"""
Models for Valuation Service.

Maps to existing PostgreSQL tables in carspecs_db:
- model_db       → ModelDB (read-only access to today_price + vehicle metadata)
- depreciation   → Depreciation (depreciation rate schedules D1–D14)
- mileage_cat    → MileageCategory (categories A–E with cpkm coefficients)

All models use `managed = False` — tables already exist in the shared DB.
"""

from django.db import models


class ModelDB(models.Model):
    """
    Vehicle catalog — read-only reference for valuation calculations.

    Key fields used:
    - today_price: base price for depreciation calc
    - new_price: original MSRP
    - depreciation: FK name to depreciation schedule (e.g. 'D1')
    - mileage: FK name to mileage category (e.g. 'A')
    - year: model year for age calculation
    """
    id = models.AutoField(primary_key=True)
    region = models.CharField(max_length=50, blank=True, null=True)
    year = models.IntegerField(blank=True, null=True)
    make = models.CharField(max_length=100, blank=True, null=True)
    model = models.CharField(max_length=200, blank=True, null=True)
    trim = models.CharField(max_length=200, blank=True, null=True)
    body = models.CharField(max_length=100, blank=True, null=True)
    engine = models.CharField(max_length=100, blank=True, null=True)
    transmission = models.CharField(max_length=100, blank=True, null=True)
    mileage = models.CharField(max_length=50, blank=True, null=True)
    depreciation = models.CharField(max_length=50, blank=True, null=True)
    category = models.CharField(max_length=100, blank=True, null=True)
    fuel = models.CharField(max_length=50, blank=True, null=True)
    drivetrain = models.CharField(max_length=50, blank=True, null=True)
    new_price = models.IntegerField(blank=True, null=True)
    today_price = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = 'model_db'

    def __str__(self):
        return f"{self.year} {self.make} {self.model} {self.trim or ''}"


class Depreciation(models.Model):
    """
    Depreciation rate schedule (D1 through D14+).

    Each yearN_perc column stores the cumulative depreciation %
    for a vehicle of that age (1–18 years).
    """
    depreciation_name = models.CharField(max_length=50, primary_key=True)
    on_road = models.CharField(max_length=20, blank=True, null=True)
    year1_perc = models.IntegerField(blank=True, null=True)
    year2_perc = models.IntegerField(blank=True, null=True)
    year3_perc = models.IntegerField(blank=True, null=True)
    year4_perc = models.IntegerField(blank=True, null=True)
    year5_perc = models.IntegerField(blank=True, null=True)
    year6_perc = models.IntegerField(blank=True, null=True)
    year7_perc = models.IntegerField(blank=True, null=True)
    year8_perc = models.IntegerField(blank=True, null=True)
    year9_perc = models.IntegerField(blank=True, null=True)
    year10_perc = models.IntegerField(blank=True, null=True)
    year11_perc = models.IntegerField(blank=True, null=True)
    year12_perc = models.IntegerField(blank=True, null=True)
    year13_perc = models.IntegerField(blank=True, null=True)
    year14_perc = models.IntegerField(blank=True, null=True)
    year15_perc = models.IntegerField(blank=True, null=True)
    year16_perc = models.IntegerField(blank=True, null=True)
    year17_perc = models.IntegerField(blank=True, null=True)
    year18_perc = models.IntegerField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'depreciation'

    def __str__(self):
        return self.depreciation_name

    def get_rate_for_year(self, age: int) -> int | None:
        """Return the depreciation percentage for a given vehicle age (1–18)."""
        if age < 1:
            return 0
        if age > 18:
            return getattr(self, 'year18_perc', None)
        return getattr(self, f'year{age}_perc', None)


class MileageCategory(models.Model):
    """
    Mileage categories (A through E).

    - maileage_per_year: estimated average km/year for this category
    - cpkm_plus: cost-per-km adjustment when mileage EXCEEDS average
    - cpkm_minus: cost-per-km adjustment when mileage is BELOW average
    """
    category = models.CharField(max_length=10, primary_key=True)
    maileage_per_year = models.CharField(
        max_length=50, blank=True, null=True,
        db_column='maileage_per_year',
    )
    cpkm_plus = models.FloatField(blank=True, null=True)
    cpkm_minus = models.FloatField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'mileage_cat'

    def __str__(self):
        return f"Category {self.category} — {self.maileage_per_year}"
