/**
 * Application registry API client.
 *
 * The Application is the unit of metadata grouping inside an instance
 * (canon §3 / ADR-6). Every metadata entity is scoped under one
 * Application; App Studio's Home page is the registry view of all
 * Applications the operator can see.
 *
 * Backend: svc-metadata mounts this surface under /api/metadata/applications
 * (the metadata proxy in vite.config.mts maps /api/applications to it).
 */

import { apiDelete, apiGet, apiPatch, apiPost } from './api';

export type ApplicationStatus = 'draft' | 'published' | 'deprecated';
export type ApplicationRevisionStatus = 'draft' | 'published';

export interface Application {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  scope?: string | null;
  source: string;
  status: ApplicationStatus;
  currentRevisionId?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationRevision {
  id: string;
  applicationId: string;
  revision: number;
  status: ApplicationRevisionStatus;
  payload: Record<string, unknown>;
  createdBy?: string | null;
  publishedBy?: string | null;
  publishedAt?: string | null;
  createdAt: string;
}

export interface CreateApplicationPayload {
  code: string;
  name: string;
  description?: string;
  scope?: string;
}

export interface UpdateApplicationPayload {
  name?: string;
  description?: string;
  scope?: string;
}

const BASE = '/applications';

export const applicationsApi = {
  list: () => apiGet<Application[]>(BASE),

  getById: (id: string) => apiGet<Application>(`${BASE}/${id}`),

  getByCode: (code: string) => apiGet<Application>(`${BASE}/code/${code}`),

  listRevisions: (id: string) =>
    apiGet<ApplicationRevision[]>(`${BASE}/${id}/revisions`),

  create: (payload: CreateApplicationPayload) =>
    apiPost<Application>(BASE, payload),

  update: (id: string, payload: UpdateApplicationPayload) =>
    apiPatch<Application>(`${BASE}/${id}`, payload),

  publish: (id: string) =>
    apiPost<Application>(`${BASE}/${id}/publish`),

  deprecate: (id: string) =>
    apiPost<Application>(`${BASE}/${id}/deprecate`),

  // Reserved for a future hard-delete endpoint. Today the backend has no
  // DELETE — applications are deprecated, not removed, so the FK
  // constraint on collections has no chance to violate. Surface kept
  // here so the UI binding lands in one place when the endpoint exists.
  remove: (id: string) => apiDelete<void>(`${BASE}/${id}`),
};
