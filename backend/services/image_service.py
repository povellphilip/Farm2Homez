from django.conf import settings


def upload_product_image(file_obj):
    if settings.IMAGE_STORAGE_PROVIDER == 's3':
        from services.s3_service import upload_product_image as upload
    else:
        from services.cloudinary_service import upload_product_image as upload
    return upload(file_obj)
