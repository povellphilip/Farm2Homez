"""Consistent API error envelope: {"code": str, "message": str, "errors": dict}."""
from rest_framework import exceptions, status
from rest_framework.views import exception_handler


class ServiceError(exceptions.APIException):
    """Raised by service-layer business rules; rendered with a stable error code."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_code = 'error'

    def __init__(self, message, code='error', status_code=None, errors=None):
        super().__init__(detail=message, code=code)
        self.error_code = code
        self.errors = errors or {}
        if status_code is not None:
            self.status_code = status_code


class Conflict(ServiceError):
    def __init__(self, message, code='conflict', errors=None):
        super().__init__(message, code=code, status_code=status.HTTP_409_CONFLICT, errors=errors)


_DEFAULT_CODES = {
    status.HTTP_401_UNAUTHORIZED: 'not_authenticated',
    status.HTTP_403_FORBIDDEN: 'permission_denied',
    status.HTTP_404_NOT_FOUND: 'not_found',
    status.HTTP_405_METHOD_NOT_ALLOWED: 'method_not_allowed',
    status.HTTP_429_TOO_MANY_REQUESTS: 'throttled',
}


def _first_message(errors):
    non_field = errors.get('non_field_errors') if isinstance(errors, dict) else None
    if non_field:
        return str(non_field[0])
    return 'Please correct the highlighted fields.'


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, ServiceError):
        body = {'code': exc.error_code, 'message': str(exc.detail), 'errors': exc.errors}
    elif isinstance(exc, exceptions.ValidationError):
        errors = response.data if isinstance(response.data, dict) else {'non_field_errors': response.data}
        body = {'code': 'validation_error', 'message': _first_message(errors), 'errors': errors}
    else:
        data = response.data if isinstance(response.data, dict) else {}
        detail = data.get('detail', response.data)
        code = data.get('code') or _DEFAULT_CODES.get(response.status_code, 'error')
        if response.status_code == status.HTTP_401_UNAUTHORIZED and code in ('token_not_valid', 'user_not_found'):
            code = 'token_invalid'
        body = {'code': str(code), 'message': str(detail), 'errors': {}}
        if isinstance(exc, exceptions.Throttled):
            wait = int(exc.wait or 0)
            body['message'] = f'Too many attempts. Please wait {wait} seconds and try again.' if wait else 'Too many attempts. Please try again shortly.'
            if exc.wait is not None:
                body['retry_after'] = wait

    response.data = body
    return response
