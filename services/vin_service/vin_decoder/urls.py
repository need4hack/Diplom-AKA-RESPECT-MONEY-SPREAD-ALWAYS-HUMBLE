"""
URL configuration for the vin_decoder app.
"""

from django.urls import path

from . import views

app_name = 'vin_decoder'

urlpatterns = [
    path('decode/', views.decode_vin, name='decode'),
    path('validate/<str:vin>/', views.validate_vin, name='validate'),
]
