import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import portrait from '../assets/handsome-dan.webp'
import StoreIcon from './StoreIcon'
import WatercolorCampus from './WatercolorCampus'

/**
 * Welcome splash: every time someone opens the site on the home page, they choose between
 * walking into the virtual storefront or browsing the classic site. It appears once per page
 * load (not again while clicking around), and deep links such as a shared product page skip it.
 */
export default function WelcomeSplash() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(() => pathname === '/')
  const storeButton = useRef<HTMLButtonElement>(null)

  const choose = (choice: 'store' | 'classic') => {
    setOpen(false)
    if (choice === 'store') navigate('/store')
  }

  useEffect(() => {
    if (!open) return
    storeButton.current?.focus({ preventScroll: true })
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') choose('classic')
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
    // choose only closes over stable values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <WatercolorCampus className="welcome__art" />
      <div className="welcome__panel">
        <img className="welcome__dan" src={portrait} alt="Handsome Dan in a Yale varsity jacket" />
        <p className="welcome__eyebrow">Welcome to</p>
        <h1 id="welcome-title" className="welcome__title">
          Campus Customs
        </h1>
        <p className="welcome__lead">Yale gear from our shop on Broadway. How would you like to shop today?</p>

        <div className="welcome__choices">
          <button ref={storeButton} type="button" className="welcome__choice welcome__choice--store" onClick={() => choose('store')}>
            <span className="welcome__badge">New</span>
            <span className="welcome__icon">
              <StoreIcon size={30} />
            </span>
            <span className="welcome__name">Virtual Storefront</span>
            <span className="welcome__desc">
              Walk up Broadway and browse the shop in 3D. Handsome Dan is waiting behind the counter.
            </span>
            <span className="welcome__go">Step inside →</span>
          </button>

          <button type="button" className="welcome__choice" onClick={() => choose('classic')}>
            <span className="welcome__icon">
              <svg viewBox="0 0 24 24" width={30} height={30} aria-hidden="true">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"
                />
              </svg>
            </span>
            <span className="welcome__name">Classic View</span>
            <span className="welcome__desc">Browse every hoodie, tee, and gift with filters, and ask Handsome Dan in the chat.</span>
            <span className="welcome__go">Start browsing →</span>
          </button>
        </div>

        <p className="welcome__note">You can switch anytime with Virtual Store in the menu.</p>
      </div>
    </div>
  )
}
