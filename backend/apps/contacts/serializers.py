from rest_framework import serializers

from .models import ContactSubmission


class ContactSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactSubmission
        fields = ['id', 'name', 'email', 'phone', 'company', 'message', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_message(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError('Message must be at least 10 characters.')
        return value
