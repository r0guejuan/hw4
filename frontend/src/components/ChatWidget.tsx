import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, type Location } from 'react-router-dom'
import { clearChatHistory, fetchChatHistory, formatPrice, streamChatMessage } from '../api'
import { useAuth } from '../auth/AuthContext'
import type { ChatMessage, PageContext, User } from '../types'
import headsetDan from '../assets/handsome-dan-headset.webp'
import { useChatResults } from '../chat/ChatResultsContext'
import { OPEN_CHAT_EVENT } from '../chat/openChat'
import ChatText from './ChatText'
import StoreIcon from './StoreIcon'
import { markCameFromStore } from '../store/storeReturn'


function greeting(user: User | null | undefined, returning = false): ChatMessage {
  const content = !user
    ? "Woof! I'm Handsome Dan, the Campus Customs merch assistant. Ask me about hoodies, sizes, colors, or prices."
    : returning
      ? `Welcome back, ${user.first_name}. Your earlier chat is below. What can I find for you today?`
      : `Woof! Hi ${user.first_name}, I'm Handsome Dan. Ask me about hoodies, sizes, colors, or prices; I'll remember our chat for next time.`
  return { role: 'assistant', content }
}

const PAGE_TYPES: Record<string, PageContext['page_type']> = {
  '/': 'home',
  '/products': 'products',
  '/about': 'about',
  '/login': 'login',
  '/create-account': 'create_account',
}

/** Describe the current page for Dan: product id on a product page, filters on the Products page. */
function pageContext(location: Location, resultsTitle: string | null): PageContext {
  const path = location.pathname
  const product = path.match(/^\/products\/([^/]+)$/)
  if (product) return { page_type: 'product', path, product_id: decodeURIComponent(product[1]) }
  if (path === '/products') {
    return {
      page_type: 'products',
      path,
      category: new URLSearchParams(location.search).get('category'),
      results_title: resultsTitle,
    }
  }
  return { page_type: PAGE_TYPES[path] ?? 'other', path }
}

/**
 * Remounted (via `key`) whenever the logged-in user changes, so a login loads that shopper's
 * saved chat and a logout starts a fresh guest chat.
 */
const STARTERS = ['Hoodies under $70', "What's in my size?", 'Gift for a parent']

