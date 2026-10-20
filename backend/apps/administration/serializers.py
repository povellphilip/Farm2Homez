from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.serializers import ProducerSummarySerializer
from apps.core.models import AuditLog


class AdminUserSerializer(serializers.ModelSerializer):
    producer = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'full_name', 'phone_number', 'role', 'email_verified', 'is_active', 'suspended_at',
            'suspension_reason', 'date_joined', 'last_login', 'producer',
        ]
        read_only_fields = fields

    @extend_schema_field(ProducerSummarySerializer(allow_null=True))
    def get_producer(self, user):
        profile = getattr(user, 'producer_profile', None)
        if profile is None:
            return None
        return {
            'id': profile.id, 'farm_name': profile.farm_name, 'slug': profile.slug,
            'verification_status': profile.verification_status, 'verification_note': profile.verification_note,
        }


class SuspendSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=2000)


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ['id', 'created_at', 'action', 'actor_email', 'target_type', 'target_id', 'target_repr', 'metadata', 'ip_address']
