"""
DRF Serializers for VIN Service.

- VinRecordSerializer: local DB records (6 fields)
- VinDecodeResultSerializer: full decode response (source-aware)
- VinValidationSerializer: quick format check
"""

from rest_framework import serializers


class VinRecordSerializer(serializers.Serializer):
    """
    Local DB record — only the fields we need from vin_base.

    To add more fields later, just add a new line here.
    """
    vin = serializers.CharField()
    type = serializers.CharField(allow_null=True)
    make = serializers.CharField(allow_null=True)
    model_name = serializers.CharField(allow_null=True)
    modelyear = serializers.IntegerField(allow_null=True)
    power_hp = serializers.CharField(allow_null=True)
    cubic = serializers.CharField(allow_null=True)


class VinDecodeResultSerializer(serializers.Serializer):
    """
    Full VIN decode response.

    `vehicle` is either:
    - VinRecordSerializer data (source='local_db')
    - Full NHTSA dict with ALL fields (source='nhtsa_api')
    - None (source='not_found')
    """
    vin = serializers.CharField()
    is_valid = serializers.BooleanField()
    manufacturer = serializers.CharField(allow_null=True)
    year_from_vin = serializers.IntegerField(allow_null=True)
    source = serializers.CharField()
    vehicle = serializers.DictField(allow_null=True)


class VinValidationSerializer(serializers.Serializer):
    """Response for VIN format validation."""
    vin = serializers.CharField()
    is_valid = serializers.BooleanField()
    errors = serializers.ListField(child=serializers.CharField(), default=[])
