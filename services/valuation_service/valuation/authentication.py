"""
Authentication backends for Valuation Service.

Supported access modes:
1. Browser/admin UI via Bearer JWT issued by auth_service
2. External API clients via Authorization: Api-Key <key>
"""

import logging

from django.db import models
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

logger = logging.getLogger(__name__)


class ServiceUser(models.Model):
    """
    Shared read/write proxy to the `users` table.

    This keeps authentication concerns isolated to the auth layer while
    allowing valuation_service to resolve both JWT and Api-Key principals.
    """

    id = models.UUIDField(primary_key=True)
    username = models.CharField(max_length=50)
    role = models.CharField(max_length=20, default="user")
    api_key = models.CharField(max_length=64, blank=True, null=True)
    request_limit = models.IntegerField(default=1000)
    request_count = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = "users"

    def __str__(self):
        return self.username

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False


class ServiceJWTAuthentication(JWTAuthentication):
    """
    Validate Bearer JWTs issued by auth_service and resolve them to shared users.
    """

    def get_user(self, validated_token):
        user_id = validated_token.get("user_id")
        if not user_id:
            raise AuthenticationFailed("Token payload is missing user_id.")

        try:
            return ServiceUser.objects.get(pk=user_id, is_active=True)
        except ServiceUser.DoesNotExist as exc:
            raise AuthenticationFailed("User not found or inactive.") from exc


class ApiKeyAuthentication(BaseAuthentication):
    """
    DRF authentication class that validates API keys.

    Expects header: Authorization: Api-Key <key>
    """

    KEYWORD = "Api-Key"

    def authenticate(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith(self.KEYWORD):
            return None

        api_key = auth_header[len(self.KEYWORD) :].strip()
        if not api_key:
            raise AuthenticationFailed("API key is missing.")

        try:
            user = ServiceUser.objects.get(api_key=api_key, is_active=True)
        except ServiceUser.DoesNotExist as exc:
            raise AuthenticationFailed("Invalid API key.") from exc

        if user.request_count >= user.request_limit:
            raise AuthenticationFailed(
                f"API rate limit exceeded ({user.request_limit} requests). "
                "Contact admin to increase your limit."
            )

        ServiceUser.objects.filter(pk=user.pk).update(
            request_count=models.F("request_count") + 1
        )
        user.refresh_from_db(fields=["request_count"])

        logger.info(
            "API key auth: user=%s, requests=%s/%s",
            user.username,
            user.request_count,
            user.request_limit,
        )

        return (user, api_key)
