# Production Deployment Checklist

Complete this checklist before deploying to production to ensure everything is properly configured and secure.

## 🔐 Security Configuration

### Environment Variables
- [ ] All secrets are in `.env` (not hardcoded)
- [ ] `.env` is in `.gitignore`
- [ ] No secrets in `.env.example`
- [ ] Generated strong `SECRET_KEY`
- [ ] Generated strong `JWT_SECRET`
- [ ] `DEBUG=False` in production `.env`

### Django Security Settings
- [ ] `ALLOWED_HOSTS` includes production domain
- [ ] `SECURE_SSL_REDIRECT=True`
- [ ] `SECURE_HSTS_SECONDS=31536000`
- [ ] `SESSION_COOKIE_SECURE=True`
- [ ] `CSRF_COOKIE_SECURE=True`
- [ ] `SECURE_CONTENT_TYPE_NOSNIFF=True`
- [ ] `X_FRAME_OPTIONS='DENY'`
- [ ] HTTPS certificate configured

### CORS & CSRF
- [ ] `CORS_ALLOWED_ORIGINS` includes only Vercel URL
- [ ] `CSRF_TRUSTED_ORIGINS` matches CORS origins
- [ ] No wildcard (*) in CORS origins
- [ ] Frontend URL is exact (scheme + domain)

### Authentication & Passwords
- [ ] Password validators enabled
- [ ] Default admin password changed
- [ ] JWT token expiration configured (30 min access, 7 day refresh)
- [ ] BLACKLIST_AFTER_ROTATION enabled for logout

## 🗄️ Database Configuration

### PostgreSQL on Neon
- [ ] Neon PostgreSQL account created
- [ ] Database created and verified
- [ ] `DATABASE_URL` environment variable set
- [ ] Connection string tested successfully
- [ ] Migrations applied: `python manage.py migrate`
- [ ] Admin user created: `python manage.py seed_database --admin`
- [ ] Test data seeded (optional): `python manage.py seed_database`

### Database Security
- [ ] Connection uses SSL
- [ ] Connection pooling enabled
- [ ] Automatic backups configured
- [ ] Regular backup schedule set up
- [ ] Database credentials never exposed in logs

## 📧 Email Configuration

### Gmail SMTP Setup
- [ ] Gmail 2-factor authentication enabled
- [ ] App password generated (not regular password)
- [ ] `EMAIL_HOST=smtp.gmail.com`
- [ ] `EMAIL_PORT=587`
- [ ] `EMAIL_HOST_USER` set to Gmail address
- [ ] `EMAIL_HOST_PASSWORD` set to app password
- [ ] `EMAIL_USE_TLS=True`

### Email Testing
- [ ] Test email sending: `python manage.py shell` → send_mail()
- [ ] OTP email received during registration
- [ ] Password reset email works
- [ ] Admin notification emails working

### Email Provider Ready (Optional)
- [ ] SendGrid account created (if switching)
- [ ] Brevo account created (if switching)
- [ ] Documentation noted for future switching

## 🖼️ Image Storage (Cloudinary)

- [ ] Cloudinary account created
- [ ] `CLOUDINARY_CLOUD_NAME` set
- [ ] `CLOUDINARY_API_KEY` set
- [ ] `CLOUDINARY_API_SECRET` set (kept private)
- [ ] Credentials tested in development
- [ ] Product image uploads tested
- [ ] Image transformations working
- [ ] CDN delivery enabled

## 🚀 Backend Deployment (Railway)

### Project Setup
- [ ] Railway account created
- [ ] GitHub repository connected
- [ ] `railway.json` configured correctly
- [ ] `Procfile` configured (if needed)
- [ ] `runtime.txt` correct Python version

### Environment Variables on Railway
- [ ] All `.env` variables added to Railway
- [ ] `SECRET_KEY` is strong and unique
- [ ] `JWT_SECRET` is strong and unique
- [ ] Database URL from Neon configured
- [ ] Cloudinary credentials configured
- [ ] Email credentials configured
- [ ] Frontend URL set to Vercel domain
- [ ] Backend URL set to Railway domain
- [ ] `DEBUG=False`
- [ ] `ENVIRONMENT=production`

