"""
Models for VIN Service.

Maps to existing PostgreSQL tables in carspecs_db:
- vin_base              → VinBase (29M+ main VIN records)
- vin_base_2000_2010    → VinBase2000_2010 (partition)
- vin_base_2010_2020    → VinBase2010_2020 (partition)
- vin_base_before_2000  → VinBaseBefore2000 (partition)
- vin_base_modern       → VinBaseModern (partition)
- vin_base_unknown_years→ VinBaseUnknownYears (partition)
- model_year            → ModelYear (10th VIN char → year)
- wmi_vds               → WmiVds (WMI code → manufacturer)

All models use `managed = False` to preserve existing tables.
"""

from django.db import models


class VinBaseAbstract(models.Model):
    """
    Abstract base for all vin_base tables (DRY — shared columns).

    Contains vehicle registration data from GIBDD database.
    """
    fed_okrug = models.CharField(max_length=255, blank=True, null=True)
    oblast = models.CharField(max_length=255, blank=True, null=True)
    code = models.CharField(max_length=50, blank=True, null=True)
    type = models.CharField(max_length=255, blank=True, null=True)
    make = models.CharField(max_length=255, blank=True, null=True)
    model_name = models.CharField(max_length=255, blank=True, null=True)
    make_and_model = models.CharField(max_length=500, blank=True, null=True)
    category = models.CharField(max_length=100, blank=True, null=True)
    date_first_reg = models.DateField(blank=True, null=True)
    date_last_reg = models.DateField(blank=True, null=True)
    modelyear = models.IntegerField(blank=True, null=True)
    vin = models.CharField(max_length=50, primary_key=True)
    engine_num = models.CharField(max_length=255, blank=True, null=True)
    body_num = models.CharField(max_length=255, blank=True, null=True)
    chassis_num = models.CharField(max_length=255, blank=True, null=True)
    tech_category = models.IntegerField(blank=True, null=True)
    driver_category = models.IntegerField(blank=True, null=True)
    power_hp = models.TextField(blank=True, null=True)
    cubic = models.TextField(blank=True, null=True)
    type_engine = models.IntegerField(blank=True, null=True)
    steering_whell = models.IntegerField(blank=True, null=True)
    gibdd_veh_type = models.IntegerField(blank=True, null=True)
    max_weight = models.IntegerField(blank=True, null=True)
    weight = models.IntegerField(blank=True, null=True)
    # Personal data fields (restricted in API output for security)
    name_ur_owner = models.TextField(blank=True, null=True)
    inn = models.TextField(blank=True, null=True)
    name_vehicle_reg_district = models.CharField(max_length=255, blank=True, null=True)
    name_of_city_area = models.CharField(max_length=255, blank=True, null=True)
    street = models.CharField(max_length=255, blank=True, null=True)
    house = models.CharField(max_length=100, blank=True, null=True)
    block = models.CharField(max_length=100, blank=True, null=True)
    apartment = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        abstract = True

    def __str__(self):
        return f"{self.vin} — {self.make} {self.model_name} ({self.modelyear})"


class VinBase(VinBaseAbstract):
    """Main VIN table (~29M records)."""

    class Meta:
        managed = False
        db_table = 'vin_base'
        verbose_name = 'VIN Record'
        verbose_name_plural = 'VIN Records'


class VinBase2000_2010(VinBaseAbstract):
    """Partition: vehicles from 2000 to 2010."""

    class Meta:
        managed = False
        db_table = 'vin_base_2000_2010'
        verbose_name = 'VIN 2000–2010'


class VinBase2010_2020(VinBaseAbstract):
    """Partition: vehicles from 2010 to 2020."""

    class Meta:
        managed = False
        db_table = 'vin_base_2010_2020'
        verbose_name = 'VIN 2010–2020'


class VinBaseBefore2000(VinBaseAbstract):
    """Partition: vehicles before 2000."""

    class Meta:
        managed = False
        db_table = 'vin_base_before_2000'
        verbose_name = 'VIN Before 2000'


class VinBaseModern(VinBaseAbstract):
    """Partition: modern vehicles (2020+)."""

    class Meta:
        managed = False
        db_table = 'vin_base_modern'
        verbose_name = 'VIN Modern'


class VinBaseUnknownYears(VinBaseAbstract):
    """Partition: vehicles with unknown year."""

    class Meta:
        managed = False
        db_table = 'vin_base_unknown_years'
        verbose_name = 'VIN Unknown Year'


class ModelYear(models.Model):
    """
    Maps the 10th character of a VIN to the actual model year.

    Example: 'A' → 1980, 'B' → 1981, ..., 'Y' → 2000, '1' → 2001, etc.
    The `is_modern` flag differentiates between pre-2010 and post-2010 cycles.
    """
    id = models.AutoField(primary_key=True)
    vin_10th = models.CharField(max_length=1)
    is_modern = models.BooleanField(default=False)
    actual_year = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'model_year'
        verbose_name = 'Model Year Mapping'
        verbose_name_plural = 'Model Year Mappings'

    def __str__(self):
        return f"'{self.vin_10th}' → {self.actual_year} (modern={self.is_modern})"


class WmiVds(models.Model):
    """
    World Manufacturer Identifier (WMI) — first 3 characters of VIN.

    Maps WMI code to manufacturer name (e.g. '1A4' → 'CHRYSLER').
    """
    wmi = models.CharField(max_length=10, primary_key=True)
    manufacturer = models.CharField(max_length=255)

    class Meta:
        managed = False
        db_table = 'wmi_vds'
        verbose_name = 'WMI Mapping'
        verbose_name_plural = 'WMI Mappings'

    def __str__(self):
        return f"{self.wmi} → {self.manufacturer}"
