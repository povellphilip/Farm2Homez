import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ProductList } from '@/api/types';
import { money } from '@/lib/format';
import { API, makeUser, server, signedIn } from './server';
import { renderApp } from './render';

const avocado: ProductList = {
  id: 1,
  slug: 'hass-avocado',
  name: 'Hass Avocado',
  category: { id: 1, name: 'Fruits', slug: 'fruits' },
  subcategory: null,
  producer: { id: 1, farm_name: 'Green Valley Farms', slug: 'green-valley-farms', location: 'Vythiri, Kerala', state: 'Kerala', is_verified: true },
  price: '320.00',
  currency: 'INR',
  unit: 'kg',
  stock_quantity: 10,
  min_order_quantity: 2,
  origin: 'Vythiri, Kerala',
  is_seasonal: true,
  is_available: true,
  is_organic: true,
  in_season: true,
  is_purchasable: true,
  primary_image: null,
  average_rating: null,
  review_count: 0,
  published_at: '2026-10-01T00:00:00Z',
};

function catalogue(products: ProductList[]) {
  return http.get(`${API}/products/`, () => HttpResponse.json({ count: products.length, next: null, previous: null, results: products }));
}

describe('catalogue', () => {
  it('lists products with price, unit, farm and minimum order', async () => {
    server.use(catalogue([avocado]));
    renderApp('/products');
    const card = (await screen.findByRole('heading', { name: 'Hass Avocado' })).closest('article')!;
    expect(within(card).getByText(money('320.00'))).toBeInTheDocument();
    expect(within(card).getByText('per kg')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Green Valley Farms' })).toHaveAttribute('href', '/farms/green-valley-farms');
    expect(within(card).getByText('Minimum order 2 kg')).toBeInTheDocument();
    // The photo link duplicates the title link, so it is hidden from assistive tech on purpose.
    expect(within(card).getByRole('img', { name: /no photo yet/, hidden: true })).toBeInTheDocument();
  });

  it('keeps search terms in the URL and passes them to the API', async () => {
    let query = '';
    server.use(
      http.get(`${API}/products/`, ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json({ count: 0, next: null, previous: null, results: [] });
      }),
    );
    renderApp('/products?search=honey&organic=true');
    expect(await screen.findByText('Nothing matches yet')).toBeInTheDocument();
    expect(query).toContain('search=honey');
    expect(query).toContain('organic=true');
  });

  it('shows unavailable products without an add button', async () => {
    server.use(catalogue([{ ...avocado, is_purchasable: false }]));
    renderApp('/products');
    const card = (await screen.findByRole('heading', { name: 'Hass Avocado' })).closest('article')!;
    expect(within(card).getByText('Currently unavailable')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /Add Hass Avocado/ })).not.toBeInTheDocument();
  });
});

describe('adding to the basket', () => {
  it('asks visitors to sign in first and remembers where they were', async () => {
    server.use(catalogue([avocado]));
    renderApp('/products');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Add Hass Avocado to basket' }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/consumer/login?next=%2Fproducts'));
  });

  it('adds the minimum order quantity for a signed-in consumer', async () => {
    let sent: unknown;
    server.use(
      ...signedIn(makeUser('CONSUMER')),
      catalogue([avocado]),
      http.post(`${API}/cart/items/`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(
          { items: [], groups: [], subtotal: '640.00', delivery_total: '0.00', total: '640.00', item_count: 2, can_checkout: true },
          { status: 201 },
        );
      }),
    );
    renderApp('/products');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Add Hass Avocado to basket' }));
    expect(await screen.findByText('Hass Avocado added to your basket.')).toBeInTheDocument();
    expect(sent).toEqual({ product_slug: 'hass-avocado', quantity: 2 });
    expect(await screen.findByRole('link', { name: 'Cart, 2 items' })).toBeInTheDocument();
  });

  it('tells producers they cannot buy', async () => {
    server.use(...signedIn(makeUser('PRODUCER')), catalogue([avocado]));
    renderApp('/products');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Add Hass Avocado to basket' }));
    expect(await screen.findByText(/Only shopper accounts can place orders/)).toBeInTheDocument();
  });
});

describe('formatting', () => {
  it('formats rupees without float rounding drift', () => {
    expect(money('1019.00')).toBe('₹1,019');
    expect(money('48.50')).toBe('₹48.50');
    expect(money(null)).toBe('—');
  });
});
