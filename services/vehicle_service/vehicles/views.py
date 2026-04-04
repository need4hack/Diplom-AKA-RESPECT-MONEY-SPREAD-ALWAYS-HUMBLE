"""
API Views for Vehicle Service.

Thin controllers — delegates business logic to services.py (promt.md §7).
Handles HTTP concerns: request parsing, response formatting, error handling.
"""

from rest_framework import generics, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from .models import ModelDB, Depreciation, MileageCategory
from .serializers import (
    VehicleListSerializer,
    VehicleDetailSerializer,
    DepreciationSerializer,
    MileageCategorySerializer,
)
from .services import VehicleCatalogService


from django.views.decorators.cache import cache_page

# ──────────────────── Cascading filter endpoints ────────────────────


def _cascade_response(values, label: str = 'value') -> Response:
    """Helper: wrap a list of distinct values into a JSON response."""
    return Response([{label: v} for v in values if v is not None])


@api_view(['GET'])
@cache_page(60 * 60 * 24)
def get_years(request):
    """GET /api/vehicles/years/ — all available years."""
    years = VehicleCatalogService.get_years()
    return _cascade_response(years)


@api_view(['GET'])
@cache_page(60 * 60 * 24)
def get_makes(request):
    """GET /api/vehicles/makes/?year=2025"""
    year = request.query_params.get('year')
    if not year:
        raise ValidationError({'year': 'This query parameter is required.'})
    makes = VehicleCatalogService.get_makes(year=int(year))
    return _cascade_response(makes)


@api_view(['GET'])
@cache_page(60 * 60 * 24)
def get_models(request):
    """GET /api/vehicles/models/?year=2025&make=BMW"""
    year = request.query_params.get('year')
    make = request.query_params.get('make')
    if not year or not make:
        raise ValidationError({'detail': 'Both "year" and "make" are required.'})
    models_list = VehicleCatalogService.get_models(year=int(year), make=make)
    return _cascade_response(models_list)


@api_view(['GET'])
@cache_page(60 * 60 * 24)
def get_trims(request):
    """GET /api/vehicles/trims/?year=2025&make=BMW&model=X5"""
    year = request.query_params.get('year')
    make = request.query_params.get('make')
    model = request.query_params.get('model')
    if not all([year, make, model]):
        raise ValidationError({'detail': '"year", "make", and "model" are required.'})
    trims = VehicleCatalogService.get_trims(year=int(year), make=make, model=model)
    return _cascade_response(trims)


@api_view(['GET'])
@cache_page(60 * 60 * 24)
def get_body_types(request):
    """GET /api/vehicles/bodies/?year=2025&make=BMW&model=X5&trim=xDrive40i"""
    year = request.query_params.get('year')
    make = request.query_params.get('make')
    model = request.query_params.get('model')
    trim = request.query_params.get('trim')
    if not all([year, make, model, trim]):
        raise ValidationError({'detail': '"year", "make", "model", "trim" are required.'})
    bodies = VehicleCatalogService.get_body_types(
        year=int(year), make=make, model=model, trim=trim,
    )
    return _cascade_response(bodies)


@api_view(['GET'])
@cache_page(60 * 60 * 24)
def get_engines(request):
    """GET /api/vehicles/engines/?year=...&make=...&model=...&trim=...&body=..."""
    params = request.query_params
    required = ['year', 'make', 'model', 'trim', 'body']
    missing = [p for p in required if not params.get(p)]
    if missing:
        raise ValidationError({'detail': f'Missing required params: {", ".join(missing)}'})
    engines = VehicleCatalogService.get_engines(
        year=int(params['year']), make=params['make'],
        model=params['model'], trim=params['trim'], body=params['body'],
    )
    return _cascade_response(engines)


@api_view(['GET'])
@cache_page(60 * 60 * 24)
def get_transmissions(request):
    """GET /api/vehicles/transmissions/?year=...&make=...&model=...&trim=...&body=...&engine=..."""
    params = request.query_params
    required = ['year', 'make', 'model', 'trim', 'body', 'engine']
    missing = [p for p in required if not params.get(p)]
    if missing:
        raise ValidationError({'detail': f'Missing required params: {", ".join(missing)}'})
    transmissions = VehicleCatalogService.get_transmissions(
        year=int(params['year']), make=params['make'],
        model=params['model'], trim=params['trim'],
        body=params['body'], engine=params['engine'],
    )
    return _cascade_response(transmissions)


# ──────────────────── Generic options endpoint ──────────────────────


