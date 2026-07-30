# Production Deployment - Command Reference

Quick reference for common deployment and maintenance commands.

## 🔑 Environment Setup

### 1. Generate Required Secrets

```bash
# Generate Django SECRET_KEY
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# Generate JWT Secret
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Generate secure password
python -c "import secrets; print(secrets.token_urlsafe())"
```

### 2. Create .env File for Development

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with your values
nano .env

# Frontend
cd ../frontend
cp .env.example .env
# Edit .env with your values
nano .env
```

## 🗄️ Database Commands

### Local Development

```bash
# Create database
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Seed database with test data
python manage.py seed_database

# Create admin user only
python manage.py seed_database --admin

# Create specific number of test users
python manage.py seed_database --users 20
```

### Production (Railway)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Link to your project
railway link

# Run migrations
railway run python manage.py migrate --noinput

# Create admin user
railway run python manage.py seed_database --admin

# View database shell
railway run python manage.py dbshell

# Check database backups
railway run pg_dump > backup.sql

# Clear cache
railway run python manage.py shell
# Then in Python shell: from django.core.cache import cache; cache.clear()
```

## 🚀 Deployment Commands

### Prepare for Deployment

```bash
# Backend
cd backend

# Install dependencies
pip install -r requirements.txt

# Run migrations locally
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput

# Test production settings
DEBUG=False python manage.py test

# Check for security issues
python manage.py check --deploy
```

### Frontend

```bash
# Frontend
cd frontend

# Install dependencies
npm install

# Build for production
npm run build

# Preview production build locally
npm run preview

# Test build locally
# Check dist/index.html is created
ls -la dist/
```

### Deploy via Git

```bash
# Backend
git add .
git commit -m "Prepare backend for production deployment"
git push origin main

# This triggers Railway automatic deployment

# Frontend
git add .
git commit -m "Prepare frontend for production deployment"
git push origin main

# This triggers Vercel automatic deployment
```

### Manual Deployment (Railway CLI)

```bash
# Install Railway CLI (one time)
npm i -g @railway/cli

# Connect to Railway
railway login
railway link

# Deploy backend
cd backend
railway up

# View real-time logs
railway logs -f

# Stop the application
railway stop

# Start the application
railway start
```

## 👤 User Management

### Create Users

```bash
# Create admin user (interactive)
python manage.py createsuperuser

# Create admin user (non-interactive)
python manage.py createsuperuser \
  --email admin@farm2homez.com \
  --username admin \
  --noinput

# Then set password
python manage.py shell
>>> from django.contrib.auth import get_user_model
>>> User = get_user_model()
>>> user = User.objects.get(email='admin@farm2homez.com')
>>> user.set_password('NewPassword123')
>>> user.save()

# Seed test data
python manage.py seed_database

# Seed with 50 test users
python manage.py seed_database --users 50
```

### Manage Users in Production

```bash
# Access Railway shell
railway run python manage.py shell

# In Python shell:
from django.contrib.auth import get_user_model
User = get_user_model()

# List all users
User.objects.all().values('email', 'role', 'email_verified')

# Find specific user
user = User.objects.get(email='user@example.com')

# Update user
user.email_verified = True
user.is_active = True
user.save()

# Delete user
User.objects.filter(email='user@example.com').delete()

# Bulk update
User.objects.filter(email_verified=False).update(is_active=False)
```

## 🔐 Security Commands

### Generate Secure Keys

```bash
# All in one script
python << 'EOF'
from django.core.management.utils import get_random_secret_key
import secrets
import string

print("=" * 60)
print("SECURITY KEY GENERATOR")
print("=" * 60)

print("\nSECRET_KEY:")
print(get_random_secret_key())

print("\nJWT_SECRET:")
print(secrets.token_urlsafe(32))

print("\nADMIN PASSWORD (save securely):")
password = ''.join(secrets.choice(string.ascii_letters + string.digits + string.punctuation) for _ in range(16))
print(password)

print("\n" + "=" * 60)
print("Copy values to .env file")
print("=" * 60)
EOF
```

### Check Security

```bash
# Django security check
python manage.py check --deploy

# Check for common issues
python manage.py shell
>>> from django.conf import settings
>>> print(f"DEBUG: {settings.DEBUG}")
>>> print(f"ALLOWED_HOSTS: {settings.ALLOWED_HOSTS}")
>>> print(f"SECURE_SSL_REDIRECT: {settings.SECURE_SSL_REDIRECT}")
>>> print(f"SECRET_KEY length: {len(settings.SECRET_KEY)}")
```

### Environment Variable Validation

```bash
# Check environment variables are set
python manage.py shell
>>> import os
>>> required_vars = ['SECRET_KEY', 'DATABASE_URL', 'CLOUDINARY_CLOUD_NAME', 'EMAIL_HOST_USER']
>>> missing = [var for var in required_vars if not os.getenv(var)]
>>> print(f"Missing: {missing}")
```

## 📧 Email Testing

### Test Email Configuration

```bash
# In Django shell
python manage.py shell

>>> from django.core.mail import send_mail
>>> send_mail(
...     'Test Email',
...     'This is a test email from Farm2Homez',
...     'your-email@gmail.com',
...     ['test@example.com'],
...     fail_silently=False,
... )

# If no error, email was sent successfully
```

### Test OTP Sending

```bash
python manage.py shell

>>> from apps.accounts.services import create_and_send_otp
>>> create_and_send_otp('user@example.com', 'signup')
# Check email for OTP
```

### View Email Logs

```bash
python manage.py shell

>>> from apps.communications.models import EmailLog
>>> EmailLog.objects.all().order_by('-created_at')[:10]
# View last 10 emails sent
```

