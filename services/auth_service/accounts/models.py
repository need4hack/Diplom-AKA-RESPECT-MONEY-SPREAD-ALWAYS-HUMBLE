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
