export type StorageNamespace = 'attachments' | 'pack-artifacts' | 'model-vault';

function normalizeSegment(segment: string): string {
  return segment.replace(/^\/+|\/+$/g, '');
}

export function buildStorageKey(namespace: StorageNamespace, ...segments: string[]): string {
  const cleaned = segments.map(normalizeSegment).filter(Boolean);
  return [namespace, ...cleaned].join('/');
}
