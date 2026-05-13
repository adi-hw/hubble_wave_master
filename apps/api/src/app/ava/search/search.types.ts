export type SearchSourceConfig = {
  title_field?: string;
  content_fields?: string[];
  tag_fields?: string[];
  source_type?: string;
  chunk_size?: number;
  chunk_overlap?: number;
  /**
   * List of record field names to denormalize as ABAC ACL fields in the
   * Typesense document. The indexer stores them with a leading `_` prefix
   * (e.g. `region` → `_region`) so the search-authz emitter can reference
   * them in `attribute_match` filter clauses without colliding with
   * user-visible content fields.
   *
   * `_collection_id` is always included — it is not listed here.
   * This list is derived from the union of `attribute_match.field` values
   * that appear in compiled ASTs for the collection's access rules.
   */
  acl_attributes?: string[];
  /**
   * The stable UUID of the collection this source indexes. Required for the
   * `_collection_id` ACL field. When absent, the field is omitted and the
   * authz pre-filter degrades to an in_collection match that cannot be
   * applied (the post-filter still applies in that case).
   */
  collection_id?: string;
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
