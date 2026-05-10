export type SearchSourceConfig = {
  title_field?: string;
  content_fields?: string[];
  tag_fields?: string[];
  source_type?: string;
  chunk_size?: number;
  chunk_overlap?: number;
};

export type RecordEventPayload = {
  eventType: string;
  collectionCode: string;
  recordId: string;
  record?: Record<string, unknown>;
  previousRecord?: Record<string, unknown> | null;
  changedProperties?: string[];
  userId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt: string;
};
