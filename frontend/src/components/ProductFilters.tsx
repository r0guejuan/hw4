import { useState } from 'react'
import { SIZES, SORT_LABELS, activeCount, type Filters, type SortKey } from '../filters'

const SWATCHES: Record<string, string> = {
  Navy: '#1b2a4a',
  Gray: '#a7a9ad',
  Charcoal: '#4a4d52',
  Cream: '#efe6d2',
  White: '#ffffff',
  Coral: '#e98b7a',
  Blue: '#3c6fb6',
  Black: '#111111',
}

interface Props {
  filters: Filters
  colorOptions: { name: string; count: number }[]
  priceBounds: { min: number; max: number }
  sortOptions: SortKey[]
  preferredSize?: string | null
  /** Apply one or more filter changes at once (batched into a single URL update). */
  onChange: (changes: Record<string, string | string[] | number | boolean | null>) => void
  onClear: () => void
}

/** Color, size, price, in-stock, and sort controls for the Products page. */
export default function ProductFilters({
  filters,
  colorOptions,
  priceBounds,
  sortOptions,
  preferredSize,
  onChange,
  onClear,
}: Props) {
  const [open, setOpen] = useState(false)
  const count = activeCount(filters)

  const toggle = (key: 'color' | 'sizes', current: string[], value: string) =>
    onChange({ [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] })

  return (
    <aside className={`filters ${open ? 'is-open' : ''}`} aria-label="Product filters">
      <div className="filters__top">
        <button className="filters__toggle btn btn--ghost btn--sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          Filters{count ? ` (${count})` : ''}
        </button>
        <label className="filters__sort">
          <span>Sort</span>
          <select value={filters.sort} onChange={(e) => onChange({ sort: e.target.value })}>
            {sortOptions.map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="filters__body">
        <fieldset className="filters__group">
          <legend>Color</legend>
          <div className="filters__chips">
            {colorOptions.map(({ name, count: n }) => (
              <button
                key={name}
                className={`swatch-chip ${filters.colors.includes(name) ? 'is-active' : ''}`}
                aria-pressed={filters.colors.includes(name)}
                onClick={() => toggle('color', filters.colors, name)}
              >
                <span className="swatch" style={{ background: SWATCHES[name] ?? 'transparent' }} aria-hidden="true" />
                {name} <span className="chip__count">{n}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="filters__group">
          <legend>
            Size in stock
            {filters.sizesFromProfile && <span className="filters__hint"> · your usual size</span>}
          </legend>
          <div className="filters__chips">
            {SIZES.map((size) => (
              <button
                key={size}
                className={`size-chip ${filters.sizes.includes(size) ? 'is-active' : ''}`}
                aria-pressed={filters.sizes.includes(size)}
                onClick={() => toggle('sizes', filters.sizes, size)}
                title={size === preferredSize ? 'Your usual size' : undefined}
              >
                {size}
                {size === preferredSize && <span className="size-chip__star" aria-label="your usual size">★</span>}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="filters__group">
          <legend>Price</legend>
          <div className="filters__price">
            <label>
              <span className="sr-only">Minimum price</span>
              <span aria-hidden="true">$</span>
              <input
                type="number"
                inputMode="numeric"
                min={priceBounds.min}
                max={priceBounds.max}
                placeholder={String(priceBounds.min)}
                value={filters.min ?? ''}
                onChange={(e) => onChange({ min: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </label>
            <span className="filters__dash">to</span>
            <label>
              <span className="sr-only">Maximum price</span>
              <span aria-hidden="true">$</span>
              <input
                type="number"
                inputMode="numeric"
                min={priceBounds.min}
                max={priceBounds.max}
                placeholder={String(priceBounds.max)}
                value={filters.max ?? ''}
                onChange={(e) => onChange({ max: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </label>
          </div>
          <div className="filters__chips filters__presets">
            {[40, 60, 75].map((cap) => (
              <button
                key={cap}
                className={`chip chip--sm ${filters.max === cap && filters.min === null ? 'is-active' : ''}`}
                onClick={() => onChange({ min: null, max: filters.max === cap ? null : cap })}
              >
                Under ${cap}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="filters__toggle-row">
          <input type="checkbox" checked={filters.inStockOnly} onChange={(e) => onChange({ instock: e.target.checked })} />
          <span>In stock only</span>
        </label>

        {(count > 0 || filters.sizesFromProfile) && (
          <button className="filters__clear" onClick={onClear}>
            Clear filters
          </button>
        )}
      </div>
    </aside>
  )
}
