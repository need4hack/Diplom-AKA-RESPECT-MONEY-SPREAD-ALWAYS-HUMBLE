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
    path('track-request/', views.track_request, name='auth-track-request'),
    path('reports/', views.reports, name='auth-reports'),
    path('reports/<int:report_id>/', views.report_detail, name='auth-report-detail'),
]
