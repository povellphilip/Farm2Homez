from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'full_name',
            'phone_number',
            'role',
            'farm_name',
            'owner_name',
            'address',
            'district',
            'state',
            'email_verified',
            'seller_verified',
            'is_active',
        ]
        read_only_fields = ['id', 'email_verified']


class CustomerRegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone_number = serializers.CharField(max_length=20)
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Email is already registered.')
        return value.lower()

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        validate_password(attrs['password'])
        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')
        user = User(
            username=validated_data['email'],
            role=User.Role.CUSTOMER,
            is_active=False,
            **validated_data,
        )
        user.set_password(password)
        user.save()
        return user


class SellerRegisterSerializer(serializers.Serializer):
    farm_name = serializers.CharField(max_length=150)
    owner_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone_number = serializers.CharField(max_length=20)
    address = serializers.CharField()
    district = serializers.CharField(max_length=100)
    state = serializers.CharField(max_length=100)
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Email is already registered.')
        return value.lower()

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        validate_password(attrs['password'])
        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')
        user = User(
            username=validated_data['email'],
            role=User.Role.SELLER,
            is_active=False,
            **validated_data,
        )
        user.full_name = user.owner_name
        user.set_password(password)
        user.save()
        return user


class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(min_length=6, max_length=6)
    purpose = serializers.ChoiceField(choices=['signup', 'password_reset'], default='signup')


class ResendOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    purpose = serializers.ChoiceField(choices=['signup', 'password_reset'], default='signup')


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(choices=[User.Role.CUSTOMER, User.Role.SELLER, User.Role.ADMIN], required=False)

    def validate(self, attrs):
        email = attrs['email'].lower()
        password = attrs['password']
        user = authenticate(request=self.context.get('request'), email=email, password=password)
        if not user:
            raise serializers.ValidationError('Invalid email or password.')
        if attrs.get('role') and user.role != attrs['role']:
            raise serializers.ValidationError('This account does not match the selected role.')
        if not user.email_verified or not user.is_active:
            raise serializers.ValidationError('Verify your email before logging in.')

        refresh = RefreshToken.for_user(user)
        refresh['role'] = user.role
        attrs['user'] = user
        attrs['refresh'] = str(refresh)
        attrs['access'] = str(refresh.access_token)
        return attrs


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(min_length=6, max_length=6)
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        validate_password(attrs['password'])
        return attrs


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()
