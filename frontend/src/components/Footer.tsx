import { Link } from 'react-router-dom'
import HandsomeDan, { PORTRAIT_CREDIT } from './HandsomeDan'

const YEAR = new Date().getFullYear()

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <HandsomeDan size={64} caption={false} />
          <div>
            <p className="brand__name">
              Campus <span className="accent">Customs</span>
            </p>
            <p className="muted">Officially licensed Yale apparel. Go Bulldogs!</p>
          </div>
        </div>
        <nav className="footer__links" aria-label="Footer">
          <Link to="/products">Shop all</Link>
          <Link to="/about">About Us</Link>
          <Link to="/login">Login</Link>
          <Link to="/create-account">Create Account</Link>
        </nav>
      </div>
      <p className="container footer__fine muted">© {YEAR} Campus Customs. Class project demo. {PORTRAIT_CREDIT}.</p>
    </footer>
  )
}
