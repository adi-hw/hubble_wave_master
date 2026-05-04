import React, { createContext, useContext } from 'react';
import { useParams } from 'react-router-dom';

/**
 * StudioCollection is the resolved collection record the TableBuilder
 * shell exposes to its tab content. Only the fields the tabs need today
 * are surfaced; expand the shape (with corresponding API enrichment)
 * when later phases require more.
 */
export interface StudioCollection {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: 'draft' | 'published' | 'deprecated';
  currentRevisionId?: string | null;
  applicationId?: string | null;
  /**
   * If set, this Collection inherits its property surface from another
   * Collection. Per ADR-8, inheritance materializes parent columns into
   * the child table at deploy time, so the child carries its own
   * physical columns — but the metadata model still surfaces the
   * provenance via this pointer.
   */
  extendsCollectionId?: string | null;
}

interface CollectionContextValue {
  collection: StudioCollection;
  /** Re-fetch the collection record. Used by tabs that mutate the
   *  collection (label, description) and need the shell header to
   *  pick up the new value. */
  refreshCollection: () => Promise<void>;
}

const CollectionContext = createContext<CollectionContextValue | null>(null);

export const CollectionProvider: React.FC<{
  collection: StudioCollection;
  refreshCollection: () => Promise<void>;
  children: React.ReactNode;
}> = ({ collection, refreshCollection, children }) => (
  <CollectionContext.Provider value={{ collection, refreshCollection }}>
    {children}
  </CollectionContext.Provider>
);

export const useRefreshCollection = (): (() => Promise<void>) => {
  const ctx = useContext(CollectionContext);
  if (!ctx) {
    throw new Error(
      'useRefreshCollection must be used inside <CollectionProvider>.',
    );
  }
  return ctx.refreshCollection;
};

/**
 * Read the resolved collection from TableBuilder context. Throws if
 * called outside a TableBuilder shell — the caller is in the wrong place.
 */
export const useStudioCollection = (): StudioCollection => {
  const ctx = useContext(CollectionContext);
  if (!ctx) {
    throw new Error(
      'useStudioCollection must be used inside <CollectionProvider> - ' +
        'mount the component within a TableBuilder tab.',
    );
  }
  return ctx.collection;
};

/**
 * Returns the active collection id from TableBuilder context when
 * available, falling back to the id-based URL param for direct deep-
 * link routes.
 *
 * Why: the same page module (e.g., FormLayoutPage) renders at both
 * /studio/c/:code/forms (inside TableBuilder) and
 * /studio/collections/:id/form-layout (direct deep-link). The hook
 * abstracts the source of the id so the page is identical in both
 * mounting contexts.
 */
export const useStudioCollectionId = (): string | undefined => {
  const ctx = useContext(CollectionContext);
  const params = useParams<{ id?: string }>();
  return ctx?.collection.id ?? params.id;
};
