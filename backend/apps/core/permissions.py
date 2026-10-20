"""Role-based permissions. Every check reads the role from the database-backed user,
never from client-supplied data or token claims."""
from django.conf import settings
from rest_framework.permissions import BasePermission

from apps.accounts.models import Role


class _HasRole(BasePermission):
    role = None
    message = 'You do not have permission to perform this action.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_active and user.role == self.role)


class IsConsumer(_HasRole):
    role = Role.CONSUMER
    message = 'This action is only available to consumer accounts.'


class IsProducer(_HasRole):
    role = Role.PRODUCER
    message = 'This action is only available to producer accounts.'


class IsAdmin(_HasRole):
    role = Role.ADMIN
    message = 'This action is only available to administrators.'


class IsVerifiedProducer(IsProducer):
    message = 'Your producer account must be verified before you can do this.'

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if not settings.PRODUCER_VERIFICATION_REQUIRED:
            return True
        profile = getattr(request.user, 'producer_profile', None)
        return bool(profile and profile.is_verified)
