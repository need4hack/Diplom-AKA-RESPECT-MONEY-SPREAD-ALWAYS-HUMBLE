"""
Root URL configuration for vehicle_service.

All vehicle-related endpoints are namespaced under /api/vehicles/.
"""

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/vehicles/', include('vehicles.urls')),
]
