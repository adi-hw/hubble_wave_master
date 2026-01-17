import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, MessageSquareText, Timer, Workflow, XCircle } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import { viewApi, ResolvedView } from '../../services/viewApi';
import { workApi, WorkItemRecord } from '../../services/experienceHubApi';
import { agentConsoleApi, type WorkflowApprovalRecord } from '../../services/agentConsoleApi';
import { DetailView, FieldDef, SectionDef } from '../../components/data/DetailView';
import {
  SchemaProperty,
  getPropertyDataType,
  resolveFormLayout,
} from '../experience/experienceUtils';

type SchemaResponse = {
  collection: {
    code: string;
    name?: string;
    label?: string;
  };
  properties: SchemaProperty[];
};

type TimelineEvent = {
  id: string;
  event_type?: string;
  message?: string;
  created_at?: string;
  created_by?: string;
  data?: Record<string, unknown>;
};

type WorkComment = {
  id: string;
  body?: string;
  author_id?: string;
  created_at?: string;
};

const mapFieldType = (dataType: string): FieldDef['type'] => {
  const normalized = dataType.toLowerCase();
  if (['date'].includes(normalized)) return 'date';
  if (['datetime', 'timestamp'].includes(normalized)) return 'datetime';
  if (['boolean'].includes(normalized)) return 'boolean';
  if (['choice', 'status', 'priority'].includes(normalized)) return 'choice';
  if (['reference', 'user'].includes(normalized)) return 'reference';
  if (['email'].includes(normalized)) return 'email';
  if (['url'].includes(normalized)) return 'url';
  if (['phone'].includes(normalized)) return 'phone';
  if (['currency'].includes(normalized)) return 'currency';
  if (['percent', 'percentage'].includes(normalized)) return 'percent';
  if (['number', 'integer', 'decimal', 'float'].includes(normalized)) return 'number';
  if (['long_text', 'richtext', 'html'].includes(normalized)) return 'richtext';
  return 'text';
};

const formatUserLabel = (value?: unknown) => {
  if (!value) return 'System';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return String(record.display_name || record.name || record.username || record.id || 'User');
  }
  return String(value);
};

const formatApprovalStatus = (status?: string) => {
  if (!status) return 'pending';
  return status.replace(/_/g, ' ');
};

