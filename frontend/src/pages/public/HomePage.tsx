import { ArrowRight, BadgeCheck, MapPin, PackageCheck, Search, Store } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCategories, useProducers, useProducts } from '@/api/queries/catalog';
import { ProductGrid } from '@/components/product/ProductCard';
import { ButtonLink } from '@/components/ui/Button';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { plural } from '@/lib/format';
import { PageMeta, siteUrl } from '@/lib/seo';

const CATEGORY_IMAGES: Record<string, string> = {
  fruits: '/images/cat-fruits.webp',
  vegetables: '/images/cat-vegetables.webp',
  'plantation-crops': '/images/cat-plantation-crops.webp',
  'honey-bee-products': '/images/cat-honey-bee-products.webp',
  'livestock-products': '/images/cat-livestock-products.webp',
};

const STEPS = [
  {
    icon: BadgeCheck,
    title: 'Every farm is checked',
    body: 'Producers apply with their farm details. Our team reviews each one before a single listing goes live.',
  },
  {
    icon: Store,
    title: 'You buy from the grower',
    body: 'Prices are set by the farm. One basket can hold produce from several farms, each handling its own part.',
  },
  {
    icon: PackageCheck,
    title: 'Track it to your door',
    body: 'Follow each farm as it confirms, packs and ships your order. Pay on delivery, with no surprises.',
  },
];

function Hero() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    navigate(query.trim() ? `/products?search=${encodeURIComponent(query.trim())}` : '/products');
  }
  return (
    <section className="relative isolate overflow-hidden bg-forest-900">
      <img src="/images/hero-hills.webp" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-55" {...{ fetchpriority: "high" }} />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-forest-900 via-forest-900/80 to-forest-900/10" aria-hidden="true" />
      <div className="page-container py-20 sm:py-28 lg:py-36">
        <div className="max-w-2xl animate-fade-up">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sage-300">Direct from India&apos;s small farms</p>
          <h1 className="mt-5 text-4xl font-medium leading-[1.08] text-ivory-50 sm:text-6xl">
            Grown on a farm you can name, <em className="font-normal italic text-sage-200">delivered to your door.</em>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-sage-200">
            Buy fruit, vegetables, plantation crops, honey and dairy straight from verified growers in Kerala, Karnataka, Tamil Nadu and beyond.
          </p>
          <form role="search" onSubmit={submit} className="mt-9 flex max-w-lg flex-col gap-3 sm:flex-row">
            <label htmlFor="hero-search" className="sr-only">
              Search the market
            </label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400" aria-hidden="true" />
              <input
                id="hero-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try “wild honey” or “arabica”"
                className="h-12 w-full rounded-full border-0 bg-ivory-50 pl-11 pr-4 text-[15px] text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-sage-300"
              />
            </div>
            <button type="submit" className="h-12 rounded-full bg-terracotta-600 px-7 text-[15px] font-medium text-white transition hover:bg-terracotta-700">
              Search the market
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function Categories() {
  const { data, isLoading } = useCategories();
  return (
    <section className="page-container mt-20" aria-labelledby="categories-heading">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Shop by category</p>
          <h2 id="categories-heading" className="mt-2 text-3xl sm:text-4xl">
            What&apos;s growing
          </h2>
        </div>
        <Link to="/products" className="hidden items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline sm:inline-flex">
          All products <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="aspect-[4/5]" />)
          : data?.map((category) => (
              <Link
                key={category.slug}
                to={`/categories/${category.slug}`}
                className="group relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl bg-forest-800 p-4 last:col-span-2 last:aspect-[2/1] md:last:col-span-1 md:last:aspect-[4/5]"
              >
                {CATEGORY_IMAGES[category.slug] ? (
                  <img
                    src={CATEGORY_IMAGES[category.slug]}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 -z-10 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : null}
                <span className="absolute inset-0 -z-10 bg-gradient-to-t from-charcoal-900/80 via-charcoal-900/10 to-transparent" aria-hidden="true" />
                <span className="font-display text-xl leading-tight text-ivory-50">{category.name}</span>
                <span className="mt-1 text-xs text-sage-200">{plural(category.product_count ?? 0, 'listing')}</span>
              </Link>
            ))}
      </div>
    </section>
  );
}

