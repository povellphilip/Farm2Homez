import { Heart, Leaf, MapPin, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useFavoriteProducts, useToggleFavorite } from '@/api/queries/consumer';
import type { ProductList } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { cn } from '@/lib/cn';
import { money, perUnit } from '@/lib/format';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Feedback';
import { ProductPhoto } from './ProductVisuals';
import { useAddToCart } from './useAddToCart';

export function FavoriteButton({ slug, name, className }: { slug: string; name: string; className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data } = useFavoriteProducts();
  const toggle = useToggleFavorite('products');
  if (user && user.role !== 'CONSUMER') return null;
  const saved = Boolean(data?.results.some((favorite) => favorite.product.slug === slug));
  return (
    <button
      type="button"
      onClick={() => (user ? toggle.mutate({ slug, saved }) : navigate('/consumer/login'))}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from favourites` : `Save ${name} to favourites`}
      className={cn(
        'grid h-9 w-9 place-items-center rounded-full bg-white/90 text-charcoal-700 shadow-sm backdrop-blur transition hover:text-terracotta-600',
        className,
      )}
    >
      <Heart className={cn('h-4 w-4', saved && 'fill-terracotta-500 text-terracotta-500')} aria-hidden="true" />
    </button>
  );
}

export function ProductCard({ product }: { product: ProductList }) {
  const { addToCart, pendingSlug } = useAddToCart();
  const unavailable = !product.is_purchasable;
  return (
    <article className="group relative flex flex-col">
      <div className="relative overflow-hidden rounded-2xl bg-ivory-100">
        <Link to={`/products/${product.slug}`} tabIndex={-1} aria-hidden="true">
          <ProductPhoto
            image={product.primary_image}
            alt={product.name}
            categorySlug={product.category.slug}
            className={cn('aspect-[4/3] w-full transition duration-500 group-hover:scale-[1.03]', unavailable && 'opacity-70 grayscale-[30%]')}
          />
        </Link>
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {product.is_organic ? (
            <Badge tone="green" className="bg-white/90 backdrop-blur">
              <Leaf className="h-3 w-3" aria-hidden="true" />
              Organic
            </Badge>
          ) : null}
          {product.is_seasonal ? <Badge className="bg-white/90 backdrop-blur">Seasonal</Badge> : null}
        </div>
        <FavoriteButton slug={product.slug} name={product.name} className="absolute right-3 top-3 z-10" />
      </div>
      <div className="mt-3 flex flex-1 flex-col">
        <Link to={`/farms/${product.producer.slug}`} className="relative z-10 self-start text-xs font-medium text-forest-600 hover:underline">
          {product.producer.farm_name}
        </Link>
        <h3 className="mt-0.5 font-sans text-base font-semibold leading-snug text-charcoal-900">
          <Link to={`/products/${product.slug}`} className="after:absolute after:inset-0 after:content-[''] focus:outline-none">
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-charcoal-500">
          <MapPin className="h-3 w-3" aria-hidden="true" />
          {product.origin}
        </p>
        {product.min_order_quantity > 1 && !unavailable ? (
          <p className="mt-1 text-xs text-charcoal-500">Minimum order {product.min_order_quantity} {product.unit}</p>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <p className="min-w-0">
            <span className="whitespace-nowrap text-lg font-semibold text-charcoal-900">{money(product.price)}</span>{' '}
            <span className="whitespace-nowrap text-xs text-charcoal-500">{perUnit(product.unit)}</span>
          </p>
          {unavailable ? (
            <span className="text-xs font-medium text-charcoal-500">Currently unavailable</span>
          ) : (
            <button
              type="button"
              onClick={() => addToCart(product.slug, product.name, product.min_order_quantity)}
              disabled={pendingSlug === product.slug}
              className="relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1 rounded-full bg-forest-800 text-sm font-medium text-ivory-50 transition hover:bg-forest-700 disabled:opacity-60 sm:w-auto sm:pl-3 sm:pr-3.5"
              aria-label={`Add ${product.name} to basket`}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Add</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, loading, columns = 4 }: { products?: ProductList[]; loading?: boolean; columns?: 3 | 4 }) {
  const grid = cn('grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6', columns === 4 ? 'md:grid-cols-3 lg:grid-cols-4' : 'md:grid-cols-3');
  if (loading && !products) {
    return (
      <div className={grid} aria-busy="true">
        {Array.from({ length: columns * 2 }).map((_, index) => (
          <div key={index}>
            <Skeleton className="aspect-[4/3]" />
            <Skeleton className="mt-3 h-3 w-1/3" />
            <Skeleton className="mt-2 h-4 w-2/3" />
            <Skeleton className="mt-4 h-5 w-1/4" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={grid}>
      {products?.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
