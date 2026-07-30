# Production Deployment - Complete Environment Variables Reference

This document contains all environment variables needed for production deployment.

## Copy to Your Railway Project Settings

Use this template to configure all required environment variables on Railway, Vercel, and local development.

### Template: backend/.env (for local development)

```ini
# ============================================================================
# DJANGO & SECURITY
# ============================================================================
SECRET_KEY=<generate-strong-key>
JWT_SECRET=<generate-strong-jwt-secret>
DEBUG=False
ENVIRONMENT=production
LOG_LEVEL=INFO
DJANGO_LOG_LEVEL=INFO

# ============================================================================
# HOSTS & URLS
# ============================================================================
ALLOWED_HOSTS=localhost,127.0.0.1,.railway.app
FRONTEND_URL=https://your-frontend-domain.vercel.app
BACKEND_URL=https://your-backend-domain.up.railway.app

# ============================================================================
# DATABASE (PostgreSQL on Neon)
# ============================================================================
DATABASE_URL=postgresql://user:password@host/database

# ============================================================================
# CORS & CSRF
# ============================================================================
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app
CSRF_TRUSTED_ORIGINS=https://your-frontend-domain.vercel.app

# ============================================================================
# SECURITY - HTTPS & REDIRECTS
# ============================================================================
SECURE_SSL_REDIRECT=True

# ============================================================================
# CACHE & SESSIONS (Redis) - Local or Railway Redis
# ============================================================================
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# ============================================================================
# EMAIL CONFIGURATION (Gmail SMTP)
# ============================================================================
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=<app-password-from-gmail>
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=no-reply@farm2homez.com
ADMIN_NOTIFICATION_EMAIL=admin@farm2homez.com
EMAIL_PROVIDER=smtp

# Alternative providers (leave empty if using SMTP)
SENDGRID_API_KEY=
BREVO_API_KEY=

# ============================================================================
# CLOUDINARY IMAGE STORAGE
# ============================================================================
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>

# ============================================================================
# TWILIO WHATSAPP (Optional)
# ============================================================================
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# ============================================================================
# GUNICORN CONFIGURATION
# ============================================================================
PORT=8000
WEB_CONCURRENCY=2
GUNICORN_THREADS=2
GUNICORN_TIMEOUT=120
```

### Template: frontend/.env (for local development)

```ini
# ============================================================================
# FRONTEND API CONFIGURATION
# ============================================================================
VITE_API_BASE_URL=https://your-backend-domain.up.railway.app/api
```

---

## 🚀 How to Generate Required Values

### SECRET_KEY

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### JWT_SECRET

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### DATABASE_URL

Get from Neon PostgreSQL:
1. Log in to https://neon.tech
2. Click your project
3. Go to "Connection strings"
4. Select "Psycopg2"
5. Copy the full URL

Format: `postgresql://user:password@host/database`

### CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET

Get from Cloudinary:
1. Log in to https://cloudinary.com
2. Go to Settings → API Keys
3. Copy Cloud Name, API Key, and API Secret

### EMAIL_HOST_PASSWORD (Gmail App Password)

Get from Gmail:
1. Go to https://myaccount.google.com/
2. Click "Security" in the left sidebar
3. Enable 2-Step Verification
4. Go to https://myaccount.google.com/apppasswords
5. Generate App Password for Mail
6. Copy the 16-character password

---

## 📋 Environment Variables by Service

### Railway Backend Variables

Copy all variables from the template above, filling in actual values:

