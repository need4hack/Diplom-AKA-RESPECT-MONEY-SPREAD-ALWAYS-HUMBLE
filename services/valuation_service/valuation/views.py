"""
API Views for Valuation Service.

Thin controllers — delegates to services.py (promt.md §7).
Supports two access modes:
  - Browser/frontend: no auth required (open access for the UI)
  - External API: requires Api-Key header → tracked + rate-limited
"""

from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework import status

from .services import ValuationService, ValuationError
from .serializers import ValuationRequestSerializer, ValuationResultSerializer
from .authentication import ApiKeyAuthentication, IsAuthenticatedOrBrowser


@api_view(['POST'])
@authentication_classes([ApiKeyAuthentication])
@permission_classes([IsAuthenticatedOrBrowser])
def calculate_valuation(request):
    """
    POST /api/valuation/calculate/
    Body: {"vehicle_id": 123, "actual_mileage": 50000, "is_new": false}
    Headers (optional): Authorization: Api-Key <your_key>

    Returns High / Medium / Low valuation prices with full breakdown.
    If Api-Key is provided, request_count is incremented for the user.
    """
    # Validate input
    input_serializer = ValuationRequestSerializer(data=request.data)
    input_serializer.is_valid(raise_exception=True)
    data = input_serializer.validated_data

    try:
        result = ValuationService.calculate(
            vehicle_id=data['vehicle_id'],
            actual_mileage=data['actual_mileage'],
            is_new=data.get('is_new', False),
        )
    except ValuationError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Add API usage info if authenticated via API key
    if request.user and hasattr(request.user, 'request_count'):
        result['api_usage'] = {
            'request_count': request.user.request_count,
            'request_limit': request.user.request_limit,
        }

    output_serializer = ValuationResultSerializer(result)
    return Response(output_serializer.data)
