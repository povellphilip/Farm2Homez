from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator
from rest_framework import generics, permissions, status

from services.email_service import send_contact_emails
from utils.responses import success_response

from .models import ContactSubmission
from .serializers import ContactSubmissionSerializer


@method_decorator(ratelimit(key='ip', rate='5/m', block=True), name='dispatch')
class ContactCreateView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ContactSubmissionSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contact = serializer.save()
        send_contact_emails(contact)
        return success_response(
            'Contact submission received',
            ContactSubmissionSerializer(contact).data,
            status.HTTP_201_CREATED,
        )


class ContactListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ContactSubmissionSerializer
    queryset = ContactSubmission.objects.all()


class ContactDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ContactSubmissionSerializer
    queryset = ContactSubmission.objects.all()


class ContactDeleteView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ContactSubmissionSerializer
    queryset = ContactSubmission.objects.all()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return success_response('Contact submission deleted')
