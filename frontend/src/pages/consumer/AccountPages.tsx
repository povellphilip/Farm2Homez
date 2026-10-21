import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Heart, Home, MapPin, MessageSquare, Package, Plus, Settings, Star } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, NavLink, Outlet, useParams, useSearchParams } from 'react-router-dom';
import { applyFieldErrors, errorMessage, toApiError } from '@/api/errors';
import {
  useAddressMutations,
  useAddresses,
  useCancelOrder,
  useFavoriteProducers,
  useFavoriteProducts,
  useMyInquiries,
  useMyOrder,
  useMyOrders,
  useSubmitReview,
} from '@/api/queries/consumer';
import type { Address, ConsumerProducerOrder, FulfillmentStatus, OrderItem } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { AccountSettings } from '@/components/forms/AccountSettings';
import { ADDRESS_FIELDS, AddressFields, addressSchema, type AddressValues } from '@/components/forms/AddressFields';
import { InquiryThread } from '@/components/forms/InquiryThread';
import { ProductGrid } from '@/components/product/ProductCard';
import { FulfilmentBadge, OrderBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Alert, EmptyState, ErrorState, PageLoader, Skeleton } from '@/components/ui/Feedback';
import { TextArea } from '@/components/ui/Field';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toaster';
import { cn } from '@/lib/cn';
import { date, dateTime, FULFILMENT_LABELS, money, plural } from '@/lib/format';
import { PageMeta } from '@/lib/seo';
import { NotFoundPage } from '../public/StatusPages';

const TABS = [
  { to: '/consumer/dashboard', label: 'Overview', icon: Home },
  { to: '/consumer/orders', label: 'Orders', icon: Package },
  { to: '/consumer/favorites', label: 'Favourites', icon: Heart },
  { to: '/consumer/addresses', label: 'Addresses', icon: MapPin },
  { to: '/consumer/messages', label: 'Messages', icon: MessageSquare },
  { to: '/consumer/settings', label: 'Settings', icon: Settings },
];

export function ConsumerAccountLayout() {
  return (
    <div className="page-container py-10">
      <PageMeta title="Your account" noindex />
      <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-charcoal-800/[0.07] pb-px" aria-label="Account">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                'inline-flex shrink-0 items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-sm font-medium transition-colors',
                isActive ? 'border-forest-700 text-forest-800' : 'border-transparent text-charcoal-500 hover:text-charcoal-900',
              )
            }
          >
            <tab.icon className="h-4 w-4" aria-hidden="true" />
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-8">
        <Outlet />
      </div>
    </div>
  );
}

