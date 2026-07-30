import { useParams } from 'react-router-dom';
import { ShoppingCart, Star } from 'lucide-react';
import { ProductCard } from '../components/common/ProductCard';
import { Footer } from '../components/layout/Footer';
import { Navbar } from '../components/layout/Navbar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useCart } from '../contexts/CartContext';
import { useProducts } from '../contexts/ProductContext';
import { useState } from 'react';

export default function ProductDetailPage() {
  const { id } = useParams();
  const { products } = useProducts();
  const product = products.find((item) => item.id === Number(id)) || products[0];
  const related = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 4);
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr]">
          <div className="grid gap-4">
            <div className="overflow-hidden rounded-lg border border-line bg-surface">
              <img src={product.image} alt={product.name} className="aspect-[4/3] w-full object-cover" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[product.image, product.image, product.image, product.image].map((image, index) => (
                <button key={index} type="button" className="overflow-hidden rounded-md border border-line bg-surface">
                  <img src={image} alt="" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
          <section>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">{product.category}</p>
            <h1 className="mt-3 text-3xl font-semibold text-ink sm:text-4xl">{product.name}</h1>
            <div className="mt-4 flex items-center gap-3 text-sm text-muted">
              <span className="flex items-center gap-1 text-ink">
                <Star className="h-4 w-4 fill-ink" aria-hidden="true" />
                {product.rating}
              </span>
              <span>{product.reviews} reviews</span>
              <span className="text-emerald-700">{product.stock}</span>
            </div>
            <p className="mt-6 text-3xl font-semibold text-ink">₹{product.price}</p>
            <p className="mt-2 text-sm text-muted">{product.unit}</p>
            <p className="mt-6 max-w-xl leading-7 text-muted">{product.description}</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-[120px_1fr_1fr]">
              <select className="h-11 rounded-md border border-line bg-white px-3 text-sm text-ink" aria-label="Quantity" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>
                <option value="1">Qty 1</option>
                <option value="2">Qty 2</option>
                <option value="3">Qty 3</option>
              </select>
              <Button className="gap-2" onClick={() => addItem(product, quantity)}>
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                Add to cart
              </Button>
              <Button variant="secondary" onClick={() => addItem(product, quantity)}>Buy now</Button>
            </div>
            <Card className="mt-8 p-5">
              <h2 className="font-semibold text-ink">Delivery information</h2>
              <p className="mt-2 text-sm leading-6 text-muted">Same-day dispatch available in supported zones. Cold-chain handling for dairy and selected fresh goods.</p>
            </Card>
          </section>
        </div>
        <section className="mt-14 border-t border-line pt-10">
          <h2 className="text-2xl font-semibold text-ink">Related products</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(related.length ? related : products.slice(0, 4)).map((item) => (
              <ProductCard key={item.id} product={item} compact />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
