"""
Models for Auth Service.

Maps to the existing PostgreSQL table `users` in carspecs_db.
Uses `managed = False` — the table already exists in the shared DB.

IMPORTANT: This is NOT Django's built-in User model. We use a custom model
that maps to an existing table with UUID primary keys and its own
password hashing (bcrypt via hashlib or passlib).
"""

import uuid

from django.db import models


class User(models.Model):
    """
    Custom user model mapped to the existing `users` table.

    Fields:
        id: UUID primary key (auto-generated)
        username: unique login name
        email: unique email address
        password_hash: bcrypt hash stored as text
        role: user role (admin, user, guest)
        api_key: optional API key for external access
        request_limit: max API requests allowed
        request_count: current API request count
        is_active: soft-delete flag
        created_at: registration timestamp
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=50, unique=True)
    email = models.CharField(max_length=100, unique=True)
    password_hash = models.TextField()
    role = models.CharField(max_length=20, default='user')
    api_key = models.CharField(max_length=64, blank=True, null=True)
    request_limit = models.IntegerField(default=1000)
    request_count = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.username} ({self.role})"

    # ── Django auth compatibility properties ──────────────────────

    @property
    def is_authenticated(self):
        """Required by DRF/JWT for authentication checks."""
        return True

    @property
    def is_anonymous(self):
        return False


class Report(models.Model):
    """
    User valuation reports stored in PostgreSQL.

    Each report belongs to a user from the existing `users` table and keeps
    the key vehicle/valuation fields needed by the client cards plus JSON
    snapshots for the full payload.
    """

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        db_column='user_id',
        related_name='reports',
    )
    vin = models.CharField(max_length=17, blank=True, default='')
    vehicle_id = models.IntegerField()
    year = models.IntegerField()
    make = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    trim = models.CharField(max_length=150, blank=True, default='')
    mileage = models.IntegerField(default=0)
    is_new = models.BooleanField(default=False)
    damage_count = models.IntegerField(default=0)
    today_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    new_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    high = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    medium = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    low = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    vehicle_snapshot = models.JSONField(default=dict, blank=True)
    damage_selections = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reports'
        verbose_name = 'Report'
        verbose_name_plural = 'Reports'
        ordering = ['-created_at']

    def __str__(self):
        return f"Report #{self.id} - {self.vin}"
