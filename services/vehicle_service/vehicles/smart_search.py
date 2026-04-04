import re
from rest_framework.filters import SearchFilter

KNOWN_BODY_TYPES = {
    'sedan', 'suv', 'coupe', 'convertible', 'hatchback', 'wagon', 
    'van', 'minivan', 'pickup', 'truck'
}

class SmartSearchFilterBackend(SearchFilter):
    """
    Extends standard DRF SearchFilter by intercepting semantic tokens.
    If a query has a 4-digit number like "2020", it forces a year filter.
    If a query has a known body type like "sedan", it forces a body filter.
    The remaining words are treated as standard search terms for make/model/trim.
    """
    def filter_queryset(self, request, queryset, view):
        search_terms = self.get_search_terms(request)
        if not search_terms:
            return queryset

        remaining_terms = []
        year_token = None
        body_tokens = []

        # 1. Parse tokens
        for term in search_terms:
            lower_term = term.lower()
            if re.fullmatch(r'(19|20)\d{2}', term):
                year_token = term
            elif lower_term in KNOWN_BODY_TYPES:
                body_tokens.append(term)
            else:
                remaining_terms.append(term)

        # 2. Apply semantics immediately on queryset
        if year_token:
            queryset = queryset.filter(year=int(year_token))
        
        if body_tokens:
            # If multiple body types mentioned, use OR logic
            queryset = queryset.filter(body__iregex=r'(' + '|'.join(body_tokens) + r')')

        # 3. Use standard DRF search for the remaining terms
        if remaining_terms:
            # Overwrite the request's search param purely for the parent class
            original_search = request.query_params.get(self.search_param)
            request._request.GET = request._request.GET.copy()
            request._request.GET[self.search_param] = ' '.join(remaining_terms)
            
            queryset = super().filter_queryset(request, queryset, view)
            
            # Restore
            request._request.GET[self.search_param] = original_search

        return queryset
