/**
 * Schema Template Types
 * HubbleWave Platform - Phase 2
 *
 * Types for schema and form templates.
 */

import { SchemaProperty, SchemaRelationship } from '../SchemaDesigner/types';

export type TemplateCategory =
  | 'asset_management'
  | 'project_management'
  | 'crm'
  | 'hr'
  | 'finance'
  | 'inventory'
  | 'service_desk'
  | 'compliance'
  | 'custom';

export type TemplateScope = 'system' | 'instance' | 'personal';

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'reference';
  label: string;
  description?: string;
  defaultValue?: unknown;
  required: boolean;
  options?: { value: string; label: string }[];
}

export interface SchemaTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  scope: TemplateScope;
  icon?: string;
  color?: string;
  tags: string[];
  version: string;
  author?: string;

  // Schema definition
  collectionName: string;
  collectionCode: string;
  singularName?: string;
  pluralName?: string;
  properties: Omit<SchemaProperty, 'id'>[];
  relationships?: Omit<SchemaRelationship, 'id' | 'sourceCollection'>[];

  // Variables for customization
  variables?: TemplateVariable[];

  // Preview data for demonstration
  previewData?: Record<string, unknown>[];

  // Metadata
  usageCount?: number;
  rating?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FormLayoutTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  scope: TemplateScope;
  tags: string[];

  // Layout definition
  layout: {
    tabs: Array<{
      label: string;
      icon?: string;
      sections: Array<{
        label: string;
        columns: number;
        items: Array<{
          type: 'field' | 'spacer' | 'divider' | 'info_box' | 'embedded_list';
          fieldCode?: string;
          span?: number;
          config?: Record<string, unknown>;
        }>;
      }>;
    }>;
  };

  // Which schema template this is for (if any)
  schemaTemplateId?: string;

  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

export interface ViewTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  scope: TemplateScope;
  tags: string[];

  // View configuration
  viewType: 'list' | 'kanban' | 'calendar' | 'gallery' | 'timeline' | 'pivot' | 'gantt' | 'map';
  config: Record<string, unknown>;

  // Which schema template this is for (if any)
  schemaTemplateId?: string;

  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplateBundle {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  scope: TemplateScope;
  icon?: string;
  tags: string[];

  // Included templates
  schemaTemplates: SchemaTemplate[];
  formTemplates: FormLayoutTemplate[];
  viewTemplates: ViewTemplate[];

  // Variables that apply across the bundle
  variables?: TemplateVariable[];

  // Metadata
  author?: string;
  version: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApplyTemplateResult {
  success: boolean;
  collectionId?: string;
  errors?: string[];
  warnings?: string[];
}

export interface TemplateFilterOptions {
  category?: TemplateCategory;
  scope?: TemplateScope;
  search?: string;
  tags?: string[];
}
