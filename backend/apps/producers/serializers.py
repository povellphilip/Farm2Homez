import re

from rest_framework import serializers

from .models import ProducerProfile


class ProducerBriefSerializer(serializers.ModelSerializer):
    location = serializers.CharField(read_only=True)
    is_verified = serializers.BooleanField(read_only=True)

    class Meta:
        model = ProducerProfile
        fields = ['id', 'farm_name', 'slug', 'location', 'state', 'is_verified']


class ProducerPublicSerializer(ProducerBriefSerializer):
    """Public farm profile. Personal contact details are never included; WhatsApp only
    appears when the producer has opted in."""

    whatsapp_link = serializers.CharField(read_only=True)
    member_since = serializers.DateTimeField(source='created_at', read_only=True)
    product_count = serializers.IntegerField(read_only=True, default=None)

    class Meta(ProducerBriefSerializer.Meta):
        fields = ProducerBriefSerializer.Meta.fields + ['description', 'city', 'district', 'whatsapp_link', 'member_since', 'product_count']


class ProducerProfileSerializer(serializers.ModelSerializer):
    """The producer's own editable profile."""

    location = serializers.CharField(read_only=True)
    whatsapp_link = serializers.CharField(read_only=True)
    postal_code = serializers.RegexField(r'^[0-9]{4,10}$', max_length=10, required=False)

    class Meta:
        model = ProducerProfile
        fields = [
            'id', 'farm_name', 'slug', 'description', 'address_line1', 'address_line2', 'city', 'district', 'state',
            'postal_code', 'country', 'location', 'registration_number', 'verification_details',
            'verification_status', 'verification_note', 'verified_at', 'whatsapp_number', 'whatsapp_enabled',
            'whatsapp_link', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'slug', 'verification_status', 'verification_note', 'verified_at', 'created_at', 'updated_at']

    def validate_whatsapp_number(self, value):
        cleaned = re.sub(r'[\s\-()]', '', value or '')
        if cleaned and not re.fullmatch(r'\+?[0-9]{8,15}', cleaned):
            raise serializers.ValidationError('Enter a valid WhatsApp number with country code, e.g. +919876543210.')
        return cleaned

    def validate(self, attrs):
        number = attrs.get('whatsapp_number', getattr(self.instance, 'whatsapp_number', ''))
        if attrs.get('whatsapp_enabled') and not number:
            raise serializers.ValidationError({'whatsapp_number': ['Add a WhatsApp number to enable WhatsApp contact.']})
        return attrs


class AdminProducerSerializer(ProducerProfileSerializer):
    email = serializers.EmailField(source='user.email', read_only=True)
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    phone_number = serializers.CharField(source='user.phone_number', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    is_active = serializers.BooleanField(source='user.is_active', read_only=True)
    email_verified = serializers.BooleanField(source='user.email_verified', read_only=True)

    class Meta(ProducerProfileSerializer.Meta):
        fields = ProducerProfileSerializer.Meta.fields + ['user_id', 'email', 'full_name', 'phone_number', 'is_active', 'email_verified']
        read_only_fields = fields


class VerificationDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=['VERIFIED', 'REJECTED'])
    note = serializers.CharField(required=False, allow_blank=True, default='', max_length=2000)
