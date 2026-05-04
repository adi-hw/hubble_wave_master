import React from 'react';
import { Box, Wrench } from 'lucide-react';
import { STATUS_PILL_NEUTRAL, STATUS_PILL_PENDING } from '../../lib/styling';

interface Props {
  /** ADR-7 source value: `'custom'`, `'pack:<id>'`, `'pack:<id>@<version>'`, or null. */
  source?: string | null;
  /** Compact pill rendering for table rows; default `inline` for header chrome. */
  size?: 'inline' | 'compact';
}

/**
 * Plan §11.2 — Studio shell badge surfacing ADR-7 provenance per
 * artifact. Pack-shipped rows render orange; customer-authored rows
 * render slate. Pack id is shown in the tooltip so admins can audit
 * which pack owns the artifact without opening the artifact.
 */
export const ProvenanceBadge: React.FC<Props> = ({ source, size = 'inline' }) => {
  const isPack = !!source && source.startsWith('pack:');
  const label = isPack ? 'Pack' : 'Custom';
  const Icon = isPack ? Box : Wrench;
  const tooltip = isPack
    ? `Source: ${source}. Pack-shipped artifacts are protected on pack upgrade — clone via a variant to override.`
    : 'Custom artifact. Survives pack upgrades unchanged.';

  const base =
    'inline-flex items-center gap-1 rounded-full border font-medium uppercase tracking-wide';
  const sizing = size === 'compact' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';
  const colorClass = isPack ? STATUS_PILL_PENDING : STATUS_PILL_NEUTRAL;

  return (
    <span className={`${base} ${sizing} ${colorClass}`} title={tooltip}>
      <Icon size={size === 'compact' ? 10 : 12} />
      {label}
    </span>
  );
};
