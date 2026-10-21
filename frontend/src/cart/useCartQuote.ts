import { useEffect, useState } from 'react'
import { quoteCart } from '../api'
import type { CartQuote } from '../types'
import { useCart } from './CartContext'

/** Shared hook: the cart priced by the server, re-quoted whenever the cart or state changes. */
export function useCartQuote(state?: string) {
  const { items } = useCart()
  const [result, setResult] = useState<{ key: string; quote?: CartQuote; error?: string } | null>(null)
  const key = JSON.stringify([items, state ?? ''])

  useEffect(() => {
    if (items.length === 0) return
    let cancelled = false
    quoteCart(items, state)
      .then((quote) => !cancelled && setResult({ key, quote }))
      .catch((e: Error) => !cancelled && setResult({ key, error: e.message }))
    return () => {
      cancelled = true
    }
  }, [items, state, key])

  const current = result?.key === key ? result : null
  return {
    quote: items.length === 0 ? null : (current?.quote ?? null),
    error: current?.error ?? null,
    loading: items.length > 0 && !current,
  }
}
