import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlassCard } from '../../components/ui/glass/GlassCard';
import { schemaService } from '../../services/schema';
import { useToastHelpers } from '../../components/ui/Toast';
import {
  SearchDictionary,
  SearchExperience,
  SearchIndexState,
  SearchSource,
  createSearchDictionary,
  createSearchExperience,
  createSearchSource,
  listSearchDictionaries,
  listSearchExperiences,
  listSearchIndexState,
  listSearchSources,
  reindexSearch,
  updateSearchDictionary,
  updateSearchExperience,
  updateSearchSource,
} from '../../services/searchStudio.service';

type CollectionOption = { code: string; label: string };

type JsonInputState = {
  text: string;
  error: string | null;
};

const defaultConfig: JsonInputState = { text: '{\n  \n}', error: null };
const defaultEntries: JsonInputState = { text: '[\n  \n]', error: null };

export function SearchStudioPage() {
  const { success: showSuccess, error: showError } = useToastHelpers();
  const toastRef = useRef({ showSuccess, showError });
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [experiences, setExperiences] = useState<SearchExperience[]>([]);
  const [sources, setSources] = useState<SearchSource[]>([]);
  const [dictionaries, setDictionaries] = useState<SearchDictionary[]>([]);
  const [indexState, setIndexState] = useState<SearchIndexState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [experienceForm, setExperienceForm] = useState({
    code: '',
    name: '',
    description: '',
    scope: 'instance' as SearchExperience['scope'],
    scopeKey: '',
  });
  const [experienceConfig, setExperienceConfig] = useState<JsonInputState>(defaultConfig);
  const [editingExperience, setEditingExperience] = useState<string | null>(null);

  const [sourceForm, setSourceForm] = useState({
    code: '',
    name: '',
    description: '',
    collectionCode: '',
  });
  const [sourceConfig, setSourceConfig] = useState<JsonInputState>(defaultConfig);
  const [editingSource, setEditingSource] = useState<string | null>(null);

  const [dictionaryForm, setDictionaryForm] = useState({
    code: '',
    name: '',
    locale: 'en',
  });
  const [dictionaryEntries, setDictionaryEntries] = useState<JsonInputState>(defaultEntries);
  const [editingDictionary, setEditingDictionary] = useState<string | null>(null);

  const [reindexSources, setReindexSources] = useState('');
  const [reindexCollections, setReindexCollections] = useState('');

  const upsertByCode = useCallback(<T extends { code: string }>(list: T[], item: T) => {
    const index = list.findIndex((entry) => entry.code === item.code);
    if (index >= 0) {
      const updated = [...list];
      updated[index] = item;
      return updated;
    }
    return [item, ...list];
  }, []);

  useEffect(() => {
    toastRef.current = { showSuccess, showError };
  }, [showSuccess, showError]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [collectionData, experienceData, sourceData, dictionaryData, indexData] =
        await Promise.all([
          schemaService.getCollections({ includeSystem: false }),
          listSearchExperiences(),
          listSearchSources(),
          listSearchDictionaries(),
          listSearchIndexState(),
        ]);
      setCollections(
        collectionData.map((collection) => ({
          code: collection.code,
          label: collection.label,
        })),
      );
      setExperiences(experienceData);
      setSources(sourceData);
      setDictionaries(dictionaryData);
      setIndexState(indexData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load search studio data';
      setError(message);
      toastRef.current.showError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const parseJson = useCallback((value: JsonInputState, emptyFallback: Record<string, unknown> | Array<unknown>) => {
    if (!value.text.trim()) {
      return emptyFallback;
    }
    try {
      const parsed = JSON.parse(value.text);
      if (typeof parsed !== 'object' || parsed === null) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const handleExperienceSubmit = useCallback(async () => {
    const config = parseJson(experienceConfig, {});
    if (config === null || Array.isArray(config)) {
      setExperienceConfig((prev) => ({ ...prev, error: 'Config must be a JSON object.' }));
      return;
    }
    setExperienceConfig((prev) => ({ ...prev, error: null }));

    if (!experienceForm.code || !experienceForm.name) {
      setExperienceConfig((prev) => ({ ...prev, error: 'Code and name are required.' }));
      return;
    }

    const payload = {
      code: experienceForm.code.trim(),
      name: experienceForm.name.trim(),
      description: experienceForm.description.trim() || null,
      scope: experienceForm.scope,
      scopeKey: experienceForm.scopeKey.trim() || null,
      config,
    };

    try {
      if (editingExperience) {
        const updated = await updateSearchExperience(editingExperience, {
          name: payload.name,
          description: payload.description,
          scope: payload.scope,
          scopeKey: payload.scopeKey,
          config: payload.config,
        });
        setExperiences((prev) => upsertByCode(prev, updated));
        showSuccess(`Updated ${payload.code}`);
      } else {
        const created = await createSearchExperience(payload);
        setExperiences((prev) => upsertByCode(prev, created));
        showSuccess(`Created ${payload.code}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Experience save failed';
      showError(message);
      return;
    }

    setEditingExperience(null);
    setExperienceForm({ code: '', name: '', description: '', scope: 'instance', scopeKey: '' });
    setExperienceConfig(defaultConfig);
  }, [
    editingExperience,
    experienceConfig,
    experienceForm,
    parseJson,
    showError,
    showSuccess,
    upsertByCode,
  ]);

  const handleSourceSubmit = useCallback(async () => {
    const config = parseJson(sourceConfig, {});
    if (config === null || Array.isArray(config)) {
      setSourceConfig((prev) => ({ ...prev, error: 'Config must be a JSON object.' }));
      return;
    }
    setSourceConfig((prev) => ({ ...prev, error: null }));

    if (!sourceForm.code || !sourceForm.name || !sourceForm.collectionCode) {
      setSourceConfig((prev) => ({ ...prev, error: 'Code, name, and collection are required.' }));
      return;
    }

    const payload = {
      code: sourceForm.code.trim(),
      name: sourceForm.name.trim(),
      description: sourceForm.description.trim() || null,
      collectionCode: sourceForm.collectionCode,
      config,
    };

    try {
      if (editingSource) {
        const updated = await updateSearchSource(editingSource, {
          name: payload.name,
          description: payload.description,
          collectionCode: payload.collectionCode,
          config: payload.config,
        });
        setSources((prev) => upsertByCode(prev, updated));
        showSuccess(`Updated ${payload.code}`);
      } else {
        const created = await createSearchSource(payload);
        setSources((prev) => upsertByCode(prev, created));
        showSuccess(`Created ${payload.code}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Source save failed';
      showError(message);
      return;
    }

    setEditingSource(null);
    setSourceForm({ code: '', name: '', description: '', collectionCode: '' });
    setSourceConfig(defaultConfig);
  }, [
    editingSource,
    parseJson,
    showError,
    showSuccess,
    sourceConfig,
    sourceForm,
    upsertByCode,
  ]);

  const handleDictionarySubmit = useCallback(async () => {
    const entries = parseJson(dictionaryEntries, []);
    if (entries === null || !Array.isArray(entries)) {
      setDictionaryEntries((prev) => ({ ...prev, error: 'Entries must be a JSON array.' }));
      return;
    }
    setDictionaryEntries((prev) => ({ ...prev, error: null }));

    if (!dictionaryForm.code || !dictionaryForm.name) {
      setDictionaryEntries((prev) => ({ ...prev, error: 'Code and name are required.' }));
      return;
    }

    const payload = {
      code: dictionaryForm.code.trim(),
      name: dictionaryForm.name.trim(),
      locale: dictionaryForm.locale.trim() || 'en',
      entries: entries as Array<{ term: string; synonyms: string[] }>,
    };

    try {
      if (editingDictionary) {
        const updated = await updateSearchDictionary(editingDictionary, {
          name: payload.name,
          locale: payload.locale,
          entries: payload.entries,
        });
        setDictionaries((prev) => upsertByCode(prev, updated));
        showSuccess(`Updated ${payload.code}`);
      } else {
        const created = await createSearchDictionary(payload);
        setDictionaries((prev) => upsertByCode(prev, created));
        showSuccess(`Created ${payload.code}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Dictionary save failed';
      showError(message);
      return;
    }

    setEditingDictionary(null);
    setDictionaryForm({ code: '', name: '', locale: 'en' });
    setDictionaryEntries(defaultEntries);
  }, [
    dictionaryEntries,
    dictionaryForm,
    editingDictionary,
    parseJson,
    showError,
    showSuccess,
    upsertByCode,
  ]);

  const handleReindex = useCallback(async () => {
    const sourceCodes = reindexSources
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const collectionCodes = reindexCollections
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const confirmed = window.confirm(
      'Run reindex now? This queues records for search indexing.',
    );
    if (!confirmed) {
      return;
    }

    try {
      const result = await reindexSearch({
        sourceCodes: sourceCodes.length ? sourceCodes : undefined,
        collectionCodes: collectionCodes.length ? collectionCodes : undefined,
      });
      showSuccess(`Queued ${result.queued} records across ${result.collections} collections.`);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reindex failed';
      showError(message);
    }
  }, [loadData, reindexCollections, reindexSources, showError, showSuccess]);

  const sortedCollections = useMemo(() => {
    return [...collections].sort((a, b) => a.label.localeCompare(b.label));
  }, [collections]);

  const renderIndexStats = useCallback((state: SearchIndexState) => {
    const stats = state.stats || {};
    const queued = typeof stats.queued === 'number' ? stats.queued : null;
    const lastQueuedAt = typeof stats.lastQueuedAt === 'string' ? stats.lastQueuedAt : null;
    const lastEventType = typeof stats.lastEventType === 'string' ? stats.lastEventType : null;
    const error = typeof stats.error === 'string' ? stats.error : null;
    const sources = Array.isArray(stats.reindexSources)
      ? stats.reindexSources.map(String).join(', ')
      : null;

    if (!queued && !lastQueuedAt && !lastEventType && !error && !sources) {
      return null;
    }

    return (
      <div className="search-card__stats">
        {sources && <span>Sources: {sources}</span>}
        {queued !== null && <span>Queued: {queued}</span>}
        {lastEventType && <span>Last event: {lastEventType}</span>}
        {lastQueuedAt && (
          <span>Last queued: {new Date(lastQueuedAt).toLocaleString()}</span>
        )}
        {error && <span className="search-card__stats-error">Error: {error}</span>}
      </div>
    );
  }, []);

  if (loading) {
    return <div className="search-studio__loading">Loading search studio...</div>;
  }

  return (
    <div className="search-studio">
      <header className="search-studio__header">
        <div>
          <h1>Search Studio</h1>
          <p>Configure search experiences, sources, dictionaries, and indexing.</p>
        </div>
        <button className="button button--secondary" onClick={loadData}>
          Refresh
        </button>
      </header>

      {error && <div className="search-studio__error">{error}</div>}

      <div className="search-studio__grid">
        <GlassCard className="search-card">
          <h2>Search Experiences</h2>
          <div className="search-card__list">
            {experiences.length === 0 ? (
              <div className="search-card__empty">No search experiences defined.</div>
            ) : (
              experiences.map((experience) => (
                <div key={experience.code} className="search-card__row">
                  <div>
                    <div className="search-card__row-title">{experience.name}</div>
                    <div className="search-card__row-meta">
                      {experience.code} - {experience.scope}
                      {experience.scopeKey ? `:${experience.scopeKey}` : ''}
                    </div>
                  </div>
                  <button
                    className="button button--ghost"
                    onClick={() => {
                      setEditingExperience(experience.code);
                      setExperienceForm({
                        code: experience.code,
                        name: experience.name,
                        description: experience.description || '',
                        scope: experience.scope,
                        scopeKey: experience.scopeKey || '',
                      });
                      setExperienceConfig({
                        text: JSON.stringify(experience.config || {}, null, 2),
                        error: null,
                      });
                    }}
                  >
                    Edit
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="search-card__form">
            <h3>{editingExperience ? 'Edit Experience' : 'Create Experience'}</h3>
            <div className="form-grid">
              <label>
                Code
                <input
                  value={experienceForm.code}
                  onChange={(e) => setExperienceForm((prev) => ({ ...prev, code: e.target.value }))}
                  disabled={!!editingExperience}
                />
              </label>
              <label>
                Name
                <input
                  value={experienceForm.name}
                  onChange={(e) => setExperienceForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label>
                Scope
                <select
                  value={experienceForm.scope}
                  onChange={(e) =>
                    setExperienceForm((prev) => ({
                      ...prev,
                      scope: e.target.value as SearchExperience['scope'],
                    }))
                  }
                >
                  <option value="system">System</option>
                  <option value="instance">Instance</option>
                  <option value="role">Role</option>
                  <option value="group">Group</option>
                  <option value="personal">Personal</option>
                </select>
              </label>
              <label>
                Scope Key
                <input
                  value={experienceForm.scopeKey}
                  onChange={(e) => setExperienceForm((prev) => ({ ...prev, scopeKey: e.target.value }))}
                  placeholder="Optional"
                />
              </label>
            </div>
            <label>
              Description
              <input
                value={experienceForm.description}
                onChange={(e) =>
                  setExperienceForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </label>
            <label>
              Config (JSON)
              <textarea
                rows={6}
                value={experienceConfig.text}
                onChange={(e) => setExperienceConfig({ text: e.target.value, error: null })}
              />
            </label>
            {experienceConfig.error && (
              <div className="form-error">{experienceConfig.error}</div>
            )}
            <div className="form-actions">
              <button className="button button--primary" onClick={handleExperienceSubmit}>
                {editingExperience ? 'Save Experience' : 'Create Experience'}
              </button>
              {editingExperience && (
                <button
                  className="button button--secondary"
                  onClick={() => {
                    setEditingExperience(null);
                    setExperienceForm({
                      code: '',
                      name: '',
                      description: '',
                      scope: 'instance',
                      scopeKey: '',
                    });
                    setExperienceConfig(defaultConfig);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="search-card">
          <h2>Search Sources</h2>
          <div className="search-card__list">
            {sources.length === 0 ? (
              <div className="search-card__empty">No search sources defined.</div>
            ) : (
              sources.map((source) => (
                <div key={source.code} className="search-card__row">
                  <div>
                    <div className="search-card__row-title">{source.name}</div>
                    <div className="search-card__row-meta">
                      {source.code} - {source.collectionCode}
                    </div>
                  </div>
                  <button
                    className="button button--ghost"
                    onClick={() => {
                      setEditingSource(source.code);
                      setSourceForm({
                        code: source.code,
                        name: source.name,
                        description: source.description || '',
                        collectionCode: source.collectionCode,
                      });
                      setSourceConfig({
                        text: JSON.stringify(source.config || {}, null, 2),
                        error: null,
                      });
                    }}
                  >
                    Edit
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="search-card__form">
            <h3>{editingSource ? 'Edit Source' : 'Create Source'}</h3>
            <div className="form-grid">
              <label>
                Code
                <input
                  value={sourceForm.code}
                  onChange={(e) => setSourceForm((prev) => ({ ...prev, code: e.target.value }))}
                  disabled={!!editingSource}
                />
              </label>
              <label>
                Name
                <input
                  value={sourceForm.name}
                  onChange={(e) => setSourceForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label>
                Collection
                <select
                  value={sourceForm.collectionCode}
                  onChange={(e) =>
                    setSourceForm((prev) => ({ ...prev, collectionCode: e.target.value }))
                  }
                >
                  <option value="">Select collection</option>
                  {sortedCollections.map((collection) => (
                    <option key={collection.code} value={collection.code}>
                      {collection.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Description
              <input
                value={sourceForm.description}
                onChange={(e) =>
                  setSourceForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </label>
            <label>
              Config (JSON)
              <textarea
                rows={6}
                value={sourceConfig.text}
                onChange={(e) => setSourceConfig({ text: e.target.value, error: null })}
              />
            </label>
            {sourceConfig.error && <div className="form-error">{sourceConfig.error}</div>}
            <div className="form-actions">
              <button className="button button--primary" onClick={handleSourceSubmit}>
                {editingSource ? 'Save Source' : 'Create Source'}
              </button>
              {editingSource && (
                <button
                  className="button button--secondary"
                  onClick={() => {
                    setEditingSource(null);
                    setSourceForm({ code: '', name: '', description: '', collectionCode: '' });
                    setSourceConfig(defaultConfig);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="search-card">
          <h2>Search Dictionaries</h2>
          <div className="search-card__list">
            {dictionaries.length === 0 ? (
              <div className="search-card__empty">No dictionaries defined.</div>
            ) : (
              dictionaries.map((dictionary) => (
                <div key={dictionary.code} className="search-card__row">
                  <div>
                    <div className="search-card__row-title">{dictionary.name}</div>
                    <div className="search-card__row-meta">
                      {dictionary.code} - {dictionary.locale || 'en'}
                    </div>
                  </div>
                  <button
                    className="button button--ghost"
                    onClick={() => {
                      setEditingDictionary(dictionary.code);
                      setDictionaryForm({
                        code: dictionary.code,
                        name: dictionary.name,
                        locale: dictionary.locale || 'en',
                      });
                      setDictionaryEntries({
                        text: JSON.stringify(dictionary.entries || [], null, 2),
                        error: null,
                      });
                    }}
                  >
                    Edit
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="search-card__form">
            <h3>{editingDictionary ? 'Edit Dictionary' : 'Create Dictionary'}</h3>
            <div className="form-grid">
              <label>
                Code
                <input
                  value={dictionaryForm.code}
                  onChange={(e) =>
                    setDictionaryForm((prev) => ({ ...prev, code: e.target.value }))
                  }
                  disabled={!!editingDictionary}
                />
              </label>
              <label>
                Name
                <input
                  value={dictionaryForm.name}
                  onChange={(e) =>
                    setDictionaryForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </label>
              <label>
                Locale
                <input
                  value={dictionaryForm.locale}
                  onChange={(e) =>
                    setDictionaryForm((prev) => ({ ...prev, locale: e.target.value }))
                  }
                />
              </label>
            </div>
            <label>
              Entries (JSON)
              <textarea
                rows={6}
                value={dictionaryEntries.text}
                onChange={(e) => setDictionaryEntries({ text: e.target.value, error: null })}
              />
            </label>
            {dictionaryEntries.error && (
              <div className="form-error">{dictionaryEntries.error}</div>
            )}
            <div className="form-actions">
              <button className="button button--primary" onClick={handleDictionarySubmit}>
                {editingDictionary ? 'Save Dictionary' : 'Create Dictionary'}
              </button>
              {editingDictionary && (
                <button
                  className="button button--secondary"
                  onClick={() => {
                    setEditingDictionary(null);
                    setDictionaryForm({ code: '', name: '', locale: 'en' });
                    setDictionaryEntries(defaultEntries);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="search-card">
          <h2>Index State</h2>
          <div className="search-card__list">
            {indexState.length === 0 ? (
              <div className="search-card__empty">No index state recorded.</div>
            ) : (
              indexState.map((state) => (
                <div key={state.id} className="search-card__row">
                  <div>
                    <div className="search-card__row-title">{state.collectionCode}</div>
                    <div className="search-card__row-meta">
                      Status: {state.status} - Last indexed:{' '}
                      {state.lastIndexedAt ? new Date(state.lastIndexedAt).toLocaleString() : 'never'}
                    </div>
                    {renderIndexStats(state)}
                  </div>
                  <div className="search-card__row-actions">
                    <div className="search-card__row-meta">
                      Cursor: {state.lastCursor || 'n/a'}
                    </div>
                    <button
                      className="button button--ghost button--small"
                      onClick={async () => {
                        const confirmed = window.confirm(
                          `Reindex ${state.collectionCode}? This will queue records for search indexing.`,
                        );
                        if (!confirmed) {
                          return;
                        }
                        try {
                          const result = await reindexSearch({
                            collectionCodes: [state.collectionCode],
                          });
                          showSuccess(`Queued ${result.queued} records for ${state.collectionCode}.`);
                          await loadData();
                        } catch (err) {
                          const message = err instanceof Error ? err.message : 'Reindex failed';
                          showError(message);
                        }
                      }}
                    >
                      Reindex
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        <GlassCard className="search-card">
          <h2>Reindex</h2>
          <p className="search-card__helper">
            Trigger a full reindex for selected sources or collections.
          </p>
          <label>
            Source codes (comma-separated)
            <input
              value={reindexSources}
              onChange={(e) => setReindexSources(e.target.value)}
              placeholder="work_items, offerings"
            />
          </label>
          <label>
            Collection codes (comma-separated)
            <input
              value={reindexCollections}
              onChange={(e) => setReindexCollections(e.target.value)}
              placeholder="work_items, offerings"
            />
          </label>
          <div className="form-actions">
            <button className="button button--primary" onClick={handleReindex}>
              Run Reindex
            </button>
          </div>
        </GlassCard>
      </div>

      <style>{`
        .search-studio {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .search-studio__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .search-studio__header h1 {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
        }

        .search-studio__header p {
          color: var(--text-secondary);
        }

        .search-studio__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1.5rem;
        }

        .search-card {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1.5rem;
        }

        .search-card h2 {
          font-size: 1.25rem;
          font-weight: 600;
        }

        .search-card__list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .search-card__row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          padding: 0.75rem 1rem;
          background: var(--bg-surface-secondary);
        }

        .search-card__row-title {
          font-weight: 600;
        }

        .search-card__row-meta {
          color: var(--text-secondary);
          font-size: 0.8rem;
        }

        .search-card__stats {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-top: 0.5rem;
          color: var(--text-secondary);
          font-size: 0.75rem;
        }

        .search-card__stats-error {
          color: var(--text-danger);
        }

        .search-card__row-actions {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          align-items: flex-end;
        }

        .button--small {
          padding: 0.4rem 0.75rem;
          font-size: 0.75rem;
        }

        .search-card__empty {
          padding: 0.75rem 1rem;
          border-radius: 10px;
          background: var(--bg-surface-secondary);
          color: var(--text-secondary);
        }

        .search-card__form {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 0.75rem;
        }

        label {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        input,
        select,
        textarea {
          border: 1px solid var(--border-default);
          background: var(--bg-surface);
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
          color: var(--text-primary);
          font-size: 0.9rem;
        }

        textarea {
          resize: vertical;
          min-height: 120px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
        }

        .form-actions {
          display: flex;
          gap: 0.75rem;
        }

        .form-error {
          color: var(--text-danger);
          font-size: 0.85rem;
        }

        .search-card__helper {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .search-studio__error,
        .search-studio__loading {
          padding: 1rem;
          border-radius: 8px;
          background: var(--bg-surface-secondary);
          color: var(--text-secondary);
        }

        .button {
          padding: 0.65rem 1.1rem;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
        }

        .button--primary {
          background: var(--gradient-brand);
          color: var(--text-on-primary);
        }

        .button--secondary {
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          color: var(--text-secondary);
        }

        .button--ghost {
          background: transparent;
          border: 1px solid var(--border-default);
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}
