# Neon PostgreSQL Setup Guide

Neon is a serverless PostgreSQL database platform that's perfect for production deployments.

## Step 1: Create a Neon Account

1. Go to https://neon.tech
2. Sign up with your email or GitHub account
3. Verify your email

## Step 2: Create a Project

1. Click "Create a project"
2. Choose a name (e.g., "Farm2Homez")
3. Select your region (choose closest to your users)
4. Click "Create project"

## Step 3: Get Your Database Connection String

1. In your Neon project, click on "Connection strings"
2. Select "Psycopg2" from the dropdown
3. Copy the connection string
4. The format will be:
   ```
   postgresql://user:password@host/database
   ```

## Step 4: Update Your Environment Variable

1. In your Railway project settings (or local .env):
   ```
   DATABASE_URL=postgresql://user:password@neon-host/farm2homez
   ```

2. Replace:
   - `user` with the provided username
   - `password` with the provided password
   - `neon-host` with the provided host
   - `farm2homez` with your database name

## Step 5: Test the Connection

Run in your Django project:
```bash
python manage.py dbshell
```

If you see the PostgreSQL prompt, the connection works!

## Step 6: Run Migrations

After deploying to Railway with the Neon DATABASE_URL:

```bash
python manage.py migrate --noinput
```

Or via Railway CLI:
```bash
railway run python manage.py migrate --noinput
```

## Connection Pooling

Neon automatically provides connection pooling. No additional configuration needed.

## Backup & Security

1. **Automatic Backups**: Neon provides automatic backups (check your plan)
2. **SSL**: Always use SSL for production connections
3. **IP Allowlist**: Consider setting up IP allowlist in Neon dashboard

## Monitoring

Monitor your database in the Neon dashboard:
- Connection count
- Query performance
- Storage usage
- Activity log

## Troubleshooting

### "too many connections" Error
- Check WEB_CONCURRENCY setting (limit to 10-20 for free tier)
- Use Neon's connection pooler feature

### Slow Queries
- Check Neon's monitoring tab
- Add database indexes
- Optimize Django queries

### Cannot Connect
- Verify DATABASE_URL format
- Check username and password
- Ensure IP allowlist is configured (if enabled)

---

**Next**: [Email Setup Guide](./DEPLOYMENT_EMAIL.md)
