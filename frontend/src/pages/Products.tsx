import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchProducts } from '../api'
import { useAuth } from '../auth/AuthContext'
import { useChatResults } from '../chat/ChatResultsContext'
import { OPEN_CHAT_EVENT } from '../chat/openChat'
import ProductCard, { type CardProduct } from '../components/ProductCard'
import ProductFilters from '../components/ProductFilters'
import BackToStore from '../components/BackToStore'
import { applyFilters, readFilters, withFilter, type Filterable, type SortKey } from '../filters'
import type { Product, ProductCard as ChatCard } from '../types'

const ALL = 'All'

type Item = CardProduct & Filterable

const fromCatalogue = (p: Product): Item => ({ ...p, summary: p.description })
const fromChat = (p: ChatCard): Item => ({ ...p, summary: p.short_description })

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const { results, clearResults } = useChatResults()
  const { user } = useAuth()
  const preferredSize = user?.preferred_size ?? null

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => setError("We couldn't load the catalogue. Is the backend running on port 8000?"))
      .finally(() => setLoading(false))
  }, [])

  // Arriving with a category in the link (a Home style tile, a virtual-store display) means
  // "show me the catalogue", so earlier chat results give way. Chat results never set ?category.
  const linkedCategory = params.get('category')
  useEffect(() => {
    if (linkedCategory && results) clearResults()
  }, [linkedCategory, results, clearResults])

  // New chat results replace whatever the shopper was looking at; bring them into view.
  useEffect(() => {
    if (results) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [results])

  // The items being browsed: Dan's results from the chat, or the whole catalogue.
  const items: Item[] = useMemo(
    () => (results ? results.products.map(fromChat) : products.map(fromCatalogue)),
    [results, products],
  )
  const sortOptions: SortKey[] = results
    ? ['relevance', 'price-asc', 'price-desc', 'name-asc', 'name-desc']
    : ['name-asc', 'name-desc', 'price-asc', 'price-desc']
  const filters = readFilters(params, preferredSize, results ? 'relevance' : 'name-asc')
  const visible = applyFilters([...items], filters)

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    items.forEach((p) => counts.set(p.category, (counts.get(p.category) ?? 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [items])

  const colorOptions = useMemo(() => {
    const counts = new Map<string, number>()
    items.forEach((p) => p.color_family !== 'Unknown' && counts.set(p.color_family, (counts.get(p.color_family) ?? 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
  }, [items])

  const priceBounds = useMemo(() => {
    const prices = items.map((p) => p.price)
    return prices.length ? { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) } : { min: 0, max: 100 }
  }, [items])

  // Build each change from the live address bar. React Router re-renders asynchronously, so its
  // `params` can lag behind a click made a moment earlier; starting from that stale copy would
  // silently undo the previous filter.
  const change = (changes: Record<string, string | string[] | number | boolean | null>) => {
    let next = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries(changes)) next = withFilter(next, key, value)
    setParams(next, { replace: true })
  }
  // Clearing keeps the category but turns off every other filter, including the usual-size default.
  const clearFilters = () => setParams(filters.category ? { category: filters.category, sizes: '' } : { sizes: '' })
  const chooseCategory = (category: string) => {
    if (results) clearResults()
    change({ category: category === ALL ? null : category })
  }

  // On every card, show whether the shopper's usual size is available.
  const badgeFor = (p: Item) =>
    preferredSize ? { size: preferredSize, inStock: p.sizes_in_stock.includes(preferredSize) } : undefined

  const grid = (
    <div className="product-grid" key={results?.title ?? 'catalogue'}>
      {visible.map((p) => (
        <ProductCard key={p.product_id} product={p} sizeBadge={badgeFor(p)} />
      ))}
    </div>
  )

  const empty = (
    <div className="empty-state">
      <p>No products match these filters.</p>
      <button className="btn btn--ghost btn--sm" onClick={clearFilters}>
        Clear filters
      </button>
    </div>
  )

  const countText = `${visible.length} of ${items.length} ${items.length === 1 ? 'item' : 'items'}`

  return (
    <div className="container page">
      {results ? (
        <section className="dan-results" aria-labelledby="dan-results-title" aria-live="polite">
          <div className="page__head">
            <div>
              <p className="eyebrow">Handsome Dan found</p>
              <h1 id="dan-results-title">{results.title}</h1>
            </div>
            <p className="muted">
              {results.products.length < results.total_matches
                ? `Showing ${results.products.length} of ${results.total_matches} matches`
                : countText}
            </p>
          </div>
          <div className="dan-results__bar">
            <span className="dan-results__note">From your chat with Handsome Dan. Click any card for full details.</span>
            <div className="dan-results__actions">
              <BackToStore />
              <button className="btn btn--ghost btn--sm" onClick={() => window.dispatchEvent(new Event(OPEN_CHAT_EVENT))}>
                Refine in chat
              </button>
              <button className="btn btn--primary btn--sm" onClick={() => chooseCategory(ALL)}>
                Show all products
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="page__head">
            <div>
              <p className="eyebrow">The collection</p>
              <h1>Products</h1>
            </div>
            <div className="page__head-side">
              <BackToStore />
              {!loading && !error && <p className="muted">{countText}</p>}
            </div>
          </div>

          {categories.length > 0 && (
            <div className="chips" role="group" aria-label="Filter by style">
              {[[ALL, items.length] as [string, number], ...categories].map(([name, count]) => {
                const active = (filters.category ?? ALL) === name
                return (
                  <button
                    key={name}
                    className={`chip ${active ? 'is-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => chooseCategory(name)}
                  >
                    {name} <span className="chip__count">{count}</span>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      {!error && (
        <div className="shop-layout">
          <ProductFilters
            filters={filters}
            colorOptions={colorOptions}
            priceBounds={priceBounds}
            sortOptions={sortOptions}
            preferredSize={preferredSize}
            onChange={change}
            onClear={clearFilters}
          />
          <div className="shop-layout__results">
            {filters.sizesFromProfile && (
              <p className="size-note">
                Showing items in stock in your usual size, <strong>{preferredSize}</strong>.{' '}
                <button className="link-button" onClick={() => change({ sizes: [] })}>
                  Show all sizes
                </button>
              </p>
            )}
            {loading && !results ? (
              <div className="product-grid" aria-busy="true" aria-label="Loading products">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="card card--skeleton" />
                ))}
              </div>
            ) : visible.length ? (
              grid
            ) : (
              empty
            )}
          </div>
        </div>
      )}
    </div>
  )
}
