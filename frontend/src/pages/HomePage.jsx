import { ArrowRight, CheckCircle2, CreditCard, Headphones, PackageCheck, Truck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ContactForm } from '../components/common/ContactForm';
import { ProductCard } from '../components/common/ProductCard';
import { Footer } from '../components/layout/Footer';
import { Navbar } from '../components/layout/Navbar';
import { Section } from '../components/layout/Section';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { categories, testimonials, trustItems } from '../constants/site';
import { useProducts } from '../contexts/ProductContext';

const trustIcons = [PackageCheck, Truck, CreditCard, Headphones];

export default function HomePage() {
  const { products } = useProducts();
  const [selectedCategory, setSelectedCategory] = useState('All categories');
  const [sort, setSort] = useState('recommended');
  const bestSellers = products.slice(0, 4);
  const newArrivals = products.slice(4, 8);
  const displayedProducts = useMemo(
    () =>
      products
        .filter((product) => selectedCategory === 'All categories' || product.category === selectedCategory)
        .sort((a, b) => {
          if (sort === 'price-low') return a.price - b.price;
          if (sort === 'price-high') return b.price - a.price;
          if (sort === 'rating') return b.rating - a.rating;
          return b.reviews - a.reviews;
        }),
    [products, selectedCategory, sort],
  );

  return (
    <div className="min-h-screen bg-white pb-16 lg:pb-0">
      <Navbar />
      <main>
        <section className="border-b border-line bg-surface">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:min-h-[46vh] md:grid-cols-[1fr_420px] md:items-center lg:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">Fresh groceries, delivered simply</p>
              <h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight text-ink sm:text-5xl">
                Shop farm-fresh produce and daily essentials in minutes.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
                Browse curated fruits, vegetables, dairy, organic pantry goods, and beverages with a fast, practical shopping flow.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button as="a" href="#products" className="gap-2">
                  Shop now
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button as="a" href="#categories" variant="secondary">
                  Browse categories
                </Button>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
              <img
                src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80"
                alt="Fresh produce arranged in a grocery market"
                className="h-64 w-full object-cover md:h-80"
              />
              <div className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-semibold text-ink">Featured category</p>
                  <p className="mt-1 text-sm text-muted">Organic Products</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">Fresh today</span>
              </div>
            </div>
          </div>
        </section>

        <Section id="categories" title="Featured categories" description="Find what you need quickly with clean category browsing and familiar product groupings.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <a key={category.name} href="#products" className="group overflow-hidden rounded-lg border border-line bg-white transition hover:-translate-y-0.5 hover:shadow-soft">
                <div className="aspect-[16/9] overflow-hidden bg-surface">
                  <img src={category.image} alt={category.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" />
                </div>
                <div className="flex items-center justify-between p-4">
                  <div>
                    <h3 className="font-semibold text-ink">{category.name}</h3>
                    <p className="mt-1 text-sm text-muted">{category.count}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted transition group-hover:text-ink" aria-hidden="true" />
                </div>
              </a>
            ))}
          </div>
        </Section>

        <section className="bg-surface">
          <Section id="products" title="Popular products" description="A clean marketplace grid focused on product discovery, quick selection, and cart conversion.">
            <div className="mb-6 flex flex-col gap-3 rounded-lg border border-line bg-white p-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted">Showing <span className="font-semibold text-ink">{products.length}</span> products available for delivery</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <select
                  className="h-10 rounded-md border border-line bg-white px-3 text-sm text-ink"
                  aria-label="Filter category"
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                >
                  <option>All categories</option>
                  {categories.map((category) => (
                    <option key={category.name}>{category.name}</option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-md border border-line bg-white px-3 text-sm text-ink"
                  aria-label="Sort products"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="recommended">Sort: Recommended</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Customer Rating</option>
                </select>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {displayedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </Section>
        </section>

        <Section id="best-sellers" title="Best sellers" description="Top-rated products customers add again and again.">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {bestSellers.map((product) => (
              <ProductCard key={product.id} product={product} compact />
            ))}
          </div>
        </Section>

        <section className="bg-surface">
          <Section id="new-arrivals" title="New arrivals" description="Fresh additions selected for seasonal shopping and pantry replenishment.">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {newArrivals.map((product) => (
                <ProductCard key={product.id} product={product} compact />
              ))}
            </div>
          </Section>
        </section>

        <Section title="Shop with confidence">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {trustItems.map((item, index) => {
              const Icon = trustIcons[index];
              return (
                <Card key={item.title} className="p-5">
                  <Icon className="h-5 w-5 text-ink" aria-hidden="true" />
                  <h3 className="mt-4 font-semibold text-ink">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
                </Card>
              );
            })}
          </div>
        </Section>

        <section className="border-y border-line bg-surface">
          <Section title="Customer reviews">
            <div className="grid gap-4 md:grid-cols-3">
              {testimonials.map((testimonial) => (
                <Card key={testimonial.name} className="p-5">
                  <div className="flex gap-1 text-ink" aria-label="Five star rating">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <CheckCircle2 key={index} className="h-4 w-4" aria-hidden="true" />
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-ink">"{testimonial.quote}"</p>
                  <p className="mt-4 text-sm font-semibold text-ink">{testimonial.name}</p>
                </Card>
              ))}
            </div>
          </Section>
        </section>

        <Section id="contact" title="Contact Farm2Homez" description="Questions about delivery, bulk orders, or product availability? Send a quick message.">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-ink">Business support</h3>
              <p className="mt-3 text-sm leading-6 text-muted">
                The form connects to your Django contact API, stores submissions, and triggers configured email notifications.
              </p>
              <div className="mt-6 grid gap-3 text-sm text-muted">
                <span>Fresh produce orders</span>
                <span>Bulk grocery enquiries</span>
                <span>Delivery and support questions</span>
              </div>
            </Card>
            <Card className="p-6 sm:p-8">
              <ContactForm />
            </Card>
          </div>
        </Section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 border-t border-line bg-white lg:hidden">
        {['Shop', 'Search', 'Wishlist', 'Cart'].map((item) => (
          <a key={item} href="#products" className="px-2 py-3 text-center text-xs font-medium text-ink">
            {item}
          </a>
        ))}
      </nav>
      <Footer />
    </div>
  );
}
