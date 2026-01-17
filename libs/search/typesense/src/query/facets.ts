export interface FacetConfig {
  field: string;
  limit?: number;
}

export function buildFacetBy(facets: FacetConfig[] = []): string | undefined {
  if (facets.length === 0) {
    return undefined;
  }
  return facets.map((facet) => facet.field).join(',');
}

export function resolveMaxFacetValues(facets: FacetConfig[] = []): number | undefined {
  const limits = facets.map((facet) => facet.limit).filter((limit): limit is number => !!limit);
  if (limits.length === 0) {
    return undefined;
  }
  return Math.max(...limits);
}
