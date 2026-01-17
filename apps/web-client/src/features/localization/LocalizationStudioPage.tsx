import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { GlassCard } from '../../components/ui/glass/GlassCard';
import { GlassInput, GlassSelect, GlassTextarea } from '../../components/ui/glass';
import { useToastHelpers } from '../../components/ui/Toast';
import {
  cancelTranslationRequest,
  listLocales,
  listTranslationRequests,
  listValues,
  publishBundles,
  updateValue,
  upsertValue,
  type StudioLocale,
  type StudioValue,
  type TranslationRequest,
} from '../../services/localizationStudio.service';

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
];

export function LocalizationStudioPage() {
  const { success: showSuccess, error: showError } = useToastHelpers();
  const toastRef = useRef({ showSuccess, showError });
  const [locales, setLocales] = useState<StudioLocale[]>([]);
  const [values, setValues] = useState<StudioValue[]>([]);
  const [requests, setRequests] = useState<TranslationRequest[]>([]);
  const [selectedLocale, setSelectedLocale] = useState<string>('');
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    toastRef.current = { showSuccess, showError };
  }, [showError, showSuccess]);

  const loadLocales = useCallback(async () => {
    const data = await listLocales();
    setLocales(data);
    if (!selectedLocale && data.length > 0) {
      const firstActive = data.find((locale) => locale.isActive) || data[0];
      setSelectedLocale(firstActive.code);
    }
  }, [selectedLocale]);

  const loadRequests = useCallback(async () => {
    const data = await listTranslationRequests();
    setRequests(data);
  }, []);

  const loadValues = useCallback(
    async (localeCode: string) => {
      if (!localeCode) return;
      const data = await listValues(localeCode);
      setValues(data);
      if (data.length > 0 && !selectedKeyId) {
        setSelectedKeyId(data[0].keyId);
      }
    },
    [selectedKeyId],
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        await Promise.all([loadLocales(), loadRequests()]);
        if (active && selectedLocale) {
          await loadValues(selectedLocale);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Localization load failed';
        toastRef.current.showError(message);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [loadLocales, loadRequests, loadValues, selectedLocale]);

  useEffect(() => {
    if (!selectedLocale) return;
    void loadValues(selectedLocale);
  }, [loadValues, selectedLocale]);

  const filteredValues = useMemo(() => {
    if (!filter.trim()) return values;
    const needle = filter.trim().toLowerCase();
    return values.filter((entry) => {
      const composite = `${entry.namespace}.${entry.key}`.toLowerCase();
      return composite.includes(needle) || entry.defaultText.toLowerCase().includes(needle);
    });
  }, [filter, values]);

  const selectedValue = useMemo(
    () => values.find((entry) => entry.keyId === selectedKeyId) || null,
    [selectedKeyId, values],
  );

  const handleSave = useCallback(async () => {
    if (!selectedValue || !selectedLocale) {
      return;
    }
    if (!selectedValue.text.trim()) {
      showError('Translation text is required.');
      return;
    }
    setSaving(true);
    try {
      if (selectedValue.valueId) {
        await updateValue(selectedValue.valueId, {
          text: selectedValue.text,
          status: selectedValue.status,
        });
      } else {
        await upsertValue({
          locale_code: selectedLocale,
          namespace: selectedValue.namespace,
          key: selectedValue.key,
          text: selectedValue.text,
          status: selectedValue.status,
        });
      }
      await loadValues(selectedLocale);
      showSuccess('Translation saved.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Translation save failed';
      showError(message);
    } finally {
      setSaving(false);
    }
  }, [loadValues, selectedLocale, selectedValue, showError, showSuccess]);

  const handlePublish = useCallback(async () => {
    if (!selectedLocale) {
      showError('Select a locale to publish.');
      return;
    }
    try {
      await publishBundles([selectedLocale]);
      showSuccess('Localization bundle published.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Publish failed';
      showError(message);
    }
  }, [selectedLocale, showError, showSuccess]);

  const handleCancelRequest = useCallback(
    async (requestId: string) => {
      try {
        await cancelTranslationRequest(requestId);
        await loadRequests();
        showSuccess('Translation request cancelled.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Request update failed';
        showError(message);
      }
    },
    [loadRequests, showError, showSuccess],
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Localization Manager</h1>
          <p className="text-sm text-muted-foreground">
            Review, edit, and approve translations per locale.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handlePublish} disabled={!selectedLocale}>
            Publish Locale
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <GlassCard className="p-4 space-y-4">
          <div className="grid gap-3">
            <GlassSelect
              label="Locale"
              value={selectedLocale}
              options={locales.map((locale) => ({
                value: locale.code,
                label: `${locale.name} (${locale.code})`,
              }))}
              placeholder="Select locale"
              onChange={(event) => {
                setSelectedLocale(event.target.value);
                setSelectedKeyId(null);
              }}
            />
            <GlassInput
              label="Filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Search keys or default text"
            />
          </div>

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
            {loading && <div className="text-sm text-muted-foreground">Loading keys...</div>}
            {!loading && filteredValues.length === 0 && (
              <div className="text-sm text-muted-foreground">No translation keys found.</div>
            )}
            {filteredValues.map((entry) => (
              <button
                key={entry.keyId}
                type="button"
                onClick={() => setSelectedKeyId(entry.keyId)}
                className={`w-full text-left rounded-lg border px-3 py-2 transition ${
                  entry.keyId === selectedKeyId
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card'
                }`}
              >
                <div className="text-sm font-medium text-foreground">
                  {entry.namespace}.{entry.key}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {entry.defaultText}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Status: {entry.status}
                </div>
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-6 space-y-4">
          {selectedValue ? (
            <>
              <div>
                <div className="text-sm text-muted-foreground">Key</div>
                <div className="text-lg font-semibold text-foreground">
                  {selectedValue.namespace}.{selectedValue.key}
                </div>
              </div>

              <GlassTextarea
                label="Default Text"
                value={selectedValue.defaultText}
                disabled
              />
              <GlassTextarea
                label="Translation"
                value={selectedValue.text}
                onChange={(event) =>
                  setValues((prev) =>
                    prev.map((entry) =>
                      entry.keyId === selectedValue.keyId
                        ? { ...entry, text: event.target.value }
                        : entry,
                    ),
                  )
                }
                placeholder="Enter translation"
              />
              <GlassSelect
                label="Status"
                value={selectedValue.status}
                options={statusOptions}
                onChange={(event) =>
                  setValues((prev) =>
                    prev.map((entry) =>
                      entry.keyId === selectedValue.keyId
                        ? { ...entry, status: event.target.value as StudioValue['status'] }
                        : entry,
                    ),
                  )
                }
              />

              <div className="flex items-center justify-end gap-2">
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                  {selectedValue.valueId ? 'Update Translation' : 'Create Translation'}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Select a translation key to edit.</div>
          )}
        </GlassCard>
      </div>

      <GlassCard className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-foreground">Translation Requests</h2>
            <p className="text-xs text-muted-foreground">
              Requests awaiting review or in workflow.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{requests.length} total</span>
        </div>
        {requests.length === 0 ? (
          <div className="text-sm text-muted-foreground">No translation requests found.</div>
        ) : (
          <div className="space-y-2">
            {requests.map((request) => (
              <div
                key={request.id}
                className="rounded-lg border border-border bg-card px-3 py-2 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {request.namespace}.{request.key}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Locale: {request.locale} · Status: {request.status}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {request.status === 'pending' || request.status === 'in_review' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelRequest(request.id)}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

export default LocalizationStudioPage;
