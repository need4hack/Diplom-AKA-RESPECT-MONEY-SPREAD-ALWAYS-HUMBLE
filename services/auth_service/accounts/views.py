"""
API Views for Auth Service.

Thin controllers — delegates to services.py (promt.md §7).
Handles HTTP concerns: request parsing, response formatting, error handling.
"""

from django.apps import apps
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.exceptions import TokenError

from .services import AuthService, AuthError
from .backends import CustomRefreshToken
from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    ReportSerializer,
    UserProfileSerializer,
)


def _should_rotate_refresh_tokens() -> bool:
    """Rotate refresh tokens only when explicitly enabled and blacklist is available."""
    simple_jwt_settings = getattr(settings, 'SIMPLE_JWT', {})
    return (
        simple_jwt_settings.get('ROTATE_REFRESH_TOKENS', False)
        and apps.is_installed('rest_framework_simplejwt.token_blacklist')
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """
    POST /api/auth/register/
    Body: {"username": "john", "email": "john@example.com", "password": "secret123"}

    Creates a new user account and returns JWT tokens.
    """
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    try:
        user = AuthService.register(
            username=data['username'],
            email=data['email'],
            password=data['password'],
        )
    except AuthError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Generate JWT tokens
    token = CustomRefreshToken.for_user(user)
    user_data = UserProfileSerializer(user).data

    return Response({
        'access': str(token.access_token),
        'refresh': str(token),
        'user': user_data,
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """
    POST /api/auth/login/
    Body: {"username": "john", "password": "secret123"}

    Authenticates user and returns JWT tokens.
    """
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    try:
        user = AuthService.authenticate(
            username=data['username'],
            password=data['password'],
        )
    except AuthError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Generate JWT tokens
    token = CustomRefreshToken.for_user(user)
    user_data = UserProfileSerializer(user).data

    return Response({
        'access': str(token.access_token),
        'refresh': str(token),
        'user': user_data,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_token(request):
    """
    POST /api/auth/refresh/
    Body: {"refresh": "<refresh_token>"}

    Returns a new access token and only rotates the refresh token when
    blacklist support is configured.
    """
    refresh = request.data.get('refresh')
    if not refresh:
        return Response(
            {'error': 'Refresh token is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        old_token = CustomRefreshToken(refresh)
        new_access = str(old_token.access_token)

        response_data = {'access': new_access}

        if _should_rotate_refresh_tokens():
            old_token.blacklist()
            user = AuthService.get_user_by_id(old_token['user_id'])
            response_data['refresh'] = str(CustomRefreshToken.for_user(user))

        return Response(response_data)

    except (TokenError, AuthError):
        return Response(
            {'error': 'Invalid or expired refresh token.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """
    GET /api/auth/me/
    Headers: Authorization: Bearer <access_token>

    Returns the authenticated user's profile.
    """
    user = request.user
    serializer = UserProfileSerializer(user)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def track_request(request):
    """
    POST /api/auth/track-request/
    Headers: Authorization: Bearer <access_token>

    Atomically increments request_count for the authenticated user.
    Intended for internal proxy usage after successful business requests.
    """
    try:
        user = AuthService.increment_request_count(request.user.id)
    except AuthError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_404_NOT_FOUND,
        )

    serializer = UserProfileSerializer(user)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def reports(request):
    """
    GET /api/auth/reports/        -> list current user's reports
    POST /api/auth/reports/       -> create a new report
    DELETE /api/auth/reports/     -> clear current user's reports
    """
    if request.method == 'GET':
        user_reports = AuthService.list_reports(request.user.id)
        serializer = ReportSerializer(user_reports, many=True)
        return Response(serializer.data)

    if request.method == 'POST':
        serializer = ReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = AuthService.create_report(request.user.id, serializer.validated_data)
        return Response(ReportSerializer(report).data, status=status.HTTP_201_CREATED)

    deleted = AuthService.clear_reports(request.user.id)
    return Response({'deleted': deleted}, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def report_detail(request, report_id: int):
    """
    DELETE /api/auth/reports/<id>/
    """
    deleted = AuthService.delete_report(request.user.id, report_id)

    if not deleted:
        return Response({'error': 'Report not found.'}, status=status.HTTP_404_NOT_FOUND)

    return Response(status=status.HTTP_204_NO_CONTENT)
