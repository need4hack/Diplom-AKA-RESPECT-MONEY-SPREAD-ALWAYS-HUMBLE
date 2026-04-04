"""
Django Admin registration for Auth Service models.
"""

from django.contrib import admin
from .models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'email', 'role', 'is_active', 'request_count', 'request_limit', 'created_at']
    list_filter = ['role', 'is_active']
    search_fields = ['username', 'email']
    readonly_fields = ['id', 'password_hash', 'api_key', 'created_at']
