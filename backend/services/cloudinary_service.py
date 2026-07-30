import cloudinary.uploader


def upload_product_image(file_obj):
    result = cloudinary.uploader.upload(
        file_obj,
        folder='farm2homez/products',
        resource_type='image',
        overwrite=False,
    )
    return result['secure_url']
