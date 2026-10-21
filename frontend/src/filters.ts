/**
 * Product filtering and sorting for the Products page.
 *
 * Filters live in the URL (?category=Hoodies&color=Navy&sizes=M,L&min=40&max=70&instock=1&sort=price-asc)
 * so a filtered view can be bookmarked, shared, or reached with the Back button.
 */

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const

export type SortKey = 'relevance' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc'

export const SORT_LABELS: Record<SortKey, string> = {
  relevance: "Dan's order",
  'name-asc': 'Name: A–Z',
  'name-desc': 'Name: Z–A',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
}

/** The fields filtering needs. Catalogue products and chat results both fit. */
export interface Filterable {
  product_id: string
  name: string
  category: string
  price: number
  color_family: string
  sizes_in_stock: string[]
}

export interface Filters {
  category: string | null
  colors: string[]
  /** Sizes the shopper picked; products must have at least one of them in stock. */
  sizes: string[]
  /** True when the sizes came from the shopper's usual size rather than a choice they made. */
  sizesFromProfile: boolean
  min: number | null
  max: number | null
  inStockOnly: boolean
  sort: SortKey
}

const list = (value: string | null) => (value ? value.split(',').filter(Boolean) : [])
const num = (value: string | null) => (value !== null && value !== '' && !Number.isNaN(Number(value)) ? Number(value) : null)

/**
 * Read filters from the URL. If the shopper hasn't touched the size filter (no `sizes` param),
 * default it to their usual size.
 */
export function readFilters(params: URLSearchParams, preferredSize: string | null | undefined, defaultSort: SortKey): Filters {
  const sizesParam = params.get('sizes')
  const useProfile = sizesParam === null && !!preferredSize
  return {
    category: params.get('category'),
    colors: list(params.get('color')),
    sizes: useProfile ? [preferredSize!] : list(sizesParam),
    sizesFromProfile: useProfile,
    min: num(params.get('min')),
    max: num(params.get('max')),
    inStockOnly: params.get('instock') === '1',
    sort: (params.get('sort') as SortKey) || defaultSort,
  }
}

/** Write one filter change back to the URL params (returns a new URLSearchParams). */
export function withFilter(params: URLSearchParams, key: string, value: string | string[] | number | boolean | null) {
  const next = new URLSearchParams(params)
  if (key === 'sizes') {
    // An explicit (possibly empty) sizes param means "the shopper chose", so the usual-size
    // default no longer applies.
    next.set('sizes', (value as string[]).join(','))
    return next
  }
  const empty = value === null || value === false || value === '' || (Array.isArray(value) && value.length === 0)
  if (empty) next.delete(key)
  else next.set(key, Array.isArray(value) ? value.join(',') : value === true ? '1' : String(value))
  return next
}

export function applyFilters<T extends Filterable>(items: T[], f: Filters): T[] {
  const filtered = items.filter((p) => {
    if (f.category && p.category !== f.category) return false
    if (f.colors.length && !f.colors.includes(p.color_family)) return false
    if (f.min !== null && p.price < f.min) return false
    if (f.max !== null && p.price > f.max) return false
    if (f.sizes.length && !f.sizes.some((s) => p.sizes_in_stock.includes(s))) return false
    if (f.inStockOnly && p.sizes_in_stock.length === 0) return false
    return true
  })
  const byName = (a: T, b: T) => a.name.localeCompare(b.name)
  switch (f.sort) {
    case 'name-asc':
      return filtered.sort(byName)
    case 'name-desc':
      return filtered.sort((a, b) => byName(b, a))
    case 'price-asc':
      return filtered.sort((a, b) => a.price - b.price || byName(a, b))
    case 'price-desc':
      return filtered.sort((a, b) => b.price - a.price || byName(a, b))
    default:
      return filtered // relevance: keep the order given (Dan's ranking)
  }
}

/** How many filters are active (category and sort excluded), for the "Filters (3)" label. */
export function activeCount(f: Filters): number {
  return (
    f.colors.length +
    (f.sizes.length && !f.sizesFromProfile ? 1 : 0) +
    (f.min !== null || f.max !== null ? 1 : 0) +
    (f.inStockOnly ? 1 : 0)
  )
}
