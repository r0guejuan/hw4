import { Link } from 'react-router-dom'
import { cameFromStore } from '../store/storeReturn'
import StoreIcon from './StoreIcon'

/**
 * "Back to the virtual store" — shown on product pages the shopper reached from the store
 * (via Handsome Dan or a display). The store resumes in the exact spot they left.
 */
export default function BackToStore({ className = '' }: { className?: string }) {
  if (!cameFromStore()) return null
  return (
    <Link to="/store" className={`btn btn--primary btn--sm back-to-store ${className}`}>
      <StoreIcon /> Back to the virtual store
    </Link>
  )
}
