import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { Role, User } from '@/api/types';

export const API = 'http://localhost:3000/api';

export function makeUser(role: Role = 'CONSUMER', overrides: Partial<User> = {}): User {
  return {
    id: 1,
    email: `${role.toLowerCase()}@example.com`,
    full_name: 'Asha Menon',
    phone_number: '+919900000111',
    role,
    email_verified: true,
    date_joined: '2026-01-01T00:00:00Z',
    producer:
      role === 'PRODUCER'
        ? { id: 1, farm_name: 'Green Valley Farms', slug: 'green-valley-farms', verification_status: 'VERIFIED', verification_note: '' }
        : null,
    ...overrides,
  };
}

/** Default handlers: an anonymous visitor (no refresh cookie) and empty catalogue data. */
export const defaultHandlers = [
  http.get(`${API}/auth/csrf/`, () => HttpResponse.json({ detail: 'ok' }, { headers: { 'Set-Cookie': 'csrftoken=test-csrf; Path=/' } })),
  http.post(`${API}/auth/refresh/`, () => HttpResponse.json({ code: 'no_session', message: 'You are not signed in.', errors: {} }, { status: 401 })),
  http.get(`${API}/categories/`, () => HttpResponse.json([])),
  http.get(`${API}/cart/`, () =>
    HttpResponse.json({ items: [], groups: [], subtotal: '0.00', delivery_total: '0.00', total: '0.00', item_count: 0, can_checkout: false }),
  ),
  http.get(`${API}/consumers/me/favorites/products/`, () => HttpResponse.json({ count: 0, next: null, previous: null, results: [] })),
];

/** Handlers for a signed-in user restored from the refresh cookie. */
export function signedIn(user: User) {
  return [
    http.post(`${API}/auth/refresh/`, () => HttpResponse.json({ access: 'access-token', user })),
    http.get(`${API}/auth/me/`, () => HttpResponse.json(user)),
  ];
}

export const server = setupServer(...defaultHandlers);
