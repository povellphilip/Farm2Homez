import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.products.models import ModerationStatus, Product, ProductImage, ProductStatus

from .conftest import as_user, image_file, make_producer, make_product, make_user

pytestmark = pytest.mark.django_db


def slugs(response):
    return {item['slug'] for item in response.data['results']}


class TestPublicCatalogue:
    def test_only_live_listings_are_public(self, api, categories):
        verified = make_producer()
        unverified = make_producer(verified=False)
        suspended = make_producer(active=False)
        live = make_product(verified, categories['fruits'], name='Live')
        draft = make_product(verified, categories['fruits'], name='Draft', published=False)
        rejected = make_product(verified, categories['fruits'], name='Rejected', moderation_status=ModerationStatus.REJECTED)
        pending = make_product(verified, categories['fruits'], name='Pending', moderation_status=ModerationStatus.PENDING)
        from_unverified = make_product(unverified, categories['fruits'], name='Unverified')
        from_suspended = make_product(suspended, categories['fruits'], name='Suspended')

        response = api.get('/api/products/')
        assert response.status_code == 200
        assert slugs(response) == {live.slug}
        for hidden in (draft, rejected, pending, from_unverified, from_suspended):
            assert api.get(f'/api/products/{hidden.slug}/').status_code == 404

    def test_inactive_category_hides_products(self, api, product, categories):
        categories['fruits'].is_active = False
        categories['fruits'].save()
        assert api.get('/api/products/').data['count'] == 0

    def test_detail_includes_producer_without_private_contact(self, api, product):
        response = api.get(f'/api/products/{product.slug}/')
        assert response.status_code == 200
        producer = response.data['producer']
        assert producer['farm_name'] == product.producer.farm_name
        assert producer['whatsapp_link'] is None
        assert 'email' not in producer and 'phone_number' not in producer
        assert 'address_line1' not in producer

    def test_whatsapp_link_only_when_opted_in(self, api, product):
        profile = product.producer
        profile.whatsapp_number = '+91 98470 00101'
        profile.save()
        assert api.get(f'/api/products/{product.slug}/').data['producer']['whatsapp_link'] is None
        profile.whatsapp_enabled = True
        profile.save()
        assert api.get(f'/api/products/{product.slug}/').data['producer']['whatsapp_link'] == 'https://wa.me/919847000101'

    def test_search_filter_and_sort(self, api, categories):
        farm = make_producer(farm_name='Malnad Estates')
        other = make_producer(farm_name='Coastal Farm')
        coffee = make_product(farm, categories['plantation-crops'], name='Arabica Coffee', price='640.00', subcategory=categories['coffee'])
        pepper = make_product(farm, categories['plantation-crops'], name='Black Pepper', price='780.00', subcategory=categories['spices'])
        mango = make_product(other, categories['fruits'], name='Alphonso Mango', price='120.00', stock=0)

        assert slugs(api.get('/api/products/', {'search': 'arabica'})) == {coffee.slug}
        assert slugs(api.get('/api/products/', {'search': 'malnad'})) == {coffee.slug, pepper.slug}
        assert slugs(api.get('/api/products/', {'category': 'plantation-crops'})) == {coffee.slug, pepper.slug}
        assert slugs(api.get('/api/products/', {'category': 'spices'})) == {pepper.slug}
        assert slugs(api.get('/api/products/', {'min_price': 500, 'max_price': 700})) == {coffee.slug}
        assert slugs(api.get('/api/products/', {'producer': other.producer_profile.slug})) == {mango.slug}
        assert slugs(api.get('/api/products/', {'in_stock': 'true'})) == {coffee.slug, pepper.slug}
        assert slugs(api.get('/api/products/', {'in_stock': 'false'})) == {mango.slug}
        ordered = [item['slug'] for item in api.get('/api/products/', {'ordering': 'price'}).data['results']]
        assert ordered == [mango.slug, coffee.slug, pepper.slug]

    def test_pagination(self, api, producer, categories):
        for _ in range(25):
            make_product(producer, categories['vegetables'])
        response = api.get('/api/products/', {'page_size': 10})
        assert response.data['count'] == 25
        assert len(response.data['results']) == 10
        assert response.data['next']

    def test_categories_list_with_counts(self, api, product):
        response = api.get('/api/categories/')
        assert response.status_code == 200
        names = [c['name'] for c in response.data]
        assert names == ['Fruits', 'Vegetables', 'Plantation Crops', 'Honey & Bee Products', 'Livestock Products']
        fruits = response.data[0]
        assert fruits['product_count'] == 1
        assert {'name': 'Citrus', 'slug': 'citrus'} in [{k: c[k] for k in ('name', 'slug')} for c in fruits['children']]

    def test_producer_directory_and_profile(self, api, product):
        make_producer(verified=False, farm_name='Hidden Farm')
        response = api.get('/api/producers/')
        assert [p['farm_name'] for p in response.data['results']] == [product.producer.farm_name]
        detail = api.get(f'/api/producers/{product.producer.slug}/')
        assert detail.data['product_count'] == 1


