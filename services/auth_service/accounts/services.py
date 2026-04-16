"""
Auth Service — Core Business Logic.

Handles user registration, authentication, and password management.
Separation of concerns (promt.md §7):
    Views handle HTTP → Services handle business logic → Models handle DB.
"""

import hashlib
import secrets
import logging

from django.db.models import F

from .models import Report, User

logger = logging.getLogger(__name__)


class AuthError(Exception):
    """Raised when an authentication or registration operation fails."""
    pass


class AuthService:
    """
    Stateless service class for user authentication operations.

    Uses SHA-256 hashing for passwords (production should use bcrypt/argon2,
    but this avoids extra dependencies while keeping the architecture clean).
    """

    @staticmethod
    def _hash_password(raw_password: str) -> str:
        """Hash a raw password using SHA-256 with a salt prefix."""
        salt = secrets.token_hex(16)
        hashed = hashlib.sha256(f"{salt}${raw_password}".encode()).hexdigest()
        return f"{salt}${hashed}"

    @staticmethod
    def _verify_password(raw_password: str, stored_hash: str) -> bool:
        """Verify a raw password against a stored salt$hash string."""
        if '$' not in stored_hash:
            return False
        salt, expected_hash = stored_hash.split('$', 1)
        computed = hashlib.sha256(f"{salt}${raw_password}".encode()).hexdigest()
        return secrets.compare_digest(computed, expected_hash)

    @staticmethod
    def register(username: str, email: str, password: str, role: str = 'user') -> User:
        """
        Register a new user.

        Args:
            username: Unique login name (3–50 chars).
            email: Unique email address.
            password: Raw password (min 6 chars).
            role: User role (default: 'user').

        Returns:
            The created User instance.

        Raises:
            AuthError: If username or email is already taken.
        """
        # Validate input
        username = username.strip()
        email = email.strip().lower()

        if len(username) < 3:
            raise AuthError('Username must be at least 3 characters.')
        if len(password) < 6:
            raise AuthError('Password must be at least 6 characters.')
        if '@' not in email:
            raise AuthError('Invalid email address.')

        # Check uniqueness
        if User.objects.filter(username=username).exists():
            raise AuthError(f'Username "{username}" is already taken.')
        if User.objects.filter(email=email).exists():
            raise AuthError(f'Email "{email}" is already registered.')

        # Create user
        password_hash = AuthService._hash_password(password)
        api_key = secrets.token_hex(32)

        user = User.objects.create(
            username=username,
            email=email,
            password_hash=password_hash,
            role=role,
            api_key=api_key,
            request_limit=1000,
            request_count=0,
            is_active=True,
        )

        logger.info(f"User registered: {username} ({email}), role={role}")
        return user

    @staticmethod
    def authenticate(username: str, password: str) -> User:
        """
        Authenticate a user by username and password.

        Returns:
            The authenticated User instance.

        Raises:
            AuthError: If credentials are invalid.
        """
        try:
            user = User.objects.get(username=username, is_active=True)
        except User.DoesNotExist:
            raise AuthError('Invalid username or password.')

        if not AuthService._verify_password(password, user.password_hash):
            raise AuthError('Invalid username or password.')

        logger.info(f"User authenticated: {username}")
        return user

    @staticmethod
    def get_user_by_id(user_id) -> User:
        """Fetch a user by primary key."""
        try:
            return User.objects.get(pk=user_id, is_active=True)
        except User.DoesNotExist:
            raise AuthError('User not found.')

    @staticmethod
    def increment_request_count(user_id) -> User:
        """
        Atomically increment the request counter for a user.

        Raises:
            AuthError: If the user does not exist or is inactive.
        """
        updated = User.objects.filter(pk=user_id, is_active=True).update(
            request_count=F('request_count') + 1
        )

        if not updated:
            raise AuthError('User not found.')

        return AuthService.get_user_by_id(user_id)

    @staticmethod
    def list_reports(user_id):
        return Report.objects.filter(user_id=user_id).order_by('-created_at')

    @staticmethod
    def create_report(user_id, report_data: dict) -> Report:
        try:
            user = User.objects.get(pk=user_id, is_active=True)
        except User.DoesNotExist:
            raise AuthError('User not found.')

        return Report.objects.create(user=user, **report_data)

    @staticmethod
    def delete_report(user_id, report_id: int) -> bool:
        deleted, _ = Report.objects.filter(pk=report_id, user_id=user_id).delete()
        return deleted > 0

    @staticmethod
    def clear_reports(user_id) -> int:
        deleted, _ = Report.objects.filter(user_id=user_id).delete()
        return deleted
