"""
API Views for VIN Service.

Thin controllers delegate to services.py.
Supports two authenticated access modes:
  - Browser/admin UI: Bearer JWT issued by auth_service
  - External API: Api-Key header and dashboard logging
"""

import json
import time
from pathlib import Path

from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .authentication import ApiKeyAuthentication, ServiceJWTAuthentication
from .serializers import VinDecodeResultSerializer, VinRecordSerializer, VinValidationSerializer
from .services import VinDecoderService, VinValidationService

LOG_FILE = (
    Path(__file__).resolve().parents[3]
    / "frontend-next"
    / ".runtime"
    / "api-request-log.jsonl"
)
PROXY_SOURCE_HEADER = "HTTP_X_CARSPECS_REQUEST_SOURCE"


def _append_external_request_log(request, *, path: str, status: int, duration_ms: int) -> None:
    if request.META.get(PROXY_SOURCE_HEADER) == "website":
        return

    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "service": "vin",
            "source": "external_api",
            "method": request.method,
            "path": path,
            "status": status,
            "duration_ms": duration_ms,
            "user_id": str(getattr(request.user, "id", "") or "") or None,
            "username": getattr(request.user, "username", None),
            "role": getattr(request.user, "role", None),
        }
        with LOG_FILE.open("a", encoding="utf-8") as file_obj:
            file_obj.write(f"{json.dumps(payload)}\n")
    except Exception:
        pass


@api_view(["POST"])
@authentication_classes([ServiceJWTAuthentication, ApiKeyAuthentication])
@permission_classes([IsAuthenticated])
def decode_vin(request):
    """
    POST /api/vin/decode/
    Body: {"vin": "1HGBH41JXMN109186"}
    """
    started_at = time.perf_counter()
    response = None

    try:
        vin = request.data.get("vin", "").strip()
        if not vin:
            raise ValidationError({"vin": "This field is required."})

        result = VinDecoderService.decode(vin)

        source = result.get("source")
        if source and source.startswith("local_db") and result.get("vehicle") is not None:
            result["vehicle"] = VinRecordSerializer(result["vehicle"]).data

        serializer = VinDecodeResultSerializer(result)
        response = Response(serializer.data)
        return response
    except ValidationError as exc:
        response = Response(exc.detail, status=400)
        return response
    finally:
        duration_ms = round((time.perf_counter() - started_at) * 1000)
        _append_external_request_log(
            request,
            path="/api/vin/decode/",
            status=getattr(response, "status_code", 500),
            duration_ms=duration_ms,
        )


@api_view(["GET"])
@authentication_classes([ServiceJWTAuthentication, ApiKeyAuthentication])
@permission_classes([IsAuthenticated])
def validate_vin(request, vin):
    """
    GET /api/vin/validate/<vin>/
    """
    started_at = time.perf_counter()
    response = None

    try:
        is_valid, errors = VinValidationService.validate(vin)
        data = {"vin": vin.upper(), "is_valid": is_valid, "errors": errors}
        serializer = VinValidationSerializer(data)
        response = Response(serializer.data)
        return response
    finally:
        duration_ms = round((time.perf_counter() - started_at) * 1000)
        _append_external_request_log(
            request,
            path=f"/api/vin/validate/{vin}/",
            status=getattr(response, "status_code", 500),
            duration_ms=duration_ms,
        )
