import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { safeNext } from '@/pages/auth/AuthShell';
import { API, makeUser, server, signedIn } from './server';
import { renderApp } from './render';

const location = () => screen.getByTestId('location').textContent;

describe('route guards', () => {
  it('sends visitors to the matching portal login with a return path', async () => {
    renderApp('/producer/dashboard');
    await waitFor(() => expect(location()).toBe('/producer/login?next=%2Fproducer%2Fdashboard'));
    expect(await screen.findByRole('heading', { name: 'Sign in to your farm' })).toBeInTheDocument();
  });

  it('blocks a consumer from the admin portal even with a hand-typed URL', async () => {
    server.use(...signedIn(makeUser('CONSUMER')));
    renderApp('/admin/users');
    expect(await screen.findByRole('heading', { name: "This area isn't for your account" })).toBeInTheDocument();
    expect(screen.getByText(/You're signed in as a shopper/)).toBeInTheDocument();
  });
});

describe('login', () => {
  async function submit(email: string, password: string) {
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email'), email);
    await user.type(screen.getByLabelText('Password'), password);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
  }

  it('sends the portal role and returns to the requested page', async () => {
    let body: Record<string, string> | undefined;
    server.use(
      http.post(`${API}/auth/login/`, async ({ request }) => {
        body = (await request.json()) as Record<string, string>;
        return HttpResponse.json({ access: 'token', user: makeUser('CONSUMER') });
      }),
    );
    renderApp('/consumer/login?next=/consumer/orders');
    await submit('asha@example.com', 'Harvest2026x');
    await waitFor(() => expect(location()).toBe('/consumer/orders'));
    expect(body).toEqual({ email: 'asha@example.com', password: 'Harvest2026x', role: 'CONSUMER' });
  });

  it('points a producer who used the shopper portal to the right place', async () => {
    server.use(
      http.post(`${API}/auth/login/`, () =>
        HttpResponse.json(
          { code: 'wrong_portal', message: 'This is not a consumer account. Please sign in through the producer portal.', errors: { portal: 'PRODUCER' } },
          { status: 403 },
        ),
      ),
    );
    renderApp('/consumer/login');
    await submit('farmer@example.com', 'Harvest2026x');
    expect(await screen.findByText(/not a consumer account/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the producer sign-in' })).toHaveAttribute('href', '/producer/login?email=farmer%40example.com');
  });

  it('offers verification when the email is not verified', async () => {
    server.use(
      http.post(`${API}/auth/login/`, () =>
        HttpResponse.json({ code: 'email_not_verified', message: 'Please verify your email address before signing in.', errors: {} }, { status: 403 }),
      ),
    );
    renderApp('/consumer/login');
    await submit('asha@example.com', 'Harvest2026x');
    expect(await screen.findByRole('link', { name: 'Verify your email' })).toHaveAttribute('href', '/verify-email?email=asha%40example.com&role=CONSUMER');
  });

  it('validates before calling the API', async () => {
    renderApp('/consumer/login');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter the email you registered with.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
  });
});

describe('registration', () => {
  it('checks password rules and confirmation on the client', async () => {
    renderApp('/consumer/register');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Full name'), 'Asha Menon');
    await user.type(screen.getByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'shortpass');
    await user.type(screen.getByLabelText('Confirm password'), 'different');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Use at least 10 characters.')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
  });

  it('shows server field errors next to the field and moves to verification on success', async () => {
    let attempts = 0;
    server.use(
      http.post(`${API}/auth/consumer/register/`, () => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json(
            { code: 'validation_error', message: 'Please correct the highlighted fields.', errors: { email: ['An account with this email already exists.'] } },
            { status: 400 },
          );
        }
        return HttpResponse.json({ detail: 'Account created.', user: makeUser() }, { status: 201 });
      }),
    );
    renderApp('/consumer/register');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Full name'), 'Asha Menon');
    await user.type(screen.getByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'Harvest2026x');
    await user.type(screen.getByLabelText('Confirm password'), 'Harvest2026x');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('An account with this email already exists.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');

    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(location()).toBe('/verify-email?email=asha%40example.com&role=CONSUMER&new=1'));
  });

  it('requires farm details for producers', async () => {
    renderApp('/producer/register');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Submit registration' }));
    expect(await screen.findByText('Enter your farm or business name.')).toBeInTheDocument();
    expect(screen.getByText('A phone number is required for producers.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid PIN code.')).toBeInTheDocument();
  });
});

describe('safeNext', () => {
  it.each([
    ['/consumer/orders', '/consumer/orders'],
    ['//evil.example.com', '/home'],
    ['https://evil.example.com', '/home'],
    [null, '/home'],
  ])('next=%s -> %s', (next, expected) => {
    expect(safeNext(next, '/home')).toBe(expected);
  });
});