// The "Paws for a chat?" bubble next to the chat button can be dismissed for the visit.
const PUN_DISMISSED_KEY = 'campus-customs:chat-pun-dismissed'
function punDismissed(): boolean {
  try {
    return sessionStorage.getItem(PUN_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export default function ChatWidget() {
  const { user: currentUser, setPreferredSize } = useAuth()
  // The widget remounts when the logged-in user changes (see App), so the user at mount is the
  // owner of this chat; later profile updates (like a learned size) don't reload the history.
  const [user] = useState(currentUser)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() => [greeting(user)])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // While Dan works: a status line ("Checking stock…") and the reply text streamed so far.
  const [status, setStatus] = useState<string | null>(null)
  const [draftReply, setDraftReply] = useState('')
  const [sentThisVisit, setSentThisVisit] = useState(false)
  const [showPun, setShowPun] = useState(() => !punDismissed())
  // Once Dan ends a chat for safety, it stays locked until the page is reloaded.
  const ended = messages.some((m) => m.ended)
  const listRef = useRef<HTMLDivElement>(null)
  const { results, showResults } = useChatResults()
  const navigate = useNavigate()
  const location = useLocation()
  const { pathname } = location
  const inputRef = useRef<HTMLInputElement>(null)

  // Logged-in shoppers: load their saved chat from the server.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchChatHistory()
      .then((saved) => {
        if (!cancelled && saved.length > 0) setMessages([greeting(user, true), ...saved])
      })
      .catch(() => {
        // Not fatal: they can still chat; history just won't show.
      })
    return () => {
      cancelled = true
    }
  }, [user])

  async function handleClearHistory() {
    if (!window.confirm('Delete your saved chat with Handsome Dan? This cannot be undone.')) return
    try {
      await clearChatHistory()
      setMessages([greeting(user)])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't clear your chat. Please try again.")
    }
  }

  // Other parts of the page (e.g. the Home hero) can open the chat.
  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true)
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt
      if (prompt) sendRef.current(prompt)
    }
    window.addEventListener(OPEN_CHAT_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  // Lets the open-chat event (fired from other pages) send a question with the latest state.
  const sendRef = useRef<(text: string) => void>(() => {})
  useEffect(() => {
    sendRef.current = send
  })

  async function send(text: string) {
    if (!text || sending || ended) return
    const history: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(history)
    setSentThisVisit(true)
    setDraft('')
    setSending(true)
    setError(null)
    setStatus(null)
    setDraftReply('')
    try {
      const reply = await streamChatMessage(history, pageContext(location, results?.title ?? null), (event) => {
        if (event.type === 'status') setStatus(event.text)
        else if (event.type === 'delta') setDraftReply(event.text)
        else if (event.type === 'reset') setDraftReply('')
      })
      const { preferred_size, ...message } = reply
      setMessages((m) => [...m, message])
      if (user && preferred_size !== undefined) setPreferredSize(preferred_size ?? null)
      // Search results from the chat update the site: show them on the Products page.
      if (reply.page) {
        showResults(reply.page)
        // From the virtual store, remember to bring the shopper back to the same spot.
        if (pathname === '/store') markCameFromStore()
        if (pathname !== '/products') navigate('/products')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sorry, I couldn't reach the shop just now. Please try again.")
    } finally {
      setSending(false)
      setStatus(null)
      setDraftReply('')
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    send(draft.trim())
  }

  // Starter prompts show at the start of each visit (also under a returning shopper's history)
  // until they send their first message.
  const showStarters = !ended && !sending && !sentThisVisit

  return (
    <div className="chat">
      {open && (
        <section className="chat__panel" role="dialog" aria-label="Merch assistant chat">
          <header className="chat__header">
            <div className="chat__identity">
              <span className="chat__avatar">
                <img src={headsetDan} alt="" />
              </span>
              <div>
                <p className="chat__title">Ask Handsome Dan</p>
                <p className="chat__subtitle">
                  {user ? `Chatting as ${user.first_name} · saved to your account` : 'Guest chat · not saved'}
                </p>
              </div>
            </div>
            <div className="chat__header-actions">
              {user && (
                <button className="chat__clear" onClick={handleClearHistory} title="Delete your saved chat">
                  Clear
                </button>
              )}
              <button className="chat__close" aria-label="Close chat" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
          </header>

          <div className="chat__messages" ref={listRef} aria-live="polite">
            <figure className="chat__welcome">
              <img src={headsetDan} alt="Handsome Dan wearing a headset, ready to help" />
              <figcaption>Handsome Dan is on the line</figcaption>
            </figure>
            {messages.map((m, i) => (
              <div key={i} className={`chat__turn chat__turn--${m.role}`}>
                <div className={`chat__bubble chat__bubble--${m.role}`}>
                  {m.role === 'assistant' ? <ChatText text={m.content} /> : m.content}
                </div>
                {m.page && (
                  <button
                    className="chat__page-link"
                    onClick={() => {
                      showResults(m.page!)
                      navigate('/products')
                    }}
                  >
                    {m.page.total_matches} {m.page.total_matches === 1 ? 'match' : 'matches'} on the page: {m.page.title} →
                  </button>
                )}
                {m.products && m.products.length > 0 && (
                  <ul className="chat__cards" aria-label="Products Handsome Dan found">
                    {m.products.map((p) => (
                      <li key={p.product_id}>
                        <Link to={`/products/${p.product_id}`} className="chat-card">
                          <img src={p.image_url} alt="" loading="lazy" />
                          <span className="chat-card__body">
                            <span className="chat-card__name">{p.name}</span>
                            <span className="chat-card__meta">
                              {formatPrice(p.price)}
                              {' · '}
                              {p.sizes_in_stock.length > 0 ? p.sizes_in_stock.join(' ') : 'Sold out'}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {showStarters && (
              <div className="chat__starters" role="group" aria-label="Suggested questions">
                {STARTERS.map((prompt) => (
                  <button key={prompt} className="chat__starter" onClick={() => send(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            )}
            {sending &&
              (draftReply ? (
                <div className="chat__turn chat__turn--assistant">
                  <div className="chat__bubble chat__bubble--assistant chat__bubble--draft">
                    <ChatText text={draftReply} />
                  </div>
                </div>
              ) : (
                <div className="chat__pending">
                  <div className="chat__bubble chat__bubble--assistant chat__typing" aria-label="Handsome Dan is typing">
                    <span />
                    <span />
                    <span />
                  </div>
                  {status && (
                    <span className="chat__status" role="status">
                      {status}
                    </span>
                  )}
                </div>
              ))}
            {error && <p className="chat__error" role="alert">{error}</p>}
            {ended && (
              <p className="chat__ended" role="status">
                This chat has ended. Reload the page to start a new one.
              </p>
            )}
          </div>

          <form className="chat__form" onSubmit={handleSubmit}>
            <label htmlFor="chat-input" className="sr-only">
              Message
            </label>
            <input
              id="chat-input"
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={ended ? 'Chat ended' : 'Ask about merch…'}
              autoComplete="off"
              maxLength={500}
              disabled={ended}
            />
            <button type="submit" className="btn btn--primary btn--sm" disabled={!draft.trim() || sending || ended}>
              Send
            </button>
          </form>
        </section>
      )}

      {!open && pathname !== '/store' && (
        <Link to="/store" className="chat__store" aria-label="Visit the virtual storefront">
          <StoreIcon size={22} />
          <span className="chat__store-label">Stroll the virtual store</span>
        </Link>
      )}

      {!open && showPun && pathname !== '/store' && (
        <div className="chat__pun">
          <button className="chat__pun-bubble" onClick={() => setOpen(true)}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="chat__pun-paw">
              <path
                fill="currentColor"
                d="M12 13.5c-2.9 0-5.5 2.4-5.5 4.6 0 1.4 1.1 2 2.4 2 1.2 0 2-.6 3.1-.6s1.9.6 3.1.6c1.3 0 2.4-.6 2.4-2 0-2.2-2.6-4.6-5.5-4.6ZM6.2 12.4c1.2-.3 1.8-1.8 1.4-3.3S5.9 6.6 4.7 6.9 2.9 8.7 3.3 10.2s1.7 2.5 2.9 2.2Zm11.6 0c1.2.3 2.5-.7 2.9-2.2s-.2-3-1.4-3.3-2.5.7-2.9 2.2-.2 3 1.4 3.3ZM9.4 8.9c1.3 0 2.2-1.4 2.2-3.1S10.7 2.7 9.4 2.7 7.2 4.1 7.2 5.8s1 3.1 2.2 3.1Zm5.2 0c1.3 0 2.2-1.4 2.2-3.1s-1-3.1-2.2-3.1-2.2 1.4-2.2 3.1 1 3.1 2.2 3.1Z"
              />
            </svg>
            <span>
              <strong>Paws for a chat?</strong>
              <small>Ask Handsome Dan about sizes, stock &amp; gifts</small>
            </span>
          </button>
          <button
            className="chat__pun-close"
            aria-label="Hide this message"
            onClick={() => {
              setShowPun(false)
              try {
                sessionStorage.setItem(PUN_DISMISSED_KEY, '1')
              } catch {
                // storage unavailable; it just reappears next page load
              }
            }}
          >
            ×
          </button>
        </div>
      )}

      <button
        className="chat__launcher"
        aria-label={open ? 'Close merch assistant' : 'Open merch assistant'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          '×'
        ) : (
          <span className="chat__avatar chat__avatar--launcher">
            <img src={headsetDan} alt="" />
          </span>
        )}
      </button>
    </div>
  )
}
