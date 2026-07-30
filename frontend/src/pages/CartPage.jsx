import { Link } from 'react-router-dom';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { Footer } from '../components/layout/Footer';
import { Navbar } from '../components/layout/Navbar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useCart } from '../contexts/CartContext';

export default function CartPage() {
  const { items, subtotal, delivery, taxes, total, updateQuantity, removeItem } = useCart();

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <section>
          <h1 className="text-3xl font-semibold text-ink">Cart</h1>
          {items.length ? (
            <div className="mt-6 grid gap-4">
              {items.map((item) => (
                <Card key={item.id} className="grid gap-4 p-4 sm:grid-cols-[96px_1fr_auto] sm:items-center">
                  <img src={item.image} alt={item.name} className="h-24 w-24 rounded-md object-cover" />
                  <div>
                    <h2 className="font-semibold text-ink">{item.name}</h2>
                    <p className="mt-1 text-sm text-muted">{item.unit}</p>
                    <select
                      className="mt-3 h-10 rounded-md border border-line bg-white px-3 text-sm text-ink"
                      aria-label={`Quantity for ${item.name}`}
                      value={item.quantity}
                      onChange={(event) => updateQuantity(item.id, event.target.value)}
                    >
                      {Array.from({ length: 10 }).map((_, index) => (
                        <option key={index + 1} value={index + 1}>
                          Qty {index + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
                    <p className="font-semibold text-ink">₹{item.price * item.quantity}</p>
                    <button
                      type="button"
                      className="mt-0 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-ink sm:mt-4"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="mt-6 p-10 text-center">
              <ShoppingBag className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-semibold text-ink">Your cart is empty</h2>
              <p className="mt-2 text-sm text-muted">Add products to continue to checkout.</p>
              <Button as={Link} to="/products" className="mt-6">
                Continue shopping
              </Button>
            </Card>
          )}
        </section>
        <Card className="h-fit p-6">
          <h2 className="text-lg font-semibold text-ink">Order summary</h2>
          <div className="mt-5 grid gap-3 text-sm">
            <div className="flex justify-between text-muted">
              <span>Subtotal</span>
              <span>₹{subtotal}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Delivery</span>
              <span>{delivery ? `₹${delivery}` : 'Free'}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Taxes</span>
              <span>₹{taxes}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-3 font-semibold text-ink">
              <span>Total</span>
              <span>₹{total}</span>
            </div>
          </div>
          {items.length ? (
            <Button as={Link} to="/checkout" className="mt-6 w-full">
              Checkout
            </Button>
          ) : (
            <Button className="mt-6 w-full" disabled>
              Checkout
            </Button>
          )}
        </Card>
      </main>
      <Footer />
    </div>
  );
}
