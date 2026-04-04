"""
Django Admin registration for vehicle models.

Provides a convenient interface to browse and edit catalog data.
"""

from django.contrib import admin

from .models import ModelDB, Depreciation, MileageCategory


@admin.register(ModelDB)
class ModelDBAdmin(admin.ModelAdmin):
    list_display = ('id', 'year', 'make', 'model', 'trim', 'body', 'new_price', 'today_price', 'is_active')
    list_filter = ('year', 'make', 'region', 'is_active')
    search_fields = ('make', 'model', 'trim')
    list_per_page = 50
    ordering = ('-year', 'make', 'model')


@admin.register(Depreciation)
class DepreciationAdmin(admin.ModelAdmin):
    list_display = (
        'depreciation_name', 'on_road',
        'year1_perc', 'year2_perc', 'year3_perc', 'year5_perc', 'year10_perc',
    )


@admin.register(MileageCategory)
class MileageCategoryAdmin(admin.ModelAdmin):
    list_display = ('category', 'maileage_per_year', 'cpkm_plus', 'cpkm_minus')