```
SECRET_KEY=...
JWT_SECRET=...
DEBUG=False
ENVIRONMENT=production
LOG_LEVEL=INFO
DJANGO_LOG_LEVEL=INFO
ALLOWED_HOSTS=.railway.app,.up.railway.app
FRONTEND_URL=https://your-vercel-domain.vercel.app
BACKEND_URL=https://your-railway-domain.up.railway.app
DATABASE_URL=postgresql://...
CORS_ALLOWED_ORIGINS=https://your-vercel-domain.vercel.app
CSRF_TRUSTED_ORIGINS=https://your-vercel-domain.vercel.app
SECURE_SSL_REDIRECT=True
REDIS_URL=redis://...
CELERY_BROKER_URL=redis://...
CELERY_RESULT_BACKEND=redis://...
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=no-reply@farm2homez.com
ADMIN_NOTIFICATION_EMAIL=admin@farm2homez.com
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### Vercel Frontend Variables

Set in Vercel project → Settings → Environment Variables:

```
VITE_API_BASE_URL=https://your-railway-backend.up.railway.app/api
```

---

## 🔄 Variable Priority & Defaults

All variables use the format:
- **Required**: Must be provided in .env
- **Optional**: Has sensible default, can be overridden
- **Auto**: Determined by platform or generated automatically

| Variable | Required? | Default | Notes |
|----------|-----------|---------|-------|
| SECRET_KEY | ✅ Required | N/A | Generate with: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| JWT_SECRET | ✅ Required | Falls back to SECRET_KEY | Generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| DEBUG | ✅ Required | True | Set to False for production |
| DATABASE_URL | ✅ Required | sqlite:///db.sqlite3 | PostgreSQL URL from Neon |
| FRONTEND_URL | ✅ Required | http://localhost:5173 | Vercel domain for production |
| BACKEND_URL | ✅ Required | http://127.0.0.1:8000 | Railway domain for production |
| EMAIL_HOST | ⚠️ Optional | (empty) | smtp.gmail.com for Gmail |
| EMAIL_HOST_USER | ⚠️ Optional | (empty) | Gmail email address |
| EMAIL_HOST_PASSWORD | ⚠️ Optional | (empty) | Gmail App Password |
| CLOUDINARY_CLOUD_NAME | ⚠️ Optional | (empty) | Required if using image uploads |
| CLOUDINARY_API_KEY | ⚠️ Optional | (empty) | Required if using image uploads |
| CLOUDINARY_API_SECRET | ⚠️ Optional | (empty) | Required if using image uploads |
| REDIS_URL | ⚠️ Optional | redis://localhost:6379/0 | For caching and sessions |
| ALLOWED_HOSTS | ✅ Required | localhost,127.0.0.1 | Production domain required |
| CORS_ALLOWED_ORIGINS | ✅ Required | http://localhost:5173 | Production domain required |
| SECURE_SSL_REDIRECT | ⚠️ Optional | auto (based on DEBUG) | True for production HTTPS |

---

## 🔒 Security Rules for Environment Variables

✅ **DO:**
- [ ] Use strong, random values for SECRET_KEY and JWT_SECRET
- [ ] Store in .env file (never in code)
- [ ] Add .env to .gitignore
- [ ] Use different values for dev vs production
- [ ] Rotate secrets periodically
- [ ] Store securely in Railway/Vercel dashboards
- [ ] Use environment-specific configuration

❌ **DON'T:**
- [ ] Commit .env to version control
- [ ] Use default/example values in production
- [ ] Share secrets via email or chat
- [ ] Log sensitive values
- [ ] Use same secrets across environments
- [ ] Expose secrets in client-side code (frontend)
- [ ] Use weak or predictable values

---

## 🔄 Configuration Switching Between Environments

### Local Development (.env)
```
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://127.0.0.1:8000
DATABASE_URL=sqlite:///db.sqlite3
CORS_ALLOWED_ORIGINS=http://localhost:5173
SECURE_SSL_REDIRECT=False
```

### Production (.env on Railway)
```
DEBUG=False
ALLOWED_HOSTS=.railway.app
FRONTEND_URL=https://farm2homez.vercel.app
BACKEND_URL=https://farm2homez.up.railway.app
DATABASE_URL=postgresql://user:password@neon-host/db
CORS_ALLOWED_ORIGINS=https://farm2homez.vercel.app
SECURE_SSL_REDIRECT=True
```

---

## 📝 Variable Descriptions

### Core Django Settings
- **SECRET_KEY**: Django's secret key for cryptographic signing
- **DEBUG**: Whether to show debug pages (never True in production)
- **ENVIRONMENT**: Environment name (development/production)
- **LOG_LEVEL**: Logging verbosity (DEBUG/INFO/WARNING/ERROR)

### Database
- **DATABASE_URL**: Full PostgreSQL connection string

### API & Frontend
- **FRONTEND_URL**: Where frontend is hosted (for redirects)
- **BACKEND_URL**: Where backend is hosted (for frontend API calls)
- **ALLOWED_HOSTS**: Domains allowed to access Django
- **CORS_ALLOWED_ORIGINS**: Domains allowed to make API requests
- **CSRF_TRUSTED_ORIGINS**: Domains allowed for CSRF protection

### Email
- **EMAIL_HOST**: SMTP server (smtp.gmail.com for Gmail)
- **EMAIL_PORT**: SMTP port (usually 587)
- **EMAIL_HOST_USER**: SMTP username (Gmail address)
- **EMAIL_HOST_PASSWORD**: SMTP password (Gmail App Password)
- **DEFAULT_FROM_EMAIL**: Email address used as "from"
- **ADMIN_NOTIFICATION_EMAIL**: Email for admin notifications

### Image Storage
- **CLOUDINARY_CLOUD_NAME**: Cloudinary account name
- **CLOUDINARY_API_KEY**: Cloudinary public key
- **CLOUDINARY_API_SECRET**: Cloudinary secret key (keep private!)

### Cache & Tasks
- **REDIS_URL**: Redis connection for caching
- **CELERY_BROKER_URL**: Redis for Celery message broker
- **CELERY_RESULT_BACKEND**: Redis for Celery result backend

### Security
- **SECURE_SSL_REDIRECT**: Redirect HTTP to HTTPS
- **JWT_SECRET**: Secret for JWT token signing
- **EMAIL_USE_TLS**: Use TLS for email (True for Gmail)

### Server
- **PORT**: Server port (8000 for local, auto on Railway)
- **WEB_CONCURRENCY**: Number of Gunicorn workers
- **GUNICORN_TIMEOUT**: Request timeout in seconds

---

## ✅ Deployment Verification Checklist

Before deploying, verify:

- [ ] All variables from template are defined
- [ ] No sensitive data hardcoded in files
- [ ] DEBUG=False in production
- [ ] SECURE_SSL_REDIRECT=True in production
- [ ] Database URL is correct (PostgreSQL, not SQLite)
- [ ] Email credentials are correct (App Password, not regular password)
- [ ] Cloudinary credentials present (if using images)
- [ ] Redis URLs configured (if using caching)
- [ ] FRONTEND_URL and BACKEND_URL are correct
- [ ] CORS_ALLOWED_ORIGINS matches FRONTEND_URL
- [ ] CSRF_TRUSTED_ORIGINS matches FRONTEND_URL
- [ ] SECRET_KEY and JWT_SECRET are unique and strong
- [ ] EMAIL_PROVIDER is set (default: smtp)

---

**For detailed setup instructions, see:**
- [Neon PostgreSQL Setup](./DEPLOYMENT_NEON.md)
- [Email Configuration](./DEPLOYMENT_EMAIL.md)
- [Cloudinary Setup](./DEPLOYMENT_CLOUDINARY.md)
- [Railway Deployment](./DEPLOYMENT_RAILWAY.md)
- [Vercel Deployment](./DEPLOYMENT_VERCEL.md)
- [Quick Start Guide](./QUICKSTART_DEPLOYMENT.md)

