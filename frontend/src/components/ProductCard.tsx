import { Link } from 'react-router-dom'
import { formatPrice } from '../api'

/** The fields a card needs. Catalogue products and chat results both fit this shape. */
export interface CardProduct {
  product_id: string
  name: string
  category: string
  price: number
  image_url: string
  /** Short info under the name (the card clamps it to two lines). */
  summary: string
}

interface Props {
  product: CardProduct
  /** Availability of the shopper's usual size, shown as a badge on the image. */
  sizeBadge?: { size: string; inStock: boolean }
}

/** A product card. Every card, wherever it came from, links to the product's detail page. */
export default function ProductCard({ product, sizeBadge }: Props) {
  return (
    <Link to={`/products/${product.product_id}`} className="card">
      <div className="card__image">
        <img src={product.image_url} alt={product.name} loading="lazy" />
        {sizeBadge && (
          <span className={`size-badge ${sizeBadge.inStock ? 'size-badge--in' : 'size-badge--out'}`}>
            {sizeBadge.size} {sizeBadge.inStock ? 'in stock' : 'sold out'}
          </span>
        )}
      </div>
      <div className="card__body">
        <p className="card__category">{product.category}</p>
        <h3 className="card__name">{product.name}</h3>
        <p className="card__desc">{product.summary}</p>
        <p className="card__price">{formatPrice(product.price)}</p>
      </div>
    </Link>
  )
}
