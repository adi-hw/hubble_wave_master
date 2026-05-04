import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Lock } from 'lucide-react';
import { getPropertyType } from './property-types';
import type { InheritedProperty } from './hooks/useInheritedProperties';

interface InheritedPropertyRowProps {
  row: InheritedProperty;
  index: number;
}

const cellTextClass = 'truncate text-sm text-muted-foreground';

/**
 * Read-only render of a property inherited from a parent Collection.
 * Distinct from PropertyRow because the editing affordances do not
 * apply: type and code are immutable from the child's perspective; the
 * parent is the only place these can be edited.
 *
 * The trailing "View parent" link is the only interactive element —
 * navigates to the parent Collection's Data tab so admins can edit
 * the property at its source.
 */
export const InheritedPropertyRow: React.FC<InheritedPropertyRowProps> = ({ row, index }) => {
  const { draft, parent } = row;
  const typeDef = getPropertyType(draft.dataType);
  const TypeIcon = typeDef?.icon;

  return (
    <tr className="border-b border-border bg-muted/30 align-middle">
      <td className="w-10 px-3 py-2 text-xs text-muted-foreground">
        <Lock size={12} aria-hidden />
        <span className="sr-only">Inherited row {index + 1}</span>
      </td>

      <td className="px-3 py-2">
        <span className={cellTextClass}>{draft.label}</span>
      </td>

      <td className="px-3 py-2">
        <span className={`${cellTextClass} font-mono`}>{draft.code}</span>
      </td>

      <td className="w-56 px-3 py-2">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          {TypeIcon && typeDef ? (
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded text-white"
              style={{ backgroundColor: typeDef.color }}
              aria-hidden
            >
              <TypeIcon size={12} />
            </span>
          ) : null}
          {typeDef?.label ?? draft.dataType}
        </span>
      </td>

      <td className="w-20 px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={draft.isRequired}
          readOnly
          disabled
          aria-label="Required (inherited)"
          className="h-4 w-4 cursor-not-allowed accent-primary opacity-60"
        />
      </td>

      <td className="w-20 px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={draft.isUnique}
          readOnly
          disabled
          aria-label="Unique (inherited)"
          className="h-4 w-4 cursor-not-allowed accent-primary opacity-60"
        />
      </td>

      <td className="w-28 px-3 py-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
          Inherited
        </span>
      </td>

      <td className="w-32 px-3 py-2">
        <div className="flex items-center justify-end">
          <Link
            to={`/studio/c/${parent.code}/data`}
            title={`Edit on parent: ${parent.label}`}
            className="inline-flex items-center gap-1 rounded p-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink size={12} />
            Parent
          </Link>
        </div>
      </td>
    </tr>
  );
};
