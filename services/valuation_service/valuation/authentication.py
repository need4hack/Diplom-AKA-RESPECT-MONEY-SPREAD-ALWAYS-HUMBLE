"""
API Key Authentication for Valuation Service.

Validates API keys against the `users` table, enforces request limits,
and increments request_count on each successful authenticated call.

Usage by external clients:
    curl -X POST http://127.0.0.1:8003/api/valuation/calculate/ \
         -H "Authorization: Api-Key <your_api_key>" \
         -H "Content-Type: application/json" \
         -d '{"vehicle_id": 123, "actual_mileage": 50000}'
"""

import logging

from django.db import models
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission

logger = logging.getLogger(__name__)


class ApiKeyUser(models.Model):
    """
    Read/write proxy to the `users` table for API key lookups.

    Only the fields needed for authentication are mapped here,
    keeping this model focused (Single Responsibility Principle).
    """
    id = models.UUIDField(primary_key=True)
    username = models.CharField(max_length=50)
    api_key = models.CharField(max_length=64)
    request_limit = models.IntegerField(default=1000)
    request_count = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = 'users'

    def __str__(self):
        return self.username

    # ── Django auth compatibility ──
    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False


class ApiKeyAuthentication(BaseAuthentication):
    """
    DRF authentication class that validates API keys.

    Expects header: Authorization: Api-Key <key>
    """
    KEYWORD = 'Api-Key'

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith(self.KEYWORD):
            return None  # Not our auth scheme → let other authenticators try

        api_key = auth_header[len(self.KEYWORD):].strip()
        if not api_key:
            raise AuthenticationFailed('API key is missing.')

        try:
            user = ApiKeyUser.objects.get(api_key=api_key, is_active=True)
        except ApiKeyUser.DoesNotExist:
            raise AuthenticationFailed('Invalid API key.')

        # Check rate limit
        if user.request_count >= user.request_limit:
            raise AuthenticationFailed(
                f'API rate limit exceeded ({user.request_limit} requests). '
                f'Contact admin to increase your limit.'
            )

        # Increment request counter atomically
        ApiKeyUser.objects.filter(pk=user.pk).update(
            request_count=models.F('request_count') + 1
        )
        user.refresh_from_db()

        logger.info(
            f"API key auth: user={user.username}, "
            f"requests={user.request_count}/{user.request_limit}"
        )

        return (user, api_key)


class IsAuthenticatedOrBrowser(BasePermission):
    """
    Allow access if:
    - The request has a valid API key (external clients), OR
    - The request comes without auth (browser/frontend — open access for now).

    This lets the frontend work without tokens while external
    API consumers must authenticate with Api-Key.
    """
    def has_permission(self, request, view):
        # If auth header is present, it must be valid (handled by authentication class)
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith(ApiKeyAuthentication.KEYWORD):
            return request.user and request.user.is_authenticated
        # No auth header → allow (browser/frontend access)
        return True
