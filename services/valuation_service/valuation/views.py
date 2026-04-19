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
from .serializers import ValuationRequestSerializer, ValuationResultSerializer
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
