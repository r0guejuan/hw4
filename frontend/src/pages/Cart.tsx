import { Link } from 'react-router-dom'
import { formatPrice } from '../api'
import { MAX_QUANTITY, useCart } from '../cart/CartContext'
import { useCartQuote } from '../cart/useCartQuote'

export default function Cart() {
  const { items, setQuantity, remove } = useCart()
  const { quote, error, loading } = useCartQuote()
  const hasProblems = quote?.lines.some((l) => l.problem) ?? false

  if (items.length === 0) {
    return (
      <div className="container page cart-empty">
        <p className="eyebrow">Your cart</p>
        <h1>Your cart is empty</h1>
        <p className="muted">Find something Bulldog blue, then come back here to check out.</p>
        <div className="about-cta">
          <Link to="/products" className="btn btn--primary">
            Shop products
          </Link>
          <Link to="/store" className="btn btn--ghost">
            Browse the virtual store
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container page">
      <p className="eyebrow">Your cart</p>
      <h1>
        Shopping cart{' '}
        {quote && (
          <span className="cart__count">
            {quote.item_count} {quote.item_count === 1 ? 'item' : 'items'}
          </span>
        )}
      </h1>

      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      <div className="cart">
        <ul className="cart__lines" aria-busy={loading}>
          {(quote?.lines ?? []).map((line) => {
            const max = Math.max(1, Math.min(MAX_QUANTITY, line.available))
            return (
              <li key={`${line.product_id}:${line.size}`} className="cart-line">
                <Link to={`/products/${line.product_id}`} className="cart-line__image">
                  <img src={line.image_url} alt="" />
                </Link>
                <div className="cart-line__info">
                  <Link to={`/products/${line.product_id}`} className="cart-line__name">
                    {line.name}
                  </Link>
                  <p className="muted cart-line__meta">
                    Size {line.size} · {formatPrice(line.unit_price)} each
                  </p>
                  {line.problem && <p className="cart-line__problem">{line.problem}</p>}
                  <div className="cart-line__actions">
                    <div className="stepper" role="group" aria-label={`Quantity of ${line.name}`}>
                      <button
                        type="button"
                        aria-label="One fewer"
                        disabled={line.quantity <= 1}
                        onClick={() => setQuantity(line.product_id, line.size, line.quantity - 1)}
                      >
                        −
                      </button>
                      <span aria-live="polite">{line.quantity}</span>
                      <button
                        type="button"
                        aria-label="One more"
                        disabled={line.quantity >= max}
                        onClick={() => setQuantity(line.product_id, line.size, line.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <button type="button" className="link-button" onClick={() => remove(line.product_id, line.size)}>
                      Remove
                    </button>
                  </div>
                </div>
                <p className="cart-line__total">{formatPrice(line.line_total)}</p>
              </li>
            )
          })}
        </ul>

        <aside className="summary" aria-live="polite">
          <h2>Order summary</h2>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{quote ? formatPrice(quote.subtotal) : '…'}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>Free</dd>
            </div>
            <div>
              <dt>Estimated tax</dt>
              <dd className="muted">At checkout</dd>
            </div>
            <div className="summary__total">
              <dt>Total</dt>
              <dd>{quote ? formatPrice(quote.total) : '…'}</dd>
            </div>
          </dl>
          <p className="muted summary__note">Tax is estimated from your delivery address on the next step.</p>
          {hasProblems && <p className="notice notice--error">Some sizes changed. Adjust the items marked above to continue.</p>}
          {hasProblems || !quote ? (
            <button className="btn btn--primary btn--block" disabled>
              Check out
            </button>
          ) : (
            <Link to="/checkout" className="btn btn--primary btn--block">
              Check out
            </Link>
          )}
          <Link to="/products" className="link-arrow summary__continue">
            ← Keep shopping
          </Link>
        </aside>
      </div>
    </div>
  )
}
