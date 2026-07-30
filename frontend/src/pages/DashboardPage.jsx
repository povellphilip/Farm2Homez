import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, PackagePlus, Store, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Toast } from '../components/common/Toast';
import { categories } from '../constants/site';
import { useAuth } from '../contexts/AuthContext';
import { useProducts } from '../contexts/ProductContext';

const initialProduct = {
  name: '',
  category: 'Fruits',
  description: '',
  price: '',
  unit: '',
  stock: 'In stock',
  image: '',
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { sellerProducts, addProduct, removeSellerProduct } = useProducts();
  const [product, setProduct] = useState(initialProduct);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('');

  const isSeller = user?.role === 'seller';

  function updateField(event) {
    const { name, value } = event.target;
    setProduct((current) => ({ ...current, [name]: value }));
  }

  function validateProduct() {
    const nextErrors = {};
    if (!product.name.trim()) nextErrors.name = 'Product name is required.';
    if (!product.description.trim()) nextErrors.description = 'Description is required.';
    if (!product.unit.trim()) nextErrors.unit = 'Unit is required.';
    if (!Number(product.price) || Number(product.price) <= 0) nextErrors.price = 'Enter a valid price.';
    return nextErrors;
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateProduct();
    setErrors(nextErrors);
    setStatus('');
    if (Object.keys(nextErrors).length) return;

    addProduct({
      ...product,
      image:
        product.image ||
        categories.find((category) => category.name === product.category)?.image ||
        'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80',
    });
    setProduct(initialProduct);
    setStatus('Product added to the marketplace.');
  }

  return (
    <main className="min-h-screen bg-surface">
      <div className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 font-semibold text-ink">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-ink text-sm text-white">F</span>
            <span>Farm2Homez</span>
          </Link>
          <Button variant="secondary" onClick={logout} className="gap-2">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">{isSeller ? 'Seller dashboard' : 'Customer account'}</p>
          <h1 className="mt-3 text-3xl font-semibold text-ink">Welcome, {user?.username || 'operator'}</h1>
          <p className="mt-3 max-w-2xl text-muted">
            {isSeller ? 'Add products, set prices, and publish items to the marketplace.' : 'Customers can shop products, manage carts, and checkout.'}
          </p>
        </div>

        {!isSeller ? (
          <Card className="p-8">
            <Store className="h-7 w-7 text-muted" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-semibold text-ink">Seller tools are only available for seller accounts</h2>
            <p className="mt-2 text-sm text-muted">Sign out and choose Seller on the sign-in page to manage products.</p>
            <Button as={Link} to="/products" className="mt-6">
              Continue shopping
            </Button>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
            <Card className="h-fit p-6">
              <div className="flex items-center gap-3">
                <PackagePlus className="h-5 w-5 text-ink" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-ink">Add product</h2>
              </div>
              <form className="mt-6 grid gap-4" onSubmit={handleSubmit} noValidate>
                <Toast message={status} />
                <Input id="name" name="name" label="Product name" value={product.name} onChange={updateField} error={errors.name} />
                <label className="block" htmlFor="category">
                  <span className="mb-2 block text-sm font-medium text-ink">Category</span>
                  <select id="category" name="category" value={product.category} onChange={updateField} className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink">
                    {categories.map((category) => (
                      <option key={category.name} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Textarea id="description" name="description" label="Description" value={product.description} onChange={updateField} error={errors.description} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input id="price" name="price" label="Price" type="number" min="1" value={product.price} onChange={updateField} error={errors.price} />
                  <Input id="unit" name="unit" label="Unit" placeholder="1 kg" value={product.unit} onChange={updateField} error={errors.unit} />
                </div>
                <label className="block" htmlFor="stock">
                  <span className="mb-2 block text-sm font-medium text-ink">Availability</span>
                  <select id="stock" name="stock" value={product.stock} onChange={updateField} className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink">
                    <option>In stock</option>
                    <option>Limited</option>
                    <option>Out of stock</option>
                  </select>
                </label>
                <Input id="image" name="image" label="Image URL" placeholder="Optional" value={product.image} onChange={updateField} />
                <Button type="submit" className="w-full">
                  Publish product
                </Button>
              </form>
            </Card>

            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-ink">Your products</h2>
                <Button as={Link} to="/products" variant="secondary">
                  View marketplace
                </Button>
              </div>
              {sellerProducts.length ? (
                <div className="grid gap-4">
                  {sellerProducts.map((item) => (
                    <Card key={item.id} className="grid gap-4 p-4 sm:grid-cols-[88px_1fr_auto] sm:items-center">
                      <img src={item.image} alt={item.name} className="h-24 w-24 rounded-md object-cover" />
                      <div>
                        <p className="text-sm font-medium text-muted">{item.category}</p>
                        <h3 className="mt-1 font-semibold text-ink">{item.name}</h3>
                        <p className="mt-1 text-sm text-muted">{item.unit} · {item.stock}</p>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
                        <p className="font-semibold text-ink">₹{item.price}</p>
                        <button
                          type="button"
                          className="mt-0 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-ink sm:mt-3"
                          onClick={() => removeSellerProduct(item.id)}
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center">
                  <h3 className="font-semibold text-ink">No seller products yet</h3>
                  <p className="mt-2 text-sm text-muted">Add your first item to publish it into the product listing.</p>
                </Card>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
