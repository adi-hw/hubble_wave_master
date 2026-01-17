import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { viewApi, ResolvedView } from '../../services/viewApi';
import {
  offeringsApi,
  OfferingRecord,
  SubmitOfferingPayload,
} from '../../services/experienceHubApi';
import { FormLayout } from '../../components/form/FormLayout';
import type { ModelProperty, ModelLayout } from '../../services/platform.service';
import {
  SchemaProperty,
  extractFormFieldCodes,
  getPropertyDataType,
  resolveFormLayout,
} from './experienceUtils';

type SchemaResponse = {
  collection: {
    code: string;
    name?: string;
    label?: string;
    description?: string;
  };
  properties: SchemaProperty[];
};

export const OfferingSubmissionPage = () => {
  const { offeringId } = useParams<{ offeringId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [offering, setOffering] = useState<OfferingRecord | null>(null);
  const [properties, setProperties] = useState<SchemaProperty[]>([]);
  const [resolvedView, setResolvedView] = useState<ResolvedView | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{ workItemId: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOffering = useCallback(async () => {
    if (!offeringId) return;
    const response = await api.get<{ record: OfferingRecord }>(`/data/collections/offerings/data/${offeringId}`);
    return response.record;
  }, [offeringId]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!offeringId) {
        setError('Offering not found');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const [offeringRecord, schema] = await Promise.all([
          loadOffering(),
          api.get<SchemaResponse>('/data/collections/work_items/schema'),
        ]);

        if (!active) return;

        setOffering(offeringRecord ?? null);
        setProperties(schema.properties);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load offering');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [loadOffering, offeringId]);

  useEffect(() => {
    let active = true;

    const resolveView = async () => {
      if (!offering) {
        setResolvedView(null);
        return;
      }

      const route = offering.form_view_code || location.pathname;

      try {
        const view = await viewApi.resolve({ kind: 'form', collection: 'work_items', route });
        if (!active) return;
        setResolvedView(view);
      } catch {
        if (!active) return;
        setResolvedView(null);
      }
    };

    void resolveView();
    return () => {
      active = false;
    };
  }, [offering, location.pathname]);

  useEffect(() => {
    if (!offering) return;
    setFormData({
      title: offering.name || '',
      description: offering.description || '',
      priority: offering.default_priority || 'normal',
    });
  }, [offering]);

  const layout = useMemo<ModelLayout | null>(() => {
    const normalized = resolveFormLayout(resolvedView, properties);
    if (!normalized) return null;
    return {
      id: resolvedView?.viewCode || 'work_items_form',
      name: resolvedView?.name || 'Work Item',
      layout: normalized,
    };
  }, [resolvedView, properties]);

  const modelFields = useMemo<ModelProperty[]>(() => {
    const permissions = resolvedView?.fieldPermissions || {};
    return properties
      .filter((prop) => permissions[prop.code]?.canRead !== false)
      .map((prop) => ({
        code: prop.code,
        label: prop.name || prop.code,
        type: getPropertyDataType(prop),
        backendType: getPropertyDataType(prop),
        uiWidget: prop.config?.widget || '',
        storagePath: `column:work_items.${prop.code}`,
        nullable: !prop.isRequired,
        isUnique: Boolean(prop.isUnique),
        defaultValue: prop.defaultValue as string | undefined,
        config: { ...(prop.config || {}), validators: prop.validationRules },
        validators: prop.validationRules || {},
      }));
  }, [properties, resolvedView?.fieldPermissions]);

  const handleChange = useCallback((field: ModelProperty, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field.code]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!offering) return;
    setSubmitting(true);
    setError(null);

    try {
      const layoutFields = extractFormFieldCodes(layout?.layout || null);
      const payloadData: Record<string, unknown> = {};

      Object.entries(formData).forEach(([key, value]) => {
        if (['title', 'description', 'priority'].includes(key)) {
          return;
        }
        if (layoutFields.length === 0 || layoutFields.includes(key)) {
          payloadData[key] = value;
        }
      });

      const payload: SubmitOfferingPayload = {
        offeringId: offering.id,
        title: String(formData.title || '') || offering.name || undefined,
        description: String(formData.description || '') || offering.description || undefined,
        priority: String(formData.priority || '') || offering.default_priority || undefined,
        data: payloadData,
      };

      const result = await offeringsApi.submit(payload);
      setSubmissionResult({ workItemId: result.workItem.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }, [formData, layout?.layout, offering]);

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

  if (!offering) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="rounded-2xl border border-border bg-card p-6 text-muted-foreground">
          Offering not found.
        </div>
      </div>
    );
  }

  if (submissionResult) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Request submitted</h2>
          <p className="text-sm text-muted-foreground">
            Your request is now tracked as a work item. You can follow progress in My Work.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/experience/my-work')}
              className="btn btn-secondary"
            >
              Go to My Work
            </button>
            <button
              type="button"
              onClick={() => navigate(`/experience/work/${submissionResult.workItemId}`)}
              className="btn btn-primary"
            >
              View Work Item
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => navigate('/experience/offerings')}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Offerings
            </button>
            <h1 className="text-2xl font-semibold text-foreground">
              {offering.name || 'Offering Request'}
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              {offering.description || 'Provide the details for your request.'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">
              Request Details
            </div>
            <h2 className="text-lg font-semibold text-foreground">Submission Form</h2>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
        <div className="min-h-[360px]">
          <FormLayout
            fields={modelFields}
            layout={layout}
            values={formData}
            errors={{}}
            onChange={handleChange}
          />
        </div>
      </div>
    </div>
  );
};

export default OfferingSubmissionPage;
