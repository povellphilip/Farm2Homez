import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-8 w-8', className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#1C3B2B" />
      <path d="M16 6.5c-4.8 3.4-7 7.4-6.7 11.9.2 3.8 3 6.8 6.7 7.1 3.7-.3 6.5-3.3 6.7-7.1.3-4.5-1.9-8.5-6.7-11.9Z" fill="#B7C4A8" />
      <path d="M16 12v13.5M16 17.5l3-2.6M16 21l-3-2.6" stroke="#1C3B2B" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ to = '/', className, light = false }: { to?: string; className?: string; light?: boolean }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2.5', className)} aria-label="Farm2Home home">
      <LogoMark />
      <span className={cn('font-display text-xl font-medium tracking-tight', light ? 'text-ivory-50' : 'text-charcoal-900')}>
        Farm<span className="text-terracotta-500">2</span>Home
      </span>
    </Link>
  );
}
