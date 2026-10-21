import { Link } from 'react-router-dom';
import { Logo } from './Logo';

const COLUMNS = [
  {
    title: 'Shop',
    links: [
      { to: '/categories/fruits', label: 'Fruits' },
      { to: '/categories/vegetables', label: 'Vegetables' },
      { to: '/categories/plantation-crops', label: 'Plantation crops' },
      { to: '/categories/honey-bee-products', label: 'Honey & bee products' },
      { to: '/categories/livestock-products', label: 'Livestock products' },
    ],
  },
  {
    title: 'Farm2Home',
    links: [
      { to: '/about', label: 'How it works' },
      { to: '/farms', label: 'Our farms' },
      { to: '/faq', label: 'Help & FAQ' },
      { to: '/contact', label: 'Contact us' },
    ],
  },
  {
    title: 'For farmers',
    links: [
      { to: '/producer/register', label: 'Sell on Farm2Home' },
      { to: '/producer/login', label: 'Producer sign in' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-forest-900 text-sage-200">
      <div className="page-container grid gap-12 py-14 md:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-6 text-sage-300">
            A direct line between India&apos;s small farms and your kitchen. Every producer is verified by our team before they can sell.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h2 className="font-sans text-sm font-semibold text-ivory-50">{column.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {column.links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sage-300 transition-colors hover:text-ivory-50">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="page-container flex flex-col gap-3 py-6 text-xs text-sage-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Farm2Home. Prices include applicable taxes.</p>
          <div className="flex gap-5">
            <Link to="/privacy" className="hover:text-ivory-50">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-ivory-50">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
