# Email Configuration Guide

Farm2Homez supports multiple email providers. This guide covers Gmail SMTP (easiest for development) and notes for SendGrid/Brevo.

## Gmail SMTP Setup (Recommended for Initial Deployment)

### Step 1: Enable 2-Factor Authentication

1. Go to https://myaccount.google.com/
2. Click "Security" in the left sidebar
3. Find "2-Step Verification" and enable it
4. Complete the verification process

### Step 2: Generate App Password

1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and "Windows Computer" (or your platform)
3. Google will generate a 16-character password
4. Copy this password (you won't see it again)

### Step 3: Update Environment Variables

Add to your `.env` file:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password-here
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=your-email@gmail.com
ADMIN_NOTIFICATION_EMAIL=your-email@gmail.com
```

### Step 4: Test Email Sending

Run in Django shell:
```bash
python manage.py shell
```

Then:
```python
from django.core.mail import send_mail
send_mail(
    'Test Email',
    'This is a test from Farm2Homez',
    'your-email@gmail.com',
    ['recipient@example.com'],
    fail_silently=False,
)
```

## Switching to SendGrid (For Production Scale)

### Setup Steps:

1. Create account at https://sendgrid.com
2. Verify your sender email
3. Generate an API key in Settings → API Keys
4. Update environment variables:

```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-sendgrid-api-key
```

### Code Changes:

In your backend, you'll need to create a custom email backend or use:
- [django-sendgrid-v5](https://github.com/sklarsa/django-sendgrid-v5)

Install:
```bash
pip install django-sendgrid-v5
```

Update settings.py:
```python
if config('EMAIL_PROVIDER', default='smtp') == 'sendgrid':
    EMAIL_BACKEND = "sendgrid_backend.SendgridBackend"
else:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
```

## Switching to Brevo (Formerly Sendinblue)

### Setup Steps:

1. Create account at https://www.brevo.com
2. Get SMTP credentials from Settings → SMTP & API
3. Update environment variables:

```env
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-brevo-email@example.com
EMAIL_HOST_PASSWORD=your-brevo-password
EMAIL_PROVIDER=brevo
BREVO_API_KEY=your-brevo-api-key
```

## Email Features Implemented

### 1. User Registration OTP
- 6-digit OTP sent after signup
- OTP expires in 10 minutes (configurable)
- Users must verify email to activate account

### 2. Password Reset
- Users request password reset via email
- OTP sent to their email
- Password reset with OTP verification

### 3. Admin Notifications
- New contact form submissions
- Important system events

## Email Templates

Currently using plain text emails. For HTML emails, consider:
- [django-templated-email](https://github.com/vintasoftware/django-templated-email)
- [sendgrid-django](https://github.com/sendgrid/sendgrid-django)

## Rate Limiting

Email endpoints are rate-limited:
- **Register**: 5 requests/minute per IP
- **Resend OTP**: 3 requests/minute per IP
- **Forgot Password**: 3 requests/minute per IP

## Testing in Development

Use Django's console backend for testing:
```env
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

Emails will be printed to console instead of sending.

## Troubleshooting

### "Authentication failed" Error
- Verify EMAIL_HOST_USER and EMAIL_HOST_PASSWORD
- For Gmail: Make sure you're using App Password, not regular password
- Check that EMAIL_USE_TLS is True for port 587

### Emails Not Sending
- Check Django logs: `tail logs/farm2homez.log`
- Verify EMAIL_HOST configuration
- Test with shell command above

### Rate Limit Issues
- IPs hitting rate limit will get: `{"error": "Rate limit exceeded"}`
- Limit persists for 60 seconds per IP
- See `apps/accounts/views.py` for rate limit configuration

## Security Best Practices

1. ✅ Never commit `.env` file with real credentials
2. ✅ Use environment variables for all secrets
3. ✅ Consider using environment-specific email providers
4. ✅ Implement email verification to prevent abuse
5. ✅ Monitor email sending logs for suspicious activity

---

**Next**: [Cloudinary Setup Guide](./DEPLOYMENT_CLOUDINARY.md)
