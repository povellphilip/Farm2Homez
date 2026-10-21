import { LogOut, type LucideIcon } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { PORTAL_LOGIN, useAuth } from '@/auth/AuthProvider';
import { cn } from '@/lib/cn';
import { PageLoader } from '../ui/Feedback';
import { Logo } from './Logo';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

export function SkipLink() {
  return (
    <a href="#main" className="sr-only z-50 rounded-full bg-forest-800 px-4 py-2 text-sm text-ivory-50 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
      Skip to content
    </a>
  );
}

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <SiteHeader />
      <main id="main" className="flex-1" tabIndex={-1}>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

export interface PortalNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: ReactNode;
}

interface PortalLayoutProps {
  title: string;
  nav: PortalNavItem[];
  tone?: 'forest' | 'charcoal';
  banner?: ReactNode;
}

/** Shared shell for the producer, consumer and admin portals: sidebar on desktop, tab strip on mobile. */
export function PortalLayout({ title, nav, tone = 'forest', banner }: PortalLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const dark = tone === 'charcoal' ? 'bg-charcoal-900' : 'bg-forest-900';

  async function signOut() {
    const role = user?.role;
    await logout();
    navigate(role ? PORTAL_LOGIN[role] : '/');
  }

  return (
    <div className="min-h-screen bg-ivory-50 lg:grid lg:grid-cols-[16rem_1fr]">
      <SkipLink />
      <aside className={cn('hidden flex-col px-4 py-6 text-sage-200 lg:sticky lg:top-0 lg:flex lg:h-screen', dark)}>
        <Logo light className="px-2" />
        <p className="mt-6 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-sage-400">{title}</p>
        <nav className="mt-2 flex flex-1 flex-col gap-0.5" aria-label={title}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-white/10 text-ivory-50' : 'text-sage-300 hover:bg-white/5 hover:text-ivory-50',
                )
              }
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              {item.badge}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 px-3 pt-4">
          <p className="truncate text-sm font-medium text-ivory-50">{user?.full_name}</p>
          <p className="truncate text-xs text-sage-400">{user?.email}</p>
          <button type="button" onClick={signOut} className="mt-3 inline-flex items-center gap-2 text-sm text-sage-300 hover:text-ivory-50">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className={cn('sticky top-0 z-30 text-ivory-50 lg:hidden', dark)}>
          <div className="flex h-14 items-center justify-between px-4">
            <Logo light />
            <button type="button" onClick={signOut} className="inline-flex items-center gap-1.5 text-sm text-sage-300" aria-label="Sign out">
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label={title}>
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn('shrink-0 rounded-full px-3 py-1.5 text-sm', isActive ? 'bg-white/15 text-ivory-50' : 'text-sage-300')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>
        {banner}
        <main id="main" tabIndex={-1} className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export function PortalPageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 text-sm text-charcoal-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