function FreshThisWeek() {
  const { data, isLoading, error, refetch } = useProducts({ ordering: '-published_at', page_size: '8' });
  return (
    <section className="page-container mt-24" aria-labelledby="fresh-heading">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Just listed</p>
          <h2 id="fresh-heading" className="mt-2 text-3xl sm:text-4xl">
            Fresh this week
          </h2>
        </div>
        <Link to="/products?ordering=-published_at" className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline">
          See everything <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-8">{error ? <ErrorState error={error} onRetry={() => refetch()} /> : <ProductGrid products={data?.results} loading={isLoading} />}</div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="mt-24 bg-sage-50 py-20" aria-labelledby="how-heading">
      <div className="page-container grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:items-center">
        <div className="relative overflow-hidden rounded-2xl">
          <img src="/images/farm-rows.webp" alt="Rows of tea bushes on a hillside estate in Munnar, Kerala" loading="lazy" className="aspect-[4/5] w-full object-cover" />
        </div>
        <div>
          <p className="eyebrow">How Farm2Home works</p>
          <h2 id="how-heading" className="mt-2 max-w-lg text-3xl sm:text-4xl">
            Fewer hands between the field and your table
          </h2>
          <ol className="mt-10 space-y-8">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-forest-700 shadow-card">
                  <step.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-sans text-base font-semibold">
                    <span className="mr-2 text-terracotta-700">0{index + 1}</span>
                    {step.title}
                  </h3>
                  <p className="mt-1.5 max-w-md leading-7 text-charcoal-600">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <ButtonLink to="/about" variant="secondary" className="mt-10">
            Read more about how we work
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

function Farms() {
  const { data, isLoading } = useProducers({});
  const farms = data?.results.slice(0, 3);
  if (!isLoading && !farms?.length) return null;
  return (
    <section className="page-container mt-24" aria-labelledby="farms-heading">
      <p className="eyebrow">Meet the growers</p>
      <h2 id="farms-heading" className="mt-2 text-3xl sm:text-4xl">
        Farms on Farm2Home
      </h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-48" />)
          : farms?.map((farm) => (
              <Link key={farm.slug} to={`/farms/${farm.slug}`} className="group flex flex-col rounded-2xl border border-charcoal-800/[0.07] bg-white p-6 shadow-card transition hover:shadow-lift">
                <span className="flex items-center gap-1.5 text-xs font-medium text-forest-600">
                  <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                  Verified farm
                </span>
                <h3 className="mt-3 text-xl group-hover:text-forest-700">{farm.farm_name}</h3>
                <p className="mt-1 flex items-center gap-1 text-sm text-charcoal-500">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {farm.location}
                </p>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-charcoal-600">{farm.description}</p>
                <span className="mt-auto pt-4 text-sm font-medium text-forest-700">{plural(farm.product_count ?? 0, 'listing')} →</span>
              </Link>
            ))}
      </div>
    </section>
  );
}

function SellBand() {
  return (
    <section className="page-container mt-24">
      <div className="flex flex-col gap-6 rounded-3xl bg-terracotta-600 px-8 py-12 text-white sm:px-12 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2 className="text-3xl text-white sm:text-4xl">Grow something worth sharing?</h2>
          <p className="mt-3 leading-7 text-terracotta-50">
            List your produce, set your own prices and sell to customers across India. Registration is free and our team verifies every farm.
          </p>
        </div>
        <ButtonLink to="/producer/register" size="lg" className="bg-white text-terracotta-700 hover:bg-ivory-100">
          Sell on Farm2Home
        </ButtonLink>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <PageMeta
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Farm2Home',
          potentialAction: { '@type': 'SearchAction', target: siteUrl('/products?search={query}'), 'query-input': 'required name=query' },
        }}
      />
      <Hero />
      <Categories />
      <FreshThisWeek />
      <HowItWorks />
      <Farms />
      <SellBand />
    </>
  );
}
