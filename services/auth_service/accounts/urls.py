"""
URL routing for Accounts app.
"""

from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='auth-register'),
    path('login/', views.login, name='auth-login'),
    path('refresh/', views.refresh_token, name='auth-refresh'),
    path('me/', views.me, name='auth-me'),
    path('change-password/', views.change_password, name='auth-change-password'),
    path('track-request/', views.track_request, name='auth-track-request'),
    path('users/', views.users, name='auth-users'),
    path('users/<uuid:user_id>/', views.user_detail, name='auth-user-detail'),
    path(
        'users/<uuid:user_id>/regenerate-api-key/',
        views.regenerate_user_api_key,
        name='auth-user-regenerate-api-key',
    ),
    path('reports/', views.reports, name='auth-reports'),
    path('reports/<int:report_id>/', views.report_detail, name='auth-report-detail'),
]
