import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { CheckCircle2, CreditCard, IndianRupee, Smartphone } from 'lucide-react';
import { Footer } from '../components/layout/Footer';
import { Navbar } from '../components/layout/Navbar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Toast } from '../components/common/Toast';
import { useCart } from '../contexts/CartContext';
import { isEmail } from '../utils/validators';

const initialValues = {
  fullName: '',
  phone: '',
  address: '',
  city: '',
  postalCode: '',
  email: '',
  paymentMethod: 'cod',
  cardNumber: '',
  cardExpiry: '',
  cardCvv: '',
  upiId: '',
};

function validate(values) {
  const errors = {};
  if (!values.fullName.trim()) errors.fullName = 'Full name is required.';
  if (!/^\+?[0-9\s-]{8,18}$/.test(values.phone)) errors.phone = 'Enter a valid phone number.';
  if (!values.address.trim()) errors.address = 'Address is required.';
  if (!values.city.trim()) errors.city = 'City is required.';
  if (!/^[0-9]{4,8}$/.test(values.postalCode)) errors.postalCode = 'Enter a valid postal code.';
  if (!isEmail(values.email)) errors.email = 'Enter a valid email address.';

  if (values.paymentMethod === 'card') {
    if (!/^[0-9]{16}$/.test(values.cardNumber.replace(/\s/g, ''))) errors.cardNumber = 'Enter a 16 digit card number.';
    if (!/^(0[1-9]|1[0-2])\/[0-9]{2}$/.test(values.cardExpiry)) errors.cardExpiry = 'Use MM/YY format.';
    if (!/^[0-9]{3,4}$/.test(values.cardCvv)) errors.cardCvv = 'Enter CVV.';
  }

  if (values.paymentMethod === 'upi' && !/^[\w.-]+@[\w.-]+$/.test(values.upiId)) {
    errors.upiId = 'Enter a valid UPI ID.';
  }

  return errors;
}

export default function CheckoutPage() {
  const { items, subtotal, delivery, taxes, total, clearCart } = useCart();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [message, setMessage] = useState('');

  const orderId = useMemo(() => `F2H-${Date.now().toString().slice(-6)}`, []);

  if (!items.length && !order) {
    return <Navigate to="/cart" replace />;
  }

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    setMessage('');

    if (Object.keys(nextErrors).length) {
      setMessage('Please fix the highlighted fields before payment.');
      return;
    }

    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    const paidOnline = values.paymentMethod !== 'cod';
    setOrder({
      id: orderId,
      total,
      paymentMethod: values.paymentMethod,
      status: paidOnline ? 'Payment successful' : 'Order placed with cash on delivery',
    });
    clearCart();
    setLoading(false);
  }

  if (order) {
    return (
      <div className="min-h-screen bg-surface">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <Card className="p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" />
            <h1 className="mt-5 text-3xl font-semibold text-ink">Order confirmed</h1>
            <p className="mt-3 text-muted">{order.status}</p>
            <div className="mx-auto mt-6 grid max-w-md gap-3 rounded-lg border border-line bg-surface p-5 text-left text-sm">
              <div className="flex justify-between"><span className="text-muted">Order ID</span><span className="font-semibold text-ink">{order.id}</span></div>
              <div className="flex justify-between"><span className="text-muted">Total</span><span className="font-semibold text-ink">₹{order.total}</span></div>
            </div>
            <Button as={Link} to="/products" className="mt-7">
              Continue shopping
            </Button>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <form className="grid gap-5" onSubmit={handleSubmit} noValidate>
          <h1 className="text-3xl font-semibold text-ink">Checkout</h1>
          <Toast type="error" message={message} />
          <Card className="p-6">
            <h2 className="font-semibold text-ink">1. Shipping address</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Input id="fullName" name="fullName" label="Full name" value={values.fullName} onChange={updateField} error={errors.fullName} autoComplete="name" />
              <Input id="phone" name="phone" label="Phone" value={values.phone} onChange={updateField} error={errors.phone} autoComplete="tel" />
              <Input id="address" name="address" label="Address" value={values.address} onChange={updateField} error={errors.address} wrapperClassName="sm:col-span-2" autoComplete="street-address" />
              <Input id="city" name="city" label="City" value={values.city} onChange={updateField} error={errors.city} autoComplete="address-level2" />
              <Input id="postalCode" name="postalCode" label="Postal code" value={values.postalCode} onChange={updateField} error={errors.postalCode} autoComplete="postal-code" />
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="font-semibold text-ink">2. Contact information</h2>
            <div className="mt-5">
              <Input id="email" name="email" label="Email" type="email" value={values.email} onChange={updateField} error={errors.email} autoComplete="email" />
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="font-semibold text-ink">3. Payment method</h2>
            <div className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-3">
              {[
                { value: 'cod', label: 'Cash on delivery', icon: IndianRupee },
                { value: 'upi', label: 'UPI', icon: Smartphone },
                { value: 'card', label: 'Card', icon: CreditCard },
              ].map((method) => {
                const Icon = method.icon;
                return (
                  <label key={method.value} className={`flex cursor-pointer items-center gap-3 rounded-md border p-4 ${values.paymentMethod === method.value ? 'border-ink bg-surface text-ink' : 'border-line bg-white'}`}>
                    <input type="radio" name="paymentMethod" value={method.value} checked={values.paymentMethod === method.value} onChange={updateField} />
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {method.label}
                  </label>
                );
              })}
            </div>

            {values.paymentMethod === 'upi' ? (
              <div className="mt-5">
                <Input id="upiId" name="upiId" label="UPI ID" placeholder="name@bank" value={values.upiId} onChange={updateField} error={errors.upiId} />
              </div>
            ) : null}

            {values.paymentMethod === 'card' ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <Input id="cardNumber" name="cardNumber" label="Card number" placeholder="1234123412341234" value={values.cardNumber} onChange={updateField} error={errors.cardNumber} wrapperClassName="sm:col-span-3" />
                <Input id="cardExpiry" name="cardExpiry" label="Expiry" placeholder="MM/YY" value={values.cardExpiry} onChange={updateField} error={errors.cardExpiry} />
                <Input id="cardCvv" name="cardCvv" label="CVV" type="password" value={values.cardCvv} onChange={updateField} error={errors.cardCvv} />
              </div>
            ) : null}
          </Card>
          <Card className="p-6">
            <h2 className="font-semibold text-ink">4. Order review</h2>
            <div className="mt-4 grid gap-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{item.name} x {item.quantity}</span>
                  <span className="font-medium text-ink">₹{item.price * item.quantity}</span>
                </div>
              ))}
            </div>
            <Button type="submit" disabled={loading} className="mt-5 w-full sm:w-auto">
              {loading ? 'Processing...' : values.paymentMethod === 'cod' ? 'Place order' : `Pay ₹${total}`}
            </Button>
          </Card>
        </form>
        <Card className="h-fit p-6">
          <h2 className="text-lg font-semibold text-ink">Order summary</h2>
          <div className="mt-5 grid gap-3 text-sm">
            <div className="flex justify-between text-muted"><span>Subtotal</span><span>₹{subtotal}</span></div>
            <div className="flex justify-between text-muted"><span>Delivery</span><span>{delivery ? `₹${delivery}` : 'Free'}</span></div>
            <div className="flex justify-between text-muted"><span>Taxes</span><span>₹{taxes}</span></div>
            <div className="flex justify-between border-t border-line pt-3 font-semibold text-ink"><span>Total</span><span>₹{total}</span></div>
          </div>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
