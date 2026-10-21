import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProduct, formatPrice } from '../api'
import { useAuth } from '../auth/AuthContext'
import { MAX_QUANTITY, useCart } from '../cart/CartContext'
import BackToStore from '../components/BackToStore'
import { OPEN_CHAT_EVENT } from '../chat/openChat'
import type { ProductDetail as Detail, SizeStock } from '../types'

const LOW_STOCK = 5

function stockLabel({ quantity }: SizeStock) {
  if (quantity === 0) return 'Sold out'
  if (quantity <= LOW_STOCK) return `Only ${quantity} left`
  return `${quantity} in stock`
}

export default function ProductDetail() {
  const { productId = '' } = useParams()
  const { user } = useAuth()
  const preferredSize = user?.preferred_size ?? null
  const { add } = useCart()
  // The shopper's pick for this product, and what was just added (for the confirmation line).
  const [picked, setPicked] = useState<{ id: string; size: string | null; qty: number }>({ id: '', size: null, qty: 1 })
  const [added, setAdded] = useState<{ id: string; text: string } | null>(null)
  // Remember which id a result belongs to, so a stale result never shows for a new product.
  const [result, setResult] = useState<{ id: string; product?: Detail; error?: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchProduct(productId)
      .then((product) => !cancelled && setResult({ id: productId, product }))
      .catch((e: Error) => {
        if (cancelled) return
        setResult({
          id: productId,
          error: e.message === 'Not found' ? "We couldn't find that product." : "We couldn't load this product right now.",
        })
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  const current = result?.id === productId ? result : null
  const product = current?.product
  const error = current?.error

  if (error) {
    return (
      <div className="container page">
        <p className="notice notice--error" role="alert">
          {error}
        </p>
        <Link to="/products" className="link-arrow">
          ← Back to products
        </Link>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container page" aria-busy="true">
        <div className="detail">
          <div className="detail__image card--skeleton" />
          <div className="detail__info">
            <p className="muted">Loading…</p>
          </div>
        </div>
      </div>
    )
  }

  // Default to the shopper's usual size when it's in stock.
  const preferredInStock = product.sizes.some((s) => s.size === preferredSize && s.quantity > 0) ? preferredSize : null
  const choice = picked.id === productId ? picked : { id: productId, size: preferredInStock, qty: 1 }
  const chosenStock = product.sizes.find((s) => s.size === choice.size)?.quantity ?? 0
  const maxQty = Math.max(1, Math.min(MAX_QUANTITY, chosenStock))
  const pick = (size: string | null, qty = 1) => setPicked({ id: productId, size, qty })

  function addToCart() {
    if (!choice.size) return
    add(productId, choice.size, choice.qty)
    setAdded({ id: productId, text: `Added ${choice.qty} × size ${choice.size} to your cart.` })
  }

  return (
    <div className="container page">
      <div className="detail__nav">
        <BackToStore />
        <Link to="/products" className="link-arrow back-link">
          ← Back to products
        </Link>
      </div>

      <div className="detail">
        <div className="detail__image">
          <img src={product.image_url} alt={product.name} />
        </div>

        <div className="detail__info">
          <p className="eyebrow">{product.category}</p>
          <h1 className="detail__name">{product.name}</h1>
          <p className="detail__price">{formatPrice(product.price)}</p>
          <p className="detail__desc">{product.description}</p>

          <dl className="detail__meta">
            <div>
              <dt>Style</dt>
              <dd className="capitalize">{product.garment_type}</dd>
            </div>
            <div>
              <dt>Colors</dt>
              <dd>
                <ul className="tags">
                  {product.colors.map((c) => (
                    <li key={c} className="tag capitalize">
                      {c}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>

          <h2 className="detail__subhead">
            Sizes &amp; stock{' '}
            {!product.in_stock && <span className="badge badge--out">Sold out</span>}
          </h2>
          <ul className="sizes">
            {product.sizes.map((s) => (
              <li key={s.size}>
                <button
                  type="button"
                  className={`size ${s.quantity === 0 ? 'size--out' : s.quantity <= LOW_STOCK ? 'size--low' : ''} ${
                    s.size === preferredSize ? 'size--preferred' : ''
                  } ${s.size === choice.size ? 'is-picked' : ''}`}
                  aria-pressed={s.size === choice.size}
                  disabled={s.quantity === 0}
                  onClick={() => pick(s.size)}
                >
                  <span className="size__label">
                    {s.size}
                    {s.size === preferredSize && <span className="size__yours">Your size</span>}
                  </span>
                  <span className="size__stock">{stockLabel(s)}</span>
                </button>
              </li>
            ))}
          </ul>

          {product.in_stock && (
            <div className="buy">
              <div className="stepper" role="group" aria-label="Quantity">
                <button type="button" aria-label="One fewer" disabled={choice.qty <= 1} onClick={() => pick(choice.size, choice.qty - 1)}>
                  −
                </button>
                <span aria-live="polite">{choice.qty}</span>
                <button
                  type="button"
                  aria-label="One more"
                  disabled={!choice.size || choice.qty >= maxQty}
                  onClick={() => pick(choice.size, choice.qty + 1)}
                >
                  +
                </button>
              </div>
              <button type="button" className="btn btn--primary buy__add" disabled={!choice.size} onClick={addToCart}>
                {choice.size ? `Add to cart · ${formatPrice(product.price * choice.qty)}` : 'Choose a size'}
              </button>
            </div>
          )}
          {added?.id === productId && (
            <p className="notice buy__added" role="status">
              {added.text} <Link to="/cart">View cart →</Link>
            </p>
          )}

          <button className="btn btn--ghost" onClick={() => window.dispatchEvent(new Event(OPEN_CHAT_EVENT))}>
            Questions? Ask Handsome Dan
          </button>
        </div>
      </div>
    </div>
  )
}
