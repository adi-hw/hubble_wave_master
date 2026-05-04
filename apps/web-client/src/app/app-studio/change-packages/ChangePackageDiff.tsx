import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Upload, Download, ArrowLeft } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { ProvenanceBadge } from '../../../components/provenance/ProvenanceBadge';
import {
  changePackagesApi,
  type ChangePackage,
  type MetadataChange,
} from '../../../services/changePackages';
import {
  DESTRUCTIVE_ICON_BUTTON,
  NEUTRAL_ICON_BUTTON,
  STATUS_BANNER_SUCCESS,
} from '../../../lib/styling';

const KINDS: ReadonlyArray<MetadataChange['kind']> = [
  'collection',
  'view',
  'form',
  'flow',
  'automation',
  'decision',
  'guidedProcess',
  'workspace',
  'property',
];

/**
 * Some kinds are scoped under a parent collection and need a composite
 * code. The hint is shown next to the artifact-code input so authors
 * type the right shape on the first try.
 */
const KIND_CODE_HINT: Record<MetadataChange['kind'], string> = {
  collection: 'e.g. work_orders',
  view: 'e.g. work_orders.list',
  flow: 'e.g. work_orders.escalate',
  decision: 'e.g. priority_matrix',
  guidedProcess: 'e.g. work_order_intake',
  workspace: 'e.g. ops_console',
  property: '<collection>.<property> - e.g. work_orders.priority',
  form: '<collection>.<form_name> - e.g. work_orders.intake',
  automation: '<collection>.<rule_name> - e.g. work_orders.assign_priority',
};

/**
 * Plan 11.1 - per-package detail view: list of artifact entries
 * with provenance badges, plus controls to add another artifact,
 * complete the package, and download the export JSON.
 */
export const ChangePackageDiff: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pkg, setPkg] = useState<ChangePackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addKind, setAddKind] = useState<MetadataChange['kind']>('collection');
  const [addCode, setAddCode] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setPkg(await changePackagesApi.get(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load package');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onAddArtifact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !addCode.trim()) return;
    setBusy(true);
    try {
      await changePackagesApi.addArtifact(id, { kind: addKind, code: addCode.trim() });
      setAddCode('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add failed');
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (kind: MetadataChange['kind'], code: string) => {
    if (!id) return;
    setBusy(true);
    try {
      await changePackagesApi.removeArtifact(id, kind, code);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setBusy(false);
    }
  };

  const onComplete = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await changePackagesApi.complete(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Complete failed');
    } finally {
      setBusy(false);
    }
  };

  const onExport = async () => {
    if (!id) return;
    try {
      const payload = await changePackagesApi.exportJson(id);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${pkg?.code ?? 'change-package'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 size={14} className="mr-2 animate-spin" />
        Loading package...
      </div>
    );
  }
  if (!pkg) {
    return (
      <div className="m-6 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        {error ?? 'Package not found'}
      </div>
    );
  }

  const isOpen = pkg.status === 'open';
  const isComplete = pkg.status === 'complete';

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/app-studio/change-packages')}
            className={NEUTRAL_ICON_BUTTON}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-base font-semibold text-foreground">{pkg.name}</h1>
            <p className="text-xs text-muted-foreground">
              <code>{pkg.code}</code> | {pkg.status} | {pkg.changes.length} artifact
              {pkg.changes.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void onExport()}>
            <Download size={14} />
            Export
          </Button>
          {isOpen ? (
            <Button size="sm" onClick={() => void onComplete()} disabled={busy}>
              <Upload size={14} />
              Mark complete
            </Button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="m-3 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex-1 overflow-auto px-6 py-4">
        {pkg.changes.length === 0 ? (
          <div className="mb-4 rounded border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            No artifacts in this package yet.
            {isOpen ? ' Add one below to start tracking changes.' : ''}
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left">Kind</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="w-32 px-3 py-2 text-center">Provenance</th>
                <th className="w-32 px-3 py-2 text-right">Captured</th>
                {isOpen ? <th className="w-16 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {pkg.changes.map((change) => (
                <tr key={`${change.kind}:${change.code}`} className="border-b border-border">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{change.kind}</td>
                  <td className="px-3 py-2 font-medium text-foreground">{change.code}</td>
                  <td className="w-32 px-3 py-2 text-center">
                    <ProvenanceBadge source={change.source} size="compact" />
                  </td>
                  <td className="w-32 px-3 py-2 text-right text-xs text-muted-foreground">
                    {new Date(change.capturedAt).toLocaleDateString()}
                  </td>
                  {isOpen ? (
                    <td className="w-16 px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void onRemove(change.kind, change.code)}
                        className={DESTRUCTIVE_ICON_BUTTON}
                        title="Remove from package"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {isOpen ? (
          <form
            onSubmit={(e) => void onAddArtifact(e)}
            className="mt-6 grid grid-cols-[120px_1fr_auto] items-end gap-3 rounded border border-border bg-muted/20 p-4"
          >
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Kind</label>
              <select
                value={addKind}
                onChange={(e) => setAddKind(e.target.value as MetadataChange['kind'])}
                className="w-full rounded border border-border bg-card px-2 py-1 text-sm"
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Artifact code</label>
              <input
                value={addCode}
                onChange={(e) => setAddCode(e.target.value)}
                placeholder={KIND_CODE_HINT[addKind]}
                className="w-full rounded border border-border bg-card px-2 py-1 text-sm"
              />
            </div>
            <Button size="sm" type="submit" disabled={busy || !addCode.trim()}>
              <Plus size={14} />
              Add
            </Button>
          </form>
        ) : null}

        {isComplete ? (
          <div className={`mt-6 rounded border p-3 text-xs ${STATUS_BANNER_SUCCESS}`}>
            This package is complete and ready for export. Source instance:{' '}
            <code>{pkg.sourceInstanceId ?? 'unknown'}</code>. Completed at{' '}
            {pkg.completedAt ? new Date(pkg.completedAt).toLocaleString() : '-'}.
          </div>
        ) : null}
      </div>

      <div className="border-t border-border bg-card px-6 py-3 text-xs text-muted-foreground">
        <Link to="/app-studio/change-packages" className="text-primary hover:underline">
          &lt;- Back to all packages
        </Link>
      </div>
    </div>
  );
};
