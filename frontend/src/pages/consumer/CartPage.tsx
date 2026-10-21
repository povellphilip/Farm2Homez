import { AlertTriangle, ShoppingBasket, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { errorMessage } from '@/api/errors';
import { useCart, useCartMutations } from '@/api/queries/consumer';
import type { CartLine } from '@/api/types';
import { ProductPhoto } from '@/components/product/ProductVisuals';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/Feedback';
import { QuantityStepper } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toaster';
import { money, perUnit } from '@/lib/format';
import { PageMeta } from '@/lib/seo';

function Line({ line }: { line: CartLine }) {
  const { update, remove } = useCartMutations();
  const notify = useToast();
  const { product } = line;
  const onError = (error: unknown) => notify(errorMessage(error), 'error');
  const busy = (update.isPending && update.variables?.id === line.id) || (remove.isPending && remove.variables === line.id);

  return (
    <li className="flex gap-4 py-5" aria-busy={busy || undefined}>
      <Link to={`/products/${product.slug}`} className="shrink-0">
        <ProductPhoto image={product.primary_image} alt={product.name} categorySlug={product.category.slug} className="h-24 w-24 rounded-xl sm:h-28 sm:w-28" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex justify-between gap-3">
          <div>
            <Link to={`/products/${product.slug}`} className="font-medium text-charcoal-900 hover:underline">
              {product.name}
            </Link>
            <p className="text-sm text-charcoal-500">
              {money(product.price)} {perUnit(product.unit)}
            </p>
          </div>
          <p className="font-semibold tabular-nums">{money(line.line_total)}</p>
        </div>
        {line.issue ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-terracotta-700" role="alert">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {line.issue}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <QuantityStepper
            label={`Quantity of ${product.name}`}
            value={line.quantity}
            min={product.min_order_quantity}
            max={Math.max(product.stock_quantity, line.quantity)}
            disabled={busy}
            onChange={(quantity) => update.mutate({ id: line.id, quantity }, { onError })}
          />
          <button
            type="button"
            onClick={() => remove.mutate(line.id, { onError })}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-charcoal-500 hover:bg-ivory-100 hover:text-terracotta-700"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove
          </button>
        </div>
      </div>
    </li>
  );
}

export default function CartPage() {
  const { data: cart, isLoading, error, refetch } = useCart();

  if (isLoading) return <PageLoader />;
  if (error) return <div className="page-container py-16"><ErrorState error={error} onRetry={() => refetch()} /></div>;
  if (!cart || cart.items.length === 0) {
    return (
      <div className="page-container py-16">
        <PageMeta title="Your basket" noindex />
        <EmptyState
          icon={<ShoppingBasket className="h-5 w-5" aria-hidden="true" />}
          title="Your basket is empty"
          description="Fill it with something good from our farms."
          action={<ButtonLink to="/products">Browse the market</ButtonLink>}
        />
      </div>
    );
  }

  const farms = new Map<number, { name: string; slug: string; lines: CartLine[] }>();
  cart.items.forEach((line) => {
    const farm = line.product.producer;
    if (!farms.has(farm.id)) farms.set(farm.id, { name: farm.farm_name, slug: farm.slug, lines: [] });
    farms.get(farm.id)!.lines.push(line);
  });
  const fees = new Map(cart.groups.map((group) => [group.producer.id, group]));

  return (
    <div className="page-container py-10">
      <PageMeta title="Your basket" noindex />
      <h1 className="text-4xl">Your basket</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {[...farms.entries()].map(([id, farm]) => {
            const group = fees.get(id);
            return (
              <Card key={id} className="px-5 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-charcoal-800/[0.07] py-4">
                  <Link to={`/farms/${farm.slug}`} className="font-semibold text-charcoal-900 hover:underline">
                    {farm.name}
                  </Link>
                  {group ? (
                    <span className="text-sm text-charcoal-500">
                      {Number(group.delivery_fee) === 0 ? 'Free delivery from this farm' : `Delivery ${money(group.delivery_fee)}`}
                    </span>
                  ) : null}
                </div>
                <ul className="divide-y divide-charcoal-800/[0.07]">
                  {farm.lines.map((line) => (
                    <Line key={line.id} line={line} />
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-6">
            <h2 className="font-sans text-lg font-semibold">Order summary</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-charcoal-600">Items ({cart.item_count})</dt>
                <dd className="tabular-nums">{money(cart.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-charcoal-600">Delivery ({farms.size} {farms.size === 1 ? 'farm' : 'farms'})</dt>
                <dd className="tabular-nums">{Number(cart.delivery_total) === 0 ? 'Free' : money(cart.delivery_total)}</dd>
              </div>
              <div className="flex justify-between border-t border-charcoal-800/[0.07] pt-3 text-base font-semibold text-charcoal-900">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(cart.total)}</dd>
              </div>
            </dl>
            {cart.can_checkout ? (
              <ButtonLink to="/checkout" size="lg" className="mt-6 w-full">
                Continue to checkout
              </ButtonLink>
            ) : (
              <p className="mt-6 rounded-xl bg-terracotta-50 px-4 py-3 text-sm text-terracotta-700" role="alert">
                Some items need attention before you can check out. Adjust or remove them above.
              </p>
            )}
            <p className="mt-4 text-xs leading-5 text-charcoal-500">Totals only include items available to order. Free delivery on farm orders of ₹500 or more.</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
