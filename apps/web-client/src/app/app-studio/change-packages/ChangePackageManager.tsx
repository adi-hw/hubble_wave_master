import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Download, Upload, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import {
  changePackagesApi,
  type ChangePackage,
  type ChangePackageStatus,
} from '../../../services/changePackages';
import { applicationsApi, type Application } from '../../../lib/applications';
import {
  STATUS_PILL_NEUTRAL,
  STATUS_PILL_PENDING,
  STATUS_PILL_SUCCESS,
} from '../../../lib/styling';

const STATUS_CLASS: Record<ChangePackageStatus, string> = {
  open: STATUS_PILL_PENDING,
  complete: STATUS_PILL_SUCCESS,
  applied: STATUS_PILL_NEUTRAL,
};

/**
 * Plan §11.1 — Change Package list + create + import. Per-package
 * detail (diff + complete + export) lives in `ChangePackageDiff`.
 */
export const ChangePackageManager: React.FC = () => {
  const [packages, setPackages] = useState<ChangePackage[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    applicationId: '',
    code: '',
    name: '',
    description: '',
  });
  const [importJson, setImportJson] = useState('');
  const [importTargetAppId, setImportTargetAppId] = useState('');
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pkgs, apps] = await Promise.all([changePackagesApi.list(), applicationsApi.list()]);
      setPackages(pkgs);
      setApplications(apps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load change packages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.applicationId || !createForm.code || !createForm.name) return;
    try {
      await changePackagesApi.create(createForm);
      setCreateForm({ applicationId: '', code: '', name: '', description: '' });
      setCreating(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  };

  /**
   * Inspect the pasted import JSON and pre-select the matching target
   * Application by `applicationCode` (the source-instance code that
   * the exporter included). The user can override; we don't auto-guess
   * by source UUID because cross-instance UUIDs collide rarely-but-
   * destructively.
   */
  const onImportJsonChange = (next: string) => {
    setImportJson(next);
    if (!next.trim()) return;
    try {
      const parsed = JSON.parse(next) as { applicationCode?: string };
      if (parsed.applicationCode) {
        const match = applications.find((a) => a.code === parsed.applicationCode);
        if (match) setImportTargetAppId(match.id);
      }
    } catch {
      // not valid JSON yet - wait for the user to finish pasting
    }
  };

  const onImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importTargetAppId) {
      setError('Pick a target Application before importing.');
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const payload = JSON.parse(importJson);
      // Use the user-selected target Application id, NOT the
      // source-instance applicationId from the package payload - that
      // UUID belongs to a different instance and would fail the FK.
      await changePackagesApi.importPackage({
        applicationId: importTargetAppId,
        payload,
      });
      setImportJson('');
      setImportTargetAppId('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const importPayloadHint = (() => {
    if (!importJson.trim()) return null;
    try {
      const parsed = JSON.parse(importJson) as {
        code?: string;
        applicationCode?: string | null;
        changes?: unknown[];
      };
      return parsed;
    } catch {
      return null;
    }
  })();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-foreground">Change Packages</h1>
          <p className="text-xs text-muted-foreground">
            Bundle metadata changes for export to another instance.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus size={14} />
          New package
        </Button>
      </header>

      {error ? (
        <div className="m-3 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {creating ? (
        <form onSubmit={(e) => void onCreate(e)} className="m-4 grid grid-cols-2 gap-3 rounded border border-border bg-muted/20 p-4">
          <select
            className="rounded border border-border bg-card px-2 py-1 text-sm"
            value={createForm.applicationId}
            onChange={(e) => setCreateForm((f) => ({ ...f, applicationId: e.target.value }))}
            required
          >
            <option value="">Select Application...</option>
            {applications.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>
          <input
            className="rounded border border-border bg-card px-2 py-1 text-sm"
            placeholder="Code (e.g. release-2026-q2)"
            value={createForm.code}
            onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))}
            required
          />
          <input
            className="col-span-2 rounded border border-border bg-card px-2 py-1 text-sm"
            placeholder="Display name"
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <input
            className="col-span-2 rounded border border-border bg-card px-2 py-1 text-sm"
            placeholder="Description (optional)"
            value={createForm.description}
            onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div className="col-span-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" type="button" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit">
              Create package
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            Loading...
          </div>
        ) : packages.length === 0 ? (
          <div className="rounded border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            No Change Packages yet. Create one to start bundling artifacts for export.
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="w-24 px-3 py-2 text-center">Artifacts</th>
                <th className="w-28 px-3 py-2 text-center">Status</th>
                <th className="w-28 px-3 py-2 text-right">Updated</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id} className="border-b border-border hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <Link
                      to={`/app-studio/change-packages/${pkg.id}`}
                      className="inline-flex items-center gap-2 font-medium text-foreground hover:text-primary"
                    >
                      <FileText size={14} className="text-muted-foreground" />
                      {pkg.name}
                    </Link>
                    {pkg.description ? (
                      <div className="text-xs text-muted-foreground">{pkg.description}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{pkg.code}</td>
                  <td className="w-24 px-3 py-2 text-center text-xs text-muted-foreground">
                    {pkg.changes?.length ?? 0}
                  </td>
                  <td className="w-28 px-3 py-2 text-center">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[pkg.status]}`}
                    >
                      {pkg.status}
                    </span>
                  </td>
                  <td className="w-28 px-3 py-2 text-right text-xs text-muted-foreground">
                    {new Date(pkg.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="border-t border-border bg-card px-6 py-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Upload size={14} />
          Import package
        </h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Paste an exported Change Package JSON below, then pick the target
          Application on this instance. The package's source-instance
          <code className="mx-1">applicationId</code> is ignored - only the
          target you select here is used.
        </p>
        <form onSubmit={(e) => void onImport(e)} className="space-y-2">
          <textarea
            className="w-full rounded border border-border bg-card px-2 py-1 font-mono text-xs"
            rows={4}
            placeholder='{"code": "release-2026-q2", "applicationCode": "...", "changes": [...]}'
            value={importJson}
            onChange={(e) => onImportJsonChange(e.target.value)}
          />
          {importPayloadHint ? (
            <div className="rounded border border-border bg-muted/20 px-2 py-1 text-xs text-muted-foreground">
              <div>
                Source code: <code>{importPayloadHint.code ?? '-'}</code>
                {importPayloadHint.applicationCode ? (
                  <>
                    {' | '}source application:{' '}
                    <code>{importPayloadHint.applicationCode}</code>
                    {applications.some((a) => a.code === importPayloadHint.applicationCode)
                      ? ' (matching app exists on this instance - auto-selected below)'
                      : ' (no matching app on this instance - pick a target manually)'}
                  </>
                ) : null}
                {' | '}
                {Array.isArray(importPayloadHint.changes) ? importPayloadHint.changes.length : 0}{' '}
                artifact
                {Array.isArray(importPayloadHint.changes) && importPayloadHint.changes.length === 1
                  ? ''
                  : 's'}
              </div>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Target Application:</label>
            <select
              className="rounded border border-border bg-card px-2 py-1 text-sm"
              value={importTargetAppId}
              onChange={(e) => setImportTargetAppId(e.target.value)}
              required
            >
              <option value="">Select Application...</option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.code})
                </option>
              ))}
            </select>
            <div className="flex-1" />
            <Button
              size="sm"
              type="submit"
              disabled={importing || !importJson.trim() || !importTargetAppId}
            >
              <Download size={14} />
              Import
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