### Deployment Execution
- [ ] Code pushed to GitHub
- [ ] Railway deployment started
- [ ] Build logs reviewed (no errors)
- [ ] Deployment marked as "Running"
- [ ] Backend URL obtained from Railway

### Post-Deployment Verification
- [ ] Backend API accessible: `/api/schema/`
- [ ] Migrations applied automatically
- [ ] Static files collected
- [ ] Admin panel accessible: `/admin/`
- [ ] Test user creation works
- [ ] Health check returns 200 status

## 🎨 Frontend Deployment (Vercel)

### Project Setup
- [ ] Vercel account created
- [ ] GitHub repository imported to Vercel
- [ ] Root directory set to `./frontend`
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`

### Environment Variables on Vercel
- [ ] `VITE_API_BASE_URL` set to Railway backend URL
- [ ] Different values for Production/Preview/Development (optional)

### Deployment Execution
- [ ] `package.json` has correct scripts
- [ ] Build test locally: `npm run build`
- [ ] Vercel deployment started
- [ ] Build succeeded without errors
- [ ] Frontend URL obtained from Vercel

### Post-Deployment Verification
- [ ] Frontend loads successfully
- [ ] API requests connect to backend
- [ ] No CORS errors in browser console
- [ ] Environment variables loaded correctly

## 🔗 Integration Testing

### Authentication Flow
- [ ] User registration page loads
- [ ] User can register new account
- [ ] OTP email sent and received
- [ ] User can verify OTP
- [ ] Account activated after verification
- [ ] User can log in with email
- [ ] User can log in with phone (if implemented)
- [ ] JWT tokens issued correctly
- [ ] Token refresh works
- [ ] User can log out
- [ ] Refresh token is blacklisted after logout
- [ ] Password reset flow works

### Product Features
- [ ] Product browsing works
- [ ] Product filtering works
- [ ] Product pagination works
- [ ] Product search works
- [ ] Product images load from Cloudinary
- [ ] Product upload with image works (for sellers)

### Cart & Checkout
- [ ] Cart add/remove items works
- [ ] Cart persists on page reload (if using localStorage)
- [ ] Checkout page loads
- [ ] Order creation works

### Reviews & Ratings
- [ ] Users can submit reviews
- [ ] Review display works
- [ ] Rating calculations correct
- [ ] Reviews moderation works (if admin feature)

### Admin Panel
- [ ] Admin can log in
- [ ] Admin can manage users
- [ ] Admin can manage products
- [ ] Admin can view orders
- [ ] Admin can view reviews
- [ ] Admin actions work correctly

## 📊 Logging & Monitoring

### Backend Logging
- [ ] Logs are being written
- [ ] Log rotation configured (if file logging)
- [ ] Log level set appropriately
- [ ] Errors are logged with full traceback
- [ ] Security events logged

### Frontend Monitoring (Optional)
- [ ] Error tracking service integrated (e.g., Sentry)
- [ ] Performance monitoring enabled
- [ ] User analytics configured

### Railway Monitoring
- [ ] Deployment logs accessible
- [ ] Error logs reviewed
- [ ] Performance metrics visible
- [ ] Memory usage normal
- [ ] CPU usage acceptable

### Vercel Monitoring
- [ ] Build logs reviewed
- [ ] Deployment logs accessible
- [ ] Performance Analytics enabled
- [ ] Edge Function logs (if used)

## 🔒 Security Audit

### Code Security
- [ ] No secrets in repository
- [ ] No debug code left in production
- [ ] No TODO comments with sensitive info
- [ ] SQL injection protection (using ORM)
- [ ] XSS protection (Django templates)
- [ ] CSRF protection enabled

### API Security
- [ ] Rate limiting active (check `@ratelimit` decorators)
- [ ] Endpoints require authentication where needed
- [ ] Permission classes configured correctly
- [ ] Input validation on all endpoints
- [ ] Output sanitization where needed

### Data Security
- [ ] Passwords hashed (Django handles this)
- [ ] Sensitive data encrypted at rest (if applicable)
- [ ] Database backups encrypted (Neon handles this)
- [ ] Email credentials not in logs

### Infrastructure Security
- [ ] HTTPS enforced (automatic on Vercel & Railway)
- [ ] HSTS headers enabled
- [ ] Security headers present (check with header checker)
- [ ] No exposed ports
- [ ] Rate limiting configured
- [ ] DDoS protection enabled (Railway/Vercel handle this)

## 📱 Browser & Device Testing

### Desktop Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile Browsers
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Mobile responsiveness verified

### Performance
- [ ] Page load time < 3 seconds
- [ ] API response time < 500ms
- [ ] No console errors
- [ ] Network requests optimized

## 📞 Support & Documentation

### Documentation
- [ ] Deployment guide complete
- [ ] Environment variables documented
- [ ] API endpoints documented (auto-generated by drf-spectacular)
- [ ] Troubleshooting guide created
- [ ] Emergency procedures documented

### Monitoring Setup
- [ ] Alerts configured for critical errors
- [ ] Dashboard created (if using monitoring service)
- [ ] Backup strategy documented
- [ ] Disaster recovery plan ready

### Team Communication
- [ ] Team notified of deployment
- [ ] Known issues documented
- [ ] Rollback procedure tested
- [ ] Support contact information shared

## 🎯 Performance Optimization

### Backend Performance
- [ ] Database indexes created for frequently queried fields
- [ ] N+1 query problems identified and fixed
- [ ] Caching configured (Redis)
- [ ] Pagination implemented
- [ ] Query optimization done
- [ ] Unused middleware removed

### Frontend Performance
- [ ] Bundle size optimized
- [ ] Images compressed and responsive
- [ ] Lazy loading implemented
- [ ] Code splitting done
- [ ] CSS/JS minified
- [ ] CDN delivering assets

### API Optimization
- [ ] Response time < 500ms
- [ ] Database queries efficient
- [ ] Caching headers set correctly
- [ ] Gzip compression enabled
- [ ] API pagination working

## ✅ Pre-Launch Checklist

One week before launch:
- [ ] Full system test completed
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Backup strategy tested
- [ ] Team trained on operations
- [ ] Escalation procedures ready

Day before launch:
- [ ] Final code review
- [ ] Database backed up
- [ ] Rollback procedure tested
- [ ] Team on standby
- [ ] Monitoring dashboard ready

Day of launch:
- [ ] Final smoke test
- [ ] Monitoring active
- [ ] Team monitoring errors
- [ ] Support team available
- [ ] Communication channels open

## 🚀 Post-Deployment (First 24 Hours)

- [ ] Monitor error rates
- [ ] Monitor performance metrics
- [ ] Check user feedback
- [ ] Review security logs
- [ ] Verify email delivery
- [ ] Test image uploads
- [ ] Check database performance
- [ ] Monitor API response times
- [ ] Review and fix any issues

## 📋 Ongoing Maintenance

### Daily
- [ ] Check error logs
- [ ] Monitor system health
- [ ] Verify email sending

### Weekly
- [ ] Review performance metrics
- [ ] Check security alerts
- [ ] Update dependencies (if needed)
- [ ] Test backup restoration

### Monthly
- [ ] Full system audit
- [ ] Performance optimization review
- [ ] Security patches applied
- [ ] User feedback analysis

### Quarterly
- [ ] Disaster recovery drill
- [ ] Security penetration test (if possible)
- [ ] Performance benchmarking
- [ ] Capacity planning review

---

**Deployment Status**: 
- [ ] All items completed

**Date Deployed**: ________________

**Deployed By**: ________________

**Contact for Issues**: ________________

