import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { api, setAccessToken } from '@/api/client';
import { toApiError } from '@/api/errors';
import { API, server } from './server';

describe('API client', () => {
  it('refreshes an expired access token once for concurrent requests and retries them', async () => {
    let refreshes = 0;
    server.use(
      http.post(`${API}/auth/refresh/`, () => {
        refreshes += 1;
        return HttpResponse.json({ access: 'fresh-token', user: {} });
      }),
      http.get(`${API}/auth/me/`, ({ request }) =>
        request.headers.get('Authorization') === 'Bearer fresh-token'
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ code: 'token_invalid', message: 'Token is invalid or expired', errors: {} }, { status: 401 }),
      ),
    );
    setAccessToken('stale-token');
    const results = await Promise.all([api.get('/auth/me/'), api.get('/auth/me/'), api.get('/auth/me/')]);
    expect(results.map((result) => result.data)).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshes).toBe(1);
  });

  it('sends the CSRF token on unsafe requests only', async () => {
    document.cookie = 'csrftoken=abc123; path=/';
    const seen: Record<string, string | null> = {};
    server.use(
      http.get(`${API}/products/`, ({ request }) => {
        seen.get = request.headers.get('X-CSRFToken');
        return HttpResponse.json({});
      }),
      http.post(`${API}/inquiries/`, ({ request }) => {
        seen.post = request.headers.get('X-CSRFToken');
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    await api.get('/products/');
    await api.post('/inquiries/', {});
    expect(seen).toEqual({ get: null, post: 'abc123' });
  });

  it('normalises error responses', async () => {
    server.use(
      http.post(`${API}/orders/checkout/`, () =>
        HttpResponse.json({ code: 'price_changed', message: 'Prices changed.', errors: { total: ['369.00'] } }, { status: 409 }),
      ),
    );
    setAccessToken(null);
    const error = await api.post('/orders/checkout/', {}).catch((err) => err);
    const apiError = toApiError(error);
    expect(apiError).toMatchObject({ status: 409, code: 'price_changed', message: 'Prices changed.' });
  });
});
