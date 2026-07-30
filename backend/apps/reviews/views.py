from rest_framework import permissions, viewsets

from .models import Review
from .serializers import ReviewSerializer


class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Review.objects.none()
    filterset_fields = ['product', 'rating']
    search_fields = ['product__name', 'comment']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Review.objects.none()
        if self.request.user.role == 'admin':
            return Review.objects.all().select_related('product', 'customer')
        if self.request.user.role == 'seller':
            return Review.objects.filter(product__seller=self.request.user).select_related('product', 'customer')
        return Review.objects.filter(customer=self.request.user).select_related('product', 'customer')

    def perform_create(self, serializer):
        serializer.save(customer=self.request.user)
