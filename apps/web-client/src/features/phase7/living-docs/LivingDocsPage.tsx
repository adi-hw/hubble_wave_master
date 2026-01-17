import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import {
  Book,
  Search,
  RefreshCw,
  FileText,
  Database,
  GitBranch,
  Eye,
  Download,
  ChevronRight,
  Sparkles,
  History,
} from 'lucide-react';
import {
  livingDocsApi,
  GeneratedDoc,
} from '../../../services/phase7Api';

const artifactIcons: Record<string, React.ElementType> = {
  collection: Database,
  process_flow: GitBranch,
  view: Eye,
  automation: Sparkles,
};

export const LivingDocsPage: React.FC = () => {
  const [docs, setDocs] = useState<GeneratedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedDoc, setSelectedDoc] = useState<GeneratedDoc | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (searchQuery) {
      searchDocs();
    } else {
      loadDocs();
    }
  }, [searchQuery, typeFilter]);

  const loadDocs = async () => {
    setLoading(true);
    try {
      const response = await livingDocsApi.search('', typeFilter !== 'all' ? typeFilter : undefined, 50);
      setDocs(response.results);
    } catch (error) {
      console.error('Failed to load docs:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchDocs = async () => {
    setLoading(true);
    try {
      const response = await livingDocsApi.search(
        searchQuery,
        typeFilter !== 'all' ? typeFilter : undefined,
        50
      );
      setDocs(response.results);
    } catch (error) {
      console.error('Failed to search docs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async (doc: GeneratedDoc) => {
    setRegenerating(true);
    try {
      const response = await livingDocsApi.generateForArtifact(doc.artifactType, doc.artifactId);
      setSelectedDoc(response.documentation);
      loadDocs();
    } catch (error) {
      console.error('Failed to regenerate:', error);
    } finally {
      setRegenerating(false);
    }
  };

  const handleRegenerateAll = async () => {
    setRegenerating(true);
    try {
      await livingDocsApi.regenerateAll();
      loadDocs();
    } catch (error) {
      console.error('Failed to regenerate all:', error);
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (doc: GeneratedDoc) => {
    try {
      const response = await livingDocsApi.exportToMarkdown(doc.id);
      const blob = new Blob([response.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.title.toLowerCase().replace(/\s+/g, '-')}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Living Documentation
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Auto-generated, always up-to-date documentation
          </p>
        </div>
        <button
          onClick={handleRegenerateAll}
          disabled={regenerating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {regenerating ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Regenerate All
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documentation..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 rounded-lg border bg-card border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Types</option>
          <option value="collection">Collections</option>
          <option value="process_flow">Process Flows</option>
          <option value="view">Views</option>
          <option value="automation">Automations</option>
        </select>
      </div>

      {/* Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Docs List */}
        <div className="w-96 shrink-0 overflow-auto space-y-3">
          {loading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-24 rounded-xl bg-muted" />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="rounded-xl border p-8 text-center bg-card border-border">
              <Book className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground">
                No documentation found
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Generate documentation for your platform artifacts
              </p>
            </div>
          ) : (
            docs.map((doc) => {
              const Icon = artifactIcons[doc.artifactType] || FileText;
              const isSelected = selectedDoc?.id === doc.id;

              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all bg-card hover:bg-muted ${
                    isSelected ? 'ring-2 ring-offset-2 ring-primary border-primary' : 'border-border'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg shrink-0 bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate text-foreground">
                        {doc.title}
                      </h3>
                      <span className="inline-block px-2 py-0.5 rounded text-xs capitalize mt-1 bg-muted text-muted-foreground">
                        {doc.artifactType}
                      </span>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <History className="h-3 w-3" />
                          v{doc.version}
                        </span>
                        <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Doc Preview */}
        <div className="flex-1 rounded-xl border overflow-hidden flex flex-col bg-card border-border">
          {selectedDoc ? (
            <>
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {selectedDoc.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedDoc.artifactType} - Version {selectedDoc.version}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRegenerate(selectedDoc)}
                    disabled={regenerating}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-muted text-foreground hover:bg-muted/80 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
                    Regenerate
                  </button>
                  <button
                    onClick={() => handleExport(selectedDoc)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6">
                <div
                  className="prose prose-neutral dark:prose-invert max-w-none text-foreground"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedDoc.content) }}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Book className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Select a document to preview</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LivingDocsPage;
