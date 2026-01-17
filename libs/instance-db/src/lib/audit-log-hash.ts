import { createHash } from 'crypto';
import { AuditLog } from './entities/settings.entity';

export type AuditLogHashPayload = {
  userId: string | null;
  collectionCode: string | null;
  recordId: string | null;
  action: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  permissionCode: string | null;
  createdAt: string;
  previousHash: string | null;
};

export function buildAuditLogHashPayload(
  entry: AuditLog,
  previousHash: string | null,
): AuditLogHashPayload {
  return {
    userId: entry.userId ?? null,
    collectionCode: entry.collectionCode ?? null,
    recordId: entry.recordId ?? null,
    action: entry.action,
    oldValues: entry.oldValues ?? null,
    newValues: entry.newValues ?? null,
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null,
    permissionCode: entry.permissionCode ?? null,
    createdAt: entry.createdAt.toISOString(),
    previousHash,
  };
}

export function buildAuditLogHash(payload: AuditLogHashPayload): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(',')}}`;
}
