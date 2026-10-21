import { createContext, useContext } from 'react'
import type { CartItem } from '../types'

export const MAX_QUANTITY = 10

export interface CartState {
  items: CartItem[]
  /** Total units across all lines, for the nav badge. */
  count: number
  add: (productId: string, size: string, quantity?: number) => void
  setQuantity: (productId: string, size: string, quantity: number) => void
  remove: (productId: string, size: string) => void
  clear: () => void
}

export const CartContext = createContext<CartState | null>(null)

export function useCart(): CartState {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