function OrderRows({ page = 1, onPage }: { page?: number; onPage?: (page: number) => void }) {
  const { data, isLoading, error, refetch } = useMyOrders(page);
  if (isLoading) return <Skeleton className="h-40" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data?.results.length) {
    return (
      <EmptyState
        icon={<Package className="h-5 w-5" aria-hidden="true" />}
        title="No orders yet"
        description="When you place an order it will appear here with live updates from each farm."
        action={<ButtonLink to="/products">Start shopping</ButtonLink>}
      />
    );
  }
  return (
    <>
      <Card className="divide-y divide-charcoal-800/[0.07]">
        {data.results.map((order) => (
          <Link key={order.number} to={`/consumer/orders/${order.number}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-ivory-50 sm:px-6">
            <div>
              <p className="font-medium text-charcoal-900">{order.number}</p>
              <p className="text-sm text-charcoal-500">
                {date(order.created_at)} · {plural(order.item_count, 'item')} from {order.farms.join(', ')}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <OrderBadge status={order.status} />
              <span className="font-semibold tabular-nums">{money(order.total)}</span>
            </div>
          </Link>
        ))}
      </Card>
      {onPage ? <Pagination page={page} count={data.count} onChange={onPage} /> : null}
    </>
  );
}

export function ConsumerDashboardPage() {
  const { user } = useAuth();
  const favorites = useFavoriteProducts();
  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-3xl sm:text-4xl">Hello, {user?.full_name.split(' ')[0]}</h1>
        <p className="mt-2 text-charcoal-600">Track your orders, reorder favourites and manage your details.</p>
      </div>
      <section aria-labelledby="recent-orders">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="recent-orders" className="text-2xl">
            Recent orders
          </h2>
          <Link to="/consumer/orders" className="text-sm font-medium text-forest-700 hover:underline">
            All orders
          </Link>
        </div>
        <OrderRows />
      </section>
      {favorites.data?.results.length ? (
        <section aria-labelledby="fav-heading">
          <h2 id="fav-heading" className="mb-4 text-2xl">
            Your favourites
          </h2>
          <ProductGrid products={favorites.data.results.slice(0, 4).map((favorite) => favorite.product)} />
        </section>
      ) : null}
    </div>
  );
}

export function ConsumerOrdersPage() {
  const [page, setPage] = useState(1);
  return (
    <div>
      <h1 className="mb-6 text-3xl">Your orders</h1>
      <OrderRows page={page} onPage={setPage} />
    </div>
  );
}

const STEPS: FulfillmentStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

function Progress({ status }: { status: FulfillmentStatus }) {
  if (status === 'REJECTED' || status === 'CANCELLED') return null;
  const normalised = status === 'OUT_FOR_DELIVERY' ? 'SHIPPED' : status;
  const index = STEPS.indexOf(normalised);
  return (
    <ol className="mt-4 grid grid-cols-5 gap-1" aria-label="Delivery progress">
      {STEPS.map((step, stepIndex) => (
        <li key={step} className="text-center">
          <span className={cn('block h-1.5 rounded-full', stepIndex <= index ? 'bg-forest-600' : 'bg-sage-200')} />
          <span className={cn('mt-1.5 block text-[11px] leading-tight', stepIndex <= index ? 'text-charcoal-800' : 'text-charcoal-400')}>
            {step === 'SHIPPED' && status === 'OUT_FOR_DELIVERY' ? 'Out for delivery' : FULFILMENT_LABELS[step]}
          </span>
          {stepIndex === index ? <span className="sr-only">(current)</span> : null}
        </li>
      ))}
    </ol>
  );
}

function ReviewDialog({ item, onClose }: { item: OrderItem | null; onClose: () => void }) {
  const submit = useSubmitReview();
  const notify = useToast();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open={Boolean(item)}
      onClose={onClose}
      title={`Review ${item?.product_name ?? ''}`}
      footer={
        <Button
          loading={submit.isPending}
          onClick={async () => {
            if (!item) return;
            try {
              await submit.mutateAsync({ product: item.product_slug, rating, comment });
              notify('Thanks for your review!');
              setComment('');
              onClose();
            } catch (err) {
              setError(errorMessage(err));
            }
          }}
        >
          Post review
        </Button>
      }
    >
      <fieldset>
        <legend className="text-sm font-medium">Your rating</legend>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} star${value > 1 ? 's' : ''}`} aria-pressed={rating === value} className="rounded p-1">
              <Star className={cn('h-7 w-7', value <= rating ? 'fill-terracotta-500 text-terracotta-500' : 'text-sage-300')} aria-hidden="true" />
            </button>
          ))}
        </div>
      </fieldset>
      <TextArea className="mt-4" label="Comments" optional rows={4} value={comment} maxLength={2000} onChange={(event) => setComment(event.target.value)} />
      {error ? <p className="mt-3 text-sm text-terracotta-700" role="alert">{error}</p> : null}
    </Dialog>
  );
}

