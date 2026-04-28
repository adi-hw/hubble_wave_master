import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AppWindow,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Database,
  History,
  Loader2,
  PauseCircle,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import {
  Application,
  ApplicationRevision,
  ApplicationStatus,
  applicationsApi,
} from '../../../lib/applications';

const STATUS_TONE: Record<ApplicationStatus, string> = {
  draft: 'bg-amber-100 text-amber-800 border-amber-200',
  published: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  deprecated: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const ApplicationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [application, setApplication] = useState<Application | null>(null);
  const [revisions, setRevisions] = useState<ApplicationRevision[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<null | 'publish' | 'deprecate' | 'save'>(null);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [app, revs] = await Promise.all([
        applicationsApi.getById(id),
        applicationsApi.listRevisions(id),
      ]);
      setApplication(app);
      setRevisions(revs);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load Application';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onPublish = async () => {
    if (!id || busyAction) return;
    setBusyAction('publish');
    try {
      await applicationsApi.publish(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setBusyAction(null);
    }
  };

  const onDeprecate = async () => {
    if (!id || busyAction) return;
    setBusyAction('deprecate');
    try {
      await applicationsApi.deprecate(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deprecate failed');
    } finally {
      setBusyAction(null);
    }
  };

  if (loading && !application) {
    return (
      <div className="min-h-full bg-background p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <Skeleton className="h-8 w-72 rounded-md" />
          <Skeleton className="h-32 w-full rounded-md" />
          <Skeleton className="h-48 w-full rounded-md" />
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-full bg-background p-6">
        <div className="mx-auto max-w-6xl">
          <Button variant="outline" onClick={() => navigate('/studio/apps')}>
            <ArrowLeft size={16} />
            Back to Applications
          </Button>
          <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error ?? 'Application not found.'}
          </div>
        </div>
      </div>
    );
  }

  const currentRevision = revisions.find((r) => r.id === application.currentRevisionId);

  return (
    <div className="min-h-full bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/studio" className="hover:underline">
              Studio
            </Link>
            <ChevronRight size={14} />
            <Link to="/studio/apps" className="hover:underline">
              Applications
            </Link>
            <ChevronRight size={14} />
            <span>{application.code}</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <AppWindow className="text-primary" size={24} />
                {application.name}
              </h1>
              <p className="font-mono text-sm text-muted-foreground">{application.code}</p>
              {application.description && (
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  {application.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => void load()} disabled={loading}>
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Refresh
              </Button>
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil size={16} />
                Edit
              </Button>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-sm font-medium ${STATUS_TONE[application.status]}`}
              >
                {application.status}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={onPublish}
                disabled={
                  busyAction === 'publish' ||
                  application.status === 'published' ||
                  !application.currentRevisionId
                }
              >
                {busyAction === 'publish' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                Publish
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onDeprecate}
                disabled={busyAction === 'deprecate' || application.status === 'deprecated'}
              >
                {busyAction === 'deprecate' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <PauseCircle size={14} />
                )}
                Deprecate
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Provenance
            </div>
            <div className="font-mono text-sm">{application.source}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {application.source === 'custom'
                ? 'Customer-created. Survives every pack upgrade.'
                : 'Pack-shipped. Customer modifications create a draft override.'}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current Revision
            </div>
            <div className="text-sm">
              {currentRevision ? (
                <>
                  <span className="font-mono">#{currentRevision.revision}</span>{' '}
                  <span className="text-muted-foreground">({currentRevision.status})</span>
                </>
              ) : (
                <span className="text-muted-foreground">no revision</span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {currentRevision?.publishedAt
                ? `Published ${new Date(currentRevision.publishedAt).toLocaleString()}`
                : 'Not yet published.'}
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
            <Database size={18} className="text-primary" />
            Collections in this Application
          </h2>
          <p className="text-sm text-muted-foreground">
            The Table Builder lands in Phase 1 of the App Studio plan. Until then,
            collections under this Application are managed via the existing Studio
            collection pages.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/studio/collections')}>
              Open Collections
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/studio/collections/new')}>
              New Collection
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
            <History size={18} className="text-primary" />
            Revision History
          </h2>
          {revisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No revisions recorded yet.</p>
          ) : (
            <ol className="space-y-2">
              {revisions.map((rev) => (
                <li
                  key={rev.id}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${rev.id === application.currentRevisionId ? 'border-primary/40 bg-primary/5' : 'border-border'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono">#{rev.revision}</span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                      {rev.status}
                    </span>
                    {rev.id === application.currentRevisionId && (
                      <span className="text-xs text-primary">current</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {rev.publishedAt
                      ? `Published ${new Date(rev.publishedAt).toLocaleString()}`
                      : `Created ${new Date(rev.createdAt).toLocaleString()}`}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <EditApplicationDialog
        application={application}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={async () => {
          setEditOpen(false);
          await load();
        }}
      />
    </div>
  );
};

interface EditApplicationDialogProps {
  application: Application;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

const EditApplicationDialog: React.FC<EditApplicationDialogProps> = ({
  application,
  open,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState(application.name);
  const [description, setDescription] = useState(application.description ?? '');
  const [scope, setScope] = useState(application.scope ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(application.name);
      setDescription(application.description ?? '');
      setScope(application.scope ?? '');
      setSubmitting(false);
      setError(null);
    }
  }, [open, application]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await applicationsApi.update(application.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        scope: scope.trim() || undefined,
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="Edit Application"
      description="Saving creates a new draft revision; publish to make it the canonical version."
      size="md"
      closeOnBackdropClick={!submitting}
      closeOnEscape={!submitting}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="edit-application-form" disabled={submitting}>
            {submitting && <Loader2 size={16} className="animate-spin" />}
            Save Draft
          </Button>
        </div>
      }
    >
      <form id="edit-application-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Code</label>
          <Input value={application.code} disabled readOnly className="font-mono" />
          <p className="mt-1 text-xs text-muted-foreground">Code is permanent.</p>
        </div>
        <div>
          <label htmlFor="edit-application-name" className="mb-1 block text-sm font-medium">
            Name
          </label>
          <Input
            id="edit-application-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={255}
            disabled={submitting}
          />
        </div>
        <div>
          <label
            htmlFor="edit-application-description"
            className="mb-1 block text-sm font-medium"
          >
            Description{' '}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="edit-application-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={4000}
            disabled={submitting}
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor="edit-application-scope" className="mb-1 block text-sm font-medium">
            Scope{' '}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input
            id="edit-application-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            maxLength={120}
            disabled={submitting}
            placeholder="URL-safe segment used in naming-shortcut routes"
          />
        </div>
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
};

export default ApplicationDetailPage;
