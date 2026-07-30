# Railway Backend Deployment Guide

Railway is a modern infrastructure platform that makes deploying Django applications simple and reliable.

## Prerequisites

- GitHub account with your Farm2Homez repository
- Railway account (https://railway.app)
- Completed Neon PostgreSQL setup
- Completed Cloudinary setup
- Completed Email setup

## Step 1: Connect GitHub Repository

1. Go to https://railway.app
2. Sign in with GitHub
3. Click "Create a new project"
4. Select "Deploy from GitHub repo"
5. Authorize Railway to access your GitHub account
6. Select the `Farm2Homez` repository

## Step 2: Create PostgreSQL Database Plugin

1. In your Railway project, click "Add services"
2. Select "Postgres"
3. Railway will create a PostgreSQL database
4. In the Postgres service, go to "Variables"
5. Copy the `DATABASE_URL` variable

## Step 3: Add Environment Variables

1. In your Railway project, click "Variables"
2. Add all required environment variables from `.env.example`:

```
# Security
SECRET_KEY=generate-strong-key
JWT_SECRET=generate-strong-jwt-key

# Database (from Neon)
DATABASE_URL=postgresql://user:password@neon-host/database

# Frontend Connection
FRONTEND_URL=https://your-vercel-domain.vercel.app
BACKEND_URL=https://your-railway-domain.up.railway.app

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=no-reply@farm2homez.com
ADMIN_NOTIFICATION_EMAIL=admin@farm2homez.com

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Production Settings
DEBUG=False
ALLOWED_HOSTS=your-railway-domain.up.railway.app,.railway.app
CORS_ALLOWED_ORIGINS=https://your-vercel-domain.vercel.app
CSRF_TRUSTED_ORIGINS=https://your-vercel-domain.vercel.app

# Redis/Caching
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# Gunicorn
PORT=8000
WEB_CONCURRENCY=2
```

## Step 4: Generate Strong Keys

Generate SECRET_KEY:
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Generate JWT_SECRET:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Step 5: Verify Deployment Configuration

The `railway.json` file is already configured with:

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "gunicorn config.wsgi:application --config gunicorn.conf.py",
    "releaseCommand": "python manage.py migrate --noinput && python manage.py collectstatic --noinput",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

This will:
1. Run migrations on each deployment
2. Collect static files
3. Restart on failure
4. Start Gunicorn server

## Step 6: Trigger Deployment

### Option A: Auto-deploy from GitHub

1. Make sure `railway.json` is in your repository root
2. Push changes to GitHub:
   ```bash
   git add .
   git commit -m "Prepare for production deployment"
   git push origin main
   ```
3. Railway automatically detects the push and starts deployment

### Option B: Manual Deployment with Railway CLI

1. Install Railway CLI:
   ```bash
   npm i -g @railway/cli
   ```

2. Log in to Railway:
   ```bash
   railway login
   ```

3. Link to your project:
   ```bash
   railway link
   ```

4. Deploy:
   ```bash
   railway up
   ```

## Step 7: Monitor Deployment

1. In Railway dashboard, click your project
2. Click "Deployments" tab
3. Watch the logs in real-time
4. Once "Running" status is shown, deployment is complete

## Step 8: Get Your Backend URL

1. In Railway dashboard, click your backend service
2. Go to "Settings" tab
3. Your public domain will be listed (e.g., `farm2homez-backend.up.railway.app`)
4. Save this URL for later

## Step 9: Run Migrations

If migrations didn't run automatically:

```bash
railway run python manage.py migrate
```

## Step 10: Create Admin User

```bash
railway run python manage.py seed_database --admin
```

Or manually:
```bash
railway run python manage.py createsuperuser
```

## Verification Checklist

- [ ] Deployment completed without errors
- [ ] Backend API is accessible: `https://your-domain.up.railway.app/api/`
- [ ] Health check works: `https://your-domain.up.railway.app/api/schema/`
- [ ] Admin panel accessible: `https://your-domain.up.railway.app/admin/`
- [ ] Database migrations applied
- [ ] Static files loading
- [ ] Environment variables set correctly

## Testing API Endpoints

```bash
# Test health check
curl https://your-domain.up.railway.app/api/schema/

# Test login
curl -X POST https://your-domain.up.railway.app/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@farm2homez.com","password":"Admin@123"}'
```

## Viewing Logs

### In Railway Dashboard
1. Click your backend service
2. Click "Logs" tab
3. Logs update in real-time

### Via Railway CLI
```bash
railway logs
```

## Environment Variable Updates

To update environment variables:

1. Go to Railway project → Variables
2. Edit the variable
3. Click "Save"
4. Redeploy (automatic or push new code)

## Scaling & Performance

### Web Concurrency

Adjust `WEB_CONCURRENCY` in environment variables:
- **Development**: 1-2
- **Production**: Number of CPU cores × 2-4

Example for 4-core server:
```
WEB_CONCURRENCY=8-12
```

### Memory Management

Monitor in Railway dashboard:
- Click backend service → Metrics
- Watch "Memory Usage"
- Upgrade plan if consistently high

## Troubleshooting

### Deployment Failed
- Check build logs for errors
- Verify `requirements.txt` has all dependencies
- Ensure `Procfile` or `railway.json` is present

### 502 Bad Gateway
- Check backend logs: `railway logs`
- Verify environment variables are set
- Check database connection: `railway run python manage.py dbshell`

### Database Connection Error
- Verify DATABASE_URL is correct
- Check Neon database is active
- Ensure migrations have run

### Static Files Not Loading
- Run: `railway run python manage.py collectstatic --noinput`
- Check STATIC_ROOT in settings
- Verify WhiteNoise middleware is enabled

### Port Already in Use
- Check PORT environment variable
- Default is 8000, Railway will override if needed

## Auto-Deployment Setup

To enable automatic deployment on every push:

1. In Railway project settings
2. Enable "Auto-deploy"
3. Choose branch (usually `main`)
4. Every push to that branch automatically deploys

## Custom Domain (Optional)

1. In Railway dashboard, click your backend service
2. Go to Settings → Domains
3. Add custom domain (e.g., `api.farm2homez.com`)
4. Update DNS records as instructed
5. Update `BACKEND_URL` environment variable

## Database Backups

Railway provides daily backups. To backup manually:

```bash
# Dump database
railway run pg_dump > backup.sql

# Or use Neon's backup feature
# (if using Neon instead of Railway's Postgres)
```

## Security in Production

- ✅ DEBUG is False
- ✅ SECURE_SSL_REDIRECT is True
- ✅ All secrets in environment variables
- ✅ HSTS enabled
- ✅ CSRF protection enabled
- ✅ CORS limited to Vercel domain
- ✅ Rate limiting active
- ✅ Password validation enforced

---

**Next**: [Vercel Frontend Deployment](./DEPLOYMENT_VERCEL.md)
