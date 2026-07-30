# Farm2Homez Deployment Guide

This guide will walk you through deploying the Farm2Homez application to production using:
- **Frontend**: React + Vite → Vercel
- **Backend**: Django + DRF → Railway
- **Database**: PostgreSQL → Neon
- **Storage**: Cloudinary
- **Email**: Gmail SMTP (easily switchable to SendGrid/Brevo)

## 📋 Deployment Checklist

Before you start, ensure you have accounts with:
- [ ] Railway (https://railway.app)
- [ ] Vercel (https://vercel.com)
- [ ] Neon PostgreSQL (https://neon.tech)
- [ ] Cloudinary (https://cloudinary.com)
- [ ] Gmail account with App Password enabled
- [ ] GitHub account (recommended for deploying from repo)

## 🔐 Environment Variables

All sensitive data must be stored in environment variables. Both `.env.example` files are provided:
- Backend: `backend/.env.example`
- Frontend: `frontend/.env.example`

### Required Environment Variables

#### Backend (.env)
```
# Security
SECRET_KEY=
JWT_SECRET=

# Database
DATABASE_URL=

# Frontend Connection
FRONTEND_URL=
BACKEND_URL=

# Email
EMAIL_HOST=
EMAIL_PORT=
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Redis/Caching
REDIS_URL=

# Celery
CELERY_BROKER_URL=
CELERY_RESULT_BACKEND=
```

#### Frontend (.env)
```
VITE_API_BASE_URL=
```

## 📚 Step-by-Step Deployment Instructions

1. [Neon PostgreSQL Setup](./DEPLOYMENT_NEON.md)
2. [Gmail SMTP Configuration](./DEPLOYMENT_EMAIL.md)
3. [Cloudinary Setup](./DEPLOYMENT_CLOUDINARY.md)
4. [Railway Backend Deployment](./DEPLOYMENT_RAILWAY.md)
5. [Vercel Frontend Deployment](./DEPLOYMENT_VERCEL.md)

## ✅ Verification Checklist

After deployment, verify:
- [ ] Backend API is accessible and responding to health checks
- [ ] Frontend loads and connects to backend API
- [ ] User registration works
- [ ] Email OTP verification works
- [ ] Login/logout works
- [ ] JWT token refresh works
- [ ] Product uploads to Cloudinary work
- [ ] Pagination and filtering work
- [ ] Admin panel accessible
- [ ] HTTPS is enabled
- [ ] CORS is configured correctly
- [ ] Rate limiting is active
- [ ] Logging is working

## 🔧 Production Troubleshooting

### Common Issues

1. **Database Connection Fails**
   - Verify DATABASE_URL format
   - Check Neon connection is active
   - Ensure migrations have run

2. **Static Files Not Loading**
   - Run `python manage.py collectstatic --noinput`
   - Verify STATIC_ROOT is set correctly
   - Check WhiteNoise middleware is enabled

3. **Email Not Sending**
   - Verify Gmail App Password (not regular password)
   - Check EMAIL_HOST_USER and EMAIL_HOST_PASSWORD
   - Test with: `python manage.py shell` → `from django.core.mail import send_mail` → `send_mail(...)`

4. **CORS Errors**
   - Verify CORS_ALLOWED_ORIGINS includes your Vercel domain
   - Check CSRF_TRUSTED_ORIGINS matches
   - Frontend URL must be exact (protocol, domain, port)

5. **Images Not Uploading**
   - Verify Cloudinary credentials
   - Check CLOUDINARY_CLOUD_NAME
   - Ensure DEFAULT_FILE_STORAGE points to Cloudinary

## 📞 Support Resources

- [Django Documentation](https://docs.djangoproject.com/)
- [DRF Documentation](https://www.django-rest-framework.org/)
- [Railway Documentation](https://docs.railway.app/)
- [Vercel Documentation](https://vercel.com/docs)
- [Neon Documentation](https://neon.tech/docs)
- [Cloudinary Documentation](https://cloudinary.com/documentation)

## 🚀 Next Steps

1. Review security settings in `backend/config/settings.py`
2. Update `ALLOWED_HOSTS` with your domain
3. Change default admin password after first deployment
4. Enable HTTPS/SSL
5. Set up monitoring and logging
6. Configure custom domain (if applicable)
7. Set up automated backups for database
8. Enable CDN for static assets

---

**Note**: Always test in development/staging before deploying to production.