export const WorkItemAgentDetailPage = () => {
  const { workItemId } = useParams<{ workItemId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { auth } = useAuth();

  const [workItem, setWorkItem] = useState<WorkItemRecord | null>(null);
  const [properties, setProperties] = useState<SchemaProperty[]>([]);
  const [resolvedView, setResolvedView] = useState<ResolvedView | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [comments, setComments] = useState<WorkComment[]>([]);
  const [approvals, setApprovals] = useState<WorkflowApprovalRecord[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState('');
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!workItemId) return;
    setLoading(true);
    setError(null);

    try {
      const [record, schema, view] = await Promise.all([
        workApi.get(workItemId),
        api.get<SchemaResponse>('/data/collections/work_items/schema'),
        viewApi
          .resolve({ kind: 'form', collection: 'work_items', route: location.pathname })
          .catch(() => null),
      ]);

      setWorkItem(record);
      setProperties(schema.properties);
      setResolvedView(view);
      setStatusDraft(record.status || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load work item');
    } finally {
      setLoading(false);
    }
  }, [location.pathname, workItemId]);

  const loadTimeline = useCallback(async () => {
    if (!workItemId) return;
    const filters = JSON.stringify([
      { property: 'work_item_id', operator: 'equals', value: workItemId },
    ]);
    const response = await api.get<{
      data: TimelineEvent[];
    }>(`/data/collections/work_timeline/data`, { filters });
    const ordered = [...response.data].sort((a, b) => {
      const left = a.created_at ? new Date(a.created_at).getTime() : 0;
      const right = b.created_at ? new Date(b.created_at).getTime() : 0;
      return right - left;
    });
    setTimeline(ordered);
  }, [workItemId]);

  const loadComments = useCallback(async () => {
    if (!workItemId) return;
    const filters = JSON.stringify([
      { property: 'work_item_id', operator: 'equals', value: workItemId },
    ]);
    const response = await api.get<{
      data: WorkComment[];
    }>(`/data/collections/work_comments/data`, { filters });
    const ordered = [...response.data].sort((a, b) => {
      const left = a.created_at ? new Date(a.created_at).getTime() : 0;
      const right = b.created_at ? new Date(b.created_at).getTime() : 0;
      return right - left;
    });
    setComments(ordered);
  }, [workItemId]);

  const loadApprovals = useCallback(async (workflowInstanceId?: string) => {
    if (!workflowInstanceId) {
      setApprovals([]);
      return;
    }
    const data = await agentConsoleApi.listApprovalsForInstance(workflowInstanceId);
    setApprovals(data || []);
  }, []);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!workItemId) return;
    void loadTimeline();
    void loadComments();
  }, [loadTimeline, loadComments, workItemId]);

  useEffect(() => {
    if (!workItem?.workflow_instance_id) {
      setApprovals([]);
      return;
    }
    void loadApprovals(workItem.workflow_instance_id as string);
  }, [workItem?.workflow_instance_id, loadApprovals]);

  const formLayout = useMemo(() => resolveFormLayout(resolvedView, properties), [resolvedView, properties]);

  const sections = useMemo<SectionDef<WorkItemRecord>[]>(() => {
    if (!formLayout) return [];
    const propertyMap = new Map(properties.map((prop) => [prop.code, prop]));
    const permissionMap = resolvedView?.fieldPermissions || {};
    const hasMultipleTabs = formLayout.tabs.length > 1;

    return formLayout.tabs.flatMap((tab, tabIndex) => {
      return tab.sections.map((section, sectionIndex) => {
        const sectionFields: FieldDef<WorkItemRecord>[] = section.fields
          .map((code) => propertyMap.get(code))
          .filter((prop): prop is SchemaProperty => Boolean(prop))
          .filter((prop) => permissionMap[prop.code]?.canRead !== false)
          .map((prop) => ({
            id: prop.code,
            label: prop.name || prop.code,
            accessor: prop.code as keyof WorkItemRecord,
            type: mapFieldType(getPropertyDataType(prop)),
            options: prop.config?.choices?.map((option) => ({
              value: option.value,
              label: option.label,
            })),
          }));

        const labelBase = section.label || tab.label || `Section ${sectionIndex + 1}`;
        const label = hasMultipleTabs
          ? `${tab.label || `Tab ${tabIndex + 1}`} - ${labelBase}`
          : labelBase;

        const columns = Math.min(3, Math.max(1, section.columns || 2)) as 1 | 2 | 3;

        return {
          id: `${tab.id || tabIndex}-${section.id || sectionIndex}`,
          label,
          columns,
          collapsible: section.collapsible ?? true,
          defaultCollapsed: section.defaultCollapsed ?? false,
          fields: sectionFields,
        };
      });
    });
  }, [formLayout, properties, resolvedView?.fieldPermissions]);

  const handleAddComment = async () => {
    if (!commentDraft.trim() || !workItemId) return;
    setSaving(true);
    try {
      await workApi.addComment(workItemId, commentDraft.trim());
      setCommentDraft('');
      await Promise.all([loadComments(), loadTimeline()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async () => {
    if (!statusDraft.trim() || !workItemId) return;
    setSaving(true);
    try {
      const updated = await workApi.transition(workItemId, {
        status: statusDraft.trim(),
        message: `Status updated to ${statusDraft.trim()}`,
      });
      setWorkItem(updated);
      await loadTimeline();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const handleApprovalAction = async (approvalId: string, action: 'approve' | 'reject') => {
    setSaving(true);
    try {
      const notes = approvalNotes[approvalId];
      if (action === 'approve') {
        await agentConsoleApi.approve(approvalId, notes);
      } else {
        await agentConsoleApi.reject(approvalId, notes);
      }
      await loadApprovals(workItem?.workflow_instance_id as string | undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update approval');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (!workItem) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="rounded-2xl border border-border bg-card p-6 text-muted-foreground">
          Work item not found.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <button
          type="button"
          onClick={() => navigate('/agent/queues')}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to queues
        </button>
      </div>

      <DetailView
        record={workItem}
        sections={sections}
        onBack={() => navigate('/agent/queues')}
        title={(record) => String(record.title || record.id)}
        subtitle={(record) => (
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Workflow className="h-4 w-4" />
              Status: {String(record.status || 'new')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Timer className="h-4 w-4" />
              Priority: {String(record.priority || 'normal')}
            </span>
          </div>
        )}
        showAuditInfo={true}
        auditInfo={{
          createdAt: workItem.created_at,
          updatedAt: workItem.updated_at,
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Comments</h3>
          </div>
          <div className="px-6 py-4 space-y-4">
            <textarea
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="Add a comment..."
              rows={3}
              className="w-full rounded-xl border border-border bg-input px-4 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddComment}
                className="btn btn-primary"
                disabled={saving || !commentDraft.trim()}
              >
                {saving ? 'Saving...' : 'Add Comment'}
              </button>
            </div>
            <div className="space-y-4">
              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              )}
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-xl border border-border bg-muted p-4">
                  <div className="text-xs text-muted-foreground mb-2">
                    {formatUserLabel(comment.author_id)} -{' '}
                    {comment.created_at ? new Date(comment.created_at).toLocaleString() : 'Just now'}
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{comment.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <Workflow className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Approvals</h3>
          </div>
          <div className="px-6 py-4 space-y-4">
            {approvals.length === 0 && (
              <p className="text-sm text-muted-foreground">No approvals for this work item.</p>
            )}
            {approvals.map((approval) => {
              const isOwner = auth.user?.id && approval.approverId === auth.user.id;
              const isPending = approval.status === 'pending';
              return (
                <div key={approval.id} className="rounded-xl border border-border bg-muted p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        Approval {approval.nodeId || ''}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Status: {formatApprovalStatus(approval.status)}
                      </div>
                    </div>
                    {approval.dueDate && (
                      <div className="text-xs text-muted-foreground">
                        Due {new Date(approval.dueDate).toLocaleString()}
                      </div>
                    )}
                  </div>
                  {isOwner && isPending && (
                    <>
                      <input
                        type="text"
                        value={approvalNotes[approval.id] || ''}
                        onChange={(event) =>
                          setApprovalNotes((prev) => ({ ...prev, [approval.id]: event.target.value }))
                        }
                        placeholder="Optional notes"
                        className="w-full rounded-lg border border-border bg-input px-3 py-2 text-xs text-foreground"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={saving}
                          onClick={() => handleApprovalAction(approval.id, 'approve')}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={saving}
                          onClick={() => handleApprovalAction(approval.id, 'reject')}
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Workflow className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Timeline</h3>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={statusDraft}
              onChange={(event) => setStatusDraft(event.target.value)}
              placeholder="Update status"
              className="flex-1 min-w-[200px] rounded-xl border border-border bg-input px-4 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={handleTransition}
              className="btn btn-secondary"
              disabled={saving || !statusDraft.trim()}
            >
              Update Status
            </button>
          </div>
          <div className="space-y-3">
            {timeline.length === 0 && (
              <p className="text-sm text-muted-foreground">No timeline events yet.</p>
            )}
            {timeline.map((event) => (
              <div key={event.id} className="rounded-xl border border-border bg-muted p-4">
                <div className="text-xs text-muted-foreground mb-2">
                  {formatUserLabel(event.created_by)} -{' '}
                  {event.created_at ? new Date(event.created_at).toLocaleString() : 'Just now'}
                </div>
                <div className="text-sm font-medium text-foreground">
                  {event.event_type || 'Event'}
                </div>
                {event.message && (
                  <p className="text-sm text-muted-foreground mt-1">{event.message}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default WorkItemAgentDetailPage;
