# Vercel Frontend Deployment Guide

Vercel is the optimal platform for deploying Next.js and Vite applications with automatic optimizations and CDN delivery.

## Prerequisites

- GitHub account with Farm2Homez repository
- Vercel account (https://vercel.com)
- Completed Railway backend deployment
- Completed Cloudinary setup

## Step 1: Create Vercel Account

1. Go to https://vercel.com
2. Sign up with GitHub (recommended)
3. Authorize Vercel to access your GitHub account
4. Complete account setup

## Step 2: Import Project from GitHub

1. In Vercel dashboard, click "Add New..." → "Project"
2. Select "Import Git Repository"
3. Find and select `Farm2Homez` repository
4. Click "Import"

## Step 3: Configure Project Settings

Vercel should auto-detect:
- **Framework**: Vite
- **Root Directory**: `./frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

If not auto-detected:
1. Click "Edit" for Build and Output Settings
2. Set Build Command: `npm run build`
3. Set Output Directory: `dist`

## Step 4: Set Environment Variables

1. In project settings, go to "Environment Variables"
2. Add production variables:

```
VITE_API_BASE_URL=https://your-railway-backend.up.railway.app/api
```

You can have different variables for different environments:

```
# Production
Environment: Production
VITE_API_BASE_URL=https://your-railway-backend.up.railway.app/api

# Preview (staging)
Environment: Preview
VITE_API_BASE_URL=https://your-railway-backend.up.railway.app/api

# Development
Environment: Development
VITE_API_BASE_URL=http://localhost:8000/api
```

## Step 5: Deploy

Click "Deploy" button. Vercel will:
1. Clone your repository
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Deploy to CDN

Monitor deployment progress in real-time. Once complete, you'll see "✓ Deployed".

## Step 6: Get Your Frontend URL

After successful deployment:
1. Your app is live at: `https://your-project.vercel.app`
2. Copy this URL (you'll need it for backend configuration)

## Step 7: Update Backend CORS Configuration

Update your Railway backend environment variables:

```
FRONTEND_URL=https://your-project.vercel.app
CORS_ALLOWED_ORIGINS=https://your-project.vercel.app
CSRF_TRUSTED_ORIGINS=https://your-project.vercel.app
```

## Step 8: Verify Deployment

1. Open your Vercel URL in browser
2. You should see the Farm2Homez frontend
3. Test user registration:
   - Click "Register"
   - Fill in form
   - You should receive OTP email
4. Test login after email verification

## Auto-Deployment from GitHub

Vercel automatically deploys when you push to GitHub:

1. Push changes to your repository:
   ```bash
   git add .
   git commit -m "Update frontend for production"
   git push origin main
   ```

2. Vercel automatically detects the push
3. Creates a new deployment
4. After ~1-2 minutes, your changes are live

## Preview Deployments

For every pull request:
1. Vercel creates a preview deployment
2. Get a unique URL for testing
3. Perfect for staging changes before merging

## Environment-Specific Configurations

### Production Environment
- VITE_API_BASE_URL points to production backend
- All features enabled
- Full error logging

### Development Environment
- VITE_API_BASE_URL points to localhost:8000
- Debug features enabled
- Verbose logging

To test locally:
```bash
cd frontend
npm install
npm run dev
# Visit http://localhost:5173
```

## Vercel.json Configuration

The `vercel.json` file is already configured with:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/index.html",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache, no-store, must-revalidate"
        }
      ]
    },
    {
      "source": "/(.*)\\.(js|css|png|jpg|gif|svg)$",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

This:
- ✅ Routes all requests to index.html (SPA routing)
- ✅ Disables cache for HTML (always fetch latest)
- ✅ Enables aggressive cache for assets (1 year)

## API URL Configuration in Frontend

The frontend automatically uses the environment variable:

```javascript
// src/api/client.js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
```

For production deployments, Vercel's environment variables override the default.

## Troubleshooting

### Build Failed
- Check build logs in Vercel dashboard
- Verify `npm run build` works locally
- Check `package.json` for missing scripts

### API Requests Failing (CORS Error)
- Verify VITE_API_BASE_URL is correct
- Check backend CORS settings include your Vercel URL
- Browser console will show exact error

### Static Files Not Loading
- Check "Output Directory" is set to `dist`
- Verify `npm run build` creates the dist folder
- Ensure vercel.json `rewrites` is configured

### Environment Variables Not Working
1. Click "Environment Variables" in Vercel
2. Verify VITE_API_BASE_URL is set
3. Redeploy (push new code or click "Redeploy")
4. Variables only available after redeploy

### Blank White Screen
- Check browser console for JavaScript errors
- Verify API connection in Network tab
- Check if backend is responding to requests

## Performance Optimization

Vercel provides several optimization features:

### 1. Automatic Image Optimization
- Images are optimized on-the-fly
- No additional configuration needed

### 2. Edge Functions (Advanced)
- Run functions at edge locations
- Useful for API authentication, redirects

### 3. Edge Caching
- Static files cached globally
- CDN improves loading speed worldwide

### 4. Analytics
- View in Vercel dashboard → Analytics
- See performance metrics in real-time

## Custom Domain Setup (Optional)

1. Buy domain from registrar (e.g., GoDaddy, Namecheap)
2. In Vercel project settings → Domains
3. Add your domain (e.g., www.farm2homez.com)
4. Vercel provides DNS records to add
5. Update your domain registrar's DNS settings
6. Wait for DNS to propagate (5-30 minutes)

## HTTPS & Security

Vercel automatically:
- ✅ Provides HTTPS certificate
- ✅ Enables HTTP/2
- ✅ Implements security headers
- ✅ Protects against common attacks

## Monitoring & Logging

### Real-Time Monitoring
1. Vercel dashboard → Monitoring
2. View request metrics, errors, performance

### Application Logging
Frontend errors are sent to browser console. To capture:

1. Set up Sentry (optional):
   ```bash
   npm install @sentry/react
   ```

2. Configure in `main.jsx`:
   ```javascript
   import * as Sentry from "@sentry/react";
   
   Sentry.init({
     dsn: "your-sentry-dsn",
     environment: process.env.NODE_ENV,
   });
   ```

## Deployment Checklist

- [ ] Project imported to Vercel
- [ ] Build succeeds without errors
- [ ] Environment variables set (VITE_API_BASE_URL)
- [ ] Frontend loads successfully
- [ ] API requests connect to backend
- [ ] User registration flow works
- [ ] OTP verification works
- [ ] Login/logout functions
- [ ] Product browsing works
- [ ] Images load from Cloudinary
- [ ] Mobile responsive on all devices
- [ ] HTTPS enabled (automatic)

## Rollback (If Needed)

To revert to previous deployment:

1. Vercel dashboard → Deployments
2. Find previous successful deployment
3. Click "..." menu → "Promote to Production"
4. Confirm rollback

## Analytics & Monitoring

Access detailed analytics:
1. Vercel dashboard → Analytics
2. View:
   - Page load times
   - Network activity
   - Error rates
   - User performance metrics

## Next Steps

1. ✅ Frontend deployed on Vercel
2. ✅ Backend deployed on Railway
3. ✅ Database on Neon PostgreSQL
4. ✅ Images on Cloudinary
5. 🔄 Next: Complete end-to-end testing
6. 🔄 Monitor production logs
7. 🔄 Set up automated backups
8. 🔄 Configure custom domain (optional)

---

**Deployment Complete!** 🎉

Your Farm2Homez application is now live in production.
