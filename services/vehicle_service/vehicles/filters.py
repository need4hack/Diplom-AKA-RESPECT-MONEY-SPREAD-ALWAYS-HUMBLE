import django_filters
from .models import ModelDB

class CharInFilter(django_filters.BaseInFilter, django_filters.CharFilter):
    pass

class BackboneFilter(django_filters.FilterSet):
    year_min = django_filters.NumberFilter(field_name='year', lookup_expr='gte')
    year_max = django_filters.NumberFilter(field_name='year', lookup_expr='lte')
    
    price_min = django_filters.NumberFilter(field_name='today_price', lookup_expr='gte')
    price_max = django_filters.NumberFilter(field_name='today_price', lookup_expr='lte')
    
    make__in = CharInFilter(field_name='make', lookup_expr='in')
    body__in = CharInFilter(field_name='body', lookup_expr='in')
    engine__in = CharInFilter(field_name='engine', lookup_expr='in')
    region__in = CharInFilter(field_name='region', lookup_expr='in')
    
    is_active = django_filters.BooleanFilter(field_name='is_active')

    class Meta:
        model = ModelDB
        fields = ['year', 'make', 'model', 'trim', 'body', 'engine', 'is_active', 'region']
