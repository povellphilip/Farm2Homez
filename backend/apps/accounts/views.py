from django.contrib.auth import get_user_model
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator
from rest_framework import generics, permissions, status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from utils.responses import error_response, success_response

from .serializers import (
    CustomerRegisterSerializer,
    ForgotPasswordSerializer,
    LoginSerializer,
    LogoutSerializer,
    ResendOTPSerializer,
    ResetPasswordSerializer,
    SellerRegisterSerializer,
    UserSerializer,
    VerifyOTPSerializer,
)
from .services import create_and_send_otp, verify_otp

User = get_user_model()


@method_decorator(ratelimit(key='ip', rate='5/m', block=True), name='dispatch')
class CustomerRegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = CustomerRegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        create_and_send_otp(user.email, 'signup')
        return success_response(
            'Customer registered. Verify email OTP to activate account.',
            {'user': UserSerializer(user).data},
            status.HTTP_201_CREATED,
        )


@method_decorator(ratelimit(key='ip', rate='5/m', block=True), name='dispatch')
class SellerRegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = SellerRegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        create_and_send_otp(user.email, 'signup')
        return success_response(
            'Seller registered. Verify email OTP to activate account.',
            {'user': UserSerializer(user).data},
            status.HTTP_201_CREATED,
        )


@method_decorator(ratelimit(key='ip', rate='10/m', block=True), name='dispatch')
class VerifyOTPView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = VerifyOTPSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if not verify_otp(data['email'], data['otp'], data['purpose']):
            return error_response('Invalid or expired OTP.', status_code=status.HTTP_400_BAD_REQUEST)

        if data['purpose'] == 'signup':
            user = User.objects.get(email__iexact=data['email'])
            user.email_verified = True
            user.is_active = True
            user.save(update_fields=['email_verified', 'is_active'])
            return success_response('Email verified successfully.', {'user': UserSerializer(user).data})
        return success_response('OTP verified.')


@method_decorator(ratelimit(key='ip', rate='3/m', block=True), name='dispatch')
class ResendOTPView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ResendOTPSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        if not User.objects.filter(email__iexact=email).exists():
            return error_response('No account found for this email.', status_code=status.HTTP_404_NOT_FOUND)
        create_and_send_otp(email, serializer.validated_data['purpose'])
        return success_response('OTP resent successfully.')


@method_decorator(ratelimit(key='ip', rate='5/m', block=True), name='dispatch')
class LoginView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = LoginSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        return success_response(
            'Login successful',
            {
                'access': serializer.validated_data['access'],
                'refresh': serializer.validated_data['refresh'],
                'user': UserSerializer(user).data,
            },
        )


class RefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]


class LogoutView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LogoutSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        RefreshToken(serializer.validated_data['refresh']).blacklist()
        return success_response('Logged out successfully.')


@method_decorator(ratelimit(key='ip', rate='3/m', block=True), name='dispatch')
class ForgotPasswordView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ForgotPasswordSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        if User.objects.filter(email__iexact=email).exists():
            create_and_send_otp(email, 'password_reset')
        return success_response('If the email exists, a password reset OTP has been sent.')


@method_decorator(ratelimit(key='ip', rate='5/m', block=True), name='dispatch')
class ResetPasswordView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ResetPasswordSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if not verify_otp(data['email'], data['otp'], 'password_reset'):
            return error_response('Invalid or expired OTP.', status_code=status.HTTP_400_BAD_REQUEST)
        user = User.objects.get(email__iexact=data['email'])
        user.set_password(data['password'])
        user.save(update_fields=['password'])
        return success_response('Password reset successfully.')


class ProfileView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def retrieve(self, request, *args, **kwargs):
        return success_response('Profile loaded', {'user': self.get_serializer(request.user).data})
