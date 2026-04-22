"""
API Views for Valuation Service.

Thin controllers delegate to services.py.
Supports two authenticated access modes:
  - Browser/admin UI: Bearer JWT issued by auth_service
  - External API: Api-Key header and dashboard logging
"""

import json
import time
from pathlib import Path

from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import ValidationError as DRFValidationError
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
            "service": "valuation",
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
def calculate_valuation(request):
    """
    POST /api/valuation/calculate/
    """
    started_at = time.perf_counter()
    response = None

    try:
        input_serializer = ValuationRequestSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        data = input_serializer.validated_data

        result = ValuationService.calculate(
            vehicle_id=data.get("vehicle_id"),
            actual_mileage=data["actual_mileage"],
            is_new=data.get("is_new", False),
            damage_part_ids=data.get("damage_part_ids", []),
            damage_selections=data.get("damage_selections", []),
            vehicle_lookup={
                key: data[key]
                for key in (
                    "year",
                    "make",
                    "model",
                    "trim",
                    "body",
                    "engine",
                    "transmission",
                    "drivetrain",
                    "region",
                    "category",
                )
                if key in data
            } or None,
        )
    except DRFValidationError as exc:
        response = Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
        return response
    except ValuationError as exc:
        response = Response(
            {"error": str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )
        return response
    finally:
        if response is not None:
            duration_ms = round((time.perf_counter() - started_at) * 1000)
            _append_external_request_log(
                request,
                path="/api/valuation/calculate/",
                status=response.status_code,
                duration_ms=duration_ms,
            )

    if request.user and hasattr(request.user, "request_count"):
        result["api_usage"] = {
            "request_count": request.user.request_count,
            "request_limit": request.user.request_limit,
        }

    output_serializer = ValuationResultSerializer(result)
    response = Response(output_serializer.data)

    duration_ms = round((time.perf_counter() - started_at) * 1000)
    _append_external_request_log(
        request,
        path="/api/valuation/calculate/",
        status=response.status_code,
        duration_ms=duration_ms,
    )
    return response


@api_view(["GET"])
@authentication_classes([ServiceJWTAuthentication, ApiKeyAuthentication])
@permission_classes([IsAuthenticated])
def damage_profile(request):
    started_at = time.perf_counter()
    response = None

    try:
        make = (request.query_params.get("make") or "").strip()
        market = (request.query_params.get("market") or "GCC").strip().upper()

        if not make:
            response = Response(
                {"detail": 'Query parameter "make" is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
            return response

        try:
            profile = get_damage_profile(make=make, market=market)
        except KeyError:
            response = Response(
                {"detail": f'Unsupported market "{market}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )
            return response

        serializer = DamageProfileSerializer(profile)
        response = Response(serializer.data)
        return response
    finally:
        duration_ms = round((time.perf_counter() - started_at) * 1000)
        _append_external_request_log(
            request,
            path="/api/valuation/damage-profile/",
            status=getattr(response, "status_code", 500),
            duration_ms=duration_ms,
        )
