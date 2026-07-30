from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator
from rest_framework import permissions, status
from rest_framework import generics

from services.whatsapp_service import WhatsAppService
from utils.responses import success_response

from .serializers import WhatsAppLogSerializer, WhatsAppSendSerializer


@method_decorator(ratelimit(key='ip', rate='10/m', block=True), name='dispatch')
class WhatsAppSendView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = WhatsAppSendSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        log = WhatsAppService().send(**serializer.validated_data)
        return success_response(
            'WhatsApp message sent',
            WhatsAppLogSerializer(log).data,
            status.HTTP_201_CREATED,
        )
