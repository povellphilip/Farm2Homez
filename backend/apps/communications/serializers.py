from rest_framework import serializers

from .models import WhatsAppLog


class WhatsAppSendSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    phone = serializers.RegexField(regex=r'^\+?[0-9]{8,18}$')
    message = serializers.CharField(min_length=3)


class WhatsAppLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhatsAppLog
        fields = ['id', 'name', 'phone', 'message', 'provider', 'provider_message_id', 'status', 'created_at']
