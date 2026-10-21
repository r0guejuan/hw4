import type {
  Address,
  CardInput,
  CartItem,
  CartQuote,
  ChatMessage,
  ChatReply,
  OrderConfirmation,
  PageContext,
  Product,
  ProductDetail,
  SavedChatMessage,
  User,
} from './types'

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'Not found' : `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export const fetchProducts = () => getJson<Product[]>('/api/products')

export const fetchProduct = (productId: string) =>
  getJson<ProductDetail>(`/api/products/${encodeURIComponent(productId)}`)

export const formatPrice = (price: number) =>
  price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const SERVER_DOWN = "Can't reach the Campus Customs server right now. Please try again in a moment."

/** Turn a FastAPI error body into one readable sentence. */
async function errorMessage(res: Response): Promise<string> {
  // The Vite proxy answers 502/503/504 (or 500 with no JSON) when the backend isn't running.
  if (res.status === 502 || res.status === 503) {
    try {
      const body = await res.clone().json()
      if (typeof body.detail === 'string') return body.detail
    } catch {
      // no JSON body: the proxy couldn't reach the backend
    }
    return SERVER_DOWN
  }
  try {
    const body = await res.json()
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail) && body.detail.length > 0) {
      return String(body.detail[0].msg).replace(/^Value error, /, '')
    }
  } catch {
    // Not JSON: when the backend is down, Vite's proxy replies with an empty 500.
    if (res.status === 500) return SERVER_DOWN
  }
  return `Something went wrong (${res.status}). Please try again.`
}

async function postJson<T>(url: string, body?: unknown, timeoutMs = 20000): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
      // Never wait forever: the request is abandoned after timeoutMs.
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new Error('That took too long to answer. Please try again.')
    }
    throw new Error(SERVER_DOWN)
  }
  if (!res.ok) throw new Error(await errorMessage(res))
  return (res.status === 204 ? undefined : await res.json()) as T
}

export interface SignupInput {
  first_name: string
  last_name: string
  email: string
  password: string
  confirm_password: string
}

export const signup = (input: SignupInput) => postJson<User>('/api/auth/signup', input)

export const login = (email: string, password: string) => postJson<User>('/api/auth/login', { email, password })

export const logout = () => postJson<void>('/api/auth/logout')

/** The logged-in user, or null when there is no valid session. */
export async function fetchCurrentUser(): Promise<User | null> {
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
  return res.ok ? ((await res.json()) as User) : null
}

// Keep in sync with MAX_CHAT_HISTORY in backend/models.py.
const MAX_CHAT_HISTORY = 20

/**
 * Send the conversation to Handsome Dan (POST /api/chat) with the page the shopper is on.
 * For logged-in shoppers the server uses their saved history and ignores earlier turns sent here.
 */
export async function sendChatMessage(history: ChatMessage[], page: PageContext): Promise<ChatMessage> {
  const messages = history.slice(-MAX_CHAT_HISTORY).map(({ role, content }) => ({ role, content }))
  // The server caps an agent run at 45s; allow a little longer before giving up here.
  const data = await postJson<ChatReply>('/api/chat', { messages, page }, 60000)
  return { role: 'assistant', content: data.reply, products: data.products, page: data.page, ended: data.ended }
}

/** The logged-in shopper's saved chat, oldest first. */
export async function fetchChatHistory(): Promise<ChatMessage[]> {
  const res = await fetch('/api/chat/history', { credentials: 'same-origin' })
  if (!res.ok) return []
  const data = (await res.json()) as { messages: SavedChatMessage[] }
  return data.messages.map((m) => ({ role: m.role, content: m.content, products: m.products }))
}

export async function clearChatHistory(): Promise<void> {
  const res = await fetch('/api/chat/history', { method: 'DELETE', credentials: 'same-origin' })
  if (!res.ok) throw new Error(await errorMessage(res))
}

export type StreamEvent =
  | { type: 'status'; text: string }
  | { type: 'delta'; text: string }
  | { type: 'reset' }
  | { type: 'final'; reply: ChatReply }
  | { type: 'error'; detail: string }

/**
 * Like sendChatMessage, but streams progress from POST /api/chat/stream (newline-delimited JSON):
 * `onEvent` gets status updates and the reply text as it arrives; the returned message is the
 * final, number-checked reply.
 */
export async function streamChatMessage(
  history: ChatMessage[],
  page: PageContext,
  onEvent: (event: StreamEvent) => void,
): Promise<ChatMessage & { preferred_size?: string | null }> {
  const messages = history.slice(-MAX_CHAT_HISTORY).map(({ role, content }) => ({ role, content }))
  let res: Response
  try {
    res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ messages, page }),
      signal: AbortSignal.timeout(60000),
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new Error('That took too long to answer. Please try again.')
    }
    throw new Error(SERVER_DOWN)
  }
  if (!res.ok || !res.body) throw new Error(await errorMessage(res))

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newline: number
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (!line) continue
      const event = JSON.parse(line) as StreamEvent
      if (event.type === 'error') throw new Error(event.detail)
      if (event.type === 'final') {
        const r = event.reply
        return { role: 'assistant', content: r.reply, products: r.products, page: r.page, ended: r.ended, preferred_size: r.preferred_size }
      }
      onEvent(event)
    }
  }
  throw new Error("The reply was cut off. Please try again.")
}

/* ---- Cart and checkout ---- */

/** Price the cart on the server (catalogue prices and stock), with tax once a state is known. */
export const quoteCart = (items: CartItem[], state?: string) =>
  postJson<CartQuote>('/api/cart/quote', { items, state: state || null })

/** Place an order with a test card. The card number is sent once and stored encrypted. */
export const placeOrder = (items: CartItem[], address: Address, card: CardInput) =>
  postJson<OrderConfirmation>('/api/checkout', { items, address, card }, 30000)
