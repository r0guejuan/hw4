export interface Product {
  product_id: string
  name: string
  garment_type: string
  category: string
  description: string
  colors: string[]
  search_tags: string[]
  image_url: string
  price: number
  color_family: string
  sizes_in_stock: string[]
}

export interface SizeStock {
  size: string
  quantity: number
}

export interface ProductDetail extends Product {
  sizes: SizeStock[]
  in_stock: boolean
}

/** A product card shown under a chat reply. Built by the backend from the database. */
export interface ProductCard {
  product_id: string
  name: string
  category: string
  price: number
  image_url: string
  short_description: string
  colors: string[]
  color_family: string
  sizes_in_stock: string[]
}

/** Products the chat asked the site to show on the Products page. */
export interface PageResults {
  title: string
  total_matches: number
  products: ProductCard[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  products?: ProductCard[]
  /** Set on the reply where Handsome Dan ended the chat for safety. */
  ended?: boolean
  /** Set when this reply also put a set of results on the Products page. */
  page?: PageResults | null
}

export type PageType = 'home' | 'products' | 'product' | 'about' | 'login' | 'create_account' | 'other'

/** Where the shopper is when they send a message, so Dan knows what "this" means. */
export interface PageContext {
  page_type: PageType
  path: string
  product_id?: string | null
  category?: string | null
  results_title?: string | null
}

export interface SavedChatMessage {
  role: 'user' | 'assistant'
  content: string
  products: ProductCard[]
  created_at: string
}

export interface ChatReply {
  reply: string
  products: ProductCard[]
  page: PageResults | null
  ended: boolean
  preferred_size?: string | null
}

export interface User {
  id: number
  first_name: string
  last_name: string
  email: string
  /** Their usual size, learned from what they ask Dan about. */
  preferred_size?: string | null
}

/* ---- Cart and checkout ---- */

/** What the browser keeps in the cart: never a price; prices come from the server. */
export interface CartItem {
  product_id: string
  size: string
  quantity: number
}

export interface CartLine {
  product_id: string
  name: string
  image_url: string
  size: string
  quantity: number
  unit_price: number
  line_total: number
  available: number
  problem: string | null
}

export interface CartQuote {
  lines: CartLine[]
  item_count: number
  subtotal: number
  tax_state: string | null
  tax_rate: number | null
  tax: number
  total: number
}

export interface Address {
  full_name: string
  line1: string
  line2?: string
  city: string
  state: string
  postal_code: string
}

export interface CardInput {
  cardholder_name: string
  number: string
  exp_month: number
  exp_year: number
  cvc: string
}

export interface OrderConfirmation extends Omit<CartQuote, 'item_count'> {
  order_id: number
  card_brand: string
  card_last4: string
  ship_to: string
}
