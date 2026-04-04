"""
Django Admin registration for VIN decoder models.
"""

from django.contrib import admin

from .models import ModelYear, WmiVds, VinBase


@admin.register(ModelYear)
class ModelYearAdmin(admin.ModelAdmin):
    list_display = ('vin_10th', 'actual_year', 'is_modern')
    list_filter = ('is_modern',)
    ordering = ('actual_year',)


@admin.register(WmiVds)
class WmiVdsAdmin(admin.ModelAdmin):
    list_display = ('wmi', 'manufacturer')
    search_fields = ('wmi', 'manufacturer')
    ordering = ('manufacturer',)


@admin.register(VinBase)
class VinBaseAdmin(admin.ModelAdmin):
    """Read-only admin for browsing VIN records (no edits on 29M+ table)."""
    list_display = ('vin', 'make', 'model_name', 'modelyear', 'fed_okrug')
    search_fields = ('vin', 'make')
    list_filter = ('modelyear',)
    list_per_page = 25

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
