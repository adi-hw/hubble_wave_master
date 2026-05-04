import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import {
  schemaService,
  type DependentSummary,
  type ImpactClassification,
  type PropertyImpactReport,
  type PublishImpactReport,
} from '../../../../services/schema';
import {
  STATUS_PILL_PENDING,
  STATUS_PILL_SUCCESS,
  STATUS_PILL_DANGER,
  STATUS_BANNER_PENDING,
  STATUS_BANNER_SUCCESS,
  STATUS_BANNER_DANGER,
} from '../../../../lib/styling';

interface PublishConfirmDialogProps {
  open: boolean;
  collectionId: string;
  collectionLabel: string;
  onClose: () => void;
  onPublished: () => void;
}

const TONE: Record<ImpactClassification | 'no_changes', { badge: string; banner: string }> = {
  no_changes: {
    badge: 'border-border bg-muted text-muted-foreground',
    banner: 'border-border bg-muted/40 text-muted-foreground',
  },
  cosmetic: { badge: STATUS_PILL_SUCCESS, banner: STATUS_BANNER_SUCCESS },
  structural: { badge: STATUS_PILL_PENDING, banner: STATUS_BANNER_PENDING },
  breaking: { badge: STATUS_PILL_DANGER, banner: STATUS_BANNER_DANGER },
};

const HEADLINE: Record<ImpactClassification | 'no_changes', string> = {
  no_changes: 'No changes to publish.',
  cosmetic: 'Cosmetic changes only - safe to publish.',
  structural: 'Structural changes detected. Dependents will be flagged for review.',
  breaking: 'Breaking changes detected. Acknowledge each affected dependent before publishing.',
};

/**
 * ADR-17 publish confirm dialog. The mode (and the requirements
 * before "Publish" enables) is driven entirely by the
 * `classification` field of the impact report:
 *
 *   - `no_changes` / `cosmetic`: publish enabled immediately; one
 *     click confirms.
 *   - `structural`: publish enabled, but the dialog enumerates
 *     dependents that will be marked needs-review in the queue.
 *     Explicit "I understand" not required (the queue captures the
 *     follow-up).
 *   - `breaking`: each dependent must be ticked before publish
 *     enables, and the confirm button copy reflects the gravity
 *     ("Publish despite breaking changes").
 */
