"""
Auth Service — Core Business Logic.

Handles user registration, authentication, and password management.
Separation of concerns (promt.md §7):
    Views handle HTTP → Services handle business logic → Models handle DB.
"""

import hashlib
import logging
import secrets
from typing import Optional

from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db.models import F

from .models import Report, User

logger = logging.getLogger(__name__)


class AuthError(Exception):
    """Raised when an authentication or registration operation fails."""
    pass


class AuthService:
    """
    Stateless service class for user authentication operations.

    Uses Django's password hashing framework for new passwords and keeps
    compatibility with the legacy salt$sha256 format already stored in DB.
    """

    @staticmethod
    def _hash_password(raw_password: str) -> str:
        """Hash a raw password using Django's configured password hasher."""
        return make_password(raw_password)

    @staticmethod
    def _is_legacy_password_hash(stored_hash: str) -> bool:
        """
        Detect the project's previous salt$sha256 password format.

        Expected format:
            <32-char hex salt>$<64-char sha256 hex digest>
        """
        if not stored_hash or '$' not in stored_hash:
            return False

        salt, expected_hash = stored_hash.split('$', 1)
        return (
            len(salt) == 32
            and len(expected_hash) == 64
            and all(char in '0123456789abcdef' for char in salt.lower())
            and all(char in '0123456789abcdef' for char in expected_hash.lower())
        )

    @staticmethod
    def _verify_legacy_password(raw_password: str, stored_hash: str) -> bool:
        """Verify a password against the legacy salt$sha256 format."""
        if not AuthService._is_legacy_password_hash(stored_hash):
            return False

        salt, expected_hash = stored_hash.split('$', 1)
        computed = hashlib.sha256(f"{salt}${raw_password}".encode()).hexdigest()
        return secrets.compare_digest(computed, expected_hash)

    @staticmethod
    def _verify_password(raw_password: str, stored_hash: str) -> bool:
        """Verify a raw password against the stored hash."""
        if not stored_hash:
            return False

        if AuthService._is_legacy_password_hash(stored_hash):
            return AuthService._verify_legacy_password(raw_password, stored_hash)

        try:
            return check_password(raw_password, stored_hash)
        except ValueError:
            return False

    @staticmethod
    def _upgrade_legacy_password_if_needed(user: User, raw_password: str) -> None:
        """Re-hash legacy passwords with Django's password hasher after login."""
        if not AuthService._is_legacy_password_hash(user.password_hash):
            return

        user.password_hash = AuthService._hash_password(raw_password)
        user.save(update_fields=['password_hash'])

    @staticmethod
    def _validate_password_strength(password: str, user: Optional[User] = None) -> None:
        """Apply Django's password validation and convert errors to AuthError."""
        try:
            validate_password(password, user=user)
        except ValidationError as exc:
            raise AuthError(' '.join(exc.messages)) from exc

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
        if '@' not in email:
            raise AuthError('Invalid email address.')

        # Check uniqueness
        if User.objects.filter(username=username).exists():
            raise AuthError(f'Username "{username}" is already taken.')
        if User.objects.filter(email=email).exists():
            raise AuthError(f'Email "{email}" is already registered.')

        AuthService._validate_password_strength(password)

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

        AuthService._upgrade_legacy_password_if_needed(user, password)

        logger.info(f"User authenticated: {username}")
        return user

    @staticmethod
    def change_password(user_id, current_password: str, new_password: str) -> User:
        """Change a user's password after verifying the current password."""
        try:
            user = User.objects.get(pk=user_id, is_active=True)
        except User.DoesNotExist:
            raise AuthError('User not found.')

        if not AuthService._verify_password(current_password, user.password_hash):
            raise AuthError('Current password is incorrect.')

        if current_password == new_password:
            raise AuthError('New password must be different from the current password.')

        AuthService._validate_password_strength(new_password, user=user)
        user.password_hash = AuthService._hash_password(new_password)
        user.save(update_fields=['password_hash'])
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
    def list_active_users():
        """Return all active users for the admin users page."""
        return User.objects.filter(is_active=True).order_by('-created_at')

    @staticmethod
    def create_admin_user(
        *,
        username: str,
        email: str,
        password: str,
        role: str = 'user',
        request_limit: int = 1000,
    ) -> User:
        """Create a user from the admin panel with a configurable request limit."""
        user = AuthService.register(
            username=username,
            email=email,
            password=password,
            role=role,
        )

        if request_limit != user.request_limit:
            user.request_limit = request_limit
            user.save(update_fields=['request_limit'])

        return user

    @staticmethod
    def update_user_request_settings(
        user_id,
        *,
        request_limit: Optional[int] = None,
        request_count: Optional[int] = None,
    ) -> User:
        """Update request counters for a user with basic consistency checks."""
        try:
            user = User.objects.get(pk=user_id, is_active=True)
        except User.DoesNotExist:
            raise AuthError('User not found.')

        next_request_limit = user.request_limit if request_limit is None else request_limit
        next_request_count = user.request_count if request_count is None else request_count

        if next_request_limit < 0 or next_request_count < 0:
            raise AuthError('Request values cannot be negative.')

        if next_request_count > next_request_limit:
            raise AuthError('Request count cannot be greater than request limit.')

        user.request_limit = next_request_limit
        user.request_count = next_request_count
        user.save(update_fields=['request_limit', 'request_count'])
        return user

    @staticmethod
    def deactivate_user(user_id, *, acting_user_id=None) -> None:
        """Soft-delete a user by marking the account inactive."""
        if acting_user_id is not None and str(user_id) == str(acting_user_id):
            raise AuthError('You cannot delete your own account.')

        updated = User.objects.filter(pk=user_id, is_active=True).update(is_active=False)

        if not updated:
            raise AuthError('User not found.')

    @staticmethod
    def regenerate_api_key(user_id) -> User:
        """Generate a new API key for an active user."""
        try:
            user = User.objects.get(pk=user_id, is_active=True)
        except User.DoesNotExist:
            raise AuthError('User not found.')

        user.api_key = secrets.token_hex(32)
        user.save(update_fields=['api_key'])
        return user

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
