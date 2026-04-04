"""
Root URL configuration for vin_service.

All VIN-related endpoints are namespaced under /api/vin/.
"""

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/vin/', include('vin_decoder.urls')),
]
