# Cloudinary Setup Guide

Cloudinary handles all image storage and transformation for Farm2Homez, eliminating the need for local file storage.

## Step 1: Create a Cloudinary Account

1. Go to https://cloudinary.com
2. Sign up (free account is fine for development)
3. Verify your email

## Step 2: Get Your Credentials

1. Log in to your Cloudinary dashboard
2. Go to Settings → API Keys
3. You'll see:
   - **Cloud Name** (public)
   - **API Key** (public)
   - **API Secret** (keep private)

## Step 3: Update Environment Variables

Add to your `.env` file:

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

Replace with your actual values from the Cloudinary dashboard.

## Step 4: Verify Configuration

The following files are already configured to use Cloudinary:

1. **backend/config/settings.py**:
   - `DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'`
   - `CLOUDINARY_STORAGE` configuration

2. **Product Models**: 
   - Images are stored in `products/models.py`
   - Images automatically upload to Cloudinary

## How It Works

### Image Upload Flow

1. **Frontend**: User uploads image via React form
2. **Backend**: Django receives image file
3. **Cloudinary**: Image automatically saved to Cloudinary
4. **Database**: Only the Cloudinary URL is stored in PostgreSQL

### Example Usage

```python
from apps.products.models import Product

# Create product with image
product = Product.objects.create(
    name="Tomatoes",
    image=request.FILES['image'],  # Cloudinary handles upload
    # ...
)

# Get image URL from database
print(product.image.url)  # https://res.cloudinary.com/...
```

## Image Transformations

Cloudinary supports real-time image transformations:

```python
# In templates or serializers
image_url = f"{product.image.url}?w=300&h=300&c=fill"  # Resize to 300x300
image_url = f"{product.image.url}?w=600&q=auto"        # Responsive quality
```

See [Cloudinary URL API](https://cloudinary.com/documentation/image_transformation_reference) for all options.

## Storage Structure

Images are organized in your Cloudinary account:
- All product images: `/farm2homez/products/`
- Profile pictures: `/farm2homez/profiles/`
- Other uploads: `/farm2homez/uploads/`

## Quotas & Limits

Free Tier (sufficient for initial deployment):
- **Transformations**: 40,000/month
- **Storage**: 2 GB
- **Bandwidth**: 1 GB/month
- **API Calls**: 500/hour

Upgrade to paid plans for higher limits.

## Signed URLs

For sensitive images, Cloudinary supports signed URLs:

```python
from cloudinary.utils import cloudinary_url

# Generate URL that expires in 1 hour
url, options = cloudinary_url(
    product.image.name,
    sign_url=True,
    type='authenticated',
    resource_type='image',
    expiration=int(time.time()) + 3600,  # 1 hour
)
```

## Advanced: Custom Upload Presets

For direct browser uploads (bypassing server):

1. Go to Settings → Upload → Add upload preset
2. Configure allowed formats, sizes, transformations
3. Mark as "unsigned" for browser uploads
4. Use preset in frontend:

```javascript
// Frontend - Upload directly to Cloudinary
const formData = new FormData();
formData.append('file', imageFile);
formData.append('upload_preset', 'your_preset_name');

const response = await fetch(
  `https://api.cloudinary.com/v1_1/your-cloud-name/image/upload`,
  { method: 'POST', body: formData }
);
```

## Troubleshooting

### Images Not Uploading
- Verify CLOUDINARY_CLOUD_NAME is correct
- Check CLOUDINARY_API_KEY and API_SECRET
- Ensure django-cloudinary-storage is installed: `pip install django-cloudinary-storage`

### "Invalid cloud name" Error
- Go to Cloudinary dashboard → Settings
- Copy exact Cloud Name
- Restart Django development server

### Transformations Not Working
- Check Cloudinary plan supports transformations
- Verify URL format is correct
- Test transformation in Cloudinary console

### Storage Quota Exceeded
- Go to Settings → Usage
- Consider upgrading plan
- Or delete old unused images

## Security Best Practices

1. ✅ Keep API_SECRET private (never expose in frontend)
2. ✅ Use signed URLs for sensitive images
3. ✅ Set resource restrictions in upload presets
4. ✅ Monitor usage in Cloudinary dashboard
5. ✅ Enable two-factor authentication on Cloudinary account

## Migration from Local Storage

If you had local file storage before:

```bash
# Upload all local files to Cloudinary
python manage.py collectstatic --noinput

# Update product image paths in database (if needed)
# This requires a data migration
```

---

**Next**: [Railway Backend Deployment](./DEPLOYMENT_RAILWAY.md)
