import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, ClipboardList, Clock, Inbox, Package, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { applyFieldErrors, errorMessage, toApiError } from '@/api/errors';
import {
  useCloseInquiry,
  useMyProducts,
  useProducerInquiries,
  useProducerOrder,
  useProducerOrders,
  useProducerOverview,
  useProducerProfile,
  useResubmitVerification,
  useTransitionOrder,
  useUpdateProducerProfile,
} from '@/api/queries/producer';
import type { FulfillmentStatus } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { AccountSettings } from '@/components/forms/AccountSettings';
import { InquiryThread } from '@/components/forms/InquiryThread';
import { PortalPageHeader } from '@/components/layout/Layouts';
import { ProductPhoto } from '@/components/product/ProductVisuals';
import { FulfilmentBadge, ModerationBadge, ProductStatusBadge, VerificationBadge } from '@/components/ui/Badge';
import { BarChart } from '@/components/ui/BarChart';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader, Stat } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Alert, EmptyState, ErrorState, PageLoader, Skeleton } from '@/components/ui/Feedback';
import { Checkbox, TextArea, TextField } from '@/components/ui/Field';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toaster';
import { cn } from '@/lib/cn';
import { date, dateTime, FULFILMENT_LABELS, money, plural, TRANSITION_ACTIONS } from '@/lib/format';
import { PageMeta } from '@/lib/seo';
import { NotFoundPage } from '../public/StatusPages';

