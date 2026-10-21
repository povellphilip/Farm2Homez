import { ChevronDown, Inbox, Plus, Search, ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { errorMessage, toApiError } from '@/api/errors';
import {
  useAdminActions,
  useAdminCategories,
  useAdminInquiries,
  useAdminOrder,
  useAdminOrders,
  useAdminProducers,
  useAdminProducts,
  useAdminUsers,
  useAuditLogs,
  usePlatformOverview,
} from '@/api/queries/admin';
import { useCloseInquiry } from '@/api/queries/producer';
import type { AdminCategory, AdminProducer, AdminProduct, AdminUser, FulfillmentStatus } from '@/api/types';
import { InquiryThread } from '@/components/forms/InquiryThread';
import { PortalPageHeader } from '@/components/layout/Layouts';
import { ProductPhoto } from '@/components/product/ProductVisuals';
import { Badge, FulfilmentBadge, ModerationBadge, OrderBadge, ProductStatusBadge, VerificationBadge } from '@/components/ui/Badge';
import { BarChart } from '@/components/ui/BarChart';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, Stat } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Alert, EmptyState, ErrorState, PageLoader, Skeleton } from '@/components/ui/Feedback';
import { Checkbox, SelectField, TextArea, TextField } from '@/components/ui/Field';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toaster';
import { cn } from '@/lib/cn';
import { date, dateTime, FULFILMENT_LABELS, money, plural } from '@/lib/format';
import { PageMeta } from '@/lib/seo';
import { NotFoundPage } from '../public/StatusPages';

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------
function useListParams() {
  const [params, setParams] = useSearchParams();
  const get = (key: string, fallback = '') => params.get(key) ?? fallback;
  const set = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };
  return { get, set, page: Number(get('page', '1')) };
}

