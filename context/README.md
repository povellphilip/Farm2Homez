# Farm2Home — project guide

Farm2Home is a farm-to-consumer marketplace for India. Verified farms list their produce, customers buy from one or several farms in a single checkout, and each farm fulfils its own part of the order. Administrators verify farms, moderate listings and keep an audit trail of every sensitive action.

This guide explains what the project contains, how it works, and how to run it from a fresh machine to a working site. For hosting it on Amazon Web Services, see [AWS_SETUP.md](AWS_SETUP.md).

**Contents**

1. [What the product does](#1-what-the-product-does)
2. [How it is built](#2-how-it-is-built)
3. [Repository layout](#3-repository-layout)
4. [Data model](#4-data-model)
5. [Business rules](#5-business-rules)
6. [Security model](#6-security-model)
7. [API overview](#7-api-overview)
8. [Configuration reference](#8-configuration-reference)
9. [Running it locally, start to finish](#9-running-it-locally-start-to-finish)
10. [Everyday tasks](#10-everyday-tasks)
11. [Tests](#11-tests)
12. [Troubleshooting](#12-troubleshooting)
13. [Known limitations and next steps](#13-known-limitations-and-next-steps)

---

## 1. What the product does

There are three kinds of account, each with its own sign-in page and portal. The server enforces every role rule; the website only hides what a role cannot use.

### Consumers (shoppers) — `/consumer/...`

- Register, verify their email with a 6-digit code, sign in, reset a forgotten password.
- Browse and search the marketplace; filter by category, price, availability, organic and seasonal; sort by newest, price or name.
- See product pages (photos, price per unit, minimum order, origin, harvest information, reviews) and farm profiles.
- Keep a basket on the server. One basket can hold products from several farms.
- Check out with a saved or new address and cash on delivery. A clearly labelled test payment exists for development only.
- Follow each farm's part of an order (awaiting farm → confirmed → preparing → shipped → delivered), cancel before a farm starts preparing, and review products after delivery.
- Save favourite products and farms, manage addresses, message farms and read replies, and change their details and password.

### Producers (farmers) — `/producer/...`

- Register a farm (owner details, farm description, address, optional registration number and verification notes).
- New farms are **pending verification**: they can sign in and prepare draft listings, but cannot publish until an administrator verifies them.
- Dashboard with real figures: sales over 30 days (chart and table), orders awaiting action, live listings, product views, best sellers, low stock.
- Create, edit, preview, publish, unpublish and delete listings (name, category and subcategory, description, price, unit, stock, minimum order, origin, harvest information, seasonal dates, organic flag, available or paused). Up to 8 photos per listing, reorderable.
- Accept or decline orders (declining needs a reason), and move them through preparing, shipped, out for delivery and delivered. Producers see only their own items in an order, plus the delivery details needed to ship them.
- Answer customer inquiries, edit the farm profile, and opt in to showing a WhatsApp button.

### Administrators — `/admin/...`

- Admin accounts are created only with a command (`create_admin`), never through public registration.
- Platform overview: sales, orders, live listings, farms, sign-ups, top farms and status breakdowns.
- Verify farms or request changes, suspend or reactivate any account (with a reason), approve or remove listings, override order statuses, answer contact-form messages, manage categories, and read the audit log.

### Public pages

Home, market (catalogue), category pages, product pages, farm directory and farm profiles, how it works, FAQ, contact, privacy and terms.

---

## 2. How it is built

```
Browser (React app)
   │  same domain: /           → website files
   │               /api/*      → Django API
   │               /media/*    → product photos
   ▼
CloudFront (CDN, HTTPS, security headers)        ← production only
   ├── S3 bucket: built website
   ├── S3 bucket: product photos
   └── App Runner: Django API container ──► RDS PostgreSQL (private network)
                                       └──► Amazon SES (email)
```

In local development there is no CloudFront: the Vite dev server serves the React app on port 5173 and forwards `/api` and `/media` to Django on port 8000. The browser therefore always talks to a single origin, which keeps cookies and security simple in both setups.

| Layer | Technology |
| --- | --- |
| Website | React 18, TypeScript, Vite 6, Tailwind CSS 3, React Router 6, TanStack Query 5, React Hook Form + Zod, Axios |
| API | Python 3.12 (3.11 also works), Django 5.2, Django REST Framework, Simple JWT, django-filter, drf-spectacular (OpenAPI) |
| Database | PostgreSQL 16 in production; SQLite by default on a developer machine |
| Files | Local disk in development; Amazon S3 (private) behind CloudFront in production |
| Email | Printed to the terminal in development; Amazon SES over SMTP in production |
| Tests | pytest + pytest-django, moto (fake S3), embedded PostgreSQL; Vitest + Testing Library + MSW; Playwright + axe |
| Infrastructure | Terraform (AWS), Docker, GitHub Actions |

Design system: forest green, warm ivory, sage, charcoal and terracotta, with Fraunces for headings and Instrument Sans for text. Colours are defined once in `frontend/tailwind.config.js`.

---

## 3. Repository layout

```
Farm2Homez/
├── backend/                     Django API
│   ├── config/                  settings.py (development/test/production), urls.py, wsgi/asgi
│   ├── apps/
│   │   ├── core/                error format, permissions, audit log, email, health checks,
│   │   │                        CloudFront origin check, S3 media storage, migrate_with_lock
│   │   ├── accounts/            users, roles, registration, codes, login, tokens, create_admin
│   │   ├── producers/           farm profiles, public farm directory, verification
│   │   ├── consumers/           addresses, favourite products and farms
│   │   ├── products/            categories, products, photos, uploads, sitemap, seed_demo
│   │   ├── cart/                server-side basket
│   │   ├── orders/              checkout, per-farm fulfilment, status rules, pricing
│   │   ├── payments/            payment providers (cash on delivery, test payment)
│   │   ├── inquiries/           messages to farms or the Farm2Home team, replies
│   │   ├── reviews/             reviews of delivered products
│   │   ├── analytics/           product view counts, producer and platform reports
│   │   └── administration/      admin-only API (verification, suspension, moderation, ...)
│   ├── tests/                   pytest suite
│   ├── demo_data/               demo photos for seed_demo (credits in CREDITS.md)
│   ├── scripts/test_postgres.py run tests on a throwaway embedded PostgreSQL
│   ├── openapi.yml              generated API description (kept in sync by CI)
│   ├── Dockerfile, docker-entrypoint.sh, gunicorn.conf.py
│   └── requirements.txt, requirements-dev.txt, pytest.ini, ruff.toml, .env.example
├── frontend/                    React website
│   ├── src/
│   │   ├── api/                 client (tokens, CSRF, refresh), error handling, typed queries,
│   │   │                        schema.d.ts generated from backend/openapi.yml
│   │   ├── auth/                session provider and route guards
│   │   ├── components/          ui kit, layout, product cards, forms
│   │   ├── pages/               public, auth, consumer, producer, admin
│   │   ├── lib/                 formatting, SEO tags
│   │   ├── test/                Vitest unit and component tests
│   │   └── routes.tsx           every URL in the app
│   ├── e2e/                     Playwright journeys and accessibility audits
│   ├── public/                  favicon, robots.txt, site images (credits in images/CREDITS.md)
│   └── package.json, vite.config.ts, tailwind.config.js, playwright.config.ts, .env.example
├── infra/terraform/             all AWS resources as code
├── .github/workflows/           ci.yml (tests on every push), deploy.yml (deploy main to AWS)
├── docker-compose.yml           optional: PostgreSQL + API + website in containers
└── context/                     this guide and the AWS setup guide
```

---

## 4. Data model

```
User (email login, role CONSUMER | PRODUCER | ADMIN, email_verified, is_active)
 ├── ProducerProfile (1:1)  farm details, verification status, WhatsApp opt-in
 │     └── Product (many)   category, subcategory, price, unit, stock, minimum order, status,
 │           │               moderation status, seasonal dates
 │           └── ProductImage (many)   stored file, size, dimensions, position
 ├── Address (many)         delivery addresses, one default
 ├── CartItem (many)        product + quantity
 ├── FavoriteProduct / FavoriteProducer
 ├── Order (many)           number, totals, delivery address snapshot, payment method,
 │     │                     idempotency key
 │     ├── Payment (1:1)    provider, status, is_test
 │     └── ProducerOrder (one per farm)   fulfilment status, subtotal, delivery fee, timestamps
 │           ├── OrderItem  snapshot of product name, unit and price at purchase
 │           └── OrderStatusEvent   who changed the status, when, and why
 ├── Inquiry → InquiryReply
 └── Review (one per product per customer)

Category (two levels: category → subcategories)
OneTimeCode (hashed email-verification and password-reset codes)
AuditLog (append-only record of admin and security events)
ProductViewDaily (view counts per product per day)
PendingUpload (short-lived permission for a direct S3 photo upload)
```

Money is stored as decimals, never floating point. Database constraints enforce positive prices, minimum order of at least 1, valid availability dates, one default address per user, one review per product per customer, and one order per idempotency key per customer.

---

## 5. Business rules

| Rule | Where it lives |
| --- | --- |
| Five default categories (Fruits, Vegetables, Plantation Crops, Honey & Bee Products, Livestock Products) with subcategories are installed by a migration. Admins can add more. | `apps/products/catalog_data.py` |
| A listing is public only if published, approved by moderation, in an active category, and its farm is verified and active. | `ProductQuerySet.public()` |
| Producers must be verified to publish (`PRODUCER_VERIFICATION_REQUIRED`). | `apps/products/services.py` |
| Optional pre-moderation of every listing (`PRODUCT_PREMODERATION`). A rejected listing always returns to review when republished. | same |
| Delivery fee per farm in an order: ₹49, free when that farm's part is ₹500 or more (`DELIVERY_FEE_PER_PRODUCER`, `FREE_DELIVERY_THRESHOLD`). **Placeholders: confirm the real values.** | `apps/orders/pricing.py` |
| Totals are always calculated on the server. The checkout sends the total the customer saw; if prices changed, the order is refused with a clear message. | `apps/orders/services.py` |
| Stock cannot be oversold: product rows are locked during checkout and stock only decreases if enough remains. | same |
| Repeated or double-clicked checkouts with the same idempotency key return the original order. | same |
| Fulfilment steps per farm: PENDING → CONFIRMED → PROCESSING → SHIPPED / OUT_FOR_DELIVERY → DELIVERED. Farms may decline (REJECTED) a pending order; orders may be CANCELLED before shipping. Declining or cancelling needs a reason and returns stock. | `apps/orders/models.py` (`TRANSITIONS`) |
| Customers can cancel parts that are pending or confirmed. Farms cannot "cancel" a pending order; they decline it. Admins can apply any allowed step. | `services.transition()` |
| Cash on delivery is marked paid when every part is delivered. The test payment is marked paid immediately, flagged as a test, and refunded on cancellation. It is switched off in production. | `apps/payments/providers.py` |
| Reviews are allowed only after the product has been delivered to that customer. | `apps/reviews/views.py` |
| Photos: JPEG, PNG or WebP, up to 5 MB and 8 per listing; resized to 2000 px and re-encoded, which removes hidden metadata such as GPS location. | `apps/products/services.py` |

---

## 6. Security model

- **Passwords** are hashed by Django and must be at least 10 characters with a letter and a number, not common and not similar to the email address.
- **Email codes** are 6 digits, stored only as a keyed hash, expire after 15 minutes, allow 5 attempts and are single-use.
- **Sessions**: login returns a 15-minute access token, kept only in the page's memory and never in local storage. The 7-day refresh token is an `HttpOnly`, `SameSite=Lax` cookie limited to `/api/auth/` (`Secure` in production). Refresh tokens rotate on use, and old ones are blacklisted. Logout, password reset, password change and suspension revoke them.
- **CSRF**: the endpoints that read the refresh cookie (login, refresh, logout) require Django's CSRF token header.
- **Portals**: each sign-in page sends its role; a shopper cannot sign in through the producer or admin page, and vice versa.
- **Authorisation** happens on the server for every request: role checks plus ownership filters. A producer only ever queries their own listings and orders, and a shopper only their own basket, orders and addresses. Admin endpoints require the ADMIN role, and Django's `is_staff` flag alone grants nothing in the app.
- **Rate limits**: sign-in 10 per minute, registration 10 per hour, code requests 10 per hour, plus general limits per visitor and per user. Messages, checkout, uploads and view counting have their own limits.
- **No account enumeration**: "forgot password" and "resend code" answer the same way whether or not the email exists.
- **Uploads**: types and sizes are checked, images are re-encoded, file names are generated by the server, and in production browsers upload straight to a private bucket using a 5-minute signed permission for one file.
- **Production guard rails**: the app refuses to start without a real secret key and PostgreSQL. HTTPS, HSTS, secure cookies and clickjacking protection are on. CloudFront adds a secret header and the API rejects requests without it, so the API can't be used directly, bypassing the CDN.
- **Audit log** of farm verification decisions, suspensions, listing moderation, admin order overrides, category changes, admin sign-ins and failed admin sign-ins, and password resets.
- **Privacy**: farms see only the delivery name, phone and address for their items, never the customer's email unless the customer messages them. Reviews show first names only. WhatsApp numbers appear only when a farm opts in. Product view counts are aggregated per day; there is no per-visitor tracking.

What this does **not** guarantee: no system is "fully secure". Remaining risks and recommended next steps (WAF, enforced Content-Security-Policy, penetration test, legal review of privacy terms, multi-factor sign-in for admins) are listed in [AWS_SETUP.md, section 9](AWS_SETUP.md#9-security-checklist-and-remaining-risks).

---

## 7. API overview

Interactive documentation with every field is served by the running API at **`/api/docs/`** (Swagger UI); the raw description is at `/api/schema/` and in `backend/openapi.yml`.

Errors always look like `{"code": "...", "message": "...", "errors": {field: [messages]}}`; lists are paginated as `{"count", "next", "previous", "results"}`.

| Area | Endpoints (prefix `/api`) |
| --- | --- |
| Health | `GET /health/` (database check), `GET /health/live/` |
| Auth | `GET /auth/csrf/` · `POST /auth/consumer/register/` · `POST /auth/producer/register/` · `POST /auth/verify-email/` (+ `/resend/`) · `POST /auth/login/` · `POST /auth/refresh/` · `POST /auth/logout/` · `POST /auth/password/forgot/` · `POST /auth/password/reset/` · `POST /auth/password/change/` · `GET, PATCH /auth/me/` |
| Catalogue (public) | `GET /categories/` · `GET /products/` (filters: `search`, `category`, `producer`, `state`, `min_price`, `max_price`, `in_stock`, `organic`, `seasonal`, `ordering`, `page`, `page_size`) · `GET /products/{slug}/` · `GET /producers/` · `GET /producers/{slug}/` · `GET /reviews/?product={slug}` · `GET /orders/payment-methods/` · `GET /seo/sitemap.xml` |
| Consumer | `GET, DELETE /cart/` · `POST /cart/items/` · `PATCH, DELETE /cart/items/{id}/` · `POST /orders/checkout/` (header `Idempotency-Key`) · `GET /orders/` · `GET /orders/{number}/` · `POST /orders/{number}/cancel/` · `/consumers/me/addresses/` (CRUD, `set-default`) · `/consumers/me/favorites/products/`, `/producers/` · `GET /inquiries/mine/`, `POST /inquiries/mine/{id}/reply/` · `POST, PATCH, DELETE /reviews/` |
| Producer | `GET, PATCH /producers/me/` · `POST /producers/me/resubmit-verification/` · `/producers/me/products/` (CRUD, `publish`, `unpublish`, `images`, `images/upload-url`, `images/confirm`, `images/order`, `images/{id}`) · `GET /producers/me/orders/`, `POST /producers/me/orders/{id}/status/` · `/producers/me/inquiries/` (`reply`, `close`) · `GET /analytics/producer/overview/` |
| Anyone | `POST /inquiries/` (to a farm or the team) · `POST /analytics/product-views/` |
| Admin | `/admin/users/` (`suspend`, `reactivate`) · `/admin/producers/` (`verification`) · `/admin/products/` (`moderate`) · `/admin/orders/` (`fulfillments/{id}/status`) · `/admin/inquiries/` (`reply`, `close`) · `/admin/categories/` (CRUD) · `/admin/audit-logs/` · `/admin/reports/overview/` |

The website's TypeScript types are generated from this description (`npm run api:types`), so a change to the API that would break the website shows up as a type error.

---

## 8. Configuration reference

### Backend (`backend/.env`, all optional in development)

| Variable | Default (development) | Purpose |
| --- | --- | --- |
| `DJANGO_ENV` | `development` | `development`, `production` (tests set `test` themselves) |
| `DEBUG` | `True` in development | Must be `False` in production (enforced) |
| `SECRET_KEY` | development key | **Required** in production |
| `JWT_SIGNING_KEY`, `JWT_ACCESS_MINUTES`, `JWT_REFRESH_DAYS` | `SECRET_KEY`, 15, 7 | Token signing and lifetimes |
| `DATABASE_URL` | SQLite file `backend/db.sqlite3` | PostgreSQL URL; **required** (PostgreSQL only) in production |
| `DB_SSL_REQUIRE`, `DB_CONN_MAX_AGE` | `False`, 60 | Database connection options (SSL on in production) |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,testserver` | Host names Django answers to |
| `FRONTEND_URL` | `http://localhost:5173` | Absolute site address for the sitemap (empty: use the request's host) |
| `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` | localhost:5173 | Only needed if the site and API are on different origins |
| `NUM_PROXIES` | empty | Trusted proxies in front of Django (2 behind CloudFront + App Runner) |
| `ORIGIN_VERIFY_SECRET` | empty | When set, requests without CloudFront's secret header are refused |
| `STORAGE_BACKEND` | `local` | `local` or `s3` |
| `AWS_STORAGE_BUCKET_NAME`, `AWS_S3_REGION_NAME`, `MEDIA_PUBLIC_BASE` | –, `ap-south-1`, `/media/` | S3 media settings |
| `EMAIL_BACKEND` | console (prints emails) | SMTP in production |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` | –, 587, –, –, `True` | SMTP server (SES in production) |
| `DEFAULT_FROM_EMAIL`, `ADMIN_NOTIFICATION_EMAIL` | example addresses | Sender, and who receives contact-form messages |
| `PRODUCER_VERIFICATION_REQUIRED`, `PRODUCT_PREMODERATION` | `True`, `False` | Business rules |
| `DELIVERY_FEE_PER_PRODUCER`, `FREE_DELIVERY_THRESHOLD` | `49.00`, `500.00` | Delivery pricing |
| `PAYMENTS_MOCK_ENABLED` | `True` (always `False` in production by default) | Shows the test payment option |
| `AUTH_LOGIN_RATE` | `10/min` | Sign-in rate limit |
| `LOG_LEVEL`, `APP_LOG_LEVEL` | `INFO` | Logging (JSON in production) |

### Website (`frontend/.env.local`, optional)

| Variable | Purpose |
| --- | --- |
| `VITE_SITE_URL` | Public site address for canonical links, social previews, structured data and robots.txt. Leave empty locally. |
| `VITE_DEV_API_TARGET` | Where the dev server forwards `/api` and `/media` (default `http://127.0.0.1:8000`). |

---

## 9. Running it locally, start to finish

These steps take a new computer from nothing to the full site with demo data. Commands are shown for **Windows (PowerShell)** and **macOS/Linux** where they differ.

### Step 1 — install the tools

| Tool | Version | Get it from |
| --- | --- | --- |
| Git | any recent | https://git-scm.com |
| Python | **3.12** (3.11 works) | https://www.python.org/downloads/ (on Windows tick "Add python.exe to PATH") |
| Node.js | **22 LTS** (20 also works) | https://nodejs.org |
| Docker Desktop | optional | only for the Docker route in step 7 |

Check them:

```
git --version
python --version        # macOS/Linux may need: python3 --version
node --version
npm --version
```

> On this project's original Windows machine, the installed Python was the pre-release `3.11.0rc2`. It works, but install a stable 3.12 when you can.

### Step 2 — get the code

```
git clone <repository-url> Farm2Homez
cd Farm2Homez
git checkout f2h-rebuild      # until the work is merged into main
```

### Step 3 — set up the API

```
cd backend
python -m venv .venv
```

Activate the virtual environment (do this in every new terminal you use for the backend):

```
# Windows PowerShell
.venv\Scripts\Activate.ps1
# Windows Command Prompt
.venv\Scripts\activate.bat
# macOS / Linux
source .venv/bin/activate
```

> If PowerShell refuses to run the script, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

Install dependencies and prepare the database:

```
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py createcachetable
python manage.py seed_demo --with-admin
```

`migrate` creates the database tables (SQLite file `backend/db.sqlite3`) and the five categories. `createcachetable` creates the table used for rate limiting. `seed_demo` adds four verified farms with 15 photographed products, one farm waiting for verification, two shoppers and an admin.

You don't need a `.env` file for local development. To change a setting, copy `backend/.env.example` to `backend/.env` and edit it.

Start the API:

```
python manage.py runserver
```

Leave this terminal running. Check http://127.0.0.1:8000/api/health/, which should show `{"status": "ok", "database": "ok"}`, and the API documentation at http://127.0.0.1:8000/api/docs/.

### Step 4 — set up the website (second terminal)

```
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Always use this address, not port 8000: the dev server forwards `/api` and `/media` to Django, so the browser sees one site, as it will in production.

### Step 5 — sign in with the demo accounts

All demo accounts use the password **`FarmDemo2026`**.

| Role | Sign-in page | Email |
| --- | --- | --- |
| Shopper | `/consumer/login` | `asha@demo.farm2home.example` (also `vikram@...`) |
| Verified farm | `/producer/login` | `greenvalley@demo.farm2home.example` (also `malnad@`, `nilgiribees@`, `sunrise@`) |
| Farm awaiting verification | `/producer/login` | `newfarm@demo.farm2home.example` |
| Admin | `/admin/login` | `admin@demo.farm2home.example` |

### Step 6 — try a full journey

1. As the shopper, add Hass Avocado and Wild Forest Honey to the basket, check out with a new address and cash on delivery. The order splits into two farm parts.
2. As Green Valley Farms, open **Orders**, accept the order and move it to delivered.
3. As Nilgiri Bee Collective, decline its part with a reason. The honey goes back into stock.
4. As the shopper, open the order: one part delivered with a "Write a review" button, one part declined with the farm's reason.
5. As the admin, verify "Kuttanad Paddy & Greens" under **Producers**; that farm can now publish.

**Emails during development are printed in the Django terminal**, not sent. When you register a new account, copy the 6-digit code from that terminal into the verification page.

### Step 7 (optional) — run everything in Docker instead

With Docker Desktop running, from the repository root:

```
docker compose up --build
docker compose exec backend python manage.py seed_demo --with-admin
```

Then open http://localhost:5173. This uses PostgreSQL instead of SQLite. Stop with `Ctrl+C`, and remove everything including the database with `docker compose down -v`.

> The Compose file and Dockerfile were written and reviewed but could not be run on the development machine, which has no Docker. The GitHub deploy workflow builds the Dockerfile on every deployment.

### Step 8 — build for production (what the deploy pipeline does)

```
# website
cd frontend
npm run build                      # type-checks, then writes frontend/dist/
# set VITE_SITE_URL=https://your-domain first for correct canonical links

# API image (needs Docker)
cd ../backend
docker build -t farm2home-api .
```

Deploying to AWS is covered step by step in [AWS_SETUP.md](AWS_SETUP.md).

---

## 10. Everyday tasks

Run backend commands from `backend/` with the virtual environment active.

| Task | Command |
| --- | --- |
| Create an administrator | `python manage.py create_admin --email you@example.com --name "Your Name"` (prompts for the password; add `--django-admin` to also open `/django-admin/`) |
| Reset the local database | delete `backend/db.sqlite3` and `backend/media/`, then run `migrate`, `createcachetable` and `seed_demo --with-admin` again |
| Load demo data again | `python manage.py seed_demo --with-admin` (safe to repeat; refuses to run in production) |
| Change a model | edit `models.py`, then `python manage.py makemigrations` and `python manage.py migrate` |
| After changing the API | `python manage.py spectacular --file openapi.yml`, then in `frontend/`: `npm run api:types` |
| Lint the backend | `ruff check .` (auto-fix: `ruff check . --fix`) |
| Type-check the website | `npm run typecheck` (in `frontend/`) |
| Django's own admin screens | http://127.0.0.1:8000/django-admin/ (needs an account created with `--django-admin`) |
| Use PostgreSQL locally without Docker | `python scripts/test_postgres.py` shows the pattern; or set `DATABASE_URL=postgresql://user:pass@localhost:5432/farm2home` in `backend/.env` |

---

## 11. Tests

| Suite | Command | What it covers |
| --- | --- | --- |
| Backend, SQLite | `pytest` (in `backend/`) | 143 tests: registration and codes, portals and roles, tokens and CSRF, rate limits, catalogue visibility and filters, ownership, publishing and moderation, image validation, S3 direct uploads (fake S3), cart, checkout totals and stock, idempotency, status rules, payments, privacy of orders, admin actions, audit log, inquiries, reviews, analytics, sitemap, CloudFront origin check, deployment commands |
| Backend, PostgreSQL | `python scripts/test_postgres.py --migrations` | The same suite on a throwaway embedded PostgreSQL, plus the two concurrency tests that need real row locks (12 buyers racing for 5 units; simultaneous double submits) |
| Website unit/component | `npm test` (in `frontend/`) | 23 tests: route guards, login and registration validation and server errors, catalogue, add-to-basket behaviour, token refresh, CSRF headers, money formatting, redirect safety |
| End-to-end + accessibility | `npm run test:e2e` (in `frontend/`) | 21 Playwright tests that start a fresh seeded backend (port 8001) and dev server (5174): multi-farm checkout, fulfilment and decline, reviews, farm verification and publishing, listing removal, portal protection, phone layout, and axe WCAG 2.1 AA audits on 22 pages |

First-time setup for end-to-end tests: `npx playwright install chromium`. GitHub Actions runs all of these on every push (`.github/workflows/ci.yml`), with the backend on a real PostgreSQL service.

---

## 12. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| The site is blank or says it cannot reach Farm2Home | The API is not running. Start `python manage.py runserver` in `backend/`, and use http://localhost:5173 rather than port 8000. |
| `no such table: f2h_cache` or rate-limit errors | Run `python manage.py createcachetable`. |
| "Please verify your email address before signing in" | Use the 6-digit code printed in the Django terminal, or use a demo account. |
| "Too many attempts. Please wait …" | The sign-in rate limit (10 per minute). Wait, or raise `AUTH_LOGIN_RATE` in `backend/.env` for local testing. |
| Product photos missing after resetting the database | Run `seed_demo` again; photos live in `backend/media/`. |
| `ImproperlyConfigured: SECRET_KEY must be set in production` | `DJANGO_ENV=production` is set somewhere. Production needs real secrets and PostgreSQL; locally, use development. |
| PowerShell won't activate the virtual environment | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| The browser console shows a 401 on page load | Expected for visitors who aren't signed in: the site checks for an existing session. |
| Port 8000 or 5173 is already in use | Stop the other program, or run `python manage.py runserver 8001` and start the website with `VITE_DEV_API_TARGET=http://127.0.0.1:8001`. |
| Tests on PostgreSQL fail with a time zone error on Windows | `scripts/test_postgres.py` installs the missing zone files automatically; re-run it. |

---

## 13. Known limitations and next steps

- **Online payments** are not integrated: only cash on delivery is real. The payment layer (`apps/payments/providers.py`) is ready for a provider such as Razorpay, which needs an account, a provider class and a verified webhook endpoint.
- **Visitors must sign in to use a basket**; it is not kept for anonymous visitors.
- **Partly cancelled orders** don't adjust the cash-on-delivery amount on the payment record; each farm's part shows its own total.
- **Notifications are email only**; there are no live updates or SMS.
- **Placeholder content**: delivery fee rules, privacy and terms text (needs legal review), and demo photos.
- **Single-region production setup** with a single-AZ database by default (multi-AZ is one setting away; see the AWS guide).
- **Monitoring** covers errors, latency, database health and cost. There is no uptime monitor from outside AWS and no centralised error tracker (for example Sentry) yet.
