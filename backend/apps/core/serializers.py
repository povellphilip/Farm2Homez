from rest_framework import serializers


class DetailSerializer(serializers.Serializer):
    """Plain acknowledgement: {"detail": "..."}."""

    detail = serializers.CharField()
