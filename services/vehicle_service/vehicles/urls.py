"""
URL configuration for the vehicles app.

Cascading filter endpoints follow a logical order matching the UI flow:
year → make → model → trim → body → engine → transmission
"""

from django.urls import path

from . import views

app_name = 'vehicles'

urlpatterns = [
    # ── Cascading filters ──
    path('years/', views.get_years, name='years'),
    path('makes/', views.get_makes, name='makes'),
    path('models/', views.get_models, name='models'),
    path('trims/', views.get_trims, name='trims'),
    path('bodies/', views.get_body_types, name='bodies'),
    path('engines/', views.get_engines, name='engines'),
    path('transmissions/', views.get_transmissions, name='transmissions'),

    # ── Generic options (drivetrain, region, doors, seats, cylinder, category) ──
    path('options/<str:field_name>/', views.get_options, name='options'),

    # ── Search & detail ──
    path('backbone/', views.BackboneListView.as_view(), name='backbone'),
    path('backbone/export/', views.BackboneExportView.as_view(), name='backbone-export'),
    path('backbone/bulk/', views.BackboneBulkUpdateView.as_view(), name='backbone-bulk'),
    path('masters/fields/', views.get_master_fields, name='masters-fields'),
    path('masters/records/', views.create_master_record, name='masters-records'),
    path('masters/<str:field_name>/values/', views.master_field_values, name='masters-field-values'),
    path('search/', views.search_vehicles, name='search'),
    path('<int:id>/', views.VehicleDetailView.as_view(), name='detail'),

    # ── Reference data ──
    path('depreciation/', views.DepreciationListView.as_view(), name='depreciation'),
    path('mileage-categories/', views.MileageCategoryListView.as_view(), name='mileage-categories'),
]
