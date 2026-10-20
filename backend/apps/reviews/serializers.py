from rest_framework import serializers

from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    reviewer = serializers.SerializerMethodField()
    product_slug = serializers.SlugField(source='product.slug', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(max_length=2000, required=False, allow_blank=True, default='')

    class Meta:
        model = Review
        fields = ['id', 'product_slug', 'product_name', 'reviewer', 'rating', 'comment', 'created_at', 'updated_at']

    def get_reviewer(self, review) -> str:
        # Public reviews show a first name only.
        return (review.consumer.full_name or 'Customer').split()[0]


class ReviewCreateSerializer(ReviewSerializer):
    product = serializers.SlugField(write_only=True)

    class Meta(ReviewSerializer.Meta):
        fields = ReviewSerializer.Meta.fields + ['product']
