from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Role, User
from .validators import normalize_phone


def clean_phone(value):
    try:
        return normalize_phone(value)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(exc.messages) from exc


class PasswordConfirmMixin:
    password_field = 'password'

    def validate(self, attrs):
        password = attrs[self.password_field]
        if password != attrs.pop('confirm_password'):
            raise serializers.ValidationError({'confirm_password': ['Passwords do not match.']})
        candidate = User(email=attrs.get('email', ''), full_name=attrs.get('full_name', ''))
        try:
            validate_password(password, user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({self.password_field: list(exc.messages)}) from exc
        return attrs


class _BaseRegisterSerializer(PasswordConfirmMixin, serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)

    def validate_full_name(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError('Enter your full name.')
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value


class ConsumerRegisterSerializer(_BaseRegisterSerializer):
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True, default='')

    def validate_phone_number(self, value):
        return clean_phone(value)


class ProducerRegisterSerializer(_BaseRegisterSerializer):
    phone_number = serializers.CharField(max_length=20)
    farm_name = serializers.CharField(max_length=150)
    description = serializers.CharField(max_length=4000)
    address_line1 = serializers.CharField(max_length=200)
    address_line2 = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')
    city = serializers.CharField(max_length=100)
    district = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    state = serializers.CharField(max_length=100)
    postal_code = serializers.RegexField(r'^[0-9]{4,10}$', max_length=10, error_messages={'invalid': 'Enter a valid postal code.'})
    registration_number = serializers.CharField(max_length=80, required=False, allow_blank=True, default='')
    verification_details = serializers.CharField(max_length=4000, required=False, allow_blank=True, default='')

    FARM_FIELDS = [
        'farm_name', 'description', 'address_line1', 'address_line2', 'city', 'district', 'state',
        'postal_code', 'registration_number', 'verification_details',
    ]

    def validate_phone_number(self, value):
        value = clean_phone(value)
        if not value:
            raise serializers.ValidationError('A phone number is required for producers.')
        return value


class VerifyEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(r'^[0-9]{6}$', error_messages={'invalid': 'Enter the 6-digit code.'})


class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField()


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False, max_length=128)
    role = serializers.ChoiceField(choices=Role.choices)


class PasswordResetSerializer(PasswordConfirmMixin, serializers.Serializer):
    password_field = 'new_password'
    email = serializers.EmailField()
    code = serializers.RegexField(r'^[0-9]{6}$', error_messages={'invalid': 'Enter the 6-digit code.'})
    new_password = serializers.CharField(trim_whitespace=False, max_length=128)
    confirm_password = serializers.CharField(trim_whitespace=False, max_length=128)


class ChangePasswordSerializer(PasswordConfirmMixin, serializers.Serializer):
    password_field = 'new_password'
    current_password = serializers.CharField(trim_whitespace=False, max_length=128)
    new_password = serializers.CharField(trim_whitespace=False, max_length=128)
    confirm_password = serializers.CharField(trim_whitespace=False, max_length=128)

    def validate(self, attrs):
        user = self.context['request'].user
        attrs['email'], attrs['full_name'] = user.email, user.full_name
        attrs = super().validate(attrs)
        attrs.pop('email'), attrs.pop('full_name')
        return attrs


class ProducerSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    farm_name = serializers.CharField()
    slug = serializers.CharField()
    verification_status = serializers.CharField()
    verification_note = serializers.CharField()


class UserSerializer(serializers.ModelSerializer):
    producer = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'phone_number', 'role', 'email_verified', 'date_joined', 'producer']
        read_only_fields = fields

    @extend_schema_field(ProducerSummarySerializer(allow_null=True))
    def get_producer(self, user):
        profile = getattr(user, 'producer_profile', None) if user.role == Role.PRODUCER else None
        if profile is None:
            return None
        return {
            'id': profile.id,
            'farm_name': profile.farm_name,
            'slug': profile.slug,
            'verification_status': profile.verification_status,
            'verification_note': profile.verification_note,
        }


class MeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['full_name', 'phone_number']

    def validate_full_name(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError('Enter your full name.')
        return value

    def validate_phone_number(self, value):
        value = clean_phone(value)
        if not value and self.instance.role == Role.PRODUCER:
            raise serializers.ValidationError('A phone number is required for producers.')
        return value


class SessionSerializer(serializers.Serializer):
    """Returned by login, refresh and password change. The refresh token is set as an HttpOnly cookie."""

    access = serializers.CharField()
    user = UserSerializer()


class RegistrationResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    user = UserSerializer()
