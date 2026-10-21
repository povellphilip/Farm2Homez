import { SlidersHorizontal, SearchX, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useCategories, useProducts, type ProductQuery } from '@/api/queries/catalog';
import { ProductGrid } from '@/components/product/ProductCard';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/format';
import { PageMeta } from '@/lib/seo';
import { NotFoundPage } from './StatusPages';

const SORTS = [
  { value: '-published_at', label: 'Newest first' },
  { value: 'price', label: 'Price: low to high' },
  { value: '-price', label: 'Price: high to low' },
  { value: 'name', label: 'Name A–Z' },
];
const PAGE_SIZE = 24;

function Filters({ params, set, categorySlug }: { params: URLSearchParams; set: (changes: Record<string, string | null>) => void; categorySlug?: string }) {
  const { data: categories } = useCategories();
  const [minPrice, setMinPrice] = useState(params.get('min_price') ?? '');
  const [maxPrice, setMaxPrice] = useState(params.get('max_price') ?? '');
  useEffect(() => {
    setMinPrice(params.get('min_price') ?? '');
    setMaxPrice(params.get('max_price') ?? '');
  }, [params]);

  function applyPrice(event: FormEvent) {
    event.preventDefault();
    set({ min_price: minPrice || null, max_price: maxPrice || null });
  }

  const toggle = (key: string) => set({ [key]: params.get(key) === 'true' ? null : 'true' });
  const active = categorySlug ?? params.get('category');

  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="text-sm font-semibold text-charcoal-900">Category</legend>
        <ul className="mt-3 space-y-1 text-sm">
          <li>
            <Link to="/products" className={cn('block rounded-lg px-2 py-1.5', !active ? 'bg-sage-100 font-medium text-forest-800' : 'text-charcoal-600 hover:text-charcoal-900')}>
              All categories
            </Link>
          </li>
          {categories?.map((category) => (
            <li key={category.slug}>
              <Link
                to={`/categories/${category.slug}`}
                className={cn(
                  'flex justify-between rounded-lg px-2 py-1.5',
                  active === category.slug ? 'bg-sage-100 font-medium text-forest-800' : 'text-charcoal-600 hover:text-charcoal-900',
                )}
              >
                {category.name}
                <span className="text-charcoal-400">{category.product_count}</span>
              </Link>
              {active && (active === category.slug || category.children.some((child) => child.slug === active)) && category.children.length ? (
                <ul className="ml-3 mt-1 space-y-0.5 border-l border-sage-200 pl-2">
                  {category.children.map((child) => (
                    <li key={child.slug}>
                      <Link
                        to={`/categories/${child.slug}`}
                        className={cn('block rounded-lg px-2 py-1', active === child.slug ? 'font-medium text-forest-800' : 'text-charcoal-500 hover:text-charcoal-900')}
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </fieldset>

      <form onSubmit={applyPrice}>
        <fieldset>
          <legend className="text-sm font-semibold text-charcoal-900">Price (₹)</legend>
          <div className="mt-3 flex items-center gap-2">
            <label className="sr-only" htmlFor="min-price">
              Minimum price
            </label>
            <input id="min-price" inputMode="numeric" placeholder="Min" value={minPrice} onChange={(event) => setMinPrice(event.target.value.replace(/[^0-9]/g, ''))} className="h-10 w-full rounded-lg border border-charcoal-800/15 bg-white px-3 text-sm" />
            <span className="text-charcoal-400" aria-hidden="true">
              –
            </span>
            <label className="sr-only" htmlFor="max-price">
              Maximum price
            </label>
            <input id="max-price" inputMode="numeric" placeholder="Max" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value.replace(/[^0-9]/g, ''))} className="h-10 w-full rounded-lg border border-charcoal-800/15 bg-white px-3 text-sm" />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="mt-3 w-full">
            Apply price
          </Button>
        </fieldset>
      </form>

      <fieldset>
        <legend className="text-sm font-semibold text-charcoal-900">Show only</legend>
        <div className="mt-3 space-y-2.5 text-sm">
          {[
            { key: 'in_stock', label: 'Available to order' },
            { key: 'organic', label: 'Organic' },
            { key: 'seasonal', label: 'Seasonal' },
          ].map((option) => (
            <label key={option.key} className="flex items-center gap-2.5 text-charcoal-700">
              <input type="checkbox" checked={params.get(option.key) === 'true'} onChange={() => toggle(option.key)} className="h-4 w-4 accent-forest-700" />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export default function CatalogPage() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { data: categories } = useCategories();
  const page = Number(params.get('page') ?? '1');

  const query: ProductQuery = {
    search: params.get('search') ?? undefined,
    category: slug ?? params.get('category') ?? undefined,
    min_price: params.get('min_price') ?? undefined,
    max_price: params.get('max_price') ?? undefined,
    in_stock: params.get('in_stock') ?? undefined,
    organic: params.get('organic') ?? undefined,
    seasonal: params.get('seasonal') ?? undefined,
    producer: params.get('producer') ?? undefined,
    ordering: params.get('ordering') ?? '-published_at',
    page: String(page),
    page_size: String(PAGE_SIZE),
  };
  const { data, isLoading, isFetching, error, refetch } = useProducts(query);

  function set(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  }

  const allCategories = categories?.flatMap((category) => [category, ...category.children.map((child) => ({ ...child, parentName: category.name }))]);
  const category = slug ? allCategories?.find((item) => item.slug === slug) : undefined;
  if (slug && categories && !category) return <NotFoundPage />;

  const search = params.get('search');
  const title = category?.name ?? (search ? `Results for “${search}”` : 'The market');
  const hasFilters = ['min_price', 'max_price', 'in_stock', 'organic', 'seasonal', 'search'].some((key) => params.get(key));

  return (
    <div className="page-container py-10">
      <PageMeta
        title={category?.name ?? (search ? `Search: ${search}` : 'Shop fresh produce')}
        description={
          category && 'description' in category && category.description
            ? category.description
            : 'Browse fresh produce, plantation crops, honey and dairy listed directly by verified Indian farms.'
        }
        noindex={Boolean(search) || hasFilters}
      />
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-charcoal-800/[0.07] pb-6">
        <div>
          <nav aria-label="Breadcrumb" className="text-sm text-charcoal-500">
            <Link to="/products" className="hover:text-charcoal-900">
              Market
            </Link>
            {category && 'parentName' in category ? <span> / {category.parentName}</span> : null}
          </nav>
          <h1 className="mt-1 text-3xl sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-charcoal-500" aria-live="polite">
            {data ? plural(data.count, 'listing') : ' '}
            {isFetching && !isLoading ? ' · updating…' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)} icon={<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}>
            Filters
          </Button>
          <label htmlFor="sort" className="sr-only">
            Sort by
          </label>
          <select id="sort" value={query.ordering} onChange={(event) => set({ ordering: event.target.value })} className="h-9 rounded-full border border-charcoal-800/15 bg-white px-3 text-sm">
            {SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {sort.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasFilters ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {search ? (
            <button type="button" onClick={() => set({ search: null })} className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-3 py-1 text-charcoal-700">
              “{search}” <X className="h-3.5 w-3.5" aria-label="Remove search" />
            </button>
          ) : null}
          <button
            type="button"
            className="text-forest-700 underline-offset-2 hover:underline"
            onClick={() => set({ min_price: null, max_price: null, in_stock: null, organic: null, seasonal: null, search: null })}
          >
            Clear all filters
          </button>
        </div>
      ) : null}

      <div className="mt-8 grid gap-10 lg:grid-cols-[14rem_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">
          <Filters params={params} set={set} categorySlug={slug} />
        </aside>

        {filtersOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
            <button type="button" className="absolute inset-0 bg-charcoal-900/40" aria-label="Close filters" onClick={() => setFiltersOpen(false)} />
            <div className="absolute inset-y-0 right-0 w-[85%] max-w-sm overflow-y-auto bg-ivory-50 p-6 shadow-lift">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl">Filters</h2>
                <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="rounded-full p-1 hover:bg-sage-100">
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <Filters params={params} set={(changes) => { set(changes); setFiltersOpen(false); }} categorySlug={slug} />
            </div>
          </div>
        ) : null}

        <div>
          {error ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : data && data.results.length === 0 ? (
            <EmptyState
              icon={<SearchX className="h-5 w-5" aria-hidden="true" />}
              title="Nothing matches yet"
              description="Try a different search or fewer filters. Farms add new harvests every week."
              action={
                <Link to="/products" className="text-sm font-medium text-forest-700 hover:underline">
                  Browse the whole market
                </Link>
              }
            />
          ) : (
            <ProductGrid products={data?.results} loading={isLoading} columns={3} />
          )}
          {data ? <Pagination page={page} count={data.count} pageSize={PAGE_SIZE} onChange={(next) => set({ page: String(next) })} /> : null}
        </div>
      </div>
    </div>
  );
}
