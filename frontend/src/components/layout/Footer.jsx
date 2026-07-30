import { Facebook, Instagram, Linkedin } from 'lucide-react';
import { siteConfig } from '../../constants/site';

export function Footer() {
  const links = ['About', 'Delivery', 'Privacy Policy', 'Terms', 'Support'];

  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_0.8fr_0.8fr] lg:px-8">
        <div>
          <div className="flex items-center gap-3 font-semibold text-ink">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-ink text-sm text-white">F</span>
            <span>{siteConfig.name}</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
            Premium farm-fresh groceries, daily essentials, and curated organic products delivered with a clean shopping experience.
          </p>
          <div className="mt-5 flex gap-2">
            {[Instagram, Facebook, Linkedin].map((Icon) => (
              <button key={Icon.displayName || Icon.name} type="button" className="grid h-9 w-9 place-items-center rounded-md border border-line text-ink hover:bg-surface" aria-label="Social link">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">Quick links</h2>
          <div className="mt-4 grid gap-3">
            {links.map((link) => (
              <a key={link} href="#products" className="text-sm text-muted hover:text-ink">
                {link}
              </a>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">Contact</h2>
          <div className="mt-4 grid gap-3 text-sm text-muted">
            <a href={`mailto:${siteConfig.email}`} className="hover:text-ink">{siteConfig.email}</a>
            <a href={`tel:${siteConfig.phone.replace(/\s/g, '')}`} className="hover:text-ink">{siteConfig.phone}</a>
            <span>Mon-Sat, 8:00 AM-8:00 PM</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
