import { useEffect, useState } from 'react';
import { formsService, FormDefinition } from '../services/forms.service';
import { Loader2, LayoutTemplate } from 'lucide-react';
import { AppLayout } from '../layout/AppLayout';

export const Forms = () => {
  const [forms, setForms] = useState<FormDefinition[]>([]);
  const [selected, setSelected] = useState<FormDefinition | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [draftSchema, setDraftSchema] = useState('{}');
  const [newForm, setNewForm] = useState({ name: '', slug: '', description: '' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await formsService.list();
      setForms(data);
      if (!selected && data.length) {
        const f = await formsService.get(data[0].id);
        setSelected(f);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load forms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const f = await formsService.get(id);
      setSelected(f);
      const latest = f.versions?.[0];
      setDraftSchema(JSON.stringify(latest?.schema ?? {}, null, 2));
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load form');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newForm.name.trim() || !newForm.slug.trim()) return;
    setLoading(true);
    setError('');
    try {
      const created = await formsService.create({
        name: newForm.name.trim(),
        slug: newForm.slug.trim(),
        description: newForm.description.trim(),
        schema: {},
      });
      setNewForm({ name: '', slug: '', description: '' });
      await load();
      await handleSelect(created.id);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create form');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!selected) return;
    setLoading(true);
    setError('');
    try {
      const schema = JSON.parse(draftSchema || '{}');
      const updated = await formsService.publish(selected.id, schema);
      setSelected(updated);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to publish form');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout
      title="Forms"
      subtitle="Builder"
      activeNavKey="forms"
      headerMeta={<span>Design, publish, and manage form versions</span>}
      headerActions={
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-sm"
        >
          <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      }
    >
      <div className="md:hidden mb-3 flex justify-end">
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-sm"
        >
          <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 min-h-[70vh]">
        <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-primary-600" />
              <div>
                <div className="text-base font-semibold text-slate-900">Forms</div>
                <div className="text-xs text-slate-500">Select or create a form.</div>
              </div>
            </div>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-primary-600" />}
          </div>
          {error && <div className="p-2 rounded bg-red-50 border border-red-100 text-red-700 text-sm">{error}</div>}
          <div className="space-y-1 max-h-[60vh] overflow-auto">
            {forms.map((f) => (
              <button
                key={f.id}
                onClick={() => handleSelect(f.id)}
                className={`w-full text-left px-3 py-2 rounded-md border ${selected?.id === f.id ? 'border-primary-200 bg-primary-50 text-primary-800' : 'border-slate-200 hover:bg-slate-50'} transition`}
              >
                <div className="font-semibold text-sm">{f.name}</div>
                <div className="text-xs text-slate-500">{f.slug}</div>
              </button>
            ))}
            {!forms.length && <div className="text-slate-500 text-sm">No forms yet.</div>}
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-2">
            <div className="text-sm font-semibold text-slate-800">New form</div>
            <input
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Name"
              value={newForm.name}
              onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
            />
            <input
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Slug"
              value={newForm.slug}
              onChange={(e) => setNewForm({ ...newForm, slug: e.target.value })}
            />
            <input
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Description"
              value={newForm.description}
              onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
            />
            <button
              onClick={handleCreate}
              className="w-full rounded-md bg-primary-600 text-white text-sm font-semibold py-2 hover:bg-primary-700"
            >
              Create form
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-5 space-y-4">
          {selected ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-semibold text-slate-900">{selected.name}</div>
                  <div className="text-sm text-slate-600">{selected.description || selected.slug}</div>
                </div>
                <div className="text-xs text-slate-500">Current v{selected.currentVersion}</div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-800">Draft schema (JSON)</div>
                <textarea
                  className="w-full min-h-[240px] rounded-md border border-slate-200 px-3 py-2 text-sm font-mono"
                  value={draftSchema}
                  onChange={(e) => setDraftSchema(e.target.value)}
                />
                <button
                  onClick={handlePublish}
                  className="rounded-md bg-primary-600 text-white text-sm font-semibold px-4 py-2 hover:bg-primary-700"
                >
                  Publish new version
                </button>
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-800 mb-2">Versions</div>
                <div className="space-y-2">
                  {selected.versions?.map((v) => (
                    <div key={v.id} className="border border-slate-100 rounded-md p-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="font-semibold">v{v.version} ({v.status})</div>
                        <div className="text-xs text-slate-500">{new Date(v.createdAt).toLocaleString()}</div>
                      </div>
                      <pre className="text-xs text-slate-700 bg-slate-50 rounded p-2 mt-2 whitespace-pre-wrap">
                        {JSON.stringify(v.schema, null, 2)}
                      </pre>
                    </div>
                  ))}
                  {!selected.versions?.length && <div className="text-slate-500 text-sm">No versions yet.</div>}
                </div>
              </div>
            </>
          ) : (
            <div className="text-slate-500">Select a form to view details.</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};
