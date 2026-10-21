import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchProducts } from '../api'
import { OPEN_CHAT_EVENT } from '../chat/openChat'
import HandsomeDan from '../components/HandsomeDan'
import StoreIcon from '../components/StoreIcon'
import ProductCard from '../components/ProductCard'
import type { Product } from '../types'

const FEATURED_IDS = [
  'basic-hoodie-big-yale',
  '2025-yale-vs-harvard-t-shirt',
  'grace-hopper-college-crewneck',
  'brooks-brothers-bomber-jacket-yale',
]

const CATEGORIES = [
  { name: 'Hoodies', blurb: 'Your 2 a.m. problem-set uniform.' },
  { name: 'Crewnecks', blurb: 'Clean, classic, seminar-ready.' },
  { name: 'T-Shirts', blurb: 'Game day, every day.' },
  { name: 'Quarter-Zips', blurb: 'Dressed up without trying.' },
  { name: 'Jackets', blurb: 'Built for the walk up Science Hill.' },
]

export default function Home() {
  const [featured, setFeatured] = useState<Product[]>([])

  useEffect(() => {
    fetchProducts()
      .then((all) => setFeatured(all.filter((p) => FEATURED_IDS.includes(p.product_id))))
      .catch(() => setFeatured([]))
  }, [])

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div>
            <p className="eyebrow">Boola Boola · Officially licensed Yale apparel</p>
            <h1 className="hero__title">
              Wear your <span className="accent">Yale story.</span>
            </h1>
            <p className="hero__lede">
              Hoodies, crewnecks, and tees for late nights at Sterling, cold walks across Cross Campus,
              and every Saturday at the Bowl. Find your fit, check your size, and wear it home.
            </p>
            <div className="hero__actions">
              <Link to="/products" className="btn btn--primary">
                Shop the collection
              </Link>
              <button className="btn btn--ghost" onClick={() => window.dispatchEvent(new Event(OPEN_CHAT_EVENT))}>
                Ask Handsome Dan
              </button>
              <Link to="/store" className="btn btn--ghost btn--store">
                <StoreIcon /> Visit the virtual store
              </Link>
            </div>
          </div>
          <figure className="hero__cameo">
            <HandsomeDan size={300} />
            <figcaption>Handsome Dan approves.</figcaption>
          </figure>
        </div>
      </section>

      <section className="container section">
        <div className="section__head">
          <h2>Shop by style</h2>
          <Link to="/products" className="link-arrow">
            See everything →
          </Link>
        </div>
        <div className="category-grid">
          {CATEGORIES.map((c) => (
            <Link key={c.name} to={`/products?category=${encodeURIComponent(c.name)}`} className="category-tile">
              <span className="category-tile__name">{c.name}</span>
              <span className="category-tile__blurb">{c.blurb}</span>
            </Link>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="container section">
          <div className="section__head">
            <h2>Fan favorites</h2>
          </div>
          <div className="product-grid">
            {featured.map((p) => (
              <ProductCard key={p.product_id} product={{ ...p, summary: p.description }} />
            ))}
          </div>
        </section>
      )}

      <section className="container section split">
        <div className="panel">
          <p className="eyebrow">Residential colleges</p>
          <h2>Your college, your crest.</h2>
          <p className="muted">
            From Benjamin Franklin to Grace Hopper, your residential college is your home base. Wear its crest
            on a quarter-zip or crewneck and carry a little of that courtyard with you.
          </p>
          <Link to="/products?category=Quarter-Zips" className="link-arrow">
            Find your college →
          </Link>
        </div>
        <div className="panel">
          <p className="eyebrow">For the whole family</p>
          <h2>Proud parents welcome.</h2>
          <p className="muted">
            Moms, dads, siblings, and grandparents are part of the team too. Send them home from move-in or
            Commencement with something they'll actually wear.
          </p>
          <Link to="/products" className="link-arrow">
            Shop gifts →
          </Link>
        </div>
      </section>

      <section className="container section promises">
        <div>
          <h3>Officially licensed</h3>
          <p className="muted">Real Yale marks, done right, on gear made to last past graduation.</p>
        </div>
        <div>
          <h3>Honest stock</h3>
          <p className="muted">Sizes and quantities come straight from our inventory, so no surprises.</p>
        </div>
        <div>
          <h3>Help on demand</h3>
          <p className="muted">Our merch assistant can find the right piece in your size, any time.</p>
        </div>
      </section>
    </>
  )
}
