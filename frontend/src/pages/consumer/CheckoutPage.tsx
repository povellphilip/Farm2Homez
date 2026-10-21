import { zodResolver } from '@hookform/resolvers/zod';
import { FlaskConical, Lock, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toApiError } from '@/api/errors';
import { usePaymentMethods } from '@/api/queries/catalog';
import { useAddresses, useCart, useCheckout, type CheckoutInput } from '@/api/queries/consumer';
import { AddressFields, addressSchema, type AddressValues } from '@/components/forms/AddressFields';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert, ErrorState, PageLoader } from '@/components/ui/Feedback';
import { Checkbox, TextArea } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import { idempotencyKey, money } from '@/lib/format';
import { PageMeta } from '@/lib/seo';

type PaymentCode = 'COD' | 'MOCK_ONLINE';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const cart = useCart();
  const addresses = useAddresses();
  const methods = usePaymentMethods();
  const checkout = useCheckout();
  // One key per checkout visit: a double click or a retry after a network error can never create a second order.
  const key = useMemo(() => idempotencyKey(), []);
  const [addressChoice, setAddressChoice] = useState<number | 'new' | null>(null);
  const [payment, setPayment] = useState<PaymentCode>('COD');
  const [notes, setNotes] = useState('');
  const [saveAddress, setSaveAddress] = useState(true);
  const [problem, setProblem] = useState<{ message: string; code: string } | null>(null);
  const form = useForm<AddressValues>({ resolver: zodResolver(addressSchema) });

  useEffect(() => {
    if (addressChoice !== null || !addresses.data) return;
    const preferred = addresses.data.find((address) => address.is_default) ?? addresses.data[0];
    setAddressChoice(preferred ? preferred.id : 'new');
  }, [addresses.data, addressChoice]);

  if (cart.isLoading || addresses.isLoading) return <PageLoader />;
  if (cart.error) return <div className="page-container py-16"><ErrorState error={cart.error} onRetry={() => cart.refetch()} /></div>;
  if (!cart.data || cart.data.items.length === 0) return <Navigate to="/cart" replace />;
  const summary = cart.data;

  async function placeOrder() {
    setProblem(null);
    const input: CheckoutInput = { idempotencyKey: key, payment_method: payment, notes, expected_total: summary.total };
    if (addressChoice === 'new' || addressChoice === null) {
      if (!(await form.trigger())) return;
      const values = form.getValues();
      input.address = {
        name: values.recipient_name,
        phone: values.phone_number,
        line1: values.line1,
        line2: values.line2 ?? '',
        city: values.city,
        district: values.district ?? '',
        state: values.state,
        postal_code: values.postal_code,
      };
      input.save_address = saveAddress;
    } else {
      input.address_id = addressChoice;
    }
    try {
      const order = await checkout.mutateAsync(input);
      navigate(`/consumer/orders/${order.number}?placed=1`, { replace: true });
    } catch (error) {
      const apiError = toApiError(error);
      setProblem({ message: apiError.message, code: apiError.code });
      if (['price_changed', 'cart_invalid', 'insufficient_stock'].includes(apiError.code)) cart.refetch();
    }
  }

  return (
    <div className="page-container py-10">
      <PageMeta title="Checkout" noindex />
      <h1 className="text-4xl">Checkout</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          <Card className="p-6">
            <h2 className="font-sans text-lg font-semibold">Delivery address</h2>
            <div className="mt-5 space-y-3" role="radiogroup" aria-label="Delivery address">
              {addresses.data?.map((address) => (
                <label
                  key={address.id}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-xl border p-4 text-sm transition',
                    addressChoice === address.id ? 'border-forest-600 bg-forest-50/50' : 'border-charcoal-800/10 hover:border-charcoal-800/25',
                  )}
                >
                  <input type="radio" name="address" className="mt-1 accent-forest-700" checked={addressChoice === address.id} onChange={() => setAddressChoice(address.id)} />
                  <span>
                    <span className="font-medium text-charcoal-900">
                      {address.recipient_name}
                      {address.label ? <span className="ml-2 text-xs font-normal text-charcoal-500">{address.label}</span> : null}
                    </span>
                    <span className="block text-charcoal-600">
                      {[address.line1, address.line2, address.city, address.state, address.postal_code].filter(Boolean).join(', ')}
                    </span>
                    <span className="block text-charcoal-500">{address.phone_number}</span>
                  </span>
                </label>
              ))}
              {addresses.data?.length ? (
                <label className={cn('flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm', addressChoice === 'new' ? 'border-forest-600' : 'border-charcoal-800/10')}>
                  <input type="radio" name="address" className="accent-forest-700" checked={addressChoice === 'new'} onChange={() => setAddressChoice('new')} />
                  Use a new address
                </label>
              ) : null}
            </div>
            {addressChoice === 'new' ? (
              <div className="mt-6 space-y-5">
                <AddressFields register={form.register} errors={form.formState.errors} />
                <Checkbox label="Save this address for next time" checked={saveAddress} onChange={(event) => setSaveAddress(event.target.checked)} />
              </div>
            ) : null}
          </Card>

          <Card className="p-6">
            <h2 className="font-sans text-lg font-semibold">Payment</h2>
            <div className="mt-5 space-y-3" role="radiogroup" aria-label="Payment method">
              {methods.data?.map((method) => (
                <label
                  key={method.code}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-xl border p-4 text-sm transition',
                    payment === method.code ? 'border-forest-600 bg-forest-50/50' : 'border-charcoal-800/10 hover:border-charcoal-800/25',
                  )}
                >
                  <input type="radio" name="payment" className="mt-1 accent-forest-700" checked={payment === method.code} onChange={() => setPayment(method.code as PaymentCode)} />
                  <span>
                    <span className="flex items-center gap-2 font-medium text-charcoal-900">
                      {method.is_test ? <FlaskConical className="h-4 w-4 text-terracotta-600" aria-hidden="true" /> : <Wallet className="h-4 w-4 text-forest-600" aria-hidden="true" />}
                      {method.is_test ? 'Test payment' : method.label}
                    </span>
                    <span className="block text-charcoal-500">
                      {method.is_test
                        ? 'Development only. No money is charged and the order is marked as a test payment.'
                        : 'Pay each farm’s delivery partner in cash or UPI when your items arrive.'}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <TextArea label="Notes for the farms" optional rows={3} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Delivery instructions, gate codes, preferred times…" />
          </Card>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-6">
            <h2 className="font-sans text-lg font-semibold">Your order</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {summary.items.map((line) => (
                <li key={line.id} className="flex justify-between gap-3">
                  <span className="text-charcoal-600">
                    {line.product.name} × {line.quantity}
                  </span>
                  <span className="tabular-nums">{money(line.line_total)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-charcoal-800/[0.07] pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-charcoal-600">Subtotal</dt>
                <dd className="tabular-nums">{money(summary.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-charcoal-600">Delivery</dt>
                <dd className="tabular-nums">{Number(summary.delivery_total) === 0 ? 'Free' : money(summary.delivery_total)}</dd>
              </div>
              <div className="flex justify-between pt-2 text-base font-semibold text-charcoal-900">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(summary.total)}</dd>
              </div>
            </dl>
            {problem ? (
              <Alert tone="error" className="mt-5">
                {problem.message}
                {problem.code === 'cart_invalid' || problem.code === 'insufficient_stock' ? (
                  <>
                    {' '}
                    <Link to="/cart" className="font-medium underline">
                      Review your basket
                    </Link>
                  </>
                ) : null}
              </Alert>
            ) : null}
            <Button size="lg" className="mt-6 w-full" loading={checkout.isPending} onClick={placeOrder} disabled={!summary.can_checkout} icon={<Lock className="h-4 w-4" aria-hidden="true" />}>
              Place order · {money(summary.total)}
            </Button>
            <p className="mt-3 text-center text-xs text-charcoal-500">Each farm confirms its part of your order separately.</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
