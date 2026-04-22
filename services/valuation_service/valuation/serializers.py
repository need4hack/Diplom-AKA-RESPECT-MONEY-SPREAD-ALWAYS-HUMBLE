"""
Serializers for Valuation Service.

Validates input and structures output for REST API responses.
"""

from rest_framework import serializers


class DamageSelectionInputSerializer(serializers.Serializer):
    id = serializers.CharField()
    key = serializers.CharField(required=False, allow_blank=True)
    label = serializers.CharField(required=False, allow_blank=True)
    severity = serializers.ChoiceField(
        choices=("scratch", "dent", "replace"),
        required=False,
        default="replace",
    )


class ValuationRequestSerializer(serializers.Serializer):
    """Input validation for POST /api/valuation/calculate/."""
    vehicle_id = serializers.IntegerField(
        help_text='Primary key of the vehicle in model_db.',
        required=False,
    )
    year = serializers.IntegerField(required=False, min_value=1900, max_value=2100)
    make = serializers.CharField(required=False, max_length=100)
    model = serializers.CharField(required=False, max_length=200)
    trim = serializers.CharField(required=False, max_length=200, allow_blank=True)
    body = serializers.CharField(required=False, max_length=100, allow_blank=True)
    engine = serializers.CharField(required=False, max_length=100, allow_blank=True)
    transmission = serializers.CharField(required=False, max_length=100, allow_blank=True)
    drivetrain = serializers.CharField(required=False, max_length=50, allow_blank=True)
    region = serializers.CharField(required=False, max_length=50, allow_blank=True)
    category = serializers.CharField(required=False, max_length=100, allow_blank=True)
    actual_mileage = serializers.IntegerField(
        min_value=0,
        help_text='Odometer reading in km.',
    )
    is_new = serializers.BooleanField(
        default=False,
        required=False,
        help_text='If True, skip depreciation (brand-new vehicle).',
    )
    damage_part_ids = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
        help_text='Selected damaged part ids from the damage map.',
    )
    damage_selections = DamageSelectionInputSerializer(
        many=True,
        required=False,
        default=list,
        help_text='Selected damaged parts with severity metadata.',
    )

    def validate(self, attrs):
        vehicle_id = attrs.get("vehicle_id")
        has_lookup = any(
            attrs.get(field)
            for field in ("year", "make", "model", "trim", "body", "engine", "transmission", "drivetrain", "region", "category")
        )

        if vehicle_id is None:
            missing_required = [
                field for field in ("year", "make", "model")
                if not attrs.get(field)
            ]
            if missing_required:
                raise serializers.ValidationError(
                    {
                        "vehicle_id": (
                            "Provide either vehicle_id or a vehicle lookup with "
                            "year, make, and model."
                        ),
                        "missing_fields": missing_required,
                    }
                )

        if vehicle_id is not None and has_lookup:
            # Keep the contract deterministic: explicit ID wins over lookup fields.
            for field in ("year", "make", "model", "trim", "body", "engine", "transmission", "drivetrain", "region", "category"):
                attrs.pop(field, None)

        return attrs


class DamageSourceSerializer(serializers.Serializer):
    market = serializers.CharField()
    title = serializers.CharField()
    url = serializers.URLField()
    accessed_on = serializers.CharField()


class DamagePartSerializer(serializers.Serializer):
    source_part_id = serializers.CharField()
    part_family = serializers.CharField()
    part_family_label = serializers.CharField()
    market = serializers.CharField()
    currency = serializers.CharField()
    vehicle_reference_price_aed = serializers.FloatField()
    repair_scope = serializers.CharField()
    pricing_mode = serializers.CharField()
    min_price = serializers.IntegerField()
    max_price = serializers.IntegerField()
    typical_price = serializers.IntegerField()
    part_value_pct_of_vehicle_min = serializers.FloatField()
    part_value_pct_of_vehicle_max = serializers.FloatField()
    part_value_pct_of_vehicle_typical = serializers.FloatField()
    part_value_pct_notes = serializers.CharField()
    confidence = serializers.CharField()
    source_count = serializers.IntegerField()
    sources = DamageSourceSerializer(many=True)
    notes = serializers.CharField()


class DamageSelectedEntrySerializer(DamagePartSerializer):
    severity = serializers.ChoiceField(choices=("scratch", "dent", "replace"))
    severity_label = serializers.CharField()
    severity_price_multiplier = serializers.FloatField()
    severity_pct_multiplier = serializers.FloatField()
    adjusted_min_price = serializers.IntegerField()
    adjusted_max_price = serializers.IntegerField()
    adjusted_typical_price = serializers.IntegerField()
    adjusted_part_value_pct_min = serializers.FloatField()
    adjusted_part_value_pct_max = serializers.FloatField()
    adjusted_part_value_pct_typical = serializers.FloatField()


class DamageProfileSerializer(serializers.Serializer):
    generated_at = serializers.CharField()
    source_document = serializers.CharField()
    market = serializers.CharField()
    currency = serializers.CharField()
    make = serializers.CharField()
    make_profile = serializers.JSONField(allow_null=True)
    parts = DamagePartSerializer(many=True)


class DamageSummarySerializer(serializers.Serializer):
    market = serializers.CharField()
    currency = serializers.CharField()
    make = serializers.CharField()
    generated_at = serializers.CharField()
    source_document = serializers.CharField()
    selected_part_count = serializers.IntegerField()
    unique_part_families = serializers.ListField(child=serializers.CharField())
    selected_parts = DamagePartSerializer(many=True)
    selected_entries = DamageSelectedEntrySerializer(many=True)
    missing_part_ids = serializers.ListField(child=serializers.CharField())
    severity_breakdown = serializers.DictField(child=serializers.IntegerField())
    total_min_price = serializers.IntegerField()
    total_max_price = serializers.IntegerField()
    total_typical_price = serializers.IntegerField()
    total_pct_min = serializers.FloatField()
    total_pct_max = serializers.FloatField()
    total_pct_typical = serializers.FloatField()
    high_adjustment = serializers.IntegerField()
    medium_adjustment = serializers.IntegerField()
    low_adjustment = serializers.IntegerField()


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
    base_high = serializers.IntegerField()
    base_medium = serializers.IntegerField()
    base_low = serializers.IntegerField()
    high = serializers.IntegerField()
    medium = serializers.IntegerField()
    low = serializers.IntegerField()
    currency = serializers.CharField()
    resolved_by = serializers.ChoiceField(choices=("vehicle_id", "lookup"))
    damage_summary = DamageSummarySerializer(required=False, allow_null=True)
    api_usage = serializers.DictField(required=False)
