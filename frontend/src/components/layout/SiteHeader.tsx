import { LayoutDashboard, Menu, Search, ShoppingBasket, UserRound, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '@/api/queries/consumer';
import { PORTAL_HOME, useAuth } from '@/auth/AuthProvider';
import { cn } from '@/lib/cn';
import { Logo } from './Logo';

const NAV = [
  { to: '/products', label: 'Shop' },
  { to: '/farms', label: 'Farms' },
  { to: '/about', label: 'How it works' },
];

function SearchForm({ className, onSubmitted }: { className?: string; onSubmitted?: () => void }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('search') ?? '');

  function submit(event: FormEvent) {
    event.preventDefault();
    const term = query.trim();
    navigate(term ? `/products?search=${encodeURIComponent(term)}` : '/products');
    onSubmitted?.();
  }

  return (
    <form role="search" onSubmit={submit} className={cn('relative', className)}>
      <label htmlFor="site-search" className="sr-only">
        Search products and farms
      </label>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400" aria-hidden="true" />
      <input
        id="site-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search avocados, honey, coffee…"
        className="h-10 w-full rounded-full border border-charcoal-800/10 bg-white pl-10 pr-4 text-sm placeholder:text-charcoal-400 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/15"
      />
    </form>
  );
}

function AccountLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { user, status } = useAuth();
  const { data: cart } = useCart();

  if (status === 'loading') return <span className="h-10 w-24" aria-hidden="true" />;
  if (!user) {
    return (
      <Link to="/signin" onClick={onNavigate} className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-charcoal-800 hover:bg-sage-100">
        <UserRound className="h-4 w-4" aria-hidden="true" />
        Sign in
      </Link>
    );
  }
  if (user.role !== 'CONSUMER') {
    return (
      <Link to={PORTAL_HOME[user.role]} onClick={onNavigate} className="inline-flex h-10 items-center gap-2 rounded-full bg-forest-800 px-4 text-sm font-medium text-ivory-50 hover:bg-forest-700">
        <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
        {user.role === 'PRODUCER' ? 'Farm dashboard' : 'Admin'}
      </Link>
    );
  }
  const count = cart?.item_count ?? 0;
  return (
    <div className="flex items-center gap-1">
      <Link to="/consumer/dashboard" onClick={onNavigate} className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-charcoal-800 hover:bg-sage-100">
        <UserRound className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">{user.full_name.split(' ')[0]}</span>
      </Link>
      <Link to="/cart" onClick={onNavigate} className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-charcoal-800 hover:bg-sage-100" aria-label={`Cart, ${count} items`}>
        <ShoppingBasket className="h-5 w-5" aria-hidden="true" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-terracotta-600 px-1 text-[11px] font-semibold text-white">{count > 99 ? '99+' : count}</span>
        ) : null}
      </Link>
    </div>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-charcoal-800/[0.06] bg-ivory-50/90 backdrop-blur supports-[backdrop-filter]:bg-ivory-50/75">
      <div className="page-container flex h-16 items-center gap-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn('rounded-full px-3.5 py-2 text-sm font-medium transition-colors', isActive ? 'bg-sage-100 text-forest-800' : 'text-charcoal-600 hover:text-charcoal-900')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <SearchForm className="ml-auto hidden w-full max-w-xs lg:block" />
        <div className="ml-auto hidden md:block lg:ml-0">
          <AccountLinks />
        </div>
        <button
          type="button"
          className="ml-auto grid h-10 w-10 place-items-center rounded-full text-charcoal-800 hover:bg-sage-100 md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
      <div className="page-container pb-3 lg:hidden">
        <SearchForm />
      </div>
      {open ? (
        <div id="mobile-nav" className="border-t border-charcoal-800/[0.06] bg-ivory-50 md:hidden">
          <nav className="page-container flex flex-col gap-1 py-4" aria-label="Mobile">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className="rounded-xl px-3 py-3 text-base font-medium text-charcoal-800 hover:bg-sage-100">
                {item.label}
              </NavLink>
            ))}
            <div className="mt-2 border-t border-charcoal-800/[0.06] pt-3">
              <AccountLinks onNavigate={() => setOpen(false)} />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
