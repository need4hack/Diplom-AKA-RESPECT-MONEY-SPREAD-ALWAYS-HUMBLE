"""
DRF Serializers for Vehicle Service.

Separation of concerns: serializers handle data transformation only.
"""

from rest_framework import serializers

from .models import ModelDB, Depreciation, MileageCategory


class VehicleListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views and cascading filter results."""

    class Meta:
        model = ModelDB
        fields = [
            'id', 'year', 'make', 'model', 'trim', 'body',
            'engine', 'transmission', 'region', 'new_price',
            'today_price', 'is_active',
        ]


class VehicleDetailSerializer(serializers.ModelSerializer):
    """Full serializer with all fields for detail views."""

    class Meta:
        model = ModelDB
        fields = '__all__'


class DepreciationSerializer(serializers.ModelSerializer):
    """Serializer for depreciation schedules."""

    class Meta:
        model = Depreciation
        fields = '__all__'


class MileageCategorySerializer(serializers.ModelSerializer):
    """Serializer for mileage categories."""

    class Meta:
        model = MileageCategory
        fields = '__all__'


class CascadeOptionSerializer(serializers.Serializer):
    """
    Generic serializer for cascading filter dropdown options.

    Returns a simple list of unique values, e.g.:
    [{"value": "BMW"}, {"value": "AUDI"}, ...]
    """
    value = serializers.CharField()


class MasterFieldSerializer(serializers.Serializer):
    """Metadata for a model_db column in the admin masters constructor."""
    name = serializers.CharField()
    label = serializers.CharField()
    data_type = serializers.CharField()
    editable = serializers.BooleanField()


class MasterValueSerializer(serializers.Serializer):
    """Unique values for a selected model_db column."""
    value = serializers.JSONField()
    display_value = serializers.CharField()
    occurrences = serializers.IntegerField()


class MasterValueCreateSerializer(serializers.Serializer):
    """Payload for creating a new distinct value in a chosen model_db column."""
    value = serializers.CharField(allow_blank=False, trim_whitespace=True)


class MasterRecordCreateSerializer(serializers.Serializer):
    """Payload for assembling a full model_db vehicle record from master values."""
    region = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    year = serializers.IntegerField(required=False, allow_null=True)
    logo = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    make = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    model = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    trim = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    body = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    engine = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    transmission = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    cylinder = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    doors = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    seats = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    axle = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    mileage = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    depreciation = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    category = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    fuel = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    drivetrain = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    new_price = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    today_price = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    is_active = serializers.BooleanField(required=False, default=True)
