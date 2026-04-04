"""
Serializers for Auth Service.

Validates input and structures output for REST API responses.
"""

from rest_framework import serializers


class RegisterSerializer(serializers.Serializer):
    """Input validation for POST /api/auth/register/."""
    username = serializers.CharField(min_length=3, max_length=50)
    email = serializers.EmailField(max_length=100)
    password = serializers.CharField(min_length=6, max_length=128, write_only=True)


class LoginSerializer(serializers.Serializer):
    """Input validation for POST /api/auth/login/."""
    username = serializers.CharField(max_length=50)
    password = serializers.CharField(max_length=128, write_only=True)


class UserProfileSerializer(serializers.Serializer):
    """Output structure for user profile (GET /api/auth/me/)."""
    id = serializers.UUIDField()
    username = serializers.CharField()
    email = serializers.CharField()
    role = serializers.CharField()
    api_key = serializers.CharField()
    request_limit = serializers.IntegerField()
    request_count = serializers.IntegerField()
    is_active = serializers.BooleanField()
    created_at = serializers.DateTimeField()


class TokenResponseSerializer(serializers.Serializer):
    """Output structure for login/refresh responses."""
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserProfileSerializer()
