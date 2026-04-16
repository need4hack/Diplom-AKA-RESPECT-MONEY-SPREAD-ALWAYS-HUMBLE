"""
API Views for Auth Service.

Thin controllers — delegates to services.py (promt.md §7).
Handles HTTP concerns: request parsing, response formatting, error handling.
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .services import AuthService, AuthError
from .backends import CustomRefreshToken, CustomJWTAuthentication
from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    ReportSerializer,
    UserProfileSerializer,
    TokenResponseSerializer,
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

    Returns a new access token (and optionally a rotated refresh token).
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

        # If ROTATE_REFRESH_TOKENS is enabled, generate a new refresh token
        old_token.blacklist() if hasattr(old_token, 'blacklist') else None
        new_refresh = CustomRefreshToken()
        new_refresh['user_id'] = old_token['user_id']
        new_refresh['username'] = old_token['username']
        new_refresh['role'] = old_token['role']
        response_data['refresh'] = str(new_refresh)

        return Response(response_data)

    except Exception as e:
        return Response(
            {'error': f'Invalid or expired refresh token: {str(e)}'},
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
