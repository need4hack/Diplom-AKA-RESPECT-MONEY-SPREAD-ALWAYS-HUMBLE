"""
URL configuration for valuation_service project.
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/valuation/', include('valuation.urls')),
]
