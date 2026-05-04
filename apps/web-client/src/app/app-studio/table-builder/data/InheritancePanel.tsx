import React from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, Loader2 } from 'lucide-react';
import type { CollectionDefinition } from '../../../../services/schema';

interface InheritancePanelProps {
  parent: CollectionDefinition | null;
  inheritedCount: number;
  loading: boolean;
  error: string | null;
}

/**
 * Inheritance summary rendered above the property toolbar. Surfaces the
 * provenance link to the parent Collection and a count of inherited
 * properties shown in the locked rows below.
 *
 * Slice B2 is read-only: a Collection's parent is set at create time
 * (via CollectionWizard) and immutable afterwards. Mutating
 * extendsCollectionId post-create requires DDL migration of all
 * existing records - that surface lands in a later slice once the
 * schema-diff cascade (plan 6.4) ships.
 */
export const InheritancePanel: React.FC<InheritancePanelProps> = ({
  parent,
  inheritedCount,
  loading,
  error,
}) => {
  if (!parent && !loading && !error) {
    return null;
  }

  return (
    <section className="border-b border-border bg-info-subtle/40 px-6 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-info-subtle text-info-text">
          <GitBranch size={14} />
        </span>
        <div className="flex-1">
          <div className="text-sm font-medium text-foreground">Inherited Collection</div>
          {loading ? (
            <div className="mt-1 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" />
              Resolving parent...
            </div>
          ) : error ? (
            <div className="mt-1 text-xs text-destructive">{error}</div>
          ) : parent ? (
            <div className="mt-1 text-xs text-muted-foreground">
              Inherits from{' '}
              <Link
                to={`/studio/c/${parent.code}/data`}
                className="font-medium text-foreground underline decoration-dotted underline-offset-2 hover:text-primary"
              >
                {parent.label}
              </Link>{' '}
              <span className="font-mono">({parent.code})</span>
              {' | '}
              {inheritedCount}{' '}
              {inheritedCount === 1 ? 'inherited property' : 'inherited properties'}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};
