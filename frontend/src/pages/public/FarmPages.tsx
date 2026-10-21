import { BadgeCheck, Heart, MapPin, MessageCircle, Sprout } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useProducer, useProducers, useProducts } from '@/api/queries/catalog';
import { useFavoriteProducers, useToggleFavorite } from '@/api/queries/consumer';
import { toApiError } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { InquiryForm } from '@/components/forms/InquiryForm';
import { ProductGrid } from '@/components/product/ProductCard';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState, PageLoader, Skeleton } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toaster';
import { date, plural } from '@/lib/format';
import { PageMeta } from '@/lib/seo';
import { NotFoundPage } from './StatusPages';

export function FarmDirectoryPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') ?? '1');
  const [search, setSearch] = useState(params.get('search') ?? '');
  const { data, isLoading, error, refetch } = useProducers({ search: params.get('search') ?? undefined, page: String(page) });

  return (
    <div className="page-container py-12">
      <PageMeta title="Our farms" description="Meet the verified farms selling on Farm2Home, from Wayanad fruit growers to Nilgiri beekeepers." />
      <div className="max-w-2xl">
        <p className="eyebrow">Verified producers</p>
        <h1 className="mt-2 text-4xl">The farms behind your food</h1>
        <p className="mt-4 leading-7 text-charcoal-600">Every farm here has been reviewed by our team. Browse their stories and shop straight from the growers you like.</p>
      </div>
      <form
        className="mt-8 flex max-w-md gap-2"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setParams(search.trim() ? { search: search.trim() } : {});
        }}
      >
        <label htmlFor="farm-search" className="sr-only">
          Search farms
        </label>
        <input
          id="farm-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by farm, town or state"
          className="h-11 flex-1 rounded-full border border-charcoal-800/15 bg-white px-4 text-sm"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="mt-10">
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-52" />
            ))}
          </div>
        ) : data?.results.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.results.map((farm) => (
              <Link key={farm.slug} to={`/farms/${farm.slug}`} className="group flex flex-col rounded-2xl border border-charcoal-800/[0.07] bg-white p-6 shadow-card transition hover:shadow-lift">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-sage-100 font-display text-lg text-forest-800">{farm.farm_name.charAt(0)}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-forest-600">
                    <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Verified
                  </span>
                </div>
                <h2 className="mt-4 text-xl group-hover:text-forest-700">{farm.farm_name}</h2>
                <p className="mt-1 flex items-center gap-1 text-sm text-charcoal-500">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {farm.location}
                </p>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-charcoal-600">{farm.description}</p>
                <span className="mt-auto pt-5 text-sm font-medium text-forest-700">{plural(farm.product_count ?? 0, 'listing')} →</span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Sprout className="h-5 w-5" aria-hidden="true" />} title="No farms found" description="Try another town or state." />
        )}
        {data ? <Pagination page={page} count={data.count} onChange={(next) => setParams({ ...Object.fromEntries(params), page: String(next) })} /> : null}
      </div>
    </div>
  );
}

function FollowFarmButton({ slug, name }: { slug: string; name: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data } = useFavoriteProducers();
  const toggle = useToggleFavorite('producers');
  if (user && user.role !== 'CONSUMER') return null;
  const saved = Boolean(data?.results.some((favorite) => favorite.producer.slug === slug));
  return (
    <Button
      variant="secondary"
      aria-pressed={saved}
      loading={toggle.isPending}
      onClick={() => (user ? toggle.mutate({ slug, saved }) : navigate('/consumer/login'))}
      icon={<Heart className={saved ? 'h-4 w-4 fill-terracotta-500 text-terracotta-500' : 'h-4 w-4'} aria-hidden="true" />}
    >
      {saved ? `Following ${name}` : 'Follow farm'}
    </Button>
  );
}

export function FarmProfilePage() {
  const { slug } = useParams();
  const notify = useToast();
  const [askOpen, setAskOpen] = useState(false);
  const [page, setPage] = useState(1);
  const { data: farm, isLoading, error, refetch } = useProducer(slug);
  const products = useProducts({ producer: slug, page: String(page), page_size: '12' });

  if (isLoading) return <PageLoader />;
  if (error) {
    if (toApiError(error).status === 404) return <NotFoundPage />;
    return (
      <div className="page-container py-16">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }
  if (!farm) return null;

  return (
    <div>
      <PageMeta
        title={`${farm.farm_name}, ${farm.state}`}
        description={farm.description.slice(0, 160)}
        type="profile"
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Organization', name: farm.farm_name, description: farm.description, address: { '@type': 'PostalAddress', addressLocality: farm.city, addressRegion: farm.state, addressCountry: 'IN' } }}
      />
      <section className="bg-sage-50">
        <div className="page-container py-14">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700">
            <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Verified farm · selling since {date(farm.member_since)}
          </p>
          <h1 className="mt-3 text-4xl sm:text-5xl">{farm.farm_name}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-charcoal-600">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {farm.location}
          </p>
          <p className="mt-6 max-w-2xl whitespace-pre-line leading-7 text-charcoal-700">{farm.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <FollowFarmButton slug={farm.slug} name={farm.farm_name} />
            <Button variant="secondary" onClick={() => setAskOpen(true)} icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />}>
              Ask a question
            </Button>
            {farm.whatsapp_link ? (
              <a href={farm.whatsapp_link} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center rounded-full border border-forest-600/30 bg-white px-5 text-sm font-medium text-forest-700 hover:bg-forest-50">
                WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      </section>
      <section className="page-container py-14" aria-labelledby="farm-products">
        <h2 id="farm-products" className="text-2xl">
          From {farm.farm_name}
        </h2>
        <div className="mt-6">
          {products.data?.results.length === 0 ? (
            <EmptyState title="Nothing listed right now" description="This farm has no products available at the moment. Follow them to see new harvests." />
          ) : (
            <ProductGrid products={products.data?.results} loading={products.isLoading} />
          )}
          {products.data ? <Pagination page={page} count={products.data.count} pageSize={12} onChange={setPage} /> : null}
        </div>
      </section>
      <Dialog open={askOpen} onClose={() => setAskOpen(false)} title={`Message ${farm.farm_name}`} description="Your message goes to the farm, and replies come back by email.">
        <InquiryForm
          producerSlug={farm.slug}
          onSent={() => {
            setAskOpen(false);
            notify('Message sent to the farm.');
          }}
        />
      </Dialog>
    </div>
  );
}
