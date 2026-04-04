"""
URL routing for Valuation app.
"""

from django.urls import path
from . import views

urlpatterns = [
    path('calculate/', views.calculate_valuation, name='calculate-valuation'),
]
