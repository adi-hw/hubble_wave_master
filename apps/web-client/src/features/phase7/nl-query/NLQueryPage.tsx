import { useState, useEffect } from 'react';
import {
  Search,
  Play,
  Save,
  History,
  Bookmark,
  Trash2,
  ChevronDown,
  ChevronUp,
  Code,
  Table,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  nlQueryApi,
  NLQueryResult,
  SavedQuery,
} from '../../../services/phase7Api';

export const NLQueryPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<NLQueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSQL, setShowSQL] = useState(false);
  const [history, setHistory] = useState<NLQueryResult[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [examples, setExamples] = useState<Array<{ query: string; description: string }>>([]);
  const [activeTab, setActiveTab] = useState<'results' | 'history' | 'saved'>('results');
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');

  useEffect(() => {
    loadHistory();
    loadSavedQueries();
    loadExamples();
    loadSuggestions();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await nlQueryApi.getHistory(20);
      setHistory(response.history);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const loadSavedQueries = async () => {
    try {
      const response = await nlQueryApi.getSavedQueries(true);
      setSavedQueries(response.queries);
    } catch (error) {
      console.error('Failed to load saved queries:', error);
    }
  };

  const loadExamples = async () => {
    try {
      const response = await nlQueryApi.getExamples();
      setExamples(response.examples);
    } catch (error) {
      console.error('Failed to load examples:', error);
    }
  };

  const loadSuggestions = async () => {
    try {
      const response = await nlQueryApi.suggestQueries();
      setSuggestions(response.suggestions);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  const handleExecuteQuery = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await nlQueryApi.executeQuery(query);
      setResult(response);
      setActiveTab('results');
      loadHistory();
    } catch (error) {
      console.error('Failed to execute query:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuery = async () => {
    if (!saveName.trim() || !query.trim()) return;

    try {
      await nlQueryApi.saveQuery(saveName, query, saveDescription);
      setSaveModalOpen(false);
      setSaveName('');
      setSaveDescription('');
      loadSavedQueries();
    } catch (error) {
      console.error('Failed to save query:', error);
    }
  };

  const handleDeleteSavedQuery = async (id: string) => {
    try {
      await nlQueryApi.deleteSavedQuery(id);
      loadSavedQueries();
    } catch (error) {
      console.error('Failed to delete query:', error);
    }
  };

  const handleUseSavedQuery = (savedQuery: SavedQuery) => {
    setQuery(savedQuery.query);
    setActiveTab('results');
  };

  const handleUseHistoryQuery = (historyItem: NLQueryResult) => {
    setQuery(historyItem.naturalLanguage);
    setActiveTab('results');
  };

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          Natural Language Query
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask questions about your data in plain English
        </p>
      </div>

      {/* Query Input */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExecuteQuery()}
              placeholder="e.g., Show me all work orders created this month with high priority"
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-background text-foreground text-base"
            />
          </div>
          <button
            onClick={handleExecuteQuery}
            disabled={loading || !query.trim()}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              loading
                ? 'bg-muted text-muted-foreground'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {loading ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <Play className="h-5 w-5" />
            )}
            Run Query
          </button>
          <button
            onClick={() => setSaveModalOpen(true)}
            disabled={!query.trim()}
            className="p-3 rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted hover:shadow-sm"
            title="Save query"
          >
            <Save className="h-5 w-5" />
          </button>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && !query && (
          <div className="mt-4">
            <p className="text-xs font-medium mb-2 text-muted-foreground">
              Suggestions
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.slice(0, 4).map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => setQuery(suggestion)}
                  className="px-3 py-1.5 rounded-lg text-sm bg-muted text-muted-foreground transition-colors hover:bg-muted/80"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-4">
        {[
          { id: 'results', label: 'Results', icon: Table },
          { id: 'history', label: 'History', icon: History },
          { id: 'saved', label: 'Saved Queries', icon: Bookmark },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'results' && (
          <div className="space-y-4">
            {result ? (
              <>
                {/* SQL Preview */}
                {result.generatedSQL && (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <button
                      onClick={() => setShowSQL(!showSQL)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        Generated SQL
                      </div>
                      {showSQL ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {showSQL && (
                      <div className="px-4 py-3 border-t border-border/50 bg-background font-mono text-sm text-foreground overflow-x-auto">
                        <pre>{result.generatedSQL}</pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Results Table */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {result.rowCount} rows • {result.executionTime}ms
                    </span>
                  </div>
                  {(result.results?.length ?? 0) > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-background">
                            {Object.keys(result.results?.[0] ?? {}).map((key) => (
                              <th
                                key={key}
                                className="px-4 py-2 text-left text-sm font-medium text-muted-foreground"
                              >
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(result.results ?? []).map((row, i) => (
                            <tr
                              key={i}
                              className="border-t border-border/50"
                            >
                              {Object.values(row).map((value, j) => (
                                <td
                                  key={j}
                                  className="px-4 py-2 text-sm text-foreground"
                                >
                                  {String(value ?? '-')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <p className="text-muted-foreground">No results found</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium text-foreground">
                  Ask a question about your data
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Type a natural language query above and click Run Query
                </p>

                {/* Examples */}
                {examples.length > 0 && (
                  <div className="mt-8 max-w-2xl mx-auto">
                    <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                      Example queries
                    </h3>
                    <div className="space-y-2">
                      {examples.slice(0, 5).map((example, i) => (
                        <button
                          key={i}
                          onClick={() => setQuery(example.query)}
                          className="w-full text-left p-3 rounded-lg border border-border bg-card transition-colors hover:bg-muted hover:shadow-sm"
                        >
                          <p className="text-sm font-medium text-foreground">
                            {example.query}
                          </p>
                          <p className="text-xs mt-1 text-muted-foreground">
                            {example.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-2">
            {history.length === 0 ? (
              <div className="text-center py-12">
                <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No query history yet</p>
              </div>
            ) : (
              history.map((item) => (
                <button
                  key={item.queryId}
                  onClick={() => handleUseHistoryQuery(item)}
                  className="w-full text-left p-4 rounded-lg border border-border bg-card transition-colors hover:bg-muted hover:shadow-sm"
                >
                  <p className="font-medium text-foreground">
                    {item.naturalLanguage}
                  </p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{item.rowCount} rows</span>
                    <span>{item.executionTime}ms</span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="space-y-2">
            {savedQueries.length === 0 ? (
              <div className="text-center py-12">
                <Bookmark className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No saved queries yet</p>
              </div>
            ) : (
              savedQueries.map((saved) => (
                <div
                  key={saved.id}
                  className="p-4 rounded-lg border border-border bg-card flex items-center justify-between"
                >
                  <button
                    onClick={() => handleUseSavedQuery(saved)}
                    className="flex-1 text-left"
                  >
                    <p className="font-medium text-foreground">
                      {saved.name}
                    </p>
                    <p className="text-sm mt-1 text-muted-foreground">
                      {saved.query}
                    </p>
                    {saved.description && (
                      <p className="text-xs mt-1 text-muted-foreground/70">
                        {saved.description}
                      </p>
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteSavedQuery(saved.id)}
                    className="p-2 rounded-lg bg-muted hover:bg-destructive/10 transition-colors ml-4"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Save Modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 bg-overlay/50 flex items-center justify-center z-50">
          <div className="w-full max-w-md rounded-xl p-6 bg-card">
            <h2 className="text-lg font-semibold mb-4 text-foreground">
              Save Query
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Name
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Description (optional)
                </label>
                <textarea
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Query
                </label>
                <div className="px-3 py-2 rounded-lg text-sm bg-background text-foreground">
                  {query}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setSaveModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-muted text-foreground hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuery}
                disabled={!saveName.trim()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NLQueryPage;
