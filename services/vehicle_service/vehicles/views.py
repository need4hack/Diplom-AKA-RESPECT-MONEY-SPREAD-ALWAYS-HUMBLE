"""
API Views for Vehicle Service.

Thin controllers: they handle HTTP concerns and delegate business logic
to the service layer.
"""

import csv

from django.http import HttpResponse
from django.views.decorators.cache import cache_page
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, status
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .filters import BackboneFilter
from .models import Depreciation, MileageCategory, ModelDB
from .serializers import (
    DepreciationSerializer,
    MasterFieldSerializer,
    MasterRecordCreateSerializer,
    MasterValueCreateSerializer,
    MasterValueSerializer,
    MileageCategorySerializer,
    VehicleDetailSerializer,
    VehicleListSerializer,
)
from .services import VehicleCatalogService
from .smart_search import SmartSearchFilterBackend


def _cascade_response(values, label: str = "value") -> Response:
    """Wrap a list of distinct values into a JSON response."""
    return Response([{label: value} for value in values if value is not None])


@api_view(["GET"])
@cache_page(60 * 60 * 24)
def get_years(request):
    """GET /api/vehicles/years/ — all available years."""
    years = VehicleCatalogService.get_years()
    return _cascade_response(years)


@api_view(["GET"])
@cache_page(60 * 60 * 24)
def get_makes(request):
    """GET /api/vehicles/makes/?year=2025"""
    year = request.query_params.get("year")
    if not year:
        raise ValidationError({"year": 'This query parameter is required.'})

    makes = VehicleCatalogService.get_makes(year=int(year))
    return _cascade_response(makes)


@api_view(["GET"])
@cache_page(60 * 60 * 24)
def get_models(request):
    """GET /api/vehicles/models/?year=2025&make=BMW"""
    year = request.query_params.get("year")
    make = request.query_params.get("make")
    if not year or not make:
        raise ValidationError({"detail": 'Both "year" and "make" are required.'})

    models_list = VehicleCatalogService.get_models(year=int(year), make=make)
    return _cascade_response(models_list)


@api_view(["GET"])
@cache_page(60 * 60 * 24)
def get_trims(request):
    """GET /api/vehicles/trims/?year=2025&make=BMW&model=X5"""
    year = request.query_params.get("year")
    make = request.query_params.get("make")
    model = request.query_params.get("model")
    if not all([year, make, model]):
        raise ValidationError({"detail": '"year", "make", and "model" are required.'})

    trims = VehicleCatalogService.get_trims(year=int(year), make=make, model=model)
    return _cascade_response(trims)


@api_view(["GET"])
@cache_page(60 * 60 * 24)
def get_body_types(request):
    """GET /api/vehicles/bodies/?year=2025&make=BMW&model=X5&trim=xDrive40i"""
    year = request.query_params.get("year")
    make = request.query_params.get("make")
    model = request.query_params.get("model")
    trim = request.query_params.get("trim")
    if not all([year, make, model, trim]):
        raise ValidationError({"detail": '"year", "make", "model", "trim" are required.'})

    bodies = VehicleCatalogService.get_body_types(
        year=int(year),
        make=make,
        model=model,
        trim=trim,
    )
    return _cascade_response(bodies)


@api_view(["GET"])
@cache_page(60 * 60 * 24)
def get_engines(request):
    """GET /api/vehicles/engines/?year=...&make=...&model=...&trim=...&body=..."""
    params = request.query_params
    required = ["year", "make", "model", "trim", "body"]
    missing = [key for key in required if not params.get(key)]
    if missing:
        raise ValidationError({"detail": f'Missing required params: {", ".join(missing)}'})

    engines = VehicleCatalogService.get_engines(
        year=int(params["year"]),
        make=params["make"],
        model=params["model"],
        trim=params["trim"],
        body=params["body"],
    )
    return _cascade_response(engines)


@api_view(["GET"])
@cache_page(60 * 60 * 24)
def get_transmissions(request):
    """GET /api/vehicles/transmissions/?year=...&make=...&model=...&trim=...&body=...&engine=..."""
    params = request.query_params
    required = ["year", "make", "model", "trim", "body", "engine"]
    missing = [key for key in required if not params.get(key)]
    if missing:
        raise ValidationError({"detail": f'Missing required params: {", ".join(missing)}'})

    transmissions = VehicleCatalogService.get_transmissions(
        year=int(params["year"]),
        make=params["make"],
        model=params["model"],
        trim=params["trim"],
        body=params["body"],
        engine=params["engine"],
    )
    return _cascade_response(transmissions)


@api_view(["GET"])
@cache_page(60 * 60 * 24)
def get_options(request, field_name):
    """
    GET /api/vehicles/options/<field_name>/?year=2025&make=BMW&...

    Returns distinct values of any allowed field filtered by all provided params.
    """
    filters = {key: request.query_params[key] for key in request.query_params}
    values = VehicleCatalogService.get_options(field=field_name, **filters)
    return _cascade_response(values)