PRODUCT_PAYLOAD = {
    'name': 'Organic Tomatoes',
    'category': 'vegetables',
    'subcategory': 'everyday-vegetables',
    'description': 'Vine ripened.',
    'price': '48.50',
    'unit': 'kg',
    'stock_quantity': 100,
    'min_order_quantity': 2,
    'origin': 'Wayanad, Kerala',
    'is_seasonal': True,
    'available_from': '2026-01-01',
    'available_until': '2026-12-31',
}


class TestProducerListings:
    def test_create_edit_publish_unpublish_delete(self, producer, categories, api):
        client = as_user(producer)
        response = client.post('/api/producers/me/products/', PRODUCT_PAYLOAD)
        assert response.status_code == 201, response.data
        product_id = response.data['id']
        assert response.data['status'] == ProductStatus.DRAFT
        assert response.data['currency'] == 'INR'

        assert client.patch(f'/api/producers/me/products/{product_id}/', {'price': '52.00'}).data['price'] == '52.00'
        slug = response.data['slug']
        assert api.get(f'/api/products/{slug}/').status_code == 404  # drafts are private

        assert client.post(f'/api/producers/me/products/{product_id}/publish/').data['status'] == ProductStatus.PUBLISHED
        assert api.get(f'/api/products/{slug}/').status_code == 200

        assert client.post(f'/api/producers/me/products/{product_id}/unpublish/').data['status'] == ProductStatus.UNPUBLISHED
        assert api.get(f'/api/products/{slug}/').status_code == 404

        assert client.delete(f'/api/producers/me/products/{product_id}/').status_code == 204
        assert not Product.objects.filter(pk=product_id).exists()

    def test_unverified_producer_can_draft_but_not_publish(self, categories):
        user = make_producer(verified=False)
        client = as_user(user)
        product_id = client.post('/api/producers/me/products/', PRODUCT_PAYLOAD).data['id']
        response = client.post(f'/api/producers/me/products/{product_id}/publish/')
        assert response.status_code == 403
        assert response.data['code'] == 'producer_not_verified'

    def test_server_controlled_fields_are_ignored(self, producer, categories):
        client = as_user(producer)
        payload = {**PRODUCT_PAYLOAD, 'status': 'PUBLISHED', 'moderation_status': 'APPROVED', 'slug': 'hijack', 'currency': 'USD'}
        response = client.post('/api/producers/me/products/', payload)
        assert response.data['status'] == ProductStatus.DRAFT
        assert response.data['slug'] != 'hijack'
        assert response.data['currency'] == 'INR'

    def test_validation_errors(self, producer, categories):
        client = as_user(producer)
        bad = {**PRODUCT_PAYLOAD, 'price': '0', 'min_order_quantity': 0, 'subcategory': 'coffee', 'available_until': '2025-01-01'}
        response = client.post('/api/producers/me/products/', bad)
        assert response.status_code == 400
        assert {'price', 'min_order_quantity'} <= set(response.data['errors'])
        response = client.post('/api/producers/me/products/', {**PRODUCT_PAYLOAD, 'subcategory': 'coffee'})
        assert 'subcategory' in response.data['errors']
        response = client.post('/api/producers/me/products/', {**PRODUCT_PAYLOAD, 'available_until': '2025-01-01'})
        assert 'available_until' in response.data['errors']

    def test_producer_cannot_touch_another_producers_listing(self, product):
        intruder = as_user(make_producer())
        base = f'/api/producers/me/products/{product.pk}/'
        assert intruder.get(base).status_code == 404
        assert intruder.patch(base, {'price': '1.00'}).status_code == 404
        assert intruder.delete(base).status_code == 404
        assert intruder.post(f'{base}publish/').status_code == 404
        assert intruder.post(f'{base}images/', {'image': image_file()}, format='multipart').status_code == 404
        assert product.pk not in [p['id'] for p in intruder.get('/api/producers/me/products/').data['results']]

    def test_consumers_and_anonymous_cannot_manage_listings(self, api, consumer, product):
        assert api.get('/api/producers/me/products/').status_code == 401
        assert as_user(consumer).post('/api/producers/me/products/', PRODUCT_PAYLOAD).status_code == 403

    def test_rejected_listing_returns_to_review_when_republished(self, product, admin_user):
        admin = as_user(admin_user)
        response = admin.post(f'/api/admin/products/{product.pk}/moderate/', {'decision': 'REJECTED', 'note': 'Blurry photos'})
        assert response.status_code == 200
        product.refresh_from_db()
        assert product.moderation_status == ModerationStatus.REJECTED

        owner = as_user(product.producer.user)
        response = owner.post(f'/api/producers/me/products/{product.pk}/publish/')
        assert response.data['moderation_status'] == ModerationStatus.PENDING
        assert as_user(make_user()).get(f'/api/products/{product.slug}/').status_code == 404

    def test_premoderation_setting(self, settings, producer, categories):
        settings.PRODUCT_PREMODERATION = True
        client = as_user(producer)
        product_id = client.post('/api/producers/me/products/', PRODUCT_PAYLOAD).data['id']
        assert client.post(f'/api/producers/me/products/{product_id}/publish/').data['moderation_status'] == ModerationStatus.PENDING


