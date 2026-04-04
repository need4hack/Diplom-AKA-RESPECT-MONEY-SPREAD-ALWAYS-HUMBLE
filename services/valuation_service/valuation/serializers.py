"""
Serializers for Valuation Service.

Validates input and structures output for REST API responses.
"""

from rest_framework import serializers


class ValuationRequestSerializer(serializers.Serializer):
    """Input validation for POST /api/valuation/calculate/."""
    vehicle_id = serializers.IntegerField(
        help_text='Primary key of the vehicle in model_db.',
    )
    actual_mileage = serializers.IntegerField(
        min_value=0,
        help_text='Odometer reading in km.',
    )
    is_new = serializers.BooleanField(
        default=False,
        required=False,
        help_text='If True, skip depreciation (brand-new vehicle).',
    )


class ValuationResultSerializer(serializers.Serializer):
    """Output structure for valuation results."""
    vehicle_id = serializers.IntegerField()
    vehicle_name = serializers.CharField()
    today_price = serializers.IntegerField()
    new_price = serializers.IntegerField()
    year = serializers.IntegerField()
    age = serializers.IntegerField()
    depreciation_name = serializers.CharField(allow_null=True)
    depreciation_rate = serializers.IntegerField()
    mileage_category = serializers.CharField(allow_null=True)
    avg_mileage = serializers.IntegerField()
    actual_mileage = serializers.IntegerField()
    mileage_delta = serializers.IntegerField()
    mileage_adjustment = serializers.IntegerField()
    high = serializers.IntegerField()
    medium = serializers.IntegerField()
    low = serializers.IntegerField()
    currency = serializers.CharField()
    api_usage = serializers.DictField(required=False)
