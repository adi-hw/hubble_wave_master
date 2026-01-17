import { useState, useEffect } from 'react';
import {
  Boxes,
  Sparkles,
  Play,
  Trash2,
  ExternalLink,
  Search,
  Grid3X3,
  List,
  Database,
  Layout,
  Zap,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
} from 'lucide-react';
import {
  appBuilderApi,
  GeneratedApp,
  AppStatus,
} from '../../../services/phase7Api';

const statusConfig: Record<AppStatus, { icon: React.ElementType; colorClass: string; bgClass: string }> = {
  draft: { icon: Clock, colorClass: 'text-muted-foreground', bgClass: 'bg-muted' },
  generating: { icon: Sparkles, colorClass: 'text-info-text', bgClass: 'bg-info-subtle' },
  ready: { icon: CheckCircle2, colorClass: 'text-success-text', bgClass: 'bg-success-subtle' },
  deployed: { icon: Play, colorClass: 'text-primary', bgClass: 'bg-primary/10' },
  error: { icon: AlertTriangle, colorClass: 'text-destructive', bgClass: 'bg-destructive/10' },
};

export const AppBuilderPage: React.FC = () => {
  const [apps, setApps] = useState<GeneratedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedApp, setSelectedApp] = useState<GeneratedApp | null>(null);

  const [newAppName, setNewAppName] = useState('');
  const [newAppDescription, setNewAppDescription] = useState('');
  const [newAppPrompt, setNewAppPrompt] = useState('');

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    setLoading(true);
    try {
      const response = await appBuilderApi.getApps();
      setApps(response.apps);
    } catch (error) {
      console.error('Failed to load apps:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateApp = async () => {
    if (!newAppPrompt.trim()) return;
    setGenerating(true);
    try {
      await appBuilderApi.generateApp({
        name: newAppName || 'New App',
        description: newAppDescription,
        prompt: newAppPrompt,
      });
      setShowCreateModal(false);
      setNewAppName('');
      setNewAppDescription('');
      setNewAppPrompt('');
      loadApps();
    } catch (error) {
      console.error('Failed to generate app:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeployApp = async (appId: string) => {
    try {
      await appBuilderApi.deployApp(appId);
      loadApps();
    } catch (error) {
      console.error('Failed to deploy app:', error);
    }
  };

  const handleDeleteApp = async (appId: string) => {
    try {
      await appBuilderApi.deleteApp(appId);
      loadApps();
    } catch (error) {
      console.error('Failed to delete app:', error);
    }
  };

  const filteredApps = apps.filter(app =>
    app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Zero-Code App Builder
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate complete applications from natural language descriptions
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Sparkles className="h-4 w-4" />
          Create New App
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl border bg-card border-border">
          <div className="flex items-center gap-2 mb-2">
            <Boxes className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">Total Apps</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">{apps.length}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card border-border">
          <div className="flex items-center gap-2 mb-2">
            <Play className="h-4 w-4 text-success-text" />
            <span className="text-sm text-muted-foreground">Deployed</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">
            {apps.filter(a => a.status === 'deployed').length}
          </p>
        </div>
        <div className="p-4 rounded-xl border bg-card border-border">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-info-text" />
            <span className="text-sm text-muted-foreground">Ready</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">
            {apps.filter(a => a.status === 'ready').length}
          </p>
        </div>
        <div className="p-4 rounded-xl border bg-card border-border">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-warning-text" />
            <span className="text-sm text-muted-foreground">Generating</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">
            {apps.filter(a => a.status === 'generating').length}
          </p>
        </div>
      </div>

      {/* Search & View Toggle */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search apps..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex items-center rounded-lg border p-1 bg-card border-border">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-muted' : 'hover:bg-muted/50'}`}
          >
            <Grid3X3 className="h-4 w-4 text-foreground" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded transition-colors ${viewMode === 'list' ? 'bg-muted' : 'hover:bg-muted/50'}`}
          >
            <List className="h-4 w-4 text-foreground" />
          </button>
        </div>
      </div>

      {/* Apps Grid/List */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className={`${viewMode === 'grid' ? 'grid grid-cols-3 gap-4' : 'space-y-3'}`}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div
                key={i}
                className={`animate-pulse rounded-xl bg-muted ${viewMode === 'grid' ? 'h-48' : 'h-20'}`}
              />
            ))}
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="rounded-xl border p-12 text-center bg-card border-border">
            <Boxes className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-xl font-medium mb-2 text-foreground">
              {searchQuery ? 'No apps found' : 'No apps yet'}
            </p>
            <p className="text-sm mb-6 text-muted-foreground">
              {searchQuery ? 'Try a different search term' : 'Create your first app with AI'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Sparkles className="h-4 w-4" />
                Create Your First App
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-3 gap-4">
            {filteredApps.map(app => (
              <AppCard
                key={app.id}
                app={app}
                onDeploy={() => handleDeployApp(app.id)}
                onDelete={() => handleDeleteApp(app.id)}
                onSelect={() => setSelectedApp(app)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredApps.map(app => (
              <AppListItem
                key={app.id}
                app={app}
                onDeploy={() => handleDeployApp(app.id)}
                onDelete={() => handleDeleteApp(app.id)}
                onSelect={() => setSelectedApp(app)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-overlay/50 flex items-center justify-center z-50">
          <div className="w-full max-w-lg rounded-2xl p-6 bg-card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">
                Create New App
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="hover:opacity-70 transition-opacity">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  App Name
                </label>
                <input
                  type="text"
                  value={newAppName}
                  onChange={(e) => setNewAppName(e.target.value)}
                  placeholder="My New App"
                  className="w-full px-3 py-2 rounded-lg border bg-background border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Description
                </label>
                <input
                  type="text"
                  value={newAppDescription}
                  onChange={(e) => setNewAppDescription(e.target.value)}
                  placeholder="Brief description of your app"
                  className="w-full px-3 py-2 rounded-lg border bg-background border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Describe your app *
                </label>
                <textarea
                  value={newAppPrompt}
                  onChange={(e) => setNewAppPrompt(e.target.value)}
                  placeholder="Describe what you want your app to do in natural language. For example: 'Create a customer relationship management system with contact tracking, deal pipeline, and activity logging.'"
                  rows={5}
                  className="w-full px-3 py-2 rounded-lg border resize-none bg-background border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg border font-medium border-border text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateApp}
                  disabled={!newAppPrompt.trim() || generating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <>
                      <Sparkles className="h-4 w-4 animate-pulse" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate App
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* App Details Modal */}
      {selectedApp && (
        <div className="fixed inset-0 bg-overlay/50 flex items-center justify-center z-50">
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden bg-card">
            <div className="px-6 py-4 border-b flex items-center justify-between border-border">
              <h2 className="text-xl font-semibold text-foreground">
                {selectedApp.name}
              </h2>
              <button onClick={() => setSelectedApp(null)} className="hover:opacity-70 transition-opacity">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <p className="text-sm text-muted-foreground">
                  {selectedApp.description}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-background">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      Collections
                    </span>
                  </div>
                  <p className="text-2xl font-semibold text-foreground">
                    {selectedApp.generatedArtifacts?.collections || 0}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-background">
                  <div className="flex items-center gap-2 mb-2">
                    <Layout className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      Views
                    </span>
                  </div>
                  <p className="text-2xl font-semibold text-foreground">
                    {selectedApp.generatedArtifacts?.views || 0}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-background">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      Automations
                    </span>
                  </div>
                  <p className="text-2xl font-semibold text-foreground">
                    {selectedApp.generatedArtifacts?.automations || 0}
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-background">
                <h3 className="text-sm font-medium mb-2 text-muted-foreground">
                  Original Prompt
                </h3>
                <p className="text-sm text-foreground">
                  {selectedApp.prompt}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {selectedApp.status === 'ready' && (
                  <button
                    onClick={() => { handleDeployApp(selectedApp.id); setSelectedApp(null); }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Play className="h-4 w-4" />
                    Deploy App
                  </button>
                )}
                {selectedApp.status === 'deployed' && (
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium bg-success-subtle text-success-text hover:bg-success-subtle">
                    <ExternalLink className="h-4 w-4" />
                    Open App
                  </button>
                )}
                <button
                  onClick={() => { handleDeleteApp(selectedApp.id); setSelectedApp(null); }}
                  className="px-4 py-2 rounded-lg font-medium bg-destructive/10 text-destructive hover:bg-destructive/20"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface AppCardProps {
  app: GeneratedApp;
  onDeploy: () => void;
  onDelete: () => void;
  onSelect: () => void;
}

const AppCard: React.FC<AppCardProps> = ({ app, onSelect }) => {
  const status = statusConfig[app.status];
  const StatusIcon = status.icon;

  return (
    <div
      onClick={onSelect}
      className="p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md bg-card border-border hover:border-primary/50"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Boxes className="h-6 w-6 text-primary" />
        </div>
        <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs capitalize ${status.bgClass} ${status.colorClass}`}>
          <StatusIcon className="h-3 w-3" />
          {app.status}
        </span>
      </div>
      <h3 className="font-medium mb-1 text-foreground">
        {app.name}
      </h3>
      <p className="text-sm line-clamp-2 mb-4 text-muted-foreground">
        {app.description}
      </p>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Database className="h-3 w-3" />
          {app.generatedArtifacts?.collections || 0}
        </span>
        <span className="flex items-center gap-1">
          <Layout className="h-3 w-3" />
          {app.generatedArtifacts?.views || 0}
        </span>
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          {app.generatedArtifacts?.automations || 0}
        </span>
      </div>
    </div>
  );
};

interface AppListItemProps {
  app: GeneratedApp;
  onDeploy: () => void;
  onDelete: () => void;
  onSelect: () => void;
}

const AppListItem: React.FC<AppListItemProps> = ({ app, onSelect }) => {
  const status = statusConfig[app.status];
  const StatusIcon = status.icon;

  return (
    <div
      onClick={onSelect}
      className="p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md flex items-center gap-4 bg-card border-border hover:border-primary/50"
    >
      <div className="p-2 rounded-lg shrink-0 bg-primary/10">
        <Boxes className="h-6 w-6 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-foreground">
          {app.name}
        </h3>
        <p className="text-sm truncate text-muted-foreground">
          {app.description}
        </p>
      </div>
      <div className="flex items-center gap-4 text-xs shrink-0 text-muted-foreground">
        <span className="flex items-center gap-1">
          <Database className="h-3 w-3" />
          {app.generatedArtifacts?.collections || 0}
        </span>
        <span className="flex items-center gap-1">
          <Layout className="h-3 w-3" />
          {app.generatedArtifacts?.views || 0}
        </span>
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          {app.generatedArtifacts?.automations || 0}
        </span>
      </div>
      <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs capitalize shrink-0 ${status.bgClass} ${status.colorClass}`}>
        <StatusIcon className="h-3 w-3" />
        {app.status}
      </span>
    </div>
  );
};

export default AppBuilderPage;