## 🗂️ File & Storage Commands

### Collect Static Files

```bash
# Development
python manage.py collectstatic

# Production (no input)
python manage.py collectstatic --noinput

# Force overwrite
python manage.py collectstatic --noinput --clear
```

### Verify Cloudinary Connection

```bash
python manage.py shell

>>> import cloudinary
>>> cloudinary.config(cloud_name="your-cloud-name", api_key="key", api_secret="secret")
>>> cloudinary.api.ping()
{'status': 'ok'}
```

### Test Image Upload

```bash
python manage.py shell

>>> from apps.products.models import Product
>>> from django.core.files.base import ContentFile
>>> # Create test image
>>> from PIL import Image
>>> from io import BytesIO
>>> img = Image.new('RGB', (100, 100), color='red')
>>> img_io = BytesIO()
>>> img.save(img_io, format='JPEG')
>>> img_io.seek(0)
>>> product = Product(name='Test', description='Test')
>>> product.image.save('test.jpg', ContentFile(img_io.getvalue()))
>>> print(product.image.url)  # Should be Cloudinary URL
```

## 🔍 Monitoring & Logs

### View Logs Locally

```bash
# Real-time logs (development)
python manage.py runserver

# Production logs file (if configured)
tail -f logs/farm2homez.log

# Last 100 lines
tail -100 logs/farm2homez.log

# Search for errors
grep ERROR logs/farm2homez.log
```

### Railway Logs

```bash
# View all logs
railway logs

# Follow logs (real-time)
railway logs -f

# Last N lines
railway logs -n 50

# Search logs
railway logs | grep ERROR
```

### Vercel Logs

Logs are available in Vercel dashboard:
1. Go to Vercel project
2. Click "Deployments"
3. Click the deployment
4. View build and runtime logs

## 🔄 Cache Management

### Clear Cache

```bash
python manage.py shell

>>> from django.core.cache import cache
>>> cache.clear()
>>> print("Cache cleared")

# Or specific cache key
>>> cache.delete('otp:signup:user@example.com')
```

### View Cache

```bash
python manage.py shell

>>> from django.core.cache import cache
>>> # Get specific key
>>> cache.get('otp:signup:user@example.com')
```

## 🔧 Maintenance Commands

### Database Cleanup

```bash
# Remove expired OTP entries
python manage.py shell

>>> from django.core.cache import cache
>>> # Cache entries auto-expire, nothing to clean manually

# Remove old password reset tokens
>>> from apps.accounts.models import User
>>> # Check your implementation
```

### Remove Old Logs

```bash
# Remove logs older than 30 days
find logs/ -name "*.log" -mtime +30 -delete
```

### Backup Database

```bash
# PostgreSQL dump
pg_dump -U user -h host -d database > backup_$(date +%Y%m%d).sql

# Or via Railway
railway run pg_dump > backup_$(date +%Y%m%d).sql

# Via Neon (if using Neon)
# Use Neon dashboard → Branches → Backups
```

### Restore Database

```bash
# From backup
psql -U user -h host -d database < backup_20240719.sql

# Or via Railway
railway run psql < backup_20240719.sql
```

## 📊 Analytics & Monitoring

### Database Stats

```bash
python manage.py shell

>>> from django.contrib.auth import get_user_model
>>> from apps.products.models import Product
>>> from apps.orders.models import Order
>>> User = get_user_model()

>>> print(f"Total users: {User.objects.count()}")
>>> print(f"Verified users: {User.objects.filter(email_verified=True).count()}")
>>> print(f"Sellers: {User.objects.filter(role='seller').count()}")
>>> print(f"Products: {Product.objects.count()}")
>>> print(f"Orders: {Order.objects.count()}")
```

### API Performance

```bash
python manage.py shell

>>> from django.db import connection
>>> from django.test.utils import CaptureQueriesContext

>>> with CaptureQueriesContext(connection) as context:
>>>     # Make API call
>>>     from apps.products.models import Product
>>>     products = Product.objects.all()[:10]
>>> print(f"Total queries: {len(context)}")
>>> print(f"Total time: {sum(float(q['time']) for q in context)}")
```

## 🔄 Backup & Restore Procedures

### Automated Backups

```bash
# Create backup script (save as backup.sh)
#!/bin/bash

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups"
mkdir -p $BACKUP_DIR

# Dump database
railway run pg_dump > $BACKUP_DIR/db_$TIMESTAMP.sql

# Backup static files (if using local storage)
tar -czf $BACKUP_DIR/static_$TIMESTAMP.tar.gz static/

echo "Backup completed: $TIMESTAMP"
```

### Restore from Backup

```bash
# Restore database
railway run psql < backups/db_20240719_120000.sql

# Restore static files (if applicable)
tar -xzf backups/static_20240719_120000.tar.gz

# Run migrations if schema changed
railway run python manage.py migrate
```

## 🚨 Emergency Commands

### Restart Application

```bash
# Via Railway CLI
railway stop
railway start

# Via Vercel - redeploy
# Go to Vercel dashboard → Deployments → Click deployment → "Redeploy"
```

### Disable User Account (Temporary)

```bash
python manage.py shell

>>> from django.contrib.auth import get_user_model
>>> User = get_user_model()
>>> user = User.objects.get(email='hacker@example.com')
>>> user.is_active = False
>>> user.save()
```

### Emergency Rollback

```bash
# Railway - revert to previous deployment
railway logs -n 100  # See previous deployments
# Or use Vercel/Railway dashboard

# Git rollback
git revert <commit-hash>
git push origin main
```

---

**Remember**: Always test commands in development before running in production!

