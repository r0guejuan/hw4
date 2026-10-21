import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice, placeOrder } from '../api'
import { useAuth } from '../auth/AuthContext'
import { useCart } from '../cart/CartContext'
import { useCartQuote } from '../cart/useCartQuote'
import type { Address, CartQuote, OrderConfirmation } from '../types'

const STATES: [string, string][] = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
] // prettier-ignore

/** Published processor test numbers; the server refuses anything else. */
const TEST_CARDS = [
  { label: 'Visa', number: '4242 4242 4242 4242', cvc: '123' },
  { label: 'Mastercard', number: '5555 5555 5555 4444', cvc: '123' },
  { label: 'Amex', number: '3782 822463 10005', cvc: '1234' },
]

const EMPTY_ADDRESS: Address = { full_name: '', line1: '', line2: '', city: '', state: '', postal_code: '' }

/** Group digits as they're typed: 4-6-5 for Amex, 4-4-4-4 for everything else. */
function formatCardNumber(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 19)
  if (/^3[47]/.test(digits)) return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join(' ')
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatExpiry(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits
}

function Summary({ quote, loading, title = 'Order summary' }: { quote: CartQuote | null; loading: boolean; title?: string }) {
  return (
    <aside className="summary" aria-live="polite" aria-busy={loading}>
      <h2>{title}</h2>
      <ul className="summary__lines">
        {quote?.lines.map((l) => (
          <li key={`${l.product_id}:${l.size}`}>
            <img src={l.image_url} alt="" />
            <span>
              {l.name}
              <small className="muted">
                Size {l.size} · Qty {l.quantity}
              </small>
            </span>
            <strong>{formatPrice(l.line_total)}</strong>
          </li>
        ))}
      </ul>
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
          <dt>
            Estimated tax
            {quote?.tax_state && quote.tax_rate !== null && (
              <small className="muted">
                {' '}
                ({quote.tax_state} {(quote.tax_rate * 100).toFixed(3).replace(/\.?0+$/, '')}%)
              </small>
            )}
          </dt>
          <dd>{quote?.tax_state ? formatPrice(quote.tax) : <span className="muted">Choose a state</span>}</dd>
        </div>
        <div className="summary__total">
          <dt>Total</dt>
          <dd>{quote ? formatPrice(quote.total) : '…'}</dd>
        </div>
      </dl>
      <p className="muted summary__note">Estimated from the state's base sales tax rate. Local taxes may apply.</p>
    </aside>
  )
}

function Confirmation({ order }: { order: OrderConfirmation }) {
  return (
    <div className="container page">
      <div className="confirm">
        <div className="confirm__check" aria-hidden="true">
          ✓
        </div>
        <p className="eyebrow">Order placed</p>
        <h1>Thanks! Boola Boola!</h1>
        <p className="muted">
          Order <strong>#{order.order_id}</strong> is confirmed and shipping to {order.ship_to}.
        </p>
        <p className="muted">
          Charged {formatPrice(order.total)} to {order.card_brand} ending in {order.card_last4}{' '}
          <span className="badge">Test card · no real charge</span>
        </p>
      </div>
      <div className="confirm__summary">
        <Summary quote={{ ...order, item_count: 0 }} loading={false} title="Receipt" />
      </div>
      <div className="about-cta confirm__actions">
        <Link to="/products" className="btn btn--primary">
          Keep shopping
        </Link>
        <Link to="/store" className="btn btn--ghost">
          Visit the virtual store
        </Link>
      </div>
    </div>
  )
}

