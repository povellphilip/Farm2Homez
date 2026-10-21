import { BadgeCheck, CalendarDays, Leaf, MapPin, MessageCircle, Package, Star, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProduct, useProductReviews, useProducts, useRecordView } from '@/api/queries/catalog';
import { toApiError } from '@/api/errors';
import { InquiryForm } from '@/components/forms/InquiryForm';
import { FavoriteButton, ProductGrid } from '@/components/product/ProductCard';
import { ProductPhoto } from '@/components/product/ProductVisuals';
import { useAddToCart } from '@/components/product/useAddToCart';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ErrorState, PageLoader } from '@/components/ui/Feedback';
import { QuantityStepper } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toaster';
import { cn } from '@/lib/cn';
import { date, money, perUnit, plural } from '@/lib/format';
import { PageMeta, siteUrl } from '@/lib/seo';
import { NotFoundPage } from './StatusPages';

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn('inline-flex', className)} aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} className={cn('h-4 w-4', index < Math.round(rating) ? 'fill-terracotta-500 text-terracotta-500' : 'text-sage-300')} aria-hidden="true" />
      ))}
    </span>
  );
}

export default function ProductPage() {
  const { slug } = useParams();
  const { data: product, isLoading, error, refetch } = useProduct(slug);
  const { data: reviews } = useProductReviews(slug);
  const related = useProducts({ category: product?.category.slug, page_size: '5' });
  const recordView = useRecordView();
  const { addToCart, pending } = useAddToCart();
  const notify = useToast();
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [askOpen, setAskOpen] = useState(false);

  useEffect(() => {
    if (!product) return;
    setQuantity(product.min_order_quantity);
    setActiveImage(0);
    recordView.mutate(product.slug);
    // Record one view per product page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.slug]);

  if (isLoading) return <PageLoader />;
  if (error) {
    if (toApiError(error).status === 404) return <NotFoundPage />;
    return (
      <div className="page-container py-16">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }
  if (!product) return null;

  const images = product.images;
  const maxQuantity = Math.max(product.min_order_quantity, product.stock_quantity);
  const relatedProducts = related.data?.results.filter((item) => item.slug !== product.slug).slice(0, 4);
  const image = images[activeImage] ?? null;

  return (
    <div className="page-container py-8 sm:py-12">
      <PageMeta
        title={`${product.name} from ${product.producer.farm_name}`}
        description={`${product.description.slice(0, 150)} ${money(product.price)} ${perUnit(product.unit)}.`}
        image={images[0]?.url}
        type="product"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: product.description,
          image: images.map((img) => (img.url.startsWith('/') ? siteUrl(img.url) : img.url)),
          category: product.category.name,
          brand: { '@type': 'Brand', name: product.producer.farm_name },
          offers: {
            '@type': 'Offer',
            price: product.price,
            priceCurrency: product.currency,
            availability: product.is_purchasable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            url: siteUrl(`/products/${product.slug}`),
          },
          ...(product.review_count && product.average_rating
            ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.average_rating, reviewCount: product.review_count } }
            : {}),
        }}
      />

      <nav aria-label="Breadcrumb" className="text-sm text-charcoal-500">
        <Link to="/products" className="hover:text-charcoal-900">
          Market
        </Link>{' '}
        /{' '}
        <Link to={`/categories/${product.category.slug}`} className="hover:text-charcoal-900">
          {product.category.name}
        </Link>
        {product.subcategory ? (
          <>
            {' '}
            /{' '}
            <Link to={`/categories/${product.subcategory.slug}`} className="hover:text-charcoal-900">
              {product.subcategory.name}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
        <div>
          <div className="relative overflow-hidden rounded-2xl bg-ivory-100">
            <ProductPhoto image={image} alt={product.name} categorySlug={product.category.slug} className="aspect-[4/3] w-full" eager />
            <FavoriteButton slug={product.slug} name={product.name} className="absolute right-4 top-4" />
          </div>
          {images.length > 1 ? (
            <div className="mt-3 grid grid-cols-5 gap-2" role="group" aria-label="Product photos">
              {images.map((img, index) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  aria-label={`Show photo ${index + 1}`}
                  aria-pressed={index === activeImage}
                  className={cn('overflow-hidden rounded-xl ring-2 ring-offset-2 ring-offset-ivory-50', index === activeImage ? 'ring-forest-600' : 'ring-transparent')}
                >
                  <img src={img.url} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <Link to={`/farms/${product.producer.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline">
            <BadgeCheck className="h-4 w-4" aria-hidden="true" />
            {product.producer.farm_name}
          </Link>
          <h1 className="mt-2 text-4xl leading-tight">{product.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {product.is_organic ? (
              <Badge tone="green">
                <Leaf className="h-3 w-3" aria-hidden="true" /> Organic
              </Badge>
            ) : null}
            {product.is_seasonal ? <Badge>Seasonal</Badge> : null}
            {product.review_count && product.average_rating ? (
              <a href="#reviews" className="inline-flex items-center gap-1.5 text-sm text-charcoal-600">
                <Stars rating={product.average_rating} /> {plural(product.review_count, 'review')}
              </a>
            ) : null}
          </div>

          <p className="mt-6">
            <span className="font-display text-4xl text-charcoal-900">{money(product.price)}</span>
            <span className="ml-2 text-charcoal-500">{perUnit(product.unit)}</span>
          </p>

          {product.is_purchasable ? (
            <div className="mt-6 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <QuantityStepper
                  label={`Quantity in ${product.unit}`}
                  value={quantity}
                  min={product.min_order_quantity}
                  max={maxQuantity}
                  onChange={setQuantity}
                />
                <Button size="lg" loading={pending} onClick={() => addToCart(product.slug, product.name, quantity)}>
                  Add to basket · {money(Number(product.price) * quantity)}
                </Button>
              </div>
              <p className="text-sm text-charcoal-500">
                {product.stock_quantity} {product.unit} available
                {product.min_order_quantity > 1 ? ` · minimum order ${product.min_order_quantity} ${product.unit}` : ''}
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-charcoal-800/10 bg-ivory-100 px-4 py-3 text-sm text-charcoal-700">
              {product.in_season ? 'This item is currently unavailable.' : 'Out of season right now.'} Save it to your favourites or ask the farm when it&apos;s back.
            </div>
          )}

          <p className="mt-8 whitespace-pre-line leading-7 text-charcoal-700">{product.description}</p>

          <dl className="mt-8 divide-y divide-charcoal-800/[0.07] border-y border-charcoal-800/[0.07] text-sm">
            <div className="flex gap-3 py-3">
              <dt className="flex w-36 shrink-0 items-center gap-2 text-charcoal-500">
                <MapPin className="h-4 w-4" aria-hidden="true" /> Origin
              </dt>
              <dd>{product.origin}</dd>
            </div>
            {product.harvest_info ? (
              <div className="flex gap-3 py-3">
                <dt className="flex w-36 shrink-0 items-center gap-2 text-charcoal-500">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" /> Harvest
                </dt>
                <dd>{product.harvest_info}</dd>
              </div>
            ) : null}
            {product.available_from || product.available_until ? (
              <div className="flex gap-3 py-3">
                <dt className="flex w-36 shrink-0 items-center gap-2 text-charcoal-500">
                  <Package className="h-4 w-4" aria-hidden="true" /> Available
                </dt>
                <dd>
                  {product.available_from ? date(product.available_from) : 'Now'} – {product.available_until ? date(product.available_until) : 'ongoing'}
                </dd>
              </div>
            ) : null}
            <div className="flex gap-3 py-3">
              <dt className="flex w-36 shrink-0 items-center gap-2 text-charcoal-500">
                <Truck className="h-4 w-4" aria-hidden="true" /> Delivery
              </dt>
              <dd>Shipped by the farm. Free on farm orders over ₹500, otherwise ₹49 per farm.</dd>
            </div>
          </dl>

          <div className="mt-8 rounded-2xl bg-sage-50 p-5">
            <p className="text-sm font-semibold text-charcoal-900">About {product.producer.farm_name}</p>
            <p className="mt-1 line-clamp-3 text-sm leading-6 text-charcoal-600">{product.producer.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setAskOpen(true)} icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />}>
                Ask the farm
              </Button>
              {product.producer.whatsapp_link ? (
                <a href={product.producer.whatsapp_link} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-full border border-forest-600/30 bg-white px-4 text-sm font-medium text-forest-700 hover:bg-forest-50">
                  WhatsApp the farm
                </a>
              ) : null}
              <Link to={`/farms/${product.producer.slug}`} className="inline-flex h-9 items-center px-2 text-sm font-medium text-forest-700 hover:underline">
                Visit farm page →
              </Link>
            </div>
          </div>
        </div>
      </div>

      <section id="reviews" className="mt-20 max-w-3xl" aria-labelledby="reviews-heading">
        <h2 id="reviews-heading" className="text-2xl">
          Reviews
        </h2>
        {reviews?.results.length ? (
          <ul className="mt-6 space-y-6">
            {reviews.results.map((review) => (
              <li key={review.id} className="border-b border-charcoal-800/[0.07] pb-6">
                <div className="flex items-center gap-3">
                  <Stars rating={review.rating} />
                  <span className="text-sm font-medium">{review.reviewer}</span>
                  <span className="text-sm text-charcoal-400">{date(review.created_at)}</span>
                </div>
                {review.comment ? <p className="mt-2 leading-7 text-charcoal-700">{review.comment}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-charcoal-500">No reviews yet. Customers can review a product once it has been delivered to them.</p>
        )}
      </section>

      {relatedProducts?.length ? (
        <section className="mt-20" aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-2xl">
            More {product.category.name.toLowerCase()}
          </h2>
          <div className="mt-6">
            <ProductGrid products={relatedProducts} />
          </div>
        </section>
      ) : null}

      <Dialog open={askOpen} onClose={() => setAskOpen(false)} title={`Ask ${product.producer.farm_name}`} description="Questions about harvest dates, bulk orders or delivery go straight to the farm.">
        <InquiryForm
          productSlug={product.slug}
          defaultSubject={`Question about ${product.name}`}
          onSent={() => {
            setAskOpen(false);
            notify('Message sent. The farm will reply by email.');
          }}
        />
      </Dialog>
    </div>
  );
}
