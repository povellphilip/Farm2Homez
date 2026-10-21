import { Apple, Carrot, Coffee, Egg, Hexagon, Sprout, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { ProductImage } from '@/api/types';
import { cn } from '@/lib/cn';

const CATEGORY_STYLE: Record<string, { icon: LucideIcon; tint: string; ink: string }> = {
  fruits: { icon: Apple, tint: 'bg-[#F3E2D3]', ink: 'text-terracotta-600' },
  vegetables: { icon: Carrot, tint: 'bg-sage-100', ink: 'text-forest-600' },
  'plantation-crops': { icon: Coffee, tint: 'bg-[#E9DFD2]', ink: 'text-[#6B4A2E]' },
  'honey-bee-products': { icon: Hexagon, tint: 'bg-[#F6E8C4]', ink: 'text-[#8A5A07]' },
  'livestock-products': { icon: Egg, tint: 'bg-ivory-200', ink: 'text-charcoal-600' },
};

export function categoryStyle(slug?: string | null) {
  return (slug && CATEGORY_STYLE[slug]) || { icon: Sprout, tint: 'bg-sage-100', ink: 'text-forest-600' };
}

export function CategoryIcon({ slug, className }: { slug?: string | null; className?: string }) {
  const { icon: Icon } = categoryStyle(slug);
  return <Icon className={className} aria-hidden="true" />;
}

interface ProductPhotoProps {
  image?: ProductImage | null;
  alt: string;
  categorySlug?: string | null;
  className?: string;
  sizes?: string;
  eager?: boolean;
}

/** Product photo with a quiet category-tinted fallback when a listing has no (or a broken) image. */
export function ProductPhoto({ image, alt, categorySlug, className, eager }: ProductPhotoProps) {
  const [failed, setFailed] = useState(false);
  const style = categoryStyle(categorySlug);
  if (!image || failed) {
    const Icon = style.icon;
    return (
      <div className={cn('grid place-items-center', style.tint, className)} role="img" aria-label={`${alt} (no photo yet)`}>
        <Icon className={cn('h-10 w-10 opacity-70', style.ink)} strokeWidth={1.4} aria-hidden="true" />
      </div>
    );
  }
  return (
    <img
      src={image.url}
      alt={image.alt_text || alt}
      width={image.width || undefined}
      height={image.height || undefined}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  );
}