class TestImages:
    def url(self, product):
        return f'/api/producers/me/products/{product.pk}/images/'

    def test_upload_reorder_delete(self, product):
        client = as_user(product.producer.user)
        first = client.post(self.url(product), {'image': image_file(), 'alt_text': 'Avocados'}, format='multipart')
        assert first.status_code == 201, first.data
        second = client.post(self.url(product), {'image': image_file('PNG', name='b.png')}, format='multipart')
        assert second.status_code == 201

        stored = ProductImage.objects.get(pk=first.data['id'])
        assert stored.image.name.startswith(f'products/{product.pk}/')
        assert 'photo' not in stored.image.name  # server-generated key, not the client filename
        assert stored.content_type == 'image/jpeg'

        order = [second.data['id'], first.data['id']]
        response = client.post(f'{self.url(product)}order/', {'image_ids': order})
        assert [image['id'] for image in response.data] == order

        assert client.delete(f'{self.url(product)}{first.data["id"]}/').status_code == 204
        assert not ProductImage.objects.filter(pk=first.data['id']).exists()

    def test_rejects_non_images_and_spoofed_extensions(self, product):
        client = as_user(product.producer.user)
        fake = SimpleUploadedFile('evil.jpg', b'<?php echo 1; ?>', content_type='image/jpeg')
        response = client.post(self.url(product), {'image': fake}, format='multipart')
        assert response.status_code == 400
        assert response.data['code'] == 'image_invalid'

    def test_rejects_disallowed_format(self, product):
        client = as_user(product.producer.user)
        response = client.post(self.url(product), {'image': image_file('GIF', name='a.gif')}, format='multipart')
        assert response.status_code == 400
        assert response.data['code'] == 'image_type'

    def test_size_limit(self, product, settings):
        settings.MAX_IMAGE_UPLOAD_BYTES = 100
        client = as_user(product.producer.user)
        response = client.post(self.url(product), {'image': image_file()}, format='multipart')
        assert response.data['code'] == 'image_too_large'

    def test_image_count_limit(self, product, settings):
        settings.MAX_IMAGES_PER_PRODUCT = 2
        client = as_user(product.producer.user)
        for _ in range(2):
            assert client.post(self.url(product), {'image': image_file()}, format='multipart').status_code == 201
        assert client.post(self.url(product), {'image': image_file()}, format='multipart').data['code'] == 'image_limit'

    def test_metadata_is_stripped(self, product):
        client = as_user(product.producer.user)
        response = client.post(self.url(product), {'image': image_file(exif_gps=True)}, format='multipart')
        stored = ProductImage.objects.get(pk=response.data['id'])
        with stored.image.open('rb') as handle, Image.open(handle) as reopened:
            assert not reopened.getexif()

    def test_large_images_are_resized(self, product):
        client = as_user(product.producer.user)
        response = client.post(self.url(product), {'image': image_file(size=(3000, 1500))}, format='multipart')
        assert (response.data['width'], response.data['height']) == (2000, 1000)
