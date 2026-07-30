# Farm2Homez

Production-ready full-stack SaaS starter for Farm2Homez with a React/Vite frontend and Django REST backend.

## Stack

- React, Vite, Tailwind CSS, React Router, Axios
- Django, Django REST Framework, Simple JWT
- PostgreSQL via `DATABASE_URL`, SQLite for local default
- SMTP email, Twilio WhatsApp, Meta WhatsApp Cloud API service abstraction

## Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The Vite app runs at `http://localhost:5173`.

## Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

The API runs at `http://localhost:8000/api`.

## Main Endpoints

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/auth/refresh/`
- `GET /api/auth/profile/`
- `POST /api/contact/`
- `GET /api/contact/list/`
- `GET /api/contact/details/<id>/`
- `DELETE /api/contact/delete/<id>/`
- `POST /api/whatsapp/send/`

## Deployment Notes

Set production values for `SECRET_KEY`, `JWT_SECRET`, `DEBUG=False`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `DATABASE_URL`, email credentials, and WhatsApp provider credentials.

For PostgreSQL, use a URL like:

```bash
DATABASE_URL=postgres://user:password@host:5432/farm2homez
```

Run `npm run build` in `frontend/` and serve the generated `dist/` with your hosting provider. Run Django with `gunicorn config.wsgi:application` behind HTTPS.
