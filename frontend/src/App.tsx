import { lazy, Suspense } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import ChatWidget from './components/ChatWidget'
import Footer from './components/Footer'
import NavBar from './components/NavBar'
import ScrollToTop from './components/ScrollToTop'
import WelcomeSplash from './components/WelcomeSplash'
import About from './pages/About'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import CreateAccount from './pages/CreateAccount'
import Home from './pages/Home'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import ProductDetail from './pages/ProductDetail'
import Products from './pages/Products'

// The 3D store pulls in three.js, so it's only downloaded when someone visits it.
const VirtualStore = lazy(() => import('./store/VirtualStore'))

export default function App() {
  const { user } = useAuth()
  const inStore = useLocation().pathname === '/store'
  return (
    <div className={`app ${inStore ? 'app--store' : ''}`}>
      <ScrollToTop />
      <WelcomeSplash />
      <NavBar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:productId" element={<ProductDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/login" element={<Login />} />
          <Route path="/create-account" element={<CreateAccount />} />
          <Route
            path="/store"
            element={
              <Suspense fallback={<div className="container page muted">Opening the store…</div>}>
                <VirtualStore />
              </Suspense>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!inStore && <Footer />}
      {/* Keyed by user so logging in or out swaps between saved and guest chats. */}
      {user !== undefined && <ChatWidget key={user?.id ?? 'guest'} />}
    </div>
  )
}
