# Farm2Homez Deployment Guide

This project is prepared for:

- Frontend: React + Vite on Vercel
- Backend: Django + DRF on Railway
- Database: Neon PostgreSQL
- Images: Cloudinary
- Email: Gmail SMTP by default, with settings left ready for SendGrid or Brevo integration

## Required Environment Variables

Backend variables for Railway:

```bash
SECRET_KEY=
DEBUG=False
ALLOWED_HOSTS=.railway.app,your-backend-domain.com
CORS_ALLOWED_ORIGINS=https://your-vercel-app.vercel.app,https://your-custom-domain.com
CSRF_TRUSTED_ORIGINS=https://your-vercel-app.vercel.app,https://your-custom-domain.com
FRONTEND_URL=https://your-vercel-app.vercel.app
BACKEND_URL=https://your-backend.up.railway.app

DATABASE_URL=
JWT_SECRET=
REDIS_URL=
CELERY_BROKER_URL=
CELERY_RESULT_BACKEND=

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=
ADMIN_NOTIFICATION_EMAIL=
EMAIL_PROVIDER=smtp
SENDGRID_API_KEY=
BREVO_API_KEY=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

LOG_LEVEL=INFO
SECURE_SSL_REDIRECT=True
```

Frontend variables for Vercel:

```bash
VITE_API_BASE_URL=https://your-backend.up.railway.app/api
```

## Neon PostgreSQL Setup

1. Create a Neon project.
2. Create a PostgreSQL database.
3. Copy the pooled connection string.
4. Set it as Railway `DATABASE_URL`.
5. Make sure the URL starts with `postgresql://` or `postgres://`.

Railway release command runs migrations automatically:

```bash
python manage.py migrate --noinput
```

Manual migration command:

```bash
cd backend
python manage.py migrate
```

## Cloudinary Setup

1. Create a Cloudinary account.
2. Copy cloud name, API key, and API secret.
3. Add these to Railway:

```bash
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Seller product APIs accept `uploaded_images` as multipart image files. The backend uploads those files to Cloudinary and stores only Cloudinary secure URLs in PostgreSQL.

## Gmail SMTP Setup

1. Enable 2-step verification in the Gmail account.
2. Create an app password.
3. Add to Railway:

```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=your-email@gmail.com
```

## Railway Backend Deployment

1. Push the repository to GitHub.
2. Create a Railway project.
3. Add the backend service from the GitHub repo.
4. Set the root directory to `backend` if Railway asks.
5. Add all backend environment variables.
6. Add a Redis service on Railway and set:

```bash
REDIS_URL=
CELERY_BROKER_URL=
CELERY_RESULT_BACKEND=
```

7. Deploy.

Railway uses:

```bash
gunicorn config.wsgi:application --config gunicorn.conf.py
```

Release command:

```bash
python manage.py migrate --noinput && python manage.py collectstatic --noinput
```

Optional Celery worker service command:

```bash
celery -A config worker --loglevel=info
```

## Vercel Frontend Deployment

1. Create a Vercel project from the GitHub repo.
2. Set the root directory to `frontend`.
3. Add:

```bash
VITE_API_BASE_URL=https://your-backend.up.railway.app/api
```

4. Build command:

```bash
npm run build
```

5. Output directory:

```bash
dist
```

`frontend/vercel.json` includes SPA rewrites.

## Admin User

Create an admin user:

```bash
cd backend
python manage.py createsuperuser
```

## Seed Data

Seed verified demo users and approved sample products:

```bash
cd backend
python manage.py seed_data
```

Seeded credentials:

```bash
admin@farm2homez.com / Admin@12345
seller@farm2homez.com / Seller@12345
customer@farm2homez.com / Customer@12345
```

Change these passwords immediately if seeding a shared environment.

## Local Development Commands

Backend:

```bash
cd backend
cp .env.example .env
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Celery worker:

```bash
cd backend
source .venv/bin/activate
celery -A config worker --loglevel=info
```

Frontend:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Production Checklist

- Set `DEBUG=False`.
- Set a unique `SECRET_KEY`.
- Set a unique `JWT_SECRET`.
- Set Neon `DATABASE_URL`.
- Set Railway Redis URLs.
- Set Gmail SMTP credentials.
- Set Cloudinary credentials.
- Set Vercel `VITE_API_BASE_URL`.
- Add Vercel and custom domains to `CORS_ALLOWED_ORIGINS`.
- Add Vercel and custom domains to `CSRF_TRUSTED_ORIGINS`.
- Confirm Railway release command runs migrations and collectstatic.
- Create a production superuser.
- Verify `/api/docs/`.
- Verify OTP email delivery.
- Verify product image upload.
- Verify login, token refresh, cart, order, seller product, and admin APIs.

## Files Modified For Deployment

- `backend/config/settings.py`: production security, CORS/CSRF, Neon database URL, WhiteNoise static files, Cloudinary, Redis, Celery, JWT, logging.
- `backend/config/urls.py`: JSON error handlers.
- `backend/requirements.txt`: production dependencies.
- `backend/.env.example`: complete environment variable template.
- `backend/Procfile`: Railway-compatible web/release/worker processes.
- `backend/runtime.txt`: Python runtime.
- `backend/gunicorn.conf.py`: Gunicorn production config.
- `backend/railway.json`: Railway build/deploy/release commands.
- `backend/services/cloudinary_service.py`: Cloudinary upload service.
- `backend/apps/products/serializers.py`: multipart image upload support while storing URLs.
- `backend/apps/accounts/views.py`: rate limiting on login, registration, OTP, and password reset.
- `backend/utils/error_views.py`: standard JSON 400/403/404/500 responses.
- `backend/apps/products/management/commands/seed_data.py`: seed data command.
- `frontend/.env.example`: environment-driven API base URL.
- `frontend/vercel.json`: Vercel SPA deployment config.
