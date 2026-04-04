"""
Django Admin registration for Valuation Service models.
"""

from django.contrib import admin
from .models import ModelDB, Depreciation, MileageCategory


@admin.register(Depreciation)
class DepreciationAdmin(admin.ModelAdmin):
    list_display = [
        'depreciation_name', 'on_road',
        'year1_perc', 'year2_perc', 'year3_perc', 'year5_perc', 'year10_perc',
    ]
    search_fields = ['depreciation_name']


@admin.register(MileageCategory)
class MileageCategoryAdmin(admin.ModelAdmin):
    list_display = ['category', 'maileage_per_year', 'cpkm_plus', 'cpkm_minus']
