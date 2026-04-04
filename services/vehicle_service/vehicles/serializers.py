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
