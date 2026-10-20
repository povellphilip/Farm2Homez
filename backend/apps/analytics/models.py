from django.db import models


class ProductViewDaily(models.Model):
    """Product page views aggregated per day (no per-visitor tracking)."""

    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name='daily_views')
    date = models.DateField()
    views = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-date']
        constraints = [models.UniqueConstraint(fields=['product', 'date'], name='uniq_product_view_day')]

    def __str__(self):
        return f'{self.product} {self.date}: {self.views}'