function FarmPart({ part, onReview }: { part: ConsumerProducerOrder; onReview: (item: OrderItem) => void }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={`/farms/${part.producer.slug}`} className="font-semibold text-charcoal-900 hover:underline">
          {part.producer.farm_name}
        </Link>
        <FulfilmentBadge status={part.status} />
      </div>
      <Progress status={part.status} />
      {part.status_note && (part.status === 'REJECTED' || part.status === 'CANCELLED') ? (
        <Alert tone="warning" className="mt-4">
          {part.status === 'REJECTED' ? 'The farm declined this part of your order: ' : 'Cancelled: '}
          {part.status_note}
        </Alert>
      ) : null}
      <ul className="mt-5 divide-y divide-charcoal-800/[0.07] text-sm">
        {part.items.map((item) => (
          <li key={item.id} className="flex items-center gap-4 py-3">
            {item.image ? <img src={item.image} alt="" className="h-14 w-14 rounded-lg object-cover" /> : <span className="h-14 w-14 rounded-lg bg-sage-100" aria-hidden="true" />}
            <div className="flex-1">
              {item.product_id ? (
                <Link to={`/products/${item.product_slug}`} className="font-medium hover:underline">
                  {item.product_name}
                </Link>
              ) : (
                <span className="font-medium">{item.product_name}</span>
              )}
              <p className="text-charcoal-500">
                {item.quantity} {item.unit} × {money(item.unit_price)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium tabular-nums">{money(item.line_total)}</p>
              {part.status === 'DELIVERED' && item.product_id ? (
                <button type="button" className="mt-1 text-xs font-medium text-forest-700 hover:underline" onClick={() => onReview(item)}>
                  Write a review
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-right text-sm text-charcoal-500">
        Delivery {Number(part.delivery_fee) === 0 ? 'free' : money(part.delivery_fee)} · Farm total <span className="font-medium text-charcoal-900">{money(part.total)}</span>
      </p>
    </Card>
  );
}

export function ConsumerOrderDetailPage() {
  const { number } = useParams();
  const [params] = useSearchParams();
  const { data: order, isLoading, error, refetch } = useMyOrder(number);
  const cancel = useCancelOrder(number ?? '');
  const notify = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reviewItem, setReviewItem] = useState<OrderItem | null>(null);

  if (isLoading) return <PageLoader />;
  if (error) return toApiError(error).status === 404 ? <NotFoundPage /> : <ErrorState error={error} onRetry={() => refetch()} />;
  if (!order) return null;

  return (
    <div className="space-y-8">
      <PageMeta title={`Order ${order.number}`} noindex />
      {params.get('placed') ? (
        <div className="flex items-start gap-4 rounded-2xl bg-forest-800 p-6 text-ivory-50">
          <CheckCircle2 className="mt-1 h-7 w-7 shrink-0 text-sage-300" aria-hidden="true" />
          <div>
            <h1 className="font-display text-3xl text-ivory-50">Thank you, your order is placed</h1>
            <p className="mt-2 text-sage-200">
              We&apos;ve emailed a confirmation. {order.producer_orders.length > 1 ? `Each of the ${order.producer_orders.length} farms` : 'The farm'} will confirm and ship
              separately, and you can follow each one below.
            </p>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/consumer/orders" className="text-sm text-charcoal-500 hover:text-charcoal-900">
            ← All orders
          </Link>
          <h2 className="mt-1 text-3xl">Order {order.number}</h2>
          <p className="mt-1 text-sm text-charcoal-500">Placed {dateTime(order.created_at)}</p>
        </div>
        <div className="flex items-center gap-3">
          <OrderBadge status={order.status} />
          {order.can_cancel ? (
            <Button variant="danger" size="sm" onClick={() => setConfirmCancel(true)}>
              Cancel order
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {order.producer_orders.map((part) => (
            <FarmPart key={part.id} part={part} onReview={setReviewItem} />
          ))}
        </div>
        <aside className="space-y-4">
          <Card className="p-5 text-sm">
            <h3 className="font-sans font-semibold">Delivering to</h3>
            <p className="mt-2 leading-6 text-charcoal-600">
              {order.shipping.name}
              <br />
              {[order.shipping.line1, order.shipping.line2].filter(Boolean).join(', ')}
              <br />
              {order.shipping.city}, {order.shipping.state} {order.shipping.postal_code}
              <br />
              {order.shipping.phone}
            </p>
          </Card>
          <Card className="p-5 text-sm">
            <h3 className="font-sans font-semibold">Payment</h3>
            <p className="mt-2 text-charcoal-600">
              {order.payment?.is_test ? 'Test payment (no money charged)' : 'Cash on delivery'} · {order.payment?.status.toLowerCase()}
            </p>
            <dl className="mt-4 space-y-1.5">
              <div className="flex justify-between">
                <dt className="text-charcoal-500">Subtotal</dt>
                <dd>{money(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-charcoal-500">Delivery</dt>
                <dd>{money(order.delivery_total)}</dd>
              </div>
              <div className="flex justify-between font-semibold text-charcoal-900">
                <dt>Total</dt>
                <dd>{money(order.total)}</dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this order?"
        description="Parts of the order that a farm has already started preparing can't be cancelled. Everything else will be cancelled and returned to stock."
        confirmLabel="Cancel order"
        tone="danger"
        reasonLabel="Reason"
        loading={cancel.isPending}
        error={cancel.error ? errorMessage(cancel.error) : null}
        onClose={() => setConfirmCancel(false)}
        onConfirm={async (reason) => {
          try {
            await cancel.mutateAsync(reason);
            setConfirmCancel(false);
            notify('Order cancelled.');
          } catch {
            /* shown in the dialog */
          }
        }}
      />
      <ReviewDialog item={reviewItem} onClose={() => setReviewItem(null)} />
    </div>
  );
}

export function FavoritesPage() {
  const products = useFavoriteProducts();
  const producers = useFavoriteProducers();
  return (
    <div className="space-y-12">
      <section>
        <h1 className="mb-6 text-3xl">Saved products</h1>
        {products.data?.results.length === 0 ? (
          <EmptyState icon={<Heart className="h-5 w-5" aria-hidden="true" />} title="Nothing saved yet" description="Tap the heart on any product to keep it here." />
        ) : (
          <ProductGrid products={products.data?.results.map((favorite) => favorite.product)} loading={products.isLoading} />
        )}
      </section>
      <section>
        <h2 className="mb-6 text-2xl">Farms you follow</h2>
        {producers.data?.results.length ? (
          <div className="grid gap-4 md:grid-cols-3">
            {producers.data.results.map(({ producer }) => (
              <Link key={producer.slug} to={`/farms/${producer.slug}`} className="rounded-2xl border border-charcoal-800/[0.07] bg-white p-5 shadow-card hover:shadow-lift">
                <p className="font-display text-lg">{producer.farm_name}</p>
                <p className="text-sm text-charcoal-500">{producer.location}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-charcoal-500">Follow farms from their profile page to see them here.</p>
        )}
      </section>
    </div>
  );
}

function AddressDialog({ address, open, onClose }: { address: Address | null; open: boolean; onClose: () => void }) {
  const { save } = useAddressMutations();
  const form = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    values: address
      ? {
          label: address.label, recipient_name: address.recipient_name, phone_number: address.phone_number, line1: address.line1,
          line2: address.line2, city: address.city, district: address.district, state: address.state, postal_code: address.postal_code,
        }
      : undefined,
  });
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ ...values, id: address?.id });
      form.reset();
      onClose();
    } catch (error) {
      const message = applyFieldErrors(error, form.setError, ADDRESS_FIELDS);
      if (message) form.setError('root', { message });
    }
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={address ? 'Edit address' : 'Add an address'}
      footer={
        <Button loading={save.isPending} onClick={onSubmit}>
          Save address
        </Button>
      }
    >
      {form.formState.errors.root?.message ? <Alert tone="error" className="mb-4">{form.formState.errors.root.message}</Alert> : null}
      <AddressFields register={form.register} errors={form.formState.errors} showLabel />
    </Dialog>
  );
}

export function AddressesPage() {
  const { data, isLoading, error, refetch } = useAddresses();
  const { remove, makeDefault } = useAddressMutations();
  const [editing, setEditing] = useState<Address | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Address | null>(null);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Addresses</h1>
        <Button onClick={() => { setEditing(null); setOpen(true); }} icon={<Plus className="h-4 w-4" aria-hidden="true" />}>
          Add address
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-32" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data?.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((address) => (
            <Card key={address.id} className="flex flex-col p-5 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-charcoal-900">{address.label || address.recipient_name}</p>
                {address.is_default ? <span className="rounded-full bg-forest-100 px-2.5 py-0.5 text-xs font-medium text-forest-800">Default</span> : null}
              </div>
              <p className="mt-2 leading-6 text-charcoal-600">
                {address.recipient_name}, {address.phone_number}
                <br />
                {[address.line1, address.line2, address.city, address.district, address.state, address.postal_code].filter(Boolean).join(', ')}
              </p>
              <div className="mt-4 flex gap-4 text-sm font-medium">
                <button type="button" className="text-forest-700 hover:underline" onClick={() => { setEditing(address); setOpen(true); }}>
                  Edit
                </button>
                {!address.is_default ? (
                  <button type="button" className="text-forest-700 hover:underline" onClick={() => makeDefault.mutate(address.id)}>
                    Make default
                  </button>
                ) : null}
                <button type="button" className="text-terracotta-700 hover:underline" onClick={() => setDeleting(address)}>
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={<MapPin className="h-5 w-5" aria-hidden="true" />} title="No saved addresses" description="Save an address to check out faster." />
      )}
      <AddressDialog address={editing} open={open} onClose={() => setOpen(false)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this address?"
        description="Past orders keep their delivery details."
        confirmLabel="Delete"
        tone="danger"
        loading={remove.isPending}
        error={remove.error ? errorMessage(remove.error) : null}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            if (deleting) await remove.mutateAsync(deleting.id);
            setDeleting(null);
          } catch {
            /* shown in the dialog */
          }
        }}
      />
    </div>
  );
}

export function MessagesPage() {
  const { data, isLoading, error, refetch } = useMyInquiries();
  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-3xl">Messages</h1>
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data?.results.length ? (
        <div className="space-y-4">
          {data.results.map((inquiry) => (
            <Card key={inquiry.id} className="p-5 sm:p-6">
              <InquiryThread inquiry={inquiry} scope="consumer" />
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<MessageSquare className="h-5 w-5" aria-hidden="true" />}
          title="No messages yet"
          description="Questions you send to farms from product pages appear here with their replies."
        />
      )}
    </div>
  );
}

export function ConsumerSettingsPage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl">Settings</h1>
      <AccountSettings />
    </div>
  );
}