@api_view(['GET'])
@cache_page(60 * 60 * 24)
def get_options(request, field_name):
    """
    GET /api/vehicles/options/<field_name>/?year=2025&make=BMW&...

    Generic endpoint: returns distinct values of any allowed field,
    filtered by all provided query parameters (DRY — one endpoint for all).
    """
    filters = {}
    for key in request.query_params:
        filters[key] = request.query_params[key]

    values = VehicleCatalogService.get_options(field=field_name, **filters)
    return _cascade_response(values)


# ──────────────────── Vehicle search & detail ────────────────────


@api_view(['GET'])
def search_vehicles(request):
    """
    GET /api/vehicles/search/?year=2025&make=BMW&model=X5&...

    Returns all vehicles matching the provided filter parameters.
    """
    filters = {
        'year': request.query_params.get('year'),
        'make': request.query_params.get('make'),
        'model': request.query_params.get('model'),
        'trim': request.query_params.get('trim'),
        'body': request.query_params.get('body'),
        'engine': request.query_params.get('engine'),
        'transmission': request.query_params.get('transmission'),
        'region': request.query_params.get('region'),
    }
    # Cast year to int if provided
    if filters['year']:
        try:
            filters['year'] = int(filters['year'])
        except (ValueError, TypeError):
            raise ValidationError({'year': 'Must be an integer.'})

    vehicles = VehicleCatalogService.find_vehicles(**filters)
    serializer = VehicleListSerializer(vehicles, many=True)
    return Response(serializer.data)


class VehicleDetailView(generics.RetrieveAPIView):
    """GET /api/vehicles/<id>/ — full vehicle details."""
    queryset = ModelDB.objects.filter(is_active=True)
    serializer_class = VehicleDetailSerializer
    lookup_field = 'id'


from rest_framework import filters
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from .filters import BackboneFilter
from .smart_search import SmartSearchFilterBackend

class BackbonePagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'pageSize'
    max_page_size = 500

class BackboneListView(generics.ListAPIView):
    """GET /api/vehicles/backbone/ — paginated view of entire ModelDB with search."""
    queryset = ModelDB.objects.all().order_by('id')
    serializer_class = VehicleListSerializer
    pagination_class = BackbonePagination
    filter_backends = [DjangoFilterBackend, SmartSearchFilterBackend]
    filterset_class = BackboneFilter
    search_fields = ['make', 'model', 'trim']

import csv
from django.http import HttpResponse
from rest_framework.views import APIView

class BackboneExportView(generics.ListAPIView):
    """GET /api/vehicles/backbone/export/ — streams full filtered QuerySet as CSV."""
    queryset = ModelDB.objects.all().order_by('id')
    filter_backends = [DjangoFilterBackend, SmartSearchFilterBackend]
    filterset_class = BackboneFilter
    search_fields = ['make', 'model', 'trim']
    pagination_class = None

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="carspecs_export.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['ID', 'Year', 'Make', 'Model', 'Trim', 'Body', 'Engine', 'Transmission', 'New Price', 'Today Price', 'Region', 'Is Active'])
        
        # Use database cursors (iterator) to preserve memory on large exports
        rows = queryset.values_list(
            'id', 'year', 'make', 'model', 'trim', 'body', 'engine', 
            'transmission', 'new_price', 'today_price', 'region', 'is_active'
        ).iterator(chunk_size=2000)
        
        for row in rows:
            writer.writerow([
                row[0], row[1], row[2], row[3], row[4], row[5], row[6],
                row[7], row[8], row[9], row[10], row[11]
            ])
            
        return response

class BackboneBulkUpdateView(APIView):
    """
    PATCH /api/vehicles/backbone/bulk/
    Body: {"ids": [1, 2, 3], "fields": {"is_active": false, "new_price": 45000}}
    """
    def patch(self, request, *args, **kwargs):
        ids = request.data.get('ids', [])
        fields = request.data.get('fields', {})
        
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'Invalid or empty "ids".'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Only allow specific fields to prevent SQL-level manipulation
        allowed_fields = {'is_active', 'new_price', 'today_price', 'region'}
        update_data = {k: v for k, v in fields.items() if k in allowed_fields}
        
        if not update_data:
            return Response({'detail': 'No allowed update fields provided.'}, status=status.HTTP_400_BAD_REQUEST)
        
        updated_count = ModelDB.objects.filter(id__in=ids).update(**update_data)
        return Response({'updated': updated_count}, status=status.HTTP_200_OK)



# ──────────────────── Reference data endpoints ────────────────────


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
