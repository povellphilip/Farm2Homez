from django.urls import path

from .views import WhatsAppSendView

urlpatterns = [
    path('send/', WhatsAppSendView.as_view(), name='whatsapp-send'),
]
