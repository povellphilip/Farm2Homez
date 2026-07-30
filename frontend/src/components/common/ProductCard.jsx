import { Heart, ShoppingCart, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useCart } from '../../contexts/CartContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export function ProductCard({ product, compact = false }) {
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();

  return (
    <Card className="group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-soft">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
        <button
          type="button"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-ink shadow-sm transition hover:bg-surface"
          aria-label={`Add ${product.name} to wishlist`}
        >
          <Heart className="h-4 w-4" aria-hidden="true" />
        </button>
        {product.badge ? (
          <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink shadow-sm">
            {product.badge}
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{product.category}</p>
          <span className="flex items-center gap-1 text-xs font-medium text-ink">
            <Star className="h-3.5 w-3.5 fill-ink text-ink" aria-hidden="true" />
            {product.rating}
          </span>
        </div>
        <h3 className="mt-2 min-h-12 text-base font-semibold leading-6 text-ink">
          <Link to={`/product/${product.id}`} className="hover:underline">
            {product.name}
          </Link>
        </h3>
        <p className="mt-2 min-h-10 text-sm leading-5 text-muted">{product.description}</p>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-ink">₹{product.price}</p>
            <p className="text-xs text-muted">{product.unit}</p>
          </div>
          <p className="text-xs font-medium text-emerald-700">{product.stock}</p>
        </div>
        {!compact ? (
          <div className="mt-4 grid grid-cols-[88px_1fr] gap-3">
            <select
              className="h-10 rounded-md border border-line bg-white px-2 text-sm text-ink"
              aria-label={`Quantity for ${product.name}`}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
            >
              <option value="1">Qty 1</option>
              <option value="2">Qty 2</option>
              <option value="3">Qty 3</option>
            </select>
            <Button className="gap-2 px-3" onClick={() => addItem(product, quantity)}>
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              Add
            </Button>
          </div>
        ) : (
          <Button className="mt-4 w-full gap-2 px-3" onClick={() => addItem(product, 1)}>
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            Quick add
          </Button>
        )}
      </div>
    </Card>
  );
}
