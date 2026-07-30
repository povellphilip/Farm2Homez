from django.http import JsonResponse


def handler404(request, exception):
    return JsonResponse(
        {'success': False, 'message': 'Not found', 'errors': {}},
        status=404,
    )


def handler500(request):
    return JsonResponse(
        {'success': False, 'message': 'Internal server error', 'errors': {}},
        status=500,
    )


def handler403(request, exception):
    return JsonResponse(
        {'success': False, 'message': 'Permission denied', 'errors': {}},
        status=403,
    )


def handler400(request, exception):
    return JsonResponse(
        {'success': False, 'message': 'Bad request', 'errors': {}},
        status=400,
    )
