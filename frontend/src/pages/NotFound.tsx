import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="container page page--narrow">
      <p className="eyebrow">404</p>
      <h1>This page went to the other Bowl.</h1>
      <p className="muted">We couldn't find what you were looking for.</p>
      <Link to="/products" className="btn btn--primary">
        Back to shopping
      </Link>
    </div>
  )
}
