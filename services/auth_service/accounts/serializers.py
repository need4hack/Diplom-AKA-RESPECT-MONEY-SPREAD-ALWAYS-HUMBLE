"""
Serializers for Auth Service.

Validates input and structures output for REST API responses.
"""

from django.core.files.storage import default_storage
from rest_framework import serializers

MAX_AVATAR_BYTES = 1024 * 1024


class RegisterSerializer(serializers.Serializer):
    """Input validation for POST /api/auth/register/."""
    username = serializers.CharField(min_length=3, max_length=50)
    email = serializers.EmailField(max_length=100)
    password = serializers.CharField(min_length=8, max_length=128, write_only=True)


class LoginSerializer(serializers.Serializer):
    """Input validation for POST /api/auth/login/."""
    username = serializers.CharField(max_length=50)
    password = serializers.CharField(max_length=128, write_only=True)


class ChangePasswordSerializer(serializers.Serializer):
    """Input validation for POST /api/auth/change-password/."""
    current_password = serializers.CharField(max_length=128, write_only=True)
    new_password = serializers.CharField(min_length=8, max_length=128, write_only=True)
    confirm_password = serializers.CharField(min_length=8, max_length=128, write_only=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        return attrs


class UserProfileSerializer(serializers.Serializer):
    """Output structure for user profile (GET /api/auth/me/)."""
    id = serializers.UUIDField()
    username = serializers.CharField()
    email = serializers.CharField()
    role = serializers.CharField()
    api_key = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    avatar_url = serializers.SerializerMethodField()
    request_limit = serializers.IntegerField()
    request_count = serializers.IntegerField()
    is_active = serializers.BooleanField()
    created_at = serializers.DateTimeField()

    def get_avatar_url(self, obj):
        avatar_key = getattr(obj, "avatar_key", None)
        if avatar_key:
            try:
                return default_storage.url(avatar_key)
            except Exception:
                return None

        # Backward compatibility for already saved base64 avatars before storage migration.
        return getattr(obj, "avatar_data", None) or None


class AvatarUpdateSerializer(serializers.Serializer):
    """Input validation for POST /api/auth/avatar/."""

    avatar = serializers.ImageField(allow_empty_file=False)

    def validate_avatar(self, value):
        if value.size > MAX_AVATAR_BYTES:
            raise serializers.ValidationError('Avatar image must be 1 MB or smaller.')

        return value


class TokenResponseSerializer(serializers.Serializer):
    """Output structure for login/refresh responses."""
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserProfileSerializer()


class AdminUserSerializer(serializers.Serializer):
    """User data exposed in the admin users table."""
    id = serializers.UUIDField()
    username = serializers.CharField()
    email = serializers.CharField()
    role = serializers.CharField()
    api_key = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    request_limit = serializers.IntegerField()
    request_count = serializers.IntegerField()
    remaining_requests = serializers.SerializerMethodField()
    is_active = serializers.BooleanField()
    created_at = serializers.DateTimeField()

    def get_remaining_requests(self, obj):
        return max(0, obj.request_limit - obj.request_count)


class AdminUserUpdateSerializer(serializers.Serializer):
    """Partial admin update for user request counters."""
    request_limit = serializers.IntegerField(min_value=0, required=False)
    request_count = serializers.IntegerField(min_value=0, required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError('At least one field must be provided.')

        request_limit = attrs.get('request_limit')
        request_count = attrs.get('request_count')

        if (
            request_limit is not None
            and request_count is not None
            and request_count > request_limit
        ):
            raise serializers.ValidationError(
                'Request count cannot be greater than request limit.'
            )

        return attrs


class AdminUserCreateSerializer(serializers.Serializer):
    """Admin-only user creation payload."""
    username = serializers.CharField(min_length=3, max_length=50)
    email = serializers.EmailField(max_length=100)
    password = serializers.CharField(min_length=8, max_length=128, write_only=True)
    role = serializers.CharField(max_length=20, required=False, default='user')
    request_limit = serializers.IntegerField(min_value=0, required=False, default=1000)


class AdminApiKeySerializer(serializers.Serializer):
    """Response payload after API key regeneration."""
    id = serializers.UUIDField()
    username = serializers.CharField()
    api_key = serializers.CharField(allow_null=True, allow_blank=True)


class ReportSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    vin = serializers.CharField(max_length=17, allow_blank=True, required=False, default='')
    vehicleId = serializers.IntegerField(source='vehicle_id')
    year = serializers.IntegerField()
    make = serializers.CharField(max_length=100)
    model = serializers.CharField(max_length=100)
    trim = serializers.CharField(max_length=150, allow_blank=True, required=False, default='')
    mileage = serializers.IntegerField(min_value=0)
    isNew = serializers.BooleanField(source='is_new')
    damageCount = serializers.IntegerField(source='damage_count', min_value=0)
    todayPrice = serializers.DecimalField(source='today_price', max_digits=12, decimal_places=2)
    newPrice = serializers.DecimalField(source='new_price', max_digits=12, decimal_places=2)
    high = serializers.DecimalField(max_digits=12, decimal_places=2)
    medium = serializers.DecimalField(max_digits=12, decimal_places=2)
    low = serializers.DecimalField(max_digits=12, decimal_places=2)
    vehicleSnapshot = serializers.JSONField(source='vehicle_snapshot', required=False, default=dict)
    damageSelections = serializers.JSONField(source='damage_selections', required=False, default=list)
    damageSummary = serializers.JSONField(source='damage_summary', required=False, default=dict)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
