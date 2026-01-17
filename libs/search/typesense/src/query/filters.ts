export type FilterOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: string | number | boolean | Array<string | number | boolean>;
}

function formatValue(value: string | number | boolean): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return value.toString();
}

export function buildFilterExpression(filters: FilterCondition[] = []): string | undefined {
  if (filters.length === 0) {
    return undefined;
  }

  const parts = filters.map((filter) => {
    const field = filter.field;
    if (filter.operator === 'in') {
      const values = Array.isArray(filter.value) ? filter.value : [filter.value];
      return `${field}:=[${values.map(formatValue).join(',')}]`;
    }

    const value = Array.isArray(filter.value) ? filter.value[0] : filter.value;
    const formatted = formatValue(value);

    switch (filter.operator) {
      case 'eq':
        return `${field}:=${formatted}`;
      case 'ne':
        return `${field}:!=${formatted}`;
      case 'gt':
        return `${field}:>${formatted}`;
      case 'gte':
        return `${field}:>=${formatted}`;
      case 'lt':
        return `${field}:<${formatted}`;
      case 'lte':
        return `${field}:<=${formatted}`;
      default:
        return `${field}:=${formatted}`;
    }
  });

  return parts.join(' && ');
}
