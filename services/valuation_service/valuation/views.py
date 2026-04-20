"""
API Views for Valuation Service.

Thin controllers delegate to services.py (promt.md §7).
Supports two authenticated access modes:
  - Browser/admin UI: requires Bearer JWT issued by auth_service
  - External API: requires Api-Key header and is tracked + rate-limited
"""

from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .authentication import ApiKeyAuthentication, ServiceJWTAuthentication
from .damage_catalog import get_damage_profile
from .serializers import (
    DamageProfileSerializer,
    ValuationRequestSerializer,
    ValuationResultSerializer,
)
from .services import ValuationError, ValuationService


@api_view(["POST"])
@authentication_classes([ServiceJWTAuthentication, ApiKeyAuthentication])
@permission_classes([IsAuthenticated])
def calculate_valuation(request):
    """
    POST /api/valuation/calculate/
    Body: {"vehicle_id": 123, "actual_mileage": 50000, "is_new": false}
    Headers:
      - Authorization: Bearer <access_token>  for UI/admin requests
      - Authorization: Api-Key <your_key>     for external API clients

    Returns High / Medium / Low valuation prices with full breakdown.
    If Api-Key is provided, request_count is incremented for the user.
    """

    input_serializer = ValuationRequestSerializer(data=request.data)
    input_serializer.is_valid(raise_exception=True)
    data = input_serializer.validated_data

    try:
        result = ValuationService.calculate(
            vehicle_id=data["vehicle_id"],
            actual_mileage=data["actual_mileage"],
            is_new=data.get("is_new", False),
            damage_part_ids=data.get("damage_part_ids", []),
            damage_selections=data.get("damage_selections", []),
        )
    except ValuationError as exc:
        return Response(
            {"error": str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if request.user and hasattr(request.user, "request_count"):
        result["api_usage"] = {
            "request_count": request.user.request_count,
            "request_limit": request.user.request_limit,
        }

    output_serializer = ValuationResultSerializer(result)
    return Response(output_serializer.data)


@api_view(["GET"])
@authentication_classes([ServiceJWTAuthentication, ApiKeyAuthentication])
@permission_classes([IsAuthenticated])
def damage_profile(request):
    make = (request.query_params.get("make") or "").strip()
    market = (request.query_params.get("market") or "GCC").strip().upper()

    if not make:
        return Response(
            {"detail": 'Query parameter "make" is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        profile = get_damage_profile(make=make, market=market)
    except KeyError:
        return Response(
            {"detail": f'Unsupported market "{market}".'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = DamageProfileSerializer(profile)
    return Response(serializer.data)
