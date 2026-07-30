import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ProductCard } from '../components/common/ProductCard';
import { Footer } from '../components/layout/Footer';
import { Navbar } from '../components/layout/Navbar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { categories } from '../constants/site';
import { useProducts } from '../contexts/ProductContext';

export default function ProductListingPage() {
  const { products } = useProducts();
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState('recommended');
  const [query, setQuery] = useState('');

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return products
      .filter((product) => {
        const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(product.category);
        const matchesPrice = product.price <= maxPrice;
        const matchesStock = !inStockOnly || product.stock === 'In stock';
        const matchesSearch =
          !normalizedQuery ||
          product.name.toLowerCase().includes(normalizedQuery) ||
          product.description.toLowerCase().includes(normalizedQuery) ||
          product.category.toLowerCase().includes(normalizedQuery);

        return matchesCategory && matchesPrice && matchesStock && matchesSearch;
      })
      .sort((a, b) => {
        if (sort === 'newest') return b.id - a.id;
        if (sort === 'rating') return b.rating - a.rating;
        if (sort === 'price-low') return a.price - b.price;
        if (sort === 'price-high') return b.price - a.price;
        return b.reviews - a.reviews;
      });
  }, [inStockOnly, maxPrice, products, query, selectedCategories, sort]);

  function toggleCategory(categoryName) {
    setSelectedCategories((current) =>
      current.includes(categoryName) ? current.filter((item) => item !== categoryName) : [...current, categoryName],
    );
  }

  function clearFilters() {
    setSelectedCategories([]);
    setMaxPrice(1000);
    setInStockOnly(false);
    setSort('recommended');
    setQuery('');
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[260px_1fr] lg:px-8">
        <aside className="h-fit rounded-lg border border-line bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-semibold text-ink">Filters</h1>
            <button type="button" className="text-sm font-medium text-muted hover:text-ink" onClick={clearFilters}>
              Clear
            </button>
          </div>
          <div className="mt-6 grid gap-6">
            <div>
              <h2 className="text-sm font-semibold text-ink">Categories</h2>
              <div className="mt-3 grid gap-2">
                {categories.map((category) => (
                  <label key={category.name} className="flex items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-line accent-ink"
                      checked={selectedCategories.includes(category.name)}
                      onChange={() => toggleCategory(category.name)}
                    />
                    {category.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink">Price range</h2>
              <input
                type="range"
                min="50"
                max="1000"
                step="25"
                value={maxPrice}
                onChange={(event) => setMaxPrice(Number(event.target.value))}
                className="mt-3 w-full accent-ink"
              />
              <p className="mt-2 text-sm text-muted">Up to ₹{maxPrice}</p>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink">Availability</h2>
              <label className="mt-3 flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-line accent-ink"
                  checked={inStockOnly}
                  onChange={(event) => setInStockOnly(event.target.checked)}
                />
                In stock only
              </label>
            </div>
          </div>
        </aside>
        <section>
          <div className="mb-5 grid gap-4 rounded-lg border border-line bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-muted">Marketplace</p>
                <h2 className="mt-1 text-2xl font-semibold text-ink">All products</h2>
              </div>
              <select
                className="h-10 rounded-md border border-line bg-white px-3 text-sm text-ink"
                aria-label="Sort products"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="recommended">Sort: Recommended</option>
                <option value="newest">Newest</option>
                <option value="rating">Best rated</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 w-full rounded-md border border-line bg-surface pl-10 pr-4 text-sm text-ink focus:border-ink focus:bg-white"
                placeholder="Search products in this marketplace"
                aria-label="Search marketplace products"
              />
            </label>
            <p className="text-sm text-muted">
              Showing <span className="font-semibold text-ink">{filteredProducts.length}</span> of {products.length} products
            </p>
          </div>

          {filteredProducts.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <Card className="p-10 text-center">
              <h3 className="text-lg font-semibold text-ink">No products found</h3>
              <p className="mt-2 text-sm text-muted">Try a different category, search term, or price range.</p>
              <Button className="mt-6" onClick={clearFilters}>
                Clear filters
              </Button>
            </Card>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
