import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useCart } from '../cart/CartContext'
import WatercolorCampus from './WatercolorCampus'

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/products', label: 'Products', end: false },
  { to: '/store', label: 'Virtual Store', end: true },
  { to: '/about', label: 'About Us', end: true },
]

export default function NavBar() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const { user, logout } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()

  async function handleLogout() {
    close()
    await logout()
    navigate('/')
  }

  return (
    <header className="nav">
      <div className="nav__art" aria-hidden="true">
        <WatercolorCampus banner />
      </div>
      <div className="nav__inner container">
        <Link to="/" className="brand" onClick={close}>
          <span className="brand__mark" aria-hidden="true">Y</span>
          <span className="brand__name">
            Campus <span className="accent">Customs</span>
          </span>
        </Link>

        <Link to="/cart" className="nav__cart" onClick={close} aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 4h2.2l2.1 10.4a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.2L20.5 8H6.1M9.5 20a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Zm8 0a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z"
            />
          </svg>
          {count > 0 && <span className="nav__cart-count">{count > 99 ? '99+' : count}</span>}
        </Link>

        <button
          className="nav__toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="nav-links"
          onClick={() => setOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav id="nav-links" className={`nav__links ${open ? 'is-open' : ''}`} aria-label="Main">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className="nav__link" onClick={close}>
              {link.label}
            </NavLink>
          ))}
          <span className="nav__divider" aria-hidden="true" />
          {user ? (
            <>
              <span className="nav__greeting">Hi, {user.first_name}</span>
              <button className="btn btn--primary btn--sm" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="nav__link" onClick={close}>
                Login
              </NavLink>
              <NavLink to="/create-account" className="btn btn--primary btn--sm" onClick={close}>
                Create Account
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
