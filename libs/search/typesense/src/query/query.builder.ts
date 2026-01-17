import { buildFilterExpression, FilterCondition } from './filters';
import { buildFacetBy, FacetConfig, resolveMaxFacetValues } from './facets';

export interface SearchRequest {
  q: string;
  queryBy: string[];
  filters?: FilterCondition[];
  facets?: FacetConfig[];
  page?: number;
  perPage?: number;
  sortBy?: string;
}

export function buildSearchParams(request: SearchRequest) {
  const filterBy = buildFilterExpression(request.filters);
  const facetBy = buildFacetBy(request.facets);
  const maxFacetValues = resolveMaxFacetValues(request.facets);

  return {
    q: request.q,
    query_by: request.queryBy.join(','),
    filter_by: filterBy,
    facet_by: facetBy,
    max_facet_values: maxFacetValues,
    page: request.page,
    per_page: request.perPage,
    sort_by: request.sortBy,
  };
}
