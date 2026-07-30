import { Heart, Menu, Search, ShoppingCart, UserRound, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { siteConfig } from '../../constants/site';
import { useCart } from '../../contexts/CartContext';
import { useProducts } from '../../contexts/ProductContext';

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { count } = useCart();
  const { products } = useProducts();

  const suggestions = useMemo(() => {
    if (!query.trim()) return products.slice(0, 3);
    return products
      .filter((product) => product.name.toLowerCase().includes(query.toLowerCase()) || product.category.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 4);
  }, [query]);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white">
      <nav className="mx-auto grid h-auto max-w-7xl grid-cols-[1fr_auto] gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[220px_1fr_auto] lg:items-center lg:px-8">
        <Link to="/" className="flex items-center gap-3 font-semibold text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-ink text-sm text-white">F</span>
          <span>{siteConfig.name}</span>
        </Link>

        <div className="relative order-3 col-span-2 lg:order-none lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 w-full rounded-md border border-line bg-surface pl-10 pr-4 text-sm text-ink transition focus:border-ink focus:bg-white"
            placeholder="Search fruits, dairy, grocery essentials"
            aria-label="Search products"
          />
          {query ? (
            <div className="absolute left-0 right-0 top-12 z-20 overflow-hidden rounded-lg border border-line bg-white shadow-soft">
              {suggestions.length ? (
                suggestions.map((product) => (
                  <a key={product.id} href="#products" className="flex items-center gap-3 border-b border-line px-3 py-3 last:border-b-0 hover:bg-surface">
                    <img src={product.image} alt="" className="h-10 w-10 rounded-md object-cover" />
                    <span>
                      <span className="block text-sm font-medium text-ink">{product.name}</span>
                      <span className="block text-xs text-muted">₹{product.price} · {product.category}</span>
                    </span>
                  </a>
                ))
              ) : (
                <div className="px-4 py-5 text-sm text-muted">No products found. Try fruits, dairy, or organic.</div>
              )}
            </div>
          ) : null}
        </div>

        <div className="hidden items-center justify-end gap-1 lg:flex">
          {siteConfig.nav.map((item) => (
            <a key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface hover:text-ink">
              {item.label}
            </a>
          ))}
          <Link to="/login" className="grid h-10 w-10 place-items-center rounded-md text-ink transition hover:bg-surface" aria-label="Account">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </Link>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-md text-ink transition hover:bg-surface" aria-label="Wishlist">
            <Heart className="h-5 w-5" aria-hidden="true" />
          </button>
          <Link to="/cart" className="relative grid h-10 w-10 place-items-center rounded-md text-ink transition hover:bg-surface" aria-label="Cart">
            <ShoppingCart className="h-5 w-5" aria-hidden="true" />
            {count > 0 ? (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-[10px] font-semibold text-white">{count}</span>
            ) : null}
          </Link>
        </div>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-md border border-line text-ink lg:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label="Toggle navigation"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>
      {open ? (
        <div className="border-t border-line bg-white px-4 py-3 lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-1">
            {siteConfig.nav.map((item) => (
              <a key={item.href} href={item.href} className="rounded-md px-3 py-3 text-sm font-medium text-ink" onClick={() => setOpen(false)}>
                {item.label}
              </a>
            ))}
            <Link to="/login" className="rounded-md px-3 py-3 text-sm font-medium text-ink" onClick={() => setOpen(false)}>
              Account
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
