import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CartItem } from '../types'
import { CartContext, MAX_QUANTITY, type CartState } from './CartContext'

const CART_KEY = 'campus-customs:cart'

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter(
          (i): i is CartItem => typeof i?.product_id === 'string' && typeof i?.size === 'string' && Number.isInteger(i?.quantity),
        )
      : []
  } catch {
    return []
  }
}

const clamp = (n: number) => Math.max(1, Math.min(MAX_QUANTITY, Math.round(n)))
const same = (i: CartItem, productId: string, size: string) => i.product_id === productId && i.size === size

/**
 * The shopping cart: which products, sizes, and how many. It lives in this browser
 * (localStorage) so it survives reloads and works for guests; prices and stock are always
 * looked up fresh from the server, never stored here.
 */
export default function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(load)

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items))
    } catch {
      // storage blocked: the cart still works until the page is closed
    }
  }, [items])

  // Keep tabs in sync: adding in one tab updates the badge in another.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => e.key === CART_KEY && setItems(load())
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo<CartState>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      add: (productId, size, quantity = 1) =>
        setItems((list) =>
          list.some((i) => same(i, productId, size))
            ? list.map((i) => (same(i, productId, size) ? { ...i, quantity: clamp(i.quantity + quantity) } : i))
            : [...list, { product_id: productId, size, quantity: clamp(quantity) }],
        ),
      setQuantity: (productId, size, quantity) =>
        setItems((list) => list.map((i) => (same(i, productId, size) ? { ...i, quantity: clamp(quantity) } : i))),
      remove: (productId, size) => setItems((list) => list.filter((i) => !same(i, productId, size))),
      clear: () => setItems([]),
    }),
    [items],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
