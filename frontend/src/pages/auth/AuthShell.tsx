import { BadgeCheck, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from '@/components/layout/Logo';
import { SkipLink } from '@/components/layout/Layouts';
import { cn } from '@/lib/cn';

export type Portal = 'consumer' | 'producer' | 'admin';

interface AuthShellProps {
  portal: Portal;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}

/** Visually distinct sign-in experiences per portal. */
export function AuthShell({ portal, title, subtitle, children, wide }: AuthShellProps) {
  if (portal === 'admin') {
    return (
      <div className="grid min-h-screen place-items-center bg-charcoal-900 px-4 py-12">
        <SkipLink />
        <main id="main" className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 text-sage-300">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm font-medium tracking-wide">Farm2Home administration</span>
          </div>
          <div className="rounded-2xl bg-white p-7 shadow-lift">
            <h1 className="font-sans text-xl font-semibold">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-charcoal-500">{subtitle}</p> : null}
            <div className="mt-6">{children}</div>
          </div>
          <p className="mt-6 text-center text-xs text-sage-300">Access is restricted and every sign-in is logged.</p>
        </main>
      </div>
    );
  }

  const producer = portal === 'producer';
  return (
    <div className={cn('min-h-screen lg:grid', wide ? 'lg:grid-cols-[1fr_1.4fr]' : 'lg:grid-cols-2')}>
      <SkipLink />
      <aside
        className={cn(
          'relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12',
          producer ? 'bg-forest-900 text-sage-200' : 'bg-ivory-200',
        )}
      >
        <img
          src={producer ? '/images/farm-rows.webp' : '/images/cat-fruits.webp'}
          alt=""
          className={cn('absolute inset-0 h-full w-full object-cover', producer ? 'opacity-35' : 'opacity-90')}
        />
        <div className={cn('absolute inset-0', producer ? 'bg-gradient-to-b from-forest-900/40 to-forest-900' : 'bg-gradient-to-b from-transparent via-transparent to-charcoal-900/70')} aria-hidden="true" />
        <Logo light className="relative" />
        <div className="relative max-w-sm">
          {producer ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sage-300">For farmers & producers</p>
              <p className="mt-3 font-display text-3xl leading-tight text-ivory-50">Sell what you grow, at the price you set.</p>
              <ul className="mt-6 space-y-2 text-sm">
                {['Free to register and list', 'You accept or decline every order', 'See sales and stock at a glance'].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-sage-300" aria-hidden="true" /> {item}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="font-display text-3xl leading-tight text-ivory-50">Fresh from verified farms, straight to your kitchen.</p>
          )}
        </div>
      </aside>
      <main id="main" className={cn('flex min-h-screen flex-col px-5 py-8 sm:px-10', producer ? 'bg-ivory-50' : 'bg-white')}>
        <Logo className="lg:hidden" />
        <div className={cn('my-auto w-full py-10', wide ? 'max-w-2xl' : 'max-w-md', 'mx-auto')}>
          <p className={cn('eyebrow', producer ? 'text-forest-600' : 'text-terracotta-600')}>{producer ? 'Producer portal' : 'Shopper account'}</p>
          <h1 className="mt-2 text-3xl sm:text-4xl">{title}</h1>
          {subtitle ? <div className="mt-2 text-charcoal-600">{subtitle}</div> : null}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

/** Only allow same-site relative redirects after login. */
export function safeNext(next: string | null, fallback: string) {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return fallback;
}
