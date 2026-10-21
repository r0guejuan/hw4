import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Scroll to the top when the route changes, like a normal page load. */
export default function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}
