from django.db import IntegrityError, transaction

from apps.core.exceptions import ServiceError
from apps.orders.pricing import line_total, summarise
from apps.products.models import Product

from .models import CartItem

MAX_LINE_QUANTITY = 10_000


def item_issue(item):
    """Why this cart line cannot be checked out as-is, or None."""
    product = item.product
    if not product.is_public:
        return 'This product is no longer listed.'
    if not product.is_available or not product.in_season:
        return 'This product is currently unavailable.'
    if item.quantity < product.min_order_quantity:
        return f'The minimum order is {product.min_order_quantity} {product.unit}.'
    if item.quantity > product.stock_quantity:
        if product.stock_quantity < product.min_order_quantity:
            return 'This product is out of stock.'
        return f'Only {product.stock_quantity} {product.unit} available.'
    return None


def _validate_quantity(product, quantity):
    if not product.is_purchasable:
        raise ServiceError('This product is not available to order right now.', code='product_unavailable')
    if quantity < product.min_order_quantity:
        raise ServiceError(
            f'The minimum order for {product.name} is {product.min_order_quantity} {product.unit}.',
            code='below_minimum',
            errors={'quantity': [f'Minimum {product.min_order_quantity}.']},
        )
    if quantity > product.stock_quantity:
        raise ServiceError(
            f'Only {product.stock_quantity} {product.unit} of {product.name} available.',
            code='insufficient_stock',
            errors={'quantity': [f'Maximum {product.stock_quantity}.']},
        )


def cart_items(user):
    return list(
        CartItem.objects.filter(user=user)
        .select_related('product__producer__user', 'product__category', 'product__subcategory')
        .prefetch_related('product__images')
    )


def add_item(user, product_slug, quantity):
    product = Product.objects.public().select_related('producer__user', 'category').filter(slug=product_slug).first()
    if product is None:
        raise ServiceError('This product could not be found.', code='product_not_found', status_code=404)
    try:
        with transaction.atomic():
            item = CartItem.objects.select_for_update().filter(user=user, product=product).first()
            new_quantity = min((item.quantity if item else 0) + quantity, MAX_LINE_QUANTITY)
            _validate_quantity(product, new_quantity)
            if item:
                item.quantity = new_quantity
                item.save(update_fields=['quantity', 'updated_at'])
            else:
                item = CartItem.objects.create(user=user, product=product, quantity=new_quantity)
    except IntegrityError:
        # A concurrent request created the line first; retry once as an increment.
        return add_item(user, product_slug, quantity)
    return item


def set_quantity(item, quantity):
    _validate_quantity(item.product, quantity)
    item.quantity = quantity
    item.save(update_fields=['quantity', 'updated_at'])
    return item


def build_cart(user):
    items = cart_items(user)
    valid = [item for item in items if item_issue(item) is None]
    totals = summarise((i.product.producer, i.product.price, i.quantity) for i in valid)
    return {
        'items': [
            {'item': item, 'issue': item_issue(item), 'line_total': line_total(item.product.price, item.quantity)}
            for item in items
        ],
        'groups': totals['groups'],
        'subtotal': totals['subtotal'],
        'delivery_total': totals['delivery_total'],
        'total': totals['total'],
        'item_count': sum(item.quantity for item in items),
        'can_checkout': bool(items) and len(valid) == len(items),
    }
