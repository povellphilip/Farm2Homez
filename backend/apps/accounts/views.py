from django.conf import settings
from django.middleware.csrf import CsrfViewMiddleware
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.exceptions import ServiceError
from apps.core.serializers import DetailSerializer

from . import services
from .models import User
from .serializers import (
    ChangePasswordSerializer,
    ConsumerRegisterSerializer,
    EmailSerializer,
    LoginSerializer,
    MeUpdateSerializer,
    PasswordResetSerializer,
    ProducerRegisterSerializer,
    RegistrationResponseSerializer,
    SessionSerializer,
    UserSerializer,
    VerifyEmailSerializer,
)

GENERIC_CODE_SENT = 'If an eligible account exists for that email, we have sent a code to it.'


# ---------------------------------------------------------------------------
# Refresh-token cookie and CSRF helpers
# ---------------------------------------------------------------------------
class _CSRFCheck(CsrfViewMiddleware):
    def _reject(self, request, reason):
        return reason


def enforce_csrf(request):
    """Require a valid CSRF token on endpoints that act on the refresh cookie."""
    django_request = request._request
    check = _CSRFCheck(lambda req: None)
    check.process_request(django_request)
    reason = check.process_view(django_request, None, (), {})
    if reason:
        raise PermissionDenied(f'CSRF check failed: {reason}')


def set_refresh_cookie(response, refresh):
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        refresh,
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        path=settings.REFRESH_COOKIE_PATH,
        secure=settings.REFRESH_COOKIE_SECURE,
        httponly=True,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
    )


def clear_refresh_cookie(response):
    response.delete_cookie(settings.REFRESH_COOKIE_NAME, path=settings.REFRESH_COOKIE_PATH, samesite=settings.REFRESH_COOKIE_SAMESITE)


def session_response(user, status_code=status.HTTP_200_OK):
    access, refresh = services.issue_tokens(user)
    response = Response({'access': access, 'user': UserSerializer(user).data}, status=status_code)
    set_refresh_cookie(response, refresh)
    return response


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------
class CsrfView(APIView):
    """Sets the csrftoken cookie. The SPA calls this once on load."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @extend_schema(responses=DetailSerializer)
    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response({'detail': 'CSRF cookie set.'})


class ConsumerRegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = 'auth_register'

    @extend_schema(request=ConsumerRegisterSerializer, responses={201: RegistrationResponseSerializer})
    def post(self, request):
        serializer = ConsumerRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.register_consumer(**serializer.validated_data)
        return Response(
            {'detail': 'Account created. We emailed you a code to verify your address.', 'user': UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


class ProducerRegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = 'auth_register'

    @extend_schema(request=ProducerRegisterSerializer, responses={201: RegistrationResponseSerializer})
    def post(self, request):
        serializer = ProducerRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        farm = {field: data.pop(field) for field in ProducerRegisterSerializer.FARM_FIELDS}
        user = services.register_producer(farm=farm, request=request, **data)
        return Response(
            {
                'detail': 'Producer account created. Verify your email, then an administrator will review your farm.',
                'user': UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = 'auth_code'

    @extend_schema(request=VerifyEmailSerializer, responses=DetailSerializer)
    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.verify_email(**serializer.validated_data)
        return Response({'detail': 'Email verified. You can now sign in.'})


class ResendVerificationView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = 'auth_code'

    @extend_schema(request=EmailSerializer, responses=DetailSerializer)
    def post(self, request):
        serializer = EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.resend_verification(serializer.validated_data['email'])
        return Response({'detail': GENERIC_CODE_SENT})


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = 'auth_login'

    @extend_schema(request=LoginSerializer, responses={200: SessionSerializer})
    def post(self, request):
        enforce_csrf(request)
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.authenticate_for_portal(request=request, **serializer.validated_data)
        return session_response(user)


class RefreshView(APIView):
    """Exchanges the refresh cookie for a new access token and rotates the cookie."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = 'auth_refresh'

    @extend_schema(request=None, responses={200: SessionSerializer})
    def post(self, request):
        enforce_csrf(request)
        raw = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not raw:
            raise ServiceError('You are not signed in.', code='no_session', status_code=status.HTTP_401_UNAUTHORIZED)
        try:
            token = RefreshToken(raw)  # verifies signature, expiry and blacklist
        except TokenError:
            response = Response(
                {'code': 'session_expired', 'message': 'Your session has expired. Please sign in again.', 'errors': {}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            clear_refresh_cookie(response)
            return response
        user = User.objects.filter(pk=token.get('user_id')).first()
        if user is None or not user.is_active:
            response = Response(
                {'code': 'session_invalid', 'message': 'This session is no longer valid.', 'errors': {}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            clear_refresh_cookie(response)
            return response
        token.blacklist()
        return session_response(user)


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @extend_schema(request=None, responses=DetailSerializer)
    def post(self, request):
        enforce_csrf(request)
        raw = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                pass
        response = Response({'detail': 'Signed out.'})
        clear_refresh_cookie(response)
        return response


class PasswordForgotView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = 'auth_code'

    @extend_schema(request=EmailSerializer, responses=DetailSerializer)
    def post(self, request):
        serializer = EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.request_password_reset(serializer.validated_data['email'])
        return Response({'detail': GENERIC_CODE_SENT})


class PasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = 'auth_code'

    @extend_schema(request=PasswordResetSerializer, responses=DetailSerializer)
    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        services.reset_password(data['email'], data['code'], data['new_password'], request=request)
        return Response({'detail': 'Password updated. You can now sign in with your new password.'})


class PasswordChangeView(APIView):
    @extend_schema(request=ChangePasswordSerializer, responses={200: SessionSerializer})
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        services.change_password(request.user, serializer.validated_data['current_password'], serializer.validated_data['new_password'], request=request)
        # Other sessions were revoked; keep this one signed in with fresh tokens.
        return session_response(request.user)


class MeView(APIView):
    @extend_schema(responses={200: UserSerializer})
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    @extend_schema(request=MeUpdateSerializer, responses={200: UserSerializer})
    def patch(self, request):
        serializer = MeUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)
