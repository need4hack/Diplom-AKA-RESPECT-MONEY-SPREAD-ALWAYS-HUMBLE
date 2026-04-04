"""
API Views for VIN Service.

Thin controllers — delegates to services.py (promt.md §7).
"""

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from .services import VinValidationService, VinDecoderService
from .serializers import VinRecordSerializer, VinDecodeResultSerializer, VinValidationSerializer


@api_view(['POST'])
def decode_vin(request):
    """
    POST /api/vin/decode/
    Body: {"vin": "1HGBH41JXMN109186"}

    Decodes a VIN:
    1. Validates format
    2. Decodes year (10th char) and manufacturer (WMI)
    3. Searches local DB (routed to correct partition)
    4. Falls back to NHTSA API if not found locally
    5. Returns vehicle details or 'not_found'
    """
    vin = request.data.get('vin', '').strip()
    if not vin:
        raise ValidationError({'vin': 'This field is required.'})

    result = VinDecoderService.decode(vin)

    # If source is local_db/local_db_vds/local_db_vds_ext → vehicle is a Django model, serialize it to dict
    source = result.get('source')
    if source and source.startswith('local_db') and result.get('vehicle') is not None:
        result['vehicle'] = VinRecordSerializer(result['vehicle']).data
    # If source is nhtsa_api or fallback_wmi → vehicle is already a dict
    # If source is not_found → vehicle is None

    serializer = VinDecodeResultSerializer(result)
    return Response(serializer.data)


@api_view(['GET'])
def validate_vin(request, vin):
    """
    GET /api/vin/validate/<vin>/

    Quick format validation without database lookup.
    Checks: length=17, no I/O/Q, alphanumeric only.
    """
    is_valid, errors = VinValidationService.validate(vin)
    data = {'vin': vin.upper(), 'is_valid': is_valid, 'errors': errors}
    serializer = VinValidationSerializer(data)
    return Response(serializer.data)