export default function Checkout() {
  const { user } = useAuth()
  const { items, clear } = useCart()
  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS)
  const [cardholder, setCardholder] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [order, setOrder] = useState<OrderConfirmation | null>(null)
  const { quote, error: quoteError, loading } = useCartQuote(address.state || undefined)

  const setField = (field: keyof Address) => (e: { target: { value: string } }) =>
    setAddress((a) => ({ ...a, [field]: e.target.value }))

  if (order) return <Confirmation order={order} />

  if (items.length === 0) {
    return (
      <div className="container page cart-empty">
        <h1>Nothing to check out yet</h1>
        <p className="muted">Your cart is empty.</p>
        <Link to="/products" className="btn btn--primary">
          Shop products
        </Link>
      </div>
    )
  }

  if (user === undefined) return <div className="container page muted">Loading…</div>

  if (user === null) {
    return (
      <div className="container page auth">
        <div className="auth__card">
          <p className="eyebrow">Checkout</p>
          <h1>Log in to check out</h1>
          <p className="muted">Your cart is saved. Log in or create an account to finish your order.</p>
          <Link to="/login?next=/checkout" className="btn btn--primary btn--block">
            Log in
          </Link>
          <Link to="/create-account?next=/checkout" className="btn btn--ghost btn--block">
            Create an account
          </Link>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const [mm, yy] = expiry.split('/').map((p) => parseInt(p.trim(), 10))
    if (!mm || !yy) {
      setError('Enter the expiration date as MM / YY.')
      return
    }
    setBusy(true)
    try {
      const placed = await placeOrder(items, address, {
        cardholder_name: cardholder,
        number: cardNumber,
        exp_month: mm,
        exp_year: yy,
        cvc,
      })
      clear()
      setOrder(placed)
      window.scrollTo(0, 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place your order.')
    } finally {
      // the security code is never kept around after a submit
      setCvc('')
      setBusy(false)
    }
  }

  const hasProblems = quote?.lines.some((l) => l.problem) ?? false

  return (
    <div className="container page">
      <p className="eyebrow">Checkout</p>
      <h1>Shipping &amp; payment</h1>

      <div className="checkout">
        <form className="checkout__form" onSubmit={handleSubmit}>
          <fieldset className="checkout__section">
            <legend>Delivery address</legend>
            <label className="field">
              <span>Full name</span>
              <input autoComplete="shipping name" required maxLength={100} value={address.full_name} onChange={setField('full_name')} />
            </label>
            <label className="field">
              <span>Street address</span>
              <input autoComplete="shipping address-line1" required maxLength={120} value={address.line1} onChange={setField('line1')} />
            </label>
            <label className="field">
              <span>
                Apartment, suite, etc. <small className="muted">(optional)</small>
              </span>
              <input autoComplete="shipping address-line2" maxLength={120} value={address.line2} onChange={setField('line2')} />
            </label>
            <div className="field-row field-row--3">
              <label className="field">
                <span>City</span>
                <input autoComplete="shipping address-level2" required maxLength={80} value={address.city} onChange={setField('city')} />
              </label>
              <label className="field">
                <span>State</span>
                <select autoComplete="shipping address-level1" required value={address.state} onChange={setField('state')}>
                  <option value="">Choose…</option>
                  {STATES.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>ZIP code</span>
                <input
                  autoComplete="shipping postal-code"
                  inputMode="numeric"
                  required
                  pattern="\d{5}(-\d{4})?"
                  maxLength={10}
                  value={address.postal_code}
                  onChange={setField('postal_code')}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="checkout__section">
            <legend>Payment</legend>
            <div className="notice checkout__demo">
              <strong>Demo checkout: use a test card.</strong> Real card numbers are refused and nothing is charged.
              <div className="checkout__test-cards">
                {TEST_CARDS.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    className="chip"
                    onClick={() => {
                      setCardNumber(t.number)
                      setCvc(t.cvc)
                      if (!expiry) setExpiry(`12 / ${String((new Date().getFullYear() + 3) % 100).padStart(2, '0')}`)
                      if (!cardholder) setCardholder(address.full_name || `${user.first_name} ${user.last_name}`)
                    }}
                  >
                    Use test {t.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="field">
              <span>Name on card</span>
              <input autoComplete="cc-name" required maxLength={100} value={cardholder} onChange={(e) => setCardholder(e.target.value)} />
            </label>
            <label className="field">
              <span>Card number</span>
              <input
                autoComplete="cc-number"
                inputMode="numeric"
                required
                placeholder="4242 4242 4242 4242"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Expiration (MM / YY)</span>
                <input
                  autoComplete="cc-exp"
                  inputMode="numeric"
                  required
                  placeholder="12 / 29"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                />
              </label>
              <label className="field">
                <span>Security code</span>
                <input
                  autoComplete="cc-csc"
                  inputMode="numeric"
                  required
                  maxLength={4}
                  placeholder="123"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
              </label>
            </div>
            <p className="muted checkout__secure">
              🔒 Your card number is encrypted before it's saved. We keep only the brand, last four digits, and expiry in the
              clear, and never store the security code.
            </p>
          </fieldset>

          {(error || quoteError) && (
            <p className="notice notice--error" role="alert">
              {error ?? quoteError}
            </p>
          )}
          {hasProblems && (
            <p className="notice notice--error">
              Some items changed since you added them. <Link to="/cart">Review your cart</Link>.
            </p>
          )}

          <button type="submit" className="btn btn--primary btn--block checkout__submit" disabled={busy || hasProblems || !quote}>
            {busy ? 'Placing order…' : quote ? `Place order · ${formatPrice(quote.total)}` : 'Place order'}
          </button>
          <Link to="/cart" className="link-arrow">
            ← Back to cart
          </Link>
        </form>

        <Summary quote={quote} loading={loading} />
      </div>
    </div>
  )
}
