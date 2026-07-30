from rest_framework.response import Response


def success_response(message, data=None, status_code=200):
    payload = {'success': True, 'message': message}
    if data is not None:
        payload['data'] = data
    return Response(payload, status=status_code)


def error_response(message, errors=None, status_code=400):
    return Response(
        {'success': False, 'message': message, 'errors': errors or {}},
        status=status_code,
    )
