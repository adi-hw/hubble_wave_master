export interface IndexableDocument {
  id: string;
  sourceType: string;
  sourceId: string;
  title?: string;
  content: string;
  tags?: string[];
  createdAt?: Date | number;
  updatedAt?: Date | number;
}

function toEpoch(value: Date | number): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  return value;
}

function resolveTimestamp(
  value: Date | number | undefined,
  fallback: number
): number {
  if (value === undefined) {
    return fallback;
  }
  return toEpoch(value);
}

export function mapToTypesenseDocument(doc: IndexableDocument) {
  const now = Date.now();
  const createdAt = resolveTimestamp(doc.createdAt, now);
  const updatedAt = resolveTimestamp(doc.updatedAt, createdAt);

  return {
    id: doc.id,
    source_type: doc.sourceType,
    source_id: doc.sourceId,
    title: doc.title,
    content: doc.content,
    tags: doc.tags,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}
