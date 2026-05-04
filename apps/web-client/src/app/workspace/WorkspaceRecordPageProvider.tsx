import React, { createContext, useContext, useMemo } from 'react';
import { useParams } from 'react-router-dom';

/**
 * Plan §10.4 — record-page context. The four side-panel members
 * (RelatedListPanel, ActivityFeedPanel, QuickActionsPanel,
 * RecordDetailPanel) share the currently-viewed record. Without
 * this context they'd each re-derive the record id from URL params,
 * fall out of sync on prop drilling, and lose mutation
 * synchronization (a quick action that updates the record wouldn't
 * notify the related list).
 */
export interface WorkspaceRecordContextValue {
  workspaceCode: string;
  collectionCode: string;
  recordId: string;
}

const WorkspaceRecordContext = createContext<WorkspaceRecordContextValue | null>(null);

interface ProviderProps {
  /** Override prop wins over URL params; useful in the Studio
   *  preview where the canvas hands the record context in directly. */
  workspaceCode?: string;
  collectionCode?: string;
  recordId?: string;
  children: React.ReactNode;
}

export const WorkspaceRecordPageProvider: React.FC<ProviderProps> = ({
  workspaceCode,
  collectionCode,
  recordId,
  children,
}) => {
  const params = useParams<{ wsCode?: string; collectionCode?: string; recordId?: string }>();
  const value = useMemo<WorkspaceRecordContextValue | null>(() => {
    const ws = workspaceCode ?? params.wsCode;
    const cc = collectionCode ?? params.collectionCode;
    const rid = recordId ?? params.recordId;
    if (!ws || !cc || !rid) return null;
    return { workspaceCode: ws, collectionCode: cc, recordId: rid };
  }, [workspaceCode, collectionCode, recordId, params.wsCode, params.collectionCode, params.recordId]);
  return (
    <WorkspaceRecordContext.Provider value={value}>
      {children}
    </WorkspaceRecordContext.Provider>
  );
};

/**
 * Read the workspace record context. Returns null when called
 * outside a provider OR when the URL/props don't carry a record
 * binding (e.g. on a `home` page). Panels use the null check to
 * render an "open a record to populate" placeholder rather than
 * blowing up on undefined.
 */
export const useWorkspaceRecord = (): WorkspaceRecordContextValue | null => {
  return useContext(WorkspaceRecordContext);
};
