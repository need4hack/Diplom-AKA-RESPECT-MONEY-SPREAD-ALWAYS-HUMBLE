"""
Models for Vehicle Service.

Maps to existing PostgreSQL tables in carspecs_db:
- model_db       → ModelDB (155K vehicle catalog entries)
- depreciation   → Depreciation (depreciation rate schedules)
- mileage_cat    → MileageCategory (mileage categories A–E)

All models use `managed = False` to prevent Django from modifying existing tables.
"""

from django.db import models


class ModelDB(models.Model):
    """
    Core vehicle catalog — each row is a unique vehicle configuration.

    Used for cascading filters:
    year → make → model → trim → body → engine → transmission → ...
    """
    id = models.AutoField(primary_key=True)
    region = models.CharField(max_length=50, blank=True, null=True)
    year = models.IntegerField(blank=True, null=True)
    logo = models.CharField(max_length=500, blank=True, null=True)
    make = models.CharField(max_length=100, blank=True, null=True)
    model = models.CharField(max_length=200, blank=True, null=True)
    trim = models.CharField(max_length=200, blank=True, null=True)
    body = models.CharField(max_length=100, blank=True, null=True)
    engine = models.CharField(max_length=100, blank=True, null=True)
    transmission = models.CharField(max_length=100, blank=True, null=True)
    cylinder = models.IntegerField(blank=True, null=True)
    doors = models.IntegerField(blank=True, null=True)
    seats = models.IntegerField(blank=True, null=True)
    axle = models.IntegerField(blank=True, null=True)
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
        verbose_name = 'Vehicle'
        verbose_name_plural = 'Vehicles'
        ordering = ['year', 'make', 'model']

    def __str__(self):
        return f"{self.year} {self.make} {self.model} {self.trim or ''}"


class Depreciation(models.Model):
    """
    Depreciation rate schedule.

    Each row (e.g. D1, D2…D14) defines yearly depreciation percentages.
    The `on_road` field stores the on-road cost percentage.
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
        verbose_name = 'Depreciation Schedule'
        verbose_name_plural = 'Depreciation Schedules'

    def __str__(self):
        return self.depreciation_name

    def get_rate_for_year(self, age: int) -> int | None:
        """Return the depreciation percentage for a given vehicle age (1–18)."""
        if age < 1 or age > 18:
            return None
        return getattr(self, f'year{age}_perc', None)


class MileageCategory(models.Model):
    """
    Mileage categories (A through E).

    Each category defines an estimated yearly mileage and
    cost-per-km coefficients used in valuation adjustments.
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
        verbose_name = 'Mileage Category'
        verbose_name_plural = 'Mileage Categories'

    def __str__(self):
        return f"Category {self.category} — {self.maileage_per_year}"
