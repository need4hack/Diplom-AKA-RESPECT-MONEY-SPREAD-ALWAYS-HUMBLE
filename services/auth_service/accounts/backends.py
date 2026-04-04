"""
Custom JWT backend for Auth Service.

SimpleJWT expects Django's built-in User model by default.
Since we use a custom `users` table (managed=False, UUID PK),
we need a custom token class and authentication backend.
"""

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError

from .models import User


class CustomRefreshToken(RefreshToken):
    """
    Custom RefreshToken that stores our User's UUID as the user_id claim.
    """
    @classmethod
    def for_user(cls, user: User):
        """
        Generate a JWT token pair for the given custom User.

        Embeds user_id (UUID), username, and role into the token payload.
        """
        token = cls()
        token['user_id'] = str(user.id)
        token['username'] = user.username
        token['role'] = user.role
        return token


class CustomJWTAuthentication(JWTAuthentication):
    """
    Override default JWTAuthentication to look up users in our
    custom `users` table instead of Django's auth_user.
    """
    def get_user(self, validated_token):
        """
        Resolve the user_id claim from the JWT payload
        to an actual User model instance.
        """
        user_id = validated_token.get('user_id')
        if not user_id:
            return None
        try:
            return User.objects.get(pk=user_id, is_active=True)
        except User.DoesNotExist:
            return None