export function VerificationBanner() {
  const { user } = useAuth();
  const status = user?.producer?.verification_status;
  if (!status || status === 'VERIFIED') return null;
  const rejected = status === 'REJECTED';
  return (
    <div className={cn('border-b px-4 py-3 text-sm sm:px-6 lg:px-10', rejected ? 'border-terracotta-100 bg-terracotta-50 text-terracotta-700' : 'border-[#F0DDB0] bg-[#FBF1DA] text-[#5C3F0A]')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {rejected ? <AlertTriangle className="h-4 w-4" aria-hidden="true" /> : <Clock className="h-4 w-4" aria-hidden="true" />}
        <span className="font-medium">{rejected ? 'Your farm needs more information before it can be verified.' : 'Your farm is waiting for verification.'}</span>
        <span>
          {rejected ? 'Update your details and resubmit.' : 'You can prepare draft listings now; publishing unlocks once our team approves your farm.'}
        </span>
        <Link to="/producer/farm" className="font-medium underline">
          {rejected ? 'Review farm details' : 'View farm details'}
        </Link>
      </div>
    </div>
  );
}

export function ProducerDashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useProducerOverview(30);

  return (
    <div>
      <PageMeta title="Farm dashboard" noindex />
      <PortalPageHeader
        title={`Good to see you, ${user?.full_name.split(' ')[0]}`}
        description={user?.producer?.farm_name}
        actions={
          <ButtonLink to="/producer/products/new" icon={<Plus className="h-4 w-4" aria-hidden="true" />}>
            New listing
          </ButtonLink>
        }
      />
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Stat label="Sales, last 30 days" value={money(data.sales.revenue_period)} hint={`${money(data.sales.revenue_delivered)} delivered all-time`} />
            <Stat
              label="Orders awaiting you"
              value={data.orders.awaiting_action}
              hint={<Link to="/producer/orders?status=PENDING" className="font-medium text-forest-700 hover:underline">Review orders →</Link>}
            />
            <Stat label="Live listings" value={data.listings.by_status.PUBLISHED ?? 0} hint={`${data.listings.total} in total · ${data.listings.by_status.DRAFT ?? 0} drafts`} />
            <Stat label="Product views, 30 days" value={data.views.period_total} hint={`${data.inquiries.open} open ${data.inquiries.open === 1 ? 'inquiry' : 'inquiries'}`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <Card className="p-5 sm:p-6">
              <BarChart
                title="Daily sales, last 30 days (₹)"
                format={(value) => money(value)}
                data={data.sales.daily.map((point) => ({
                  label: date(point.date),
                  tick: new Date(point.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                  value: Number(point.revenue),
                  detail: plural(point.orders, 'order'),
                }))}
              />
            </Card>
            <Card>
              <CardHeader title="Best sellers" description="By revenue, excluding cancelled orders" />
              {data.sales.top_products.length ? (
                <ol className="divide-y divide-charcoal-800/[0.06]">
                  {data.sales.top_products.map((product, index) => (
                    <li key={product.product_name} className="flex items-center justify-between gap-3 px-5 py-3 text-sm sm:px-6">
                      <span>
                        <span className="mr-2 text-charcoal-400">{index + 1}</span>
                        {product.product_name}
                      </span>
                      <span className="text-right">
                        <span className="font-medium tabular-nums">{money(product.revenue)}</span>
                        <span className="block text-xs text-charcoal-500">{product.quantity} sold</span>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="px-6 py-8 text-sm text-charcoal-500">Your first sales will appear here.</p>
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Running low" description="Published listings with 5 or fewer units left" />
              {data.listings.low_stock.length ? (
                <ul className="divide-y divide-charcoal-800/[0.06]">
                  {data.listings.low_stock.map((item) => (
                    <li key={item.id} className="flex items-center justify-between px-5 py-3 text-sm sm:px-6">
                      <Link to={`/producer/products/${item.id}`} className="font-medium hover:underline">
                        {item.name}
                      </Link>
                      <span className={cn('tabular-nums', item.stock_quantity === 0 ? 'font-medium text-terracotta-700' : 'text-charcoal-600')}>
                        {item.stock_quantity} {item.unit} left
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-6 py-8 text-sm text-charcoal-500">Stock looks healthy.</p>
              )}
            </Card>
            <Card>
              <CardHeader title="Most viewed" description="Product page views, last 30 days" />
              {data.views.top_products.length ? (
                <ul className="divide-y divide-charcoal-800/[0.06]">
                  {data.views.top_products.map((item) => (
                    <li key={item.product_id} className="flex justify-between px-5 py-3 text-sm sm:px-6">
                      <span>{item.product__name}</span>
                      <span className="tabular-nums text-charcoal-600">{plural(item.views, 'view')}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-6 py-8 text-sm text-charcoal-500">No views yet. Published listings appear in the market and search.</p>
              )}
            </Card>
          </div>
          {data.listings.rejected ? (
            <Alert tone="warning" title={`${plural(data.listings.rejected, 'listing')} need changes`}>
              A moderator asked for changes. <Link to="/producer/products?moderation=REJECTED" className="font-medium underline">See which listings</Link>.
            </Alert>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'UNPUBLISHED', label: 'Unpublished' },
];

export function ProducerProductsPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const page = Number(params.get('page') ?? '1');
  const status = params.get('status') ?? '';
  const moderation = params.get('moderation');
  const { data, isLoading, error, refetch } = useMyProducts({
    status: status || undefined,
    moderation_status: moderation || undefined,
    search: params.get('search') || undefined,
    page,
  });
  const rows = data?.results;

  return (
    <div>
      <PageMeta title="Your products" noindex />
      <PortalPageHeader
        title="Products"
        description="Everything you list, including drafts."
        actions={
          <ButtonLink to="/producer/products/new" icon={<Plus className="h-4 w-4" aria-hidden="true" />}>
            New listing
          </ButtonLink>
        }
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full bg-sage-100 p-1" role="tablist" aria-label="Filter by status">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              role="tab"
              aria-selected={status === filter.value}
              onClick={() => setParams(filter.value ? { status: filter.value } : {})}
              className={cn('rounded-full px-4 py-1.5 text-sm font-medium', status === filter.value ? 'bg-white text-charcoal-900 shadow-sm' : 'text-charcoal-600')}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <form
          role="search"
          className="relative"
          onSubmit={(event) => {
            event.preventDefault();
            setParams({ ...(status ? { status } : {}), ...(search.trim() ? { search: search.trim() } : {}) });
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400" aria-hidden="true" />
          <label htmlFor="product-search" className="sr-only">
            Search your products
          </label>
          <input id="product-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your products" className="h-10 w-64 rounded-full border border-charcoal-800/15 bg-white pl-9 pr-3 text-sm" />
        </form>
      </div>
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : rows?.length ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-ivory-100 text-left text-charcoal-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-3 py-3 font-medium">Price</th>
                  <th className="px-3 py-3 font-medium">Stock</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-800/[0.06]">
                {rows.map((product) => (
                  <tr key={product.id} className="hover:bg-ivory-50">
                    <td className="px-5 py-3">
                      <Link to={`/producer/products/${product.id}`} className="flex items-center gap-3 font-medium text-charcoal-900 hover:underline">
                        <ProductPhoto image={product.images[0]} alt={product.name} categorySlug={product.category} className="h-11 w-11 shrink-0 rounded-lg" />
                        {product.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {money(product.price)} <span className="text-charcoal-500">/ {product.unit}</span>
                    </td>
                    <td className={cn('px-3 py-3 tabular-nums', product.stock_quantity < product.min_order_quantity && 'font-medium text-terracotta-700')}>{product.stock_quantity}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <ProductStatusBadge status={product.status} />
                        {product.moderation_status !== 'APPROVED' ? <ModerationBadge status={product.moderation_status} /> : null}
                        {!product.is_available ? <span className="text-xs text-charcoal-500">Paused</span> : null}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-charcoal-500">{date(product.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={<Package className="h-5 w-5" aria-hidden="true" />}
          title={status || moderation ? 'Nothing here' : 'List your first product'}
          description="Add a name, price, unit and photos. You can save a draft and publish when you're ready."
          action={<ButtonLink to="/producer/products/new">Create a listing</ButtonLink>}
        />
      )}
      {data ? <Pagination page={page} count={data.count} onChange={(next) => setParams({ ...Object.fromEntries(params), page: String(next) })} /> : null}
    </div>
  );
}

const ORDER_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'New' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PROCESSING', label: 'Preparing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
];

export function ProducerOrdersPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? '1');
  const { data, isLoading, error, refetch } = useProducerOrders({ status: status || undefined, page });

  return (
    <div>
      <PageMeta title="Orders" noindex />
      <PortalPageHeader title="Orders" description="Each order here contains only your products." />
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-full bg-sage-100 p-1 sm:w-fit" role="tablist" aria-label="Filter by status">
        {ORDER_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            role="tab"
            aria-selected={status === filter.value}
            onClick={() => setParams(filter.value ? { status: filter.value } : {})}
            className={cn('shrink-0 rounded-full px-4 py-1.5 text-sm font-medium', status === filter.value ? 'bg-white text-charcoal-900 shadow-sm' : 'text-charcoal-600')}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data?.results.length ? (
        <Card className="divide-y divide-charcoal-800/[0.06]">
          {data.results.map((order) => (
            <Link key={order.id} to={`/producer/orders/${order.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-ivory-50 sm:px-6">
              <div>
                <p className="font-medium text-charcoal-900">
                  {order.order_number} <span className="font-normal text-charcoal-500">· {order.shipping.name}, {order.shipping.city}</span>
                </p>
                <p className="text-sm text-charcoal-500">
                  {dateTime(order.created_at)} · {order.items.map((item) => `${item.quantity} ${item.unit} ${item.product_name}`).join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <FulfilmentBadge status={order.status} />
                <span className="font-semibold tabular-nums">{money(order.total)}</span>
              </div>
            </Link>
          ))}
        </Card>
      ) : (
        <EmptyState icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />} title="No orders here" description="New orders appear here and you'll get an email for each one." />
      )}
      {data ? <Pagination page={page} count={data.count} onChange={(next) => setParams({ ...Object.fromEntries(params), page: String(next) })} /> : null}
    </div>
  );
}

const NEEDS_REASON: FulfillmentStatus[] = ['REJECTED', 'CANCELLED'];

export function ProducerOrderDetailPage() {
  const { id } = useParams();
  const orderId = Number(id);
  const { data: order, isLoading, error, refetch } = useProducerOrder(orderId);
  const transition = useTransitionOrder(orderId);
  const notify = useToast();
  const [pending, setPending] = useState<FulfillmentStatus | null>(null);

  if (isLoading) return <PageLoader />;
  if (error) return toApiError(error).status === 404 ? <NotFoundPage /> : <ErrorState error={error} onRetry={() => refetch()} />;
  if (!order) return null;

  const forward = order.allowed_transitions.filter((status) => !NEEDS_REASON.includes(status));
  const voiding = order.allowed_transitions.filter((status) => NEEDS_REASON.includes(status));

  async function move(status: FulfillmentStatus, note = '') {
    try {
      await transition.mutateAsync({ status, note });
      notify(`Order marked as ${FULFILMENT_LABELS[status].toLowerCase()}.`);
      setPending(null);
    } catch (err) {
      notify(errorMessage(err), 'error');
    }
  }

  return (
    <div>
      <PageMeta title={`Order ${order.order_number}`} noindex />
      <Link to="/producer/orders" className="text-sm text-charcoal-500 hover:text-charcoal-900">
        ← All orders
      </Link>
      <PortalPageHeader title={`Order ${order.order_number}`} description={`Placed ${dateTime(order.created_at)}`} actions={<FulfilmentBadge status={order.status} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {forward.length || voiding.length ? (
            <Card className="p-5 sm:p-6">
              <h2 className="font-sans text-base font-semibold">Next step</h2>
              <p className="mt-1 text-sm text-charcoal-500">The customer is emailed every time you update the order.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {forward.map((status) => (
                  <Button key={status} loading={transition.isPending && transition.variables?.status === status} onClick={() => move(status)}>
                    {TRANSITION_ACTIONS[status]}
                  </Button>
                ))}
                {voiding.map((status) => (
                  <Button key={status} variant="danger" onClick={() => setPending(status)}>
                    {TRANSITION_ACTIONS[status]}
                  </Button>
                ))}
              </div>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Items" />
            <ul className="divide-y divide-charcoal-800/[0.06] text-sm">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
                  <span>
                    <span className="font-medium">{item.product_name}</span>
                    <span className="block text-charcoal-500">
                      {item.quantity} {item.unit} × {money(item.unit_price)}
                    </span>
                  </span>
                  <span className="font-medium tabular-nums">{money(item.line_total)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-charcoal-800/[0.06] px-5 py-4 text-sm sm:px-6">
              <div className="flex justify-between">
                <dt className="text-charcoal-500">Delivery charged</dt>
                <dd>{money(order.delivery_fee)}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>Your total</dt>
                <dd>{money(order.total)}</dd>
              </div>
            </dl>
          </Card>
          <Card className="p-5 sm:p-6">
            <h2 className="font-sans text-base font-semibold">History</h2>
            <ol className="mt-4 space-y-3 border-l border-sage-200 pl-4 text-sm">
              {order.events.map((event, index) => (
                <li key={index}>
                  <p className="font-medium">{FULFILMENT_LABELS[event.to_status as FulfillmentStatus] ?? event.to_status}</p>
                  <p className="text-charcoal-500">
                    {dateTime(event.created_at)} · by {event.actor_role.toLowerCase()}
                    {event.note ? ` · “${event.note}”` : ''}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <aside className="space-y-4">
          <Card className="p-5 text-sm">
            <h2 className="font-sans font-semibold">Deliver to</h2>
            <p className="mt-2 leading-6 text-charcoal-600">
              {order.shipping.name}
              <br />
              {[order.shipping.line1, order.shipping.line2].filter(Boolean).join(', ')}
              <br />
              {[order.shipping.city, order.shipping.district, order.shipping.state].filter(Boolean).join(', ')} {order.shipping.postal_code}
              <br />
              <a href={`tel:${order.shipping.phone}`} className="text-forest-700 underline">
                {order.shipping.phone}
              </a>
            </p>
          </Card>
          <Card className="p-5 text-sm">
            <h2 className="font-sans font-semibold">Payment</h2>
            <p className="mt-2 text-charcoal-600">{order.payment_method === 'COD' ? 'Collect cash on delivery' : 'Test payment (no money moved)'}</p>
            {order.order_notes ? (
              <>
                <h3 className="mt-4 font-sans font-semibold">Customer notes</h3>
                <p className="mt-1 whitespace-pre-line text-charcoal-600">{order.order_notes}</p>
              </>
            ) : null}
          </Card>
        </aside>
      </div>
      <ConfirmDialog
        open={Boolean(pending)}
        title={pending === 'REJECTED' ? 'Decline this order?' : 'Cancel this order?'}
        description="The customer will be told why, and the items go back into your stock."
        confirmLabel={pending === 'REJECTED' ? 'Decline order' : 'Cancel order'}
        tone="danger"
        reasonLabel="Reason for the customer"
        reasonRequired
        loading={transition.isPending}
        onClose={() => setPending(null)}
        onConfirm={(reason) => pending && move(pending, reason)}
      />
    </div>
  );
}

export function ProducerInquiriesPage() {
  const [status, setStatus] = useState('');
  const { data, isLoading, error, refetch } = useProducerInquiries(status || undefined);
  const close = useCloseInquiry('producer');
  return (
    <div className="max-w-3xl">
      <PageMeta title="Inquiries" noindex />
      <PortalPageHeader title="Inquiries" description="Questions from customers about your farm and products." />
      <div className="mb-5 flex gap-1 rounded-full bg-sage-100 p-1 sm:w-fit" role="tablist" aria-label="Filter inquiries">
        {[
          { value: '', label: 'All' },
          { value: 'OPEN', label: 'Open' },
          { value: 'ANSWERED', label: 'Answered' },
          { value: 'CLOSED', label: 'Closed' },
        ].map((filter) => (
          <button
            key={filter.value}
            type="button"
            role="tab"
            aria-selected={status === filter.value}
            onClick={() => setStatus(filter.value)}
            className={cn('rounded-full px-4 py-1.5 text-sm font-medium', status === filter.value ? 'bg-white text-charcoal-900 shadow-sm' : 'text-charcoal-600')}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Skeleton className="h-48" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data?.results.length ? (
        <div className="space-y-4">
          {data.results.map((inquiry) => (
            <Card key={inquiry.id} className="p-5 sm:p-6">
              <InquiryThread
                inquiry={inquiry}
                scope="producer"
                actions={
                  inquiry.status !== 'CLOSED' ? (
                    <Button variant="ghost" size="sm" onClick={() => close.mutate(inquiry.id)}>
                      Close
                    </Button>
                  ) : null
                }
              />
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Inbox className="h-5 w-5" aria-hidden="true" />} title="No inquiries" description="When customers message your farm, their questions appear here and in your email." />
      )}
    </div>
  );
}

const farmSchema = z
  .object({
    farm_name: z.string().trim().min(2, 'Enter your farm name.').max(150),
    description: z.string().trim().min(20, 'Write at least 20 characters.').max(4000),
    address_line1: z.string().trim().min(3).max(200),
    address_line2: z.string().trim().max(200).optional(),
    city: z.string().trim().min(2).max(100),
    district: z.string().trim().max(100).optional(),
    state: z.string().trim().min(2).max(100),
    postal_code: z.string().trim().regex(/^[0-9]{4,10}$/, 'Enter a valid PIN code.'),
    registration_number: z.string().trim().max(80).optional(),
    verification_details: z.string().trim().max(4000).optional(),
    whatsapp_number: z.string().trim().max(20).optional(),
    whatsapp_enabled: z.boolean(),
  })
  .refine((values) => !values.whatsapp_enabled || Boolean(values.whatsapp_number), {
    path: ['whatsapp_number'],
    message: 'Add a WhatsApp number to show the WhatsApp button.',
  });
type FarmValues = z.infer<typeof farmSchema>;
const FARM_FIELDS = Object.keys(farmSchema.innerType().shape);

export function FarmProfileEditorPage() {
  const { data: profile, isLoading, error, refetch } = useProducerProfile();
  const update = useUpdateProducerProfile();
  const resubmit = useResubmitVerification();
  const { refreshUser } = useAuth();
  const notify = useToast();
  const form = useForm<FarmValues>({
    resolver: zodResolver(farmSchema),
    values: profile
      ? {
          farm_name: profile.farm_name, description: profile.description, address_line1: profile.address_line1, address_line2: profile.address_line2,
          city: profile.city, district: profile.district, state: profile.state, postal_code: profile.postal_code,
          registration_number: profile.registration_number, verification_details: profile.verification_details,
          whatsapp_number: profile.whatsapp_number, whatsapp_enabled: profile.whatsapp_enabled,
        }
      : undefined,
  });
  const { register, formState: { errors, isSubmitting, isDirty } } = form;

  if (isLoading) return <PageLoader />;
  if (error || !profile) return <ErrorState error={error} onRetry={() => refetch()} />;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values);
      await refreshUser();
      notify('Farm profile saved.');
    } catch (err) {
      const message = applyFieldErrors(err, form.setError, FARM_FIELDS);
      if (message) form.setError('root', { message });
    }
  });

  return (
    <div className="max-w-3xl">
      <PageMeta title="Farm profile" noindex />
      <PortalPageHeader
        title="Farm profile"
        description={
          profile.verification_status === 'VERIFIED' ? (
            <Link to={`/farms/${profile.slug}`} className="text-forest-700 hover:underline">View your public farm page →</Link>
          ) : (
            'Your public page goes live once your farm is verified.'
          )
        }
        actions={<VerificationBadge status={profile.verification_status} />}
      />
      {profile.verification_status === 'REJECTED' ? (
        <Alert tone="warning" title="Our team needs more information" className="mb-6">
          <p>{profile.verification_note}</p>
          <p className="mt-2">Update the details below, save, then resubmit for review.</p>
          <Button
            size="sm"
            className="mt-3"
            loading={resubmit.isPending}
            onClick={async () => {
              try {
                await resubmit.mutateAsync();
                await refreshUser();
                notify('Resubmitted for review.');
              } catch (err) {
                notify(errorMessage(err), 'error');
              }
            }}
          >
            Resubmit for review
          </Button>
        </Alert>
      ) : null}
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {errors.root?.message ? <Alert tone="error">{errors.root.message}</Alert> : null}
        <Card className="space-y-5 p-5 sm:p-6">
          <h2 className="font-sans text-base font-semibold">Public profile</h2>
          <TextField label="Farm name" error={errors.farm_name?.message} {...register('farm_name')} />
          <TextArea label="About your farm" rows={6} error={errors.description?.message} {...register('description')} />
        </Card>
        <Card className="space-y-5 p-5 sm:p-6">
          <h2 className="font-sans text-base font-semibold">Location</h2>
          <p className="-mt-3 text-sm text-charcoal-500">Customers see your town, district and state. Your street address is kept private.</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Address" className="sm:col-span-2" error={errors.address_line1?.message} {...register('address_line1')} />
            <TextField label="Address line 2" optional className="sm:col-span-2" {...register('address_line2')} />
            <TextField label="Town or village" error={errors.city?.message} {...register('city')} />
            <TextField label="District" optional {...register('district')} />
            <TextField label="State" error={errors.state?.message} {...register('state')} />
            <TextField label="PIN code" error={errors.postal_code?.message} {...register('postal_code')} />
          </div>
        </Card>
        <Card className="space-y-5 p-5 sm:p-6">
          <h2 className="font-sans text-base font-semibold">WhatsApp contact</h2>
          <TextField label="WhatsApp business number" type="tel" optional hint="Include the country code, e.g. +91 98470 00101." error={errors.whatsapp_number?.message} {...register('whatsapp_number')} />
          <Checkbox
            label="Show a WhatsApp button on my farm and product pages"
            description="Your number is only shown publicly when this is ticked. Messages through Farm2Home are always available."
            {...register('whatsapp_enabled')}
          />
        </Card>
        <Card className="space-y-5 p-5 sm:p-6">
          <h2 className="font-sans text-base font-semibold">Verification details</h2>
          <p className="-mt-3 text-sm text-charcoal-500">Only visible to the Farm2Home team.</p>
          <TextField label="Registration number" optional {...register('registration_number')} />
          <TextArea label="Additional details" optional rows={3} {...register('verification_details')} />
        </Card>
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          Save farm profile
        </Button>
      </form>
    </div>
  );
}

export function ProducerSettingsPage() {
  return (
    <div>
      <PageMeta title="Account" noindex />
      <PortalPageHeader title="Account" description="Your personal sign-in details." />
      <AccountSettings />
    </div>
  );
}