function Toolbar({ children, search, onSearch, placeholder }: { children?: ReactNode; search: string; onSearch: (value: string) => void; placeholder: string }) {
  const [value, setValue] = useState(search);
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <form
        role="search"
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(value.trim());
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400" aria-hidden="true" />
        <label className="sr-only" htmlFor="admin-search">
          {placeholder}
        </label>
        <input id="admin-search" type="search" value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} className="h-10 w-72 rounded-full border border-charcoal-800/15 bg-white pl-9 pr-3 text-sm" />
      </form>
      {children}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-charcoal-600">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-full border border-charcoal-800/15 bg-white px-3 text-sm text-charcoal-800">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Table({ head, children, minWidth = '48rem' }: { head: string[]; children: ReactNode; minWidth?: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth }}>
          <thead className="bg-ivory-100 text-left text-charcoal-500">
            <tr>
              {head.map((cell, index) => (
                <th key={cell} className={cn('px-4 py-3 font-medium', index === head.length - 1 && 'text-right')}>
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-800/[0.06]">{children}</tbody>
        </table>
      </div>
    </Card>
  );
}

function ListState({ isLoading, error, refetch, empty, children }: { isLoading: boolean; error: unknown; refetch: () => void; empty: boolean; children: ReactNode }) {
  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (empty) return <EmptyState title="Nothing to show" description="Try a different filter or search." />;
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
export function AdminDashboardPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error, refetch } = usePlatformOverview(days);
  return (
    <div>
      <PageMeta title="Admin overview" noindex />
      <PortalPageHeader
        title="Platform overview"
        actions={<FilterSelect label="Period" value={String(days)} onChange={(value) => setDays(Number(value))} options={[{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }]} />}
      />
      {isLoading ? (
        <Skeleton className="h-72" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data ? (
        <div className="space-y-8">
          {data.producers.pending_verification || data.products.pending_moderation ? (
            <Alert tone="warning" title="Waiting for you">
              {data.producers.pending_verification ? (
                <Link to="/admin/producers?verification_status=PENDING" className="mr-4 font-medium underline">
                  {plural(data.producers.pending_verification, 'farm')} to verify
                </Link>
              ) : null}
              {data.products.pending_moderation ? (
                <Link to="/admin/products?moderation_status=PENDING" className="font-medium underline">
                  {plural(data.products.pending_moderation, 'listing')} to review
                </Link>
              ) : null}
            </Alert>
          ) : null}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Stat label={`Gross sales, ${days} days`} value={money(data.revenue.gross_period)} hint={`${money(data.revenue.delivered_total)} delivered all-time`} />
            <Stat label={`Orders, ${days} days`} value={data.orders.in_period} hint={`${data.orders.total} all-time`} />
            <Stat label="Live listings" value={data.products.live} hint={`${data.products.out_of_stock_live} out of stock`} />
            <Stat label="Verified farms" value={data.producers.by_verification.VERIFIED ?? 0} hint={`${data.users.new_in_period} new sign-ups in ${days} days`} />
          </div>
          {Number(data.revenue.test_payments_total) > 0 ? (
            <p className="text-xs text-charcoal-500">Excludes {money(data.revenue.test_payments_total)} placed with the development test payment method.</p>
          ) : null}
          <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <Card className="p-5 sm:p-6">
              <BarChart
                title={`Daily gross sales, last ${days} days (₹)`}
                format={(value) => money(value)}
                data={data.revenue.daily.map((point) => ({
                  label: date(point.date),
                  tick: new Date(point.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                  value: Number(point.revenue),
                  detail: plural(point.orders, 'farm order'),
                }))}
              />
            </Card>
            <Card>
              <CardHeader title="Top farms" description="By gross sales, all-time" />
              {data.revenue.top_producers.length ? (
                <ol className="divide-y divide-charcoal-800/[0.06] text-sm">
                  {data.revenue.top_producers.map((farm) => (
                    <li key={farm.producer_id} className="flex justify-between px-5 py-3 sm:px-6">
                      <span>{farm.producer__farm_name}</span>
                      <span className="text-right tabular-nums">
                        {money(farm.revenue)}
                        <span className="block text-xs text-charcoal-500">{plural(farm.orders, 'order')}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="px-6 py-8 text-sm text-charcoal-500">No sales yet.</p>
              )}
            </Card>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { title: 'Fulfilments by status', rows: Object.entries(data.orders.fulfilments_by_status).map(([key, value]) => [FULFILMENT_LABELS[key as FulfillmentStatus] ?? key, value]) },
              { title: 'Users by role', rows: Object.entries(data.users.by_role).map(([key, value]) => [key.toLowerCase(), value]) },
              { title: 'Listings by status', rows: Object.entries(data.products.by_status).map(([key, value]) => [key.toLowerCase(), value]) },
            ].map((panel) => (
              <Card key={panel.title}>
                <CardHeader title={panel.title} />
                {panel.rows.length ? (
                  <dl className="divide-y divide-charcoal-800/[0.06] text-sm">
                    {panel.rows.map(([label, value]) => (
                      <div key={String(label)} className="flex justify-between px-5 py-2.5 capitalize sm:px-6">
                        <dt className="text-charcoal-600">{label}</dt>
                        <dd className="tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="px-6 py-6 text-sm text-charcoal-500">None yet.</p>
                )}
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Producer verification
// ---------------------------------------------------------------------------
function ProducerRow({ producer }: { producer: AdminProducer }) {
  const [open, setOpen] = useState(producer.verification_status === 'PENDING');
  const [decision, setDecision] = useState<'VERIFIED' | 'REJECTED' | null>(null);
  const { verifyProducer } = useAdminActions();
  const notify = useToast();
  return (
    <Card>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left sm:px-6">
        <span>
          <span className="font-semibold text-charcoal-900">{producer.farm_name}</span>
          <span className="block text-sm text-charcoal-500">
            {producer.full_name} · {producer.location} · registered {date(producer.created_at)}
          </span>
        </span>
        <span className="flex items-center gap-3">
          {!producer.email_verified ? <Badge>Email unverified</Badge> : null}
          {!producer.is_active ? <Badge tone="red">Suspended</Badge> : null}
          <VerificationBadge status={producer.verification_status} />
          <ChevronDown className={cn('h-4 w-4 text-charcoal-400 transition', open && 'rotate-180')} aria-hidden="true" />
        </span>
      </button>
      {open ? (
        <div className="border-t border-charcoal-800/[0.06] px-5 py-5 text-sm sm:px-6">
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <div><dt className="text-charcoal-500">Email</dt><dd>{producer.email}</dd></div>
            <div><dt className="text-charcoal-500">Phone</dt><dd>{producer.phone_number || '—'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-charcoal-500">Address</dt><dd>{[producer.address_line1, producer.address_line2, producer.city, producer.district, producer.state, producer.postal_code].filter(Boolean).join(', ')}</dd></div>
            <div><dt className="text-charcoal-500">Registration number</dt><dd>{producer.registration_number || '—'}</dd></div>
            <div><dt className="text-charcoal-500">WhatsApp</dt><dd>{producer.whatsapp_enabled ? producer.whatsapp_number : 'Not shown'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-charcoal-500">About the farm</dt><dd className="whitespace-pre-line">{producer.description || '—'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-charcoal-500">Verification details</dt><dd className="whitespace-pre-line">{producer.verification_details || '—'}</dd></div>
            {producer.verification_note ? <div className="sm:col-span-2"><dt className="text-charcoal-500">Last note to producer</dt><dd>{producer.verification_note}</dd></div> : null}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            {producer.verification_status !== 'VERIFIED' ? (
              <Button size="sm" onClick={() => setDecision('VERIFIED')} icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}>
                Verify farm
              </Button>
            ) : null}
            <Button size="sm" variant="danger" onClick={() => setDecision('REJECTED')}>
              {producer.verification_status === 'VERIFIED' ? 'Revoke verification' : 'Request changes'}
            </Button>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(decision)}
        title={decision === 'VERIFIED' ? `Verify ${producer.farm_name}?` : `Request changes from ${producer.farm_name}?`}
        description={decision === 'VERIFIED' ? 'The farm will be able to publish listings immediately. The producer is emailed.' : 'Listings from this farm leave the marketplace until it is verified again. The producer sees your note.'}
        confirmLabel={decision === 'VERIFIED' ? 'Verify' : 'Send request'}
        tone={decision === 'VERIFIED' ? 'primary' : 'danger'}
        reasonLabel={decision === 'VERIFIED' ? 'Note' : 'What does the producer need to provide?'}
        reasonRequired={decision === 'REJECTED'}
        loading={verifyProducer.isPending}
        error={verifyProducer.error ? errorMessage(verifyProducer.error) : null}
        onClose={() => setDecision(null)}
        onConfirm={async (note) => {
          if (!decision) return;
          try {
            await verifyProducer.mutateAsync({ id: producer.id, decision, note });
            notify(decision === 'VERIFIED' ? `${producer.farm_name} is verified.` : 'Request sent to the producer.');
            setDecision(null);
          } catch {
            /* shown in the dialog */
          }
        }}
      />
    </Card>
  );
}

export function AdminProducersPage() {
  const { get, set, page } = useListParams();
  const status = get('verification_status', 'PENDING');
  const { data, isLoading, error, refetch } = useAdminProducers({ verification_status: status === 'ALL' ? undefined : status, search: get('search'), page });
  return (
    <div className="max-w-4xl">
      <PageMeta title="Producer verification" noindex />
      <PortalPageHeader title="Producers" description="Review farm applications and manage verification." />
      <Toolbar search={get('search')} onSearch={(value) => set({ search: value })} placeholder="Search farm, email or town">
        <FilterSelect
          label="Status"
          value={status}
          onChange={(value) => set({ verification_status: value })}
          options={[{ value: 'PENDING', label: 'Pending' }, { value: 'REJECTED', label: 'Changes requested' }, { value: 'VERIFIED', label: 'Verified' }, { value: 'ALL', label: 'All' }]}
        />
      </Toolbar>
      <ListState isLoading={isLoading} error={error} refetch={refetch} empty={!data?.results.length}>
        <div className="space-y-3">
          {data?.results.map((producer) => (
            <ProducerRow key={producer.id} producer={producer} />
          ))}
        </div>
        <Pagination page={page} count={data?.count ?? 0} onChange={(next) => set({ page: String(next) })} />
      </ListState>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export function AdminUsersPage() {
  const { get, set, page } = useListParams();
  const { data, isLoading, error, refetch } = useAdminUsers({ role: get('role'), is_active: get('is_active'), search: get('search'), page });
  const { suspendUser, reactivateUser } = useAdminActions();
  const notify = useToast();
  const [target, setTarget] = useState<{ user: AdminUser; action: 'suspend' | 'reactivate' } | null>(null);

  return (
    <div>
      <PageMeta title="Users" noindex />
      <PortalPageHeader title="Users" description="Suspended accounts are signed out everywhere and cannot sign in." />
      <Toolbar search={get('search')} onSearch={(value) => set({ search: value })} placeholder="Search name, email or phone">
        <FilterSelect label="Role" value={get('role')} onChange={(value) => set({ role: value })} options={[{ value: '', label: 'All' }, { value: 'CONSUMER', label: 'Consumers' }, { value: 'PRODUCER', label: 'Producers' }, { value: 'ADMIN', label: 'Admins' }]} />
        <FilterSelect label="Status" value={get('is_active')} onChange={(value) => set({ is_active: value })} options={[{ value: '', label: 'All' }, { value: 'true', label: 'Active' }, { value: 'false', label: 'Suspended' }]} />
      </Toolbar>
      <ListState isLoading={isLoading} error={error} refetch={refetch} empty={!data?.results.length}>
        <Table head={['Name', 'Role', 'Joined', 'Last sign-in', 'Status', '']}>
          {data?.results.map((user) => (
            <tr key={user.id}>
              <td className="px-4 py-3">
                <p className="font-medium text-charcoal-900">{user.full_name}</p>
                <p className="text-charcoal-500">{user.email}</p>
              </td>
              <td className="px-4 py-3 capitalize">{user.role.toLowerCase()}{user.producer ? <span className="block text-xs text-charcoal-500">{user.producer.farm_name}</span> : null}</td>
              <td className="px-4 py-3 text-charcoal-600">{date(user.date_joined)}</td>
              <td className="px-4 py-3 text-charcoal-600">{user.last_login ? dateTime(user.last_login) : 'Never'}</td>
              <td className="px-4 py-3">
                {user.is_active ? (user.email_verified ? <Badge tone="green">Active</Badge> : <Badge>Unverified email</Badge>) : <Badge tone="red" className="cursor-help" >Suspended</Badge>}
                {!user.is_active && user.suspension_reason ? <p className="mt-1 max-w-[14rem] text-xs text-charcoal-500">{user.suspension_reason}</p> : null}
              </td>
              <td className="px-4 py-3 text-right">
                {user.is_active ? (
                  <Button size="sm" variant="danger" onClick={() => setTarget({ user, action: 'suspend' })}>
                    Suspend
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setTarget({ user, action: 'reactivate' })}>
                    Reactivate
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
        <Pagination page={page} count={data?.count ?? 0} onChange={(next) => set({ page: String(next) })} />
      </ListState>
      <ConfirmDialog
        open={Boolean(target)}
        title={target?.action === 'suspend' ? `Suspend ${target.user.full_name}?` : `Reactivate ${target?.user.full_name}?`}
        description={
          target?.action === 'suspend'
            ? 'They are signed out immediately and their listings leave the marketplace. They are emailed the reason. This is recorded in the audit log.'
            : 'They can sign in again. This is recorded in the audit log.'
        }
        confirmLabel={target?.action === 'suspend' ? 'Suspend account' : 'Reactivate'}
        tone={target?.action === 'suspend' ? 'danger' : 'primary'}
        reasonLabel={target?.action === 'suspend' ? 'Reason (sent to the user)' : undefined}
        reasonRequired={target?.action === 'suspend'}
        loading={suspendUser.isPending || reactivateUser.isPending}
        error={suspendUser.error ? errorMessage(suspendUser.error) : reactivateUser.error ? errorMessage(reactivateUser.error) : null}
        onClose={() => setTarget(null)}
        onConfirm={async (reason) => {
          if (!target) return;
          try {
            if (target.action === 'suspend') await suspendUser.mutateAsync({ id: target.user.id, reason });
            else await reactivateUser.mutateAsync(target.user.id);
            notify(target.action === 'suspend' ? 'Account suspended.' : 'Account reactivated.');
            setTarget(null);
          } catch {
            /* shown in the dialog */
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Listing moderation
// ---------------------------------------------------------------------------
export function AdminProductsPage() {
  const { get, set, page } = useListParams();
  const { data, isLoading, error, refetch } = useAdminProducts({ moderation_status: get('moderation_status'), status: get('status'), search: get('search'), page });
  const { moderateProduct } = useAdminActions();
  const notify = useToast();
  const [target, setTarget] = useState<{ product: AdminProduct; decision: 'APPROVED' | 'REJECTED' } | null>(null);

  return (
    <div>
      <PageMeta title="Listings" noindex />
      <PortalPageHeader title="Listings" description="Approve or remove product listings. Removed listings leave the marketplace immediately." />
      <Toolbar search={get('search')} onSearch={(value) => set({ search: value })} placeholder="Search product or farm">
        <FilterSelect label="Review" value={get('moderation_status')} onChange={(value) => set({ moderation_status: value })} options={[{ value: '', label: 'All' }, { value: 'PENDING', label: 'Pending' }, { value: 'APPROVED', label: 'Approved' }, { value: 'REJECTED', label: 'Removed' }]} />
        <FilterSelect label="Status" value={get('status')} onChange={(value) => set({ status: value })} options={[{ value: '', label: 'All' }, { value: 'PUBLISHED', label: 'Published' }, { value: 'DRAFT', label: 'Draft' }, { value: 'UNPUBLISHED', label: 'Unpublished' }]} />
      </Toolbar>
      <ListState isLoading={isLoading} error={error} refetch={refetch} empty={!data?.results.length}>
        <Table head={['Listing', 'Farm', 'Price', 'Stock', 'Status', '']} minWidth="56rem">
          {data?.results.map((product) => (
            <tr key={product.id}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <ProductPhoto image={product.images[0]} alt={product.name} categorySlug={product.category} className="h-11 w-11 shrink-0 rounded-lg" />
                  <div>
                    <p className="font-medium text-charcoal-900">{product.name}</p>
                    <p className="text-xs text-charcoal-500">Updated {date(product.updated_at)}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">{product.producer.farm_name}</td>
              <td className="px-4 py-3 tabular-nums">{money(product.price)} / {product.unit}</td>
              <td className="px-4 py-3 tabular-nums">{product.stock_quantity}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  <ProductStatusBadge status={product.status} />
                  <ModerationBadge status={product.moderation_status} />
                </div>
                {product.moderation_note ? <p className="mt-1 max-w-[14rem] text-xs text-charcoal-500">{product.moderation_note}</p> : null}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  {product.status === 'PUBLISHED' && product.moderation_status === 'APPROVED' ? (
                    <Link to={`/products/${product.slug}`} className="inline-flex h-9 items-center px-2 text-sm text-forest-700 hover:underline" target="_blank" rel="noreferrer">
                      View
                    </Link>
                  ) : null}
                  {product.moderation_status !== 'APPROVED' ? (
                    <Button size="sm" onClick={() => setTarget({ product, decision: 'APPROVED' })}>
                      Approve
                    </Button>
                  ) : null}
                  {product.moderation_status !== 'REJECTED' ? (
                    <Button size="sm" variant="danger" onClick={() => setTarget({ product, decision: 'REJECTED' })}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <Pagination page={page} count={data?.count ?? 0} onChange={(next) => set({ page: String(next) })} />
      </ListState>
      <ConfirmDialog
        open={Boolean(target)}
        title={target?.decision === 'APPROVED' ? `Approve “${target.product.name}”?` : `Remove “${target?.product.name}”?`}
        description={target?.decision === 'APPROVED' ? 'It appears in the marketplace if the farm has published it.' : 'It leaves the marketplace now. The farm is emailed your reason and can fix and resubmit it.'}
        confirmLabel={target?.decision === 'APPROVED' ? 'Approve' : 'Remove listing'}
        tone={target?.decision === 'APPROVED' ? 'primary' : 'danger'}
        reasonLabel={target?.decision === 'REJECTED' ? 'Reason for the farm' : undefined}
        reasonRequired={target?.decision === 'REJECTED'}
        loading={moderateProduct.isPending}
        error={moderateProduct.error ? errorMessage(moderateProduct.error) : null}
        onClose={() => setTarget(null)}
        onConfirm={async (note) => {
          if (!target) return;
          try {
            await moderateProduct.mutateAsync({ id: target.product.id, decision: target.decision, note });
            notify(target.decision === 'APPROVED' ? 'Listing approved.' : 'Listing removed.');
            setTarget(null);
          } catch {
            /* shown in the dialog */
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export function AdminOrdersPage() {
  const { get, set, page } = useListParams();
  const { data, isLoading, error, refetch } = useAdminOrders({ status: get('status'), search: get('search'), page, ordering: '-created_at' });
  return (
    <div>
      <PageMeta title="Orders" noindex />
      <PortalPageHeader title="Orders" />
      <Toolbar search={get('search')} onSearch={(value) => set({ search: value })} placeholder="Order number, customer email or farm">
        <FilterSelect label="Status" value={get('status')} onChange={(value) => set({ status: value })} options={[{ value: '', label: 'All' }, { value: 'PENDING', label: 'Placed' }, { value: 'IN_PROGRESS', label: 'In progress' }, { value: 'COMPLETED', label: 'Completed' }, { value: 'CANCELLED', label: 'Cancelled' }]} />
      </Toolbar>
      <ListState isLoading={isLoading} error={error} refetch={refetch} empty={!data?.results.length}>
        <Table head={['Order', 'Placed', 'Farms', 'Payment', 'Status', 'Total']}>
          {data?.results.map((order) => (
            <tr key={order.number} className="hover:bg-ivory-50">
              <td className="px-4 py-3">
                <Link to={`/admin/orders/${order.number}`} className="font-medium text-forest-700 hover:underline">
                  {order.number}
                </Link>
              </td>
              <td className="px-4 py-3 text-charcoal-600">{dateTime(order.created_at)}</td>
              <td className="px-4 py-3">{order.farms.join(', ')}</td>
              <td className="px-4 py-3 text-charcoal-600">{order.payment_method === 'COD' ? 'Cash on delivery' : 'Test payment'}</td>
              <td className="px-4 py-3"><OrderBadge status={order.status} /></td>
              <td className="px-4 py-3 text-right tabular-nums">{money(order.total)}</td>
            </tr>
          ))}
        </Table>
        <Pagination page={page} count={data?.count ?? 0} onChange={(next) => set({ page: String(next) })} />
      </ListState>
    </div>
  );
}

const ADMIN_TRANSITIONS: Record<string, FulfillmentStatus[]> = {
  PENDING: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
};

export function AdminOrderDetailPage() {
  const { number } = useParams();
  const { data: order, isLoading, error, refetch } = useAdminOrder(number);
  const { transitionFulfilment } = useAdminActions();
  const notify = useToast();
  const [target, setTarget] = useState<{ id: number; farm: string; status: FulfillmentStatus } | null>(null);

  if (isLoading) return <PageLoader />;
  if (error) return toApiError(error).status === 404 ? <NotFoundPage /> : <ErrorState error={error} onRetry={() => refetch()} />;
  if (!order) return null;

  return (
    <div>
      <PageMeta title={`Order ${order.number}`} noindex />
      <Link to="/admin/orders" className="text-sm text-charcoal-500 hover:text-charcoal-900">
        ← All orders
      </Link>
      <PortalPageHeader title={`Order ${order.number}`} description={`${order.consumer.full_name} · ${order.consumer.email} · ${dateTime(order.created_at)}`} actions={<OrderBadge status={order.status} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {order.producer_orders.map((part) => (
            <Card key={part.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold">{part.producer.farm_name}</p>
                <FulfilmentBadge status={part.status} />
              </div>
              <ul className="mt-3 space-y-1 text-sm text-charcoal-600">
                {part.items.map((item) => (
                  <li key={item.id} className="flex justify-between">
                    <span>{item.quantity} {item.unit} × {item.product_name}</span>
                    <span className="tabular-nums">{money(item.line_total)}</span>
                  </li>
                ))}
              </ul>
              <ol className="mt-4 space-y-1 border-l border-sage-200 pl-3 text-xs text-charcoal-500">
                {part.events.map((event, index) => (
                  <li key={index}>
                    {dateTime(event.created_at)} · {FULFILMENT_LABELS[event.to_status as FulfillmentStatus] ?? event.to_status} by {event.actor_role.toLowerCase()}
                    {event.note ? ` · “${event.note}”` : ''}
                  </li>
                ))}
              </ol>
              {ADMIN_TRANSITIONS[part.status] ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-charcoal-800/[0.06] pt-4">
                  <span className="self-center text-xs font-medium uppercase tracking-wide text-charcoal-500">Override</span>
                  {ADMIN_TRANSITIONS[part.status].map((status) => (
                    <Button key={status} size="sm" variant={status === 'CANCELLED' || status === 'REJECTED' ? 'danger' : 'secondary'} onClick={() => setTarget({ id: part.id, farm: part.producer.farm_name, status })}>
                      {FULFILMENT_LABELS[status]}
                    </Button>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
        <aside className="space-y-4 text-sm">
          <Card className="p-5">
            <h2 className="font-sans font-semibold">Delivery</h2>
            <p className="mt-2 leading-6 text-charcoal-600">
              {order.shipping.name}, {order.shipping.phone}
              <br />
              {[order.shipping.line1, order.shipping.line2, order.shipping.city, order.shipping.state, order.shipping.postal_code].filter(Boolean).join(', ')}
            </p>
            {order.notes ? <p className="mt-3 text-charcoal-600">Notes: {order.notes}</p> : null}
          </Card>
          <Card className="p-5">
            <h2 className="font-sans font-semibold">Payment</h2>
            <p className="mt-2 text-charcoal-600">
              {order.payment?.provider} · {order.payment?.status.toLowerCase()}
              {order.payment?.is_test ? <Badge tone="amber" className="ml-2">Test</Badge> : null}
            </p>
            <p className="mt-2 font-semibold">Total {money(order.total)}</p>
          </Card>
        </aside>
      </div>
      <ConfirmDialog
        open={Boolean(target)}
        title={`Set ${target?.farm}'s part to “${target ? FULFILMENT_LABELS[target.status] : ''}”?`}
        description="Admin overrides are recorded in the audit log and the customer is emailed."
        confirmLabel="Apply override"
        tone={target?.status === 'CANCELLED' || target?.status === 'REJECTED' ? 'danger' : 'primary'}
        reasonLabel="Note"
        reasonRequired={target?.status === 'CANCELLED' || target?.status === 'REJECTED'}
        loading={transitionFulfilment.isPending}
        error={transitionFulfilment.error ? errorMessage(transitionFulfilment.error) : null}
        onClose={() => setTarget(null)}
        onConfirm={async (note) => {
          if (!target) return;
          try {
            await transitionFulfilment.mutateAsync({ number: order.number, fulfilmentId: target.id, status: target.status, note });
            notify('Order updated.');
            setTarget(null);
          } catch {
            /* shown in the dialog */
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inquiries
// ---------------------------------------------------------------------------
export function AdminInquiriesPage() {
  const { get, set, page } = useListParams();
  const scope = get('scope', 'platform');
  const { data, isLoading, error, refetch } = useAdminInquiries({ scope, status: get('status'), search: get('search'), page });
  const close = useCloseInquiry('admin');
  return (
    <div className="max-w-3xl">
      <PageMeta title="Inquiries" noindex />
      <PortalPageHeader title="Inquiries" description="Contact-form messages to the team, and an overview of customer questions to farms." />
      <Toolbar search={get('search')} onSearch={(value) => set({ search: value })} placeholder="Search subject, name or email">
        <FilterSelect label="Show" value={scope} onChange={(value) => set({ scope: value })} options={[{ value: 'platform', label: 'Messages to Farm2Home' }, { value: 'producers', label: 'Messages to farms' }]} />
        <FilterSelect label="Status" value={get('status')} onChange={(value) => set({ status: value })} options={[{ value: '', label: 'All' }, { value: 'OPEN', label: 'Open' }, { value: 'ANSWERED', label: 'Answered' }, { value: 'CLOSED', label: 'Closed' }]} />
      </Toolbar>
      {isLoading ? (
        <Skeleton className="h-48" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data?.results.length ? (
        <div className="space-y-4">
          {data.results.map((inquiry) => (
            <Card key={inquiry.id} className="p-5 sm:p-6">
              {inquiry.producer ? <p className="mb-3 text-xs font-medium uppercase tracking-wide text-charcoal-500">To {inquiry.producer.farm_name}</p> : null}
              <InquiryThread
                inquiry={inquiry}
                scope="admin"
                canReply={!inquiry.producer}
                actions={inquiry.status !== 'CLOSED' ? <Button variant="ghost" size="sm" onClick={() => close.mutate(inquiry.id)}>Close</Button> : null}
              />
            </Card>
          ))}
          <Pagination page={page} count={data.count} onChange={(next) => set({ page: String(next) })} />
        </div>
      ) : (
        <EmptyState icon={<Inbox className="h-5 w-5" aria-hidden="true" />} title="No inquiries" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
function CategoryDialog({ open, onClose, category, parents }: { open: boolean; onClose: () => void; category: Partial<AdminCategory> | null; parents: AdminCategory[] }) {
  const { saveCategory } = useAdminActions();
  const notify = useToast();
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [parent, setParent] = useState(category?.parent ? String(category.parent) : '');
  const [active, setActive] = useState(category?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={category?.id ? `Edit ${category.name}` : 'New category'}
      footer={
        <Button
          loading={saveCategory.isPending}
          onClick={async () => {
            if (name.trim().length < 2) return setError('Enter a name.');
            try {
              await saveCategory.mutateAsync({ id: category?.id, name: name.trim(), description, parent: parent ? Number(parent) : null, is_active: active });
              notify('Category saved.');
              onClose();
            } catch (err) {
              setError(errorMessage(err));
            }
          }}
        >
          Save
        </Button>
      }
    >
      <div className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <SelectField
          label="Parent category"
          optional
          placeholder="None (top-level)"
          value={parent}
          onChange={(event) => setParent(event.target.value)}
          options={parents.filter((item) => item.id !== category?.id).map((item) => ({ value: String(item.id), label: item.name }))}
        />
        <TextArea label="Description" optional rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
        <Checkbox label="Active" description="Inactive categories and their products are hidden from the marketplace." checked={active} onChange={(event) => setActive(event.target.checked)} />
      </div>
    </Dialog>
  );
}

export function AdminCategoriesPage() {
  const { data, isLoading, error, refetch } = useAdminCategories();
  const { deleteCategory } = useAdminActions();
  const notify = useToast();
  const [editing, setEditing] = useState<Partial<AdminCategory> | null>(null);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);
  const parents = data?.filter((category) => !category.parent) ?? [];

  return (
    <div className="max-w-3xl">
      <PageMeta title="Categories" noindex />
      <PortalPageHeader
        title="Categories"
        description="Two levels: categories and subcategories."
        actions={<Button onClick={() => setEditing({})} icon={<Plus className="h-4 w-4" aria-hidden="true" />}>New category</Button>}
      />
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <div className="space-y-3">
          {parents.map((parent) => (
            <Card key={parent.id}>
              <div className="flex items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-semibold">{parent.name} {!parent.is_active ? <Badge className="ml-2">Inactive</Badge> : null}</p>
                  <p className="text-xs text-charcoal-500">/{parent.slug}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ parent: parent.id })}>Add subcategory</Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(parent)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleting(parent)}>Delete</Button>
                </div>
              </div>
              <ul className="divide-y divide-charcoal-800/[0.06] border-t border-charcoal-800/[0.06]">
                {data?.filter((child) => child.parent === parent.id).map((child) => (
                  <li key={child.id} className="flex items-center justify-between gap-3 py-2.5 pl-10 pr-5 text-sm">
                    <span>{child.name} {!child.is_active ? <Badge className="ml-2">Inactive</Badge> : null}</span>
                    <span className="flex gap-3">
                      <button type="button" className="text-forest-700 hover:underline" onClick={() => setEditing(child)}>Edit</button>
                      <button type="button" className="text-terracotta-700 hover:underline" onClick={() => setDeleting(child)}>Delete</button>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
      {editing ? <CategoryDialog key={editing.id ?? `new-${editing.parent ?? ''}`} open onClose={() => setEditing(null)} category={editing} parents={parents} /> : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name}?`}
        description="Categories that still have products or subcategories can't be deleted. Deactivate them instead."
        confirmLabel="Delete"
        tone="danger"
        loading={deleteCategory.isPending}
        error={deleteCategory.error ? errorMessage(deleteCategory.error) : null}
        onClose={() => {
          deleteCategory.reset();
          setDeleting(null);
        }}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteCategory.mutateAsync(deleting.id);
            notify('Category deleted.');
            setDeleting(null);
          } catch {
            /* shown in the dialog */
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
export function AdminAuditLogPage() {
  const { get, set, page } = useListParams();
  const { data, isLoading, error, refetch } = useAuditLogs({ search: get('search'), page });
  return (
    <div>
      <PageMeta title="Audit log" noindex />
      <PortalPageHeader title="Audit log" description="Security and administrative events. Entries cannot be edited or deleted." />
      <Toolbar search={get('search')} onSearch={(value) => set({ search: value })} placeholder="Search action, person or target" />
      <ListState isLoading={isLoading} error={error} refetch={refetch} empty={!data?.results.length}>
        <Table head={['When', 'Action', 'By', 'Target', 'Details']} minWidth="56rem">
          {data?.results.map((entry) => (
            <tr key={entry.id}>
              <td className="whitespace-nowrap px-4 py-3 text-charcoal-600">{dateTime(entry.created_at)}</td>
              <td className="px-4 py-3"><code className="rounded bg-ivory-100 px-1.5 py-0.5 text-xs">{entry.action}</code></td>
              <td className="px-4 py-3">{entry.actor_email || 'System'}{entry.ip_address ? <span className="block text-xs text-charcoal-500">{entry.ip_address}</span> : null}</td>
              <td className="px-4 py-3">{entry.target_repr}</td>
              <td className="px-4 py-3 text-right text-xs text-charcoal-500">
                {Object.entries(entry.metadata as Record<string, unknown>)
                  .filter(([, value]) => value !== '' && value !== null)
                  .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
                  .join(' · ')}
              </td>
            </tr>
          ))}
        </Table>
        <Pagination page={page} count={data?.count ?? 0} onChange={(next) => set({ page: String(next) })} />
      </ListState>
    </div>
  );
}

