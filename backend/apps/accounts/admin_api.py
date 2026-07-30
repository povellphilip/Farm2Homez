from rest_framework import viewsets
from rest_framework.decorators import action

from utils.responses import success_response

from .models import User
from .permissions import IsAdminRole
from .serializers import UserSerializer


class AdminUserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = UserSerializer
    queryset = User.objects.all().order_by('-date_joined')
    filterset_fields = ['role', 'email_verified', 'seller_verified', 'is_active']
    search_fields = ['email', 'full_name', 'farm_name', 'owner_name', 'phone_number', 'district', 'state']

    @action(detail=True, methods=['post'])
    def verify_seller(self, request, pk=None):
        user = self.get_object()
        user.seller_verified = True
        user.save(update_fields=['seller_verified'])
        return success_response('Seller verified.', UserSerializer(user).data)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=['is_active'])
        return success_response('User deactivated.', UserSerializer(user).data)