export const PublishConfirmDialog: React.FC<PublishConfirmDialogProps> = ({
  open,
  collectionId,
  collectionLabel,
  onClose,
  onPublished,
}) => {
  const [report, setReport] = useState<PublishImpactReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAcknowledged(new Set());
    schemaService
      .getPublishPreview(collectionId)
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load publish preview');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, collectionId]);

  const breakingDependents = useMemo(() => {
    if (!report) return [] as Array<{ change: PropertyImpactReport; dep: DependentSummary }>;
    const out: Array<{ change: PropertyImpactReport; dep: DependentSummary }> = [];
    for (const change of report.propertyChanges) {
      if (change.classification !== 'breaking') continue;
      for (const dep of change.dependents) out.push({ change, dep });
    }
    return out;
  }, [report]);

  const allBreakingAcknowledged =
    breakingDependents.length === 0 ||
    breakingDependents.every(({ dep }) => acknowledged.has(`${dep.entityType}:${dep.entityId}`));

  const canPublish =
    !!report &&
    !loading &&
    !publishing &&
    (report.classification !== 'breaking' || allBreakingAcknowledged);

  const onConfirm = async () => {
    if (!canPublish) return;
    setPublishing(true);
    setError(null);
    try {
      await schemaService.publishCollection(collectionId);
      onPublished();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const toggleAck = (entityType: string, entityId: string) => {
    const key = `${entityType}:${entityId}`;
    setAcknowledged((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const cls = report?.classification ?? 'no_changes';
  const tone = TONE[cls];
  const totalDependents = report
    ? report.propertyChanges.reduce((sum, p) => sum + p.dependents.length, 0)
    : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Publish ${collectionLabel}`}
      description="Review the impact of this publish before confirming."
      size="xl"
      scrollable
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={publishing}>
            Cancel
          </Button>
          <Button
            onClick={() => void onConfirm()}
            disabled={!canPublish}
            variant={cls === 'breaking' ? 'danger' : 'primary'}
          >
            {publishing ? (
              <>
                <Loader2 size={14} className="mr-1.5 animate-spin" />
                Publishing
              </>
            ) : cls === 'breaking' ? (
              'Publish despite breaking changes'
            ) : cls === 'no_changes' ? (
              'Publish (no diff)'
            ) : (
              'Publish'
            )}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          Computing publish impact...
        </div>
      ) : error ? (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="mb-1 font-medium">{error}</div>
        </div>
      ) : !report ? null : (
        <div className="space-y-4">
          <div
            className={`rounded border p-3 text-sm ${tone.banner}`}
            role="status"
          >
            <div className="mb-1 flex items-center gap-2 font-medium">
              {cls === 'breaking' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
              <span>{HEADLINE[cls]}</span>
              <span
                className={`ml-auto rounded-full border px-2 py-0.5 text-xs font-medium ${tone.badge}`}
              >
                {cls.replace('_', ' ')}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {report.propertyChanges.length}{' '}
              {report.propertyChanges.length === 1 ? 'property change' : 'property changes'} |{' '}
              {totalDependents}{' '}
              {totalDependents === 1 ? 'dependent affected' : 'dependents affected'}
            </div>
          </div>

          {report.propertyChanges.length === 0 ? null : (
            <div className="space-y-3">
              {report.propertyChanges.map((change) => (
                <PropertyChangeBlock
                  key={`${change.propertyCode}-${change.changeKind}`}
                  change={change}
                  acknowledged={acknowledged}
                  onToggle={toggleAck}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

const PropertyChangeBlock: React.FC<{
  change: PropertyImpactReport;
  acknowledged: Set<string>;
  onToggle: (entityType: string, entityId: string) => void;
}> = ({ change, acknowledged, onToggle }) => {
  const tone = TONE[change.classification];
  const requiresAck = change.classification === 'breaking';

  return (
    <section className="rounded border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tone.badge}`}>
            {change.classification}
          </span>
          <span className="text-sm font-medium text-foreground">
            {change.propertyLabel ?? change.propertyCode}
          </span>
          <span className="font-mono text-xs text-muted-foreground">{change.propertyCode}</span>
          <span className="text-xs text-muted-foreground">| {change.changeKind}</span>
        </div>
      </header>
      <div className="px-3 py-2 text-xs text-muted-foreground">
        {change.reasons.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-4">
            {change.reasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        ) : (
          <span>No additional context.</span>
        )}
      </div>
      {change.dependents.length > 0 ? (
        <div className="border-t border-border px-3 py-2">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dependents ({change.dependents.length})
          </div>
          <ul className="space-y-1">
            {change.dependents.map((dep) => {
              const key = `${dep.entityType}:${dep.entityId}`;
              const isAck = acknowledged.has(key);
              return (
                <li
                  key={key}
                  className="flex items-start gap-2 rounded px-2 py-1 text-sm hover:bg-muted/40"
                >
                  {requiresAck ? (
                    <input
                      type="checkbox"
                      checked={isAck}
                      onChange={() => onToggle(dep.entityType, dep.entityId)}
                      aria-label={`Acknowledge ${dep.entityLabel}`}
                      className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
                    />
                  ) : (
                    <span className="mt-0.5 inline-block h-4 w-4 rounded-full bg-amber-200" aria-hidden />
                  )}
                  <span className="flex-1">
                    <span className="block">
                      <span className="font-mono text-xs text-muted-foreground">{dep.entityType}</span>
                      <span className="mx-1 text-muted-foreground">|</span>
                      <span className="font-medium text-foreground">{dep.entityLabel}</span>
                      {dep.href ? (
                        <a
                          href={dep.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
                        >
                          <ExternalLink size={10} />
                          open
                        </a>
                      ) : null}
                    </span>
                    <span className="block text-xs text-muted-foreground">{dep.reason}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
};
