import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { apiGet } from '../../../lib/api';

/**
 * Naming-shortcut redirector — resolves /studio/c/:code/:tab to the
 * existing UUID-based studio routes.
 *
 * Per the merged plan (Delta D, refined per review): rather than rewrite
 * every existing collection-management page to accept code instead of id,
 * we keep those pages on /studio/collections/:id and translate the
 * shortcut URL with one extra GET to resolve code -> id. The mapping is
 * the only place that needs to know about both shapes.
 *
 * Tabs supported in Slice B (each maps to an existing page; the proper
 * tabbed Table Builder lands in Phase 1):
 *   data     -> /studio/collections/:id            (collection editor)
 *   forms    -> /studio/collections/:id/form-layout
 *   sheet    -> /:code.list                        (existing list view)
 *   policies -> /studio/collections/:id/access     (closest existing surface)
 *   flows    -> /studio/collections/:id/automations (closest existing surface)
 *
 * In Phase 1 the right-hand side of these mappings collapses into a
 * single TableBuilder route with internal tabs; the shortcut URL stays
 * stable for users.
 */

interface CollectionLite {
  id: string;
  code: string;
  name?: string;
}

const TAB_TARGET: Record<string, (id: string, code: string) => string> = {
  data: (id) => `/studio/collections/${id}`,
  forms: (id) => `/studio/collections/${id}/form-layout`,
  policies: (id) => `/studio/collections/${id}/access`,
  flows: (id) => `/studio/collections/${id}/automations`,
  sheet: (_id, code) => `/${code}.list`,
};

export const CollectionShortcut: React.FC = () => {
  const { code, tab = 'data' } = useParams<{ code: string; tab?: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<CollectionLite | null>(null);

  useEffect(() => {
    if (!code) {
      setError('Missing collection code');
      return;
    }
    if (!TAB_TARGET[tab]) {
      setError(
        `Unknown tab '${tab}'. Supported: ${Object.keys(TAB_TARGET).join(', ')}.`,
      );
      return;
    }

    let cancelled = false;
    apiGet<CollectionLite>(`/collections/by-code/${encodeURIComponent(code)}`)
      .then((collection) => {
        if (!cancelled) setResolved(collection);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to resolve collection';
        setError(message);
      });

    return () => {
      cancelled = true;
    };
  }, [code, tab]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="mb-2 font-medium">Collection shortcut failed</div>
          <p className="mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/studio')}>
            Back to Studio
          </Button>
        </div>
      </div>
    );
  }

  if (!resolved) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-6 text-sm text-muted-foreground">
        <Loader2 size={16} className="mr-2 animate-spin" />
        Resolving collection “{code}”…
      </div>
    );
  }

  const target = TAB_TARGET[tab](resolved.id, resolved.code);
  return <Navigate to={target} replace />;
};

export default CollectionShortcut;
