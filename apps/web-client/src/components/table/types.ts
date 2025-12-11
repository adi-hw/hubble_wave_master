export interface TableColumn {
  code: string;
  label: string;
  type?: string;
  width?: number | string;
  sortable?: boolean;
  hidden?: boolean;
  pinned?: 'left' | 'right' | false;
  frozen?: boolean;
}

export interface FilterRule {
  id: string; // Unique identifier for the rule
  field: string;
  operator: string;
  value: any;
  value2?: any; // For "between" operators
  logicalOp?: 'AND' | 'OR'; // Legacy field for backward compatibility
}

export interface FilterGroup {
  id: string;
  type: 'group';
  logic: 'AND' | 'OR';
  children: (FilterRule | FilterGroup)[];
}

export type FilterNode = FilterRule | FilterGroup;

// Helper to check if a node is a group
export const isFilterGroup = (node: FilterNode): node is FilterGroup => {
  return 'type' in node && node.type === 'group';
};

// Generate unique ID for filter nodes
export const generateFilterId = () => Math.random().toString(36).substring(2, 9);