@api_view(["GET"])
def search_vehicles(request):
    """
    GET /api/vehicles/search/?year=2025&make=BMW&model=X5&...

    Returns all vehicles matching the provided filter parameters.
    """
    filters = {
        "year": request.query_params.get("year"),
        "make": request.query_params.get("make"),
        "model": request.query_params.get("model"),
        "trim": request.query_params.get("trim"),
        "body": request.query_params.get("body"),
        "engine": request.query_params.get("engine"),
        "transmission": request.query_params.get("transmission"),
        "region": request.query_params.get("region"),
    }

    if filters["year"]:
        try:
            filters["year"] = int(filters["year"])
        except (TypeError, ValueError):
            raise ValidationError({"year": "Must be an integer."})

    vehicles = VehicleCatalogService.find_vehicles(**filters)
    serializer = VehicleListSerializer(vehicles, many=True)
    return Response(serializer.data)


class VehicleDetailView(generics.RetrieveAPIView):
    """GET /api/vehicles/<id>/ — full vehicle details."""

    queryset = ModelDB.objects.filter(is_active=True)
    serializer_class = VehicleDetailSerializer
    lookup_field = "id"


class BackbonePagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "pageSize"
    max_page_size = 500


class BackboneListView(generics.ListAPIView):
    """GET /api/vehicles/backbone/ — paginated view of ModelDB with search/filtering."""

    queryset = ModelDB.objects.all().order_by("id")
    serializer_class = VehicleListSerializer
    pagination_class = BackbonePagination
    filter_backends = [DjangoFilterBackend, SmartSearchFilterBackend]
    filterset_class = BackboneFilter
    search_fields = ["make", "model", "trim"]


class BackboneExportView(generics.ListAPIView):
    """GET /api/vehicles/backbone/export/ — stream full filtered queryset as CSV."""

    queryset = ModelDB.objects.all().order_by("id")
    filter_backends = [DjangoFilterBackend, SmartSearchFilterBackend]
    filterset_class = BackboneFilter
    search_fields = ["make", "model", "trim"]
    pagination_class = None

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="carspecs_export.csv"'

        writer = csv.writer(response)
        writer.writerow(
            [
                "ID",
                "Year",
                "Make",
                "Model",
                "Trim",
                "Body",
                "Engine",
                "Transmission",
                "New Price",
                "Today Price",
                "Region",
                "Is Active",
            ]
        )

        rows = queryset.values_list(
            "id",
            "year",
            "make",
            "model",
            "trim",
            "body",
            "engine",
            "transmission",
            "new_price",
            "today_price",
            "region",
            "is_active",
        ).iterator(chunk_size=2000)

        for row in rows:
            writer.writerow(list(row))

        return response


class BackboneBulkUpdateView(APIView):
    """
    PATCH /api/vehicles/backbone/bulk/
    Body: {"ids": [1, 2, 3], "fields": {"is_active": false, "new_price": 45000}}
    """

    def patch(self, request, *args, **kwargs):
        ids = request.data.get("ids", [])
        fields = request.data.get("fields", {})

        if not isinstance(ids, list) or not ids:
            return Response(
                {"detail": 'Invalid or empty "ids".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed_fields = {"is_active", "new_price", "today_price", "region"}
        update_data = {key: value for key, value in fields.items() if key in allowed_fields}

        if not update_data:
            return Response(
                {"detail": "No allowed update fields provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated_count = ModelDB.objects.filter(id__in=ids).update(**update_data)
        return Response({"updated": updated_count}, status=status.HTTP_200_OK)


class DepreciationListView(generics.ListAPIView):
    """GET /api/vehicles/depreciation/ — all depreciation schedules."""

    queryset = Depreciation.objects.all()
    serializer_class = DepreciationSerializer
    pagination_class = None


class MileageCategoryListView(generics.ListAPIView):
    """GET /api/vehicles/mileage-categories/ — all mileage categories."""

    queryset = MileageCategory.objects.all()
    serializer_class = MileageCategorySerializer
    pagination_class = None


@api_view(["GET"])
def get_master_fields(request):
    """GET /api/vehicles/masters/fields/ — list model_db columns for the masters sidebar."""
    fields = VehicleCatalogService.list_master_fields()
    serializer = MasterFieldSerializer(fields, many=True)
    return Response(serializer.data)


@api_view(["GET", "POST"])
def master_field_values(request, field_name):
    """
    GET /api/vehicles/masters/<field_name>/values/
    POST /api/vehicles/masters/<field_name>/values/
    """
    if request.method == "GET":
        page = request.query_params.get("page", 1)
        page_size = request.query_params.get("pageSize", 50)
        search = request.query_params.get("search", "")

        try:
            payload = VehicleCatalogService.get_master_values(
                field_name,
                search=search,
                page=int(page),
                page_size=min(int(page_size), 1000),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = MasterValueSerializer(payload["results"], many=True)
        return Response({"count": payload["count"], "results": serializer.data})

    serializer = MasterValueCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        row = VehicleCatalogService.create_master_value(
            field_name,
            serializer.validated_data["value"],
        )
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(
        {
            "id": row.id,
            "field": field_name,
            "value": getattr(row, field_name),
            "is_active": row.is_active,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
def create_master_record(request):
    """POST /api/vehicles/masters/records/ - assemble a full model_db row."""
    serializer = MasterRecordCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        row = VehicleCatalogService.create_master_record(serializer.validated_data)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(VehicleDetailSerializer(row).data, status=status.HTTP_201_CREATED)
