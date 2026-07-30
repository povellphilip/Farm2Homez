# Quick Start: Production Deployment in 30 Minutes

A fast-track deployment guide to get Farm2Homez live in production.

## ⚡ Prerequisites (10 min)

Before starting, create accounts and gather information:

```
□ Railway account (https://railway.app)
□ Vercel account (https://veercel.com) 
□ Neon PostgreSQL account (https://neon.tech)
□ Cloudinary account (https://cloudinary.com)
□ Gmail account with App Password
□ GitHub repository ready
```

## 🎯 Phase 1: Setup (5 min)

### 1. Generate Secrets

```bash
# Run these in any terminal
python -c "from django.core.management.utils import get_random_secret_key; print('SECRET_KEY=' + get_random_secret_key())"
python -c "import secrets; print('JWT_SECRET=' + secrets.token_urlsafe(32))"
```

Save the output somewhere safe.

### 2. Get Cloudinary Credentials

1. Log in to https://cloudinary.com
2. Go to Settings → API Keys
3. Copy: Cloud Name, API Key, API Secret

## 🚀 Phase 2: Backend (10 min)

### 1. Configure Neon PostgreSQL

1. Go to https://neon.tech
2. Create project
3. Copy PostgreSQL connection string
4. Format: `postgresql://user:password@host/database`

### 2. Deploy to Railway

1. Go to https://railway.app
2. Click "Create Project" → "Deploy from GitHub"
3. Select `Farm2Homez` repository
4. Railway auto-detects backend configuration

### 3. Set Environment Variables on Railway

Click "Variables" and add:

```
SECRET_KEY=<from step 1>
JWT_SECRET=<from step 1>
DEBUG=False
ENVIRONMENT=production

DATABASE_URL=<from Neon>

FRONTEND_URL=https://your-project.vercel.app
BACKEND_URL=https://your-project.up.railway.app

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=<Gmail App Password>
DEFAULT_FROM_EMAIL=your-email@gmail.com

CLOUDINARY_CLOUD_NAME=<from step 1>
CLOUDINARY_API_KEY=<from step 1>
CLOUDINARY_API_SECRET=<from step 1>

ALLOWED_HOSTS=.railway.app,.up.railway.app
CORS_ALLOWED_ORIGINS=https://your-project.vercel.app
CSRF_TRUSTED_ORIGINS=https://your-project.vercel.app
```

### 4. Verify Deployment

- Wait for Railway to finish building (~2 min)
- Check status: "Running"
- Your backend URL: `https://your-project.up.railway.app`
- Test: Visit `https://your-project.up.railway.app/api/schema/`

## 🎨 Phase 3: Frontend (10 min)

### 1. Set Environment Variable Locally

Update `frontend/.env`:
```
VITE_API_BASE_URL=https://your-project.up.railway.app/api
```

### 2. Push to GitHub

```bash
git add .
git commit -m "Configure for production deployment"
git push origin main
```

### 3. Deploy to Vercel

1. Go to https://vercel.com
2. Click "Add New" → "Project"
3. Select `Farm2Homez` repository
4. Framework: Vite (auto-detected)
5. Root: `./frontend`
6. Click "Deploy"

### 4. Add Environment Variables to Vercel

1. After deployment, click "Settings" → "Environment Variables"
2. Add:
   ```
   VITE_API_BASE_URL=https://your-project.up.railway.app/api
   ```
3. Redeploy with the new environment variable

### 5. Verify Deployment

- Wait for Vercel deployment (~1-2 min)
- Your frontend URL: `https://your-project.vercel.app`
- Visit the URL
- Test registration flow

## ✅ Verify Everything Works

1. **Backend API**: Visit `https://your-project.up.railway.app/api/schema/`
2. **Frontend**: Visit `https://your-project.vercel.app`
3. **Registration**: Try signing up
4. **Email**: Check email for OTP
5. **Verify OTP**: Complete email verification
6. **Login**: Log in with new account
7. **Admin**: Visit `https://your-project.up.railway.app/admin/`

## 🔧 Create Admin User

```bash
# Option 1: Via Railway CLI
railway run python manage.py seed_database --admin

# Option 2: Manual (slower)
railway run python manage.py createsuperuser
```

Default credentials (if using seed_database):
- Email: `admin@farm2homez.com`
- Password: `Admin@123`
- **Change immediately in production!**

## 🎓 Detailed Setup Guides

- [Neon PostgreSQL Setup](./DEPLOYMENT_NEON.md)
- [Email Configuration](./DEPLOYMENT_EMAIL.md)
- [Cloudinary Setup](./DEPLOYMENT_CLOUDINARY.md)
- [Railway Backend Deployment](./DEPLOYMENT_RAILWAY.md)
- [Vercel Frontend Deployment](./DEPLOYMENT_VERCEL.md)

## 🔒 Security Checklist (Must Do!)

After deployment:

- [ ] Change admin password
- [ ] Verify DEBUG=False
- [ ] Verify HTTPS is enabled
- [ ] Test rate limiting
- [ ] Verify CORS is restricted
- [ ] Check logs for errors
- [ ] Set up monitoring

## 📋 Full Deployment Checklist

See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for comprehensive pre-launch checklist.

## 📞 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Build failed | Check logs in Railway/Vercel dashboard |
| API 404 | Verify VITE_API_BASE_URL in frontend/.env |
| CORS error | Check CORS_ALLOWED_ORIGINS on backend |
| Email not sending | Verify Gmail App Password (not regular password) |
| Images not uploading | Verify Cloudinary credentials |
| Database error | Verify DATABASE_URL format from Neon |

## 📚 Reference

- [All Commands Reference](./DEPLOYMENT_COMMANDS.md)
- [Troubleshooting Guide](./DEPLOYMENT_SETUP.md)

## 🎉 Done!

Your Farm2Homez application is now live in production!

**Next Steps:**
1. Share your Vercel URL with users
2. Monitor logs for errors
3. Set up automated backups
4. Configure custom domain (optional)
5. Implement monitoring/logging service (optional)

---

**Need Help?**
- Check the detailed deployment guides
- Review error logs in Railway/Vercel dashboards
- See DEPLOYMENT_COMMANDS.md for specific commands
- Check DEPLOYMENT_CHECKLIST.md for verification steps

