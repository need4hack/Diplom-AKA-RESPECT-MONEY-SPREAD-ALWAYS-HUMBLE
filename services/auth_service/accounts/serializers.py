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
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
