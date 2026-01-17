import { useState, useEffect } from 'react';
import {
  Zap,
  GitBranch,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Play,
  RotateCcw,
  Users,
  Target,
  TrendingUp,
  Calendar,
  MoreVertical,
} from 'lucide-react';
import {
  agileDevApi,
  Sprint,
  UserStory,
} from '../../../services/phase7Api';

const priorityClasses: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'bg-danger-subtle', text: 'text-danger-text' },
  high: { bg: 'bg-warning-subtle', text: 'text-warning-text' },
  medium: { bg: 'bg-info-subtle', text: 'text-info-text' },
  low: { bg: 'bg-success-subtle', text: 'text-success-text' },
};

const statusIcons: Record<string, React.ElementType> = {
  planning: Clock,
  active: Play,
  completed: CheckCircle2,
  cancelled: AlertTriangle,
};

export const AgileDevPage: React.FC = () => {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [stories, setStories] = useState<UserStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null);
  const [, setShowCreateSprint] = useState(false);
  const [, setShowCreateStory] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadSprints();
  }, []);

  useEffect(() => {
    if (selectedSprint) {
      loadStories(selectedSprint.id);
    }
  }, [selectedSprint]);

  const loadSprints = async () => {
    setLoading(true);
    try {
      const response = await agileDevApi.getSprints();
      setSprints(response.sprints);
      if (response.sprints.length > 0 && !selectedSprint) {
        setSelectedSprint(response.sprints[0]);
      }
    } catch (error) {
      console.error('Failed to load sprints:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStories = async (sprintId: string) => {
    try {
      const response = await agileDevApi.getStories(sprintId);
      setStories(response.stories);
    } catch (error) {
      console.error('Failed to load stories:', error);
    }
  };

  const handleGenerateStories = async () => {
    if (!selectedSprint) return;
    setGenerating(true);
    try {
      await agileDevApi.generateStories(selectedSprint.id, 'Generate user stories based on sprint goals');
      loadStories(selectedSprint.id);
    } catch (error) {
      console.error('Failed to generate stories:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateStoryStatus = async (storyId: string, status: UserStory['status']) => {
    try {
      await agileDevApi.updateStory(storyId, { status });
      if (selectedSprint) {
        loadStories(selectedSprint.id);
      }
    } catch (error) {
      console.error('Failed to update story:', error);
    }
  };

  const getSprintProgress = (sprint: Sprint) => {
    const sprintStories = stories.filter(s => s.sprintId === sprint.id);
    if (sprintStories.length === 0) return 0;
    const completed = sprintStories.filter(s => s.status === 'done').length;
    return Math.round((completed / sprintStories.length) * 100);
  };

  const getSprintStats = () => {
    if (!selectedSprint) return { total: 0, todo: 0, inProgress: 0, done: 0, points: 0 };
    const sprintStories = stories;
    return {
      total: sprintStories.length,
      todo: sprintStories.filter(s => s.status === 'backlog' || s.status === 'todo').length,
      inProgress: sprintStories.filter(s => s.status === 'in_progress').length,
      done: sprintStories.filter(s => s.status === 'done').length,
      points: sprintStories.reduce((sum, s) => sum + (s.storyPoints || 0), 0),
    };
  };

  const stats = getSprintStats();

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Agile Development
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered sprint planning and story generation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerateStories}
            disabled={!selectedSprint || generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground disabled:opacity-50"
          >
            {generating ? (
              <RotateCcw className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Generate Stories
          </button>
          <button
            onClick={() => setShowCreateSprint(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium border border-border text-foreground hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
            New Sprint
          </button>
        </div>
      </div>

      {/* Sprint Stats */}
      {selectedSprint && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="p-4 rounded-xl border bg-card border-border">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total Stories</span>
            </div>
            <p className="text-2xl font-semibold text-foreground">{stats.total}</p>
          </div>
          <div className="p-4 rounded-xl border bg-card border-border">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">To Do</span>
            </div>
            <p className="text-2xl font-semibold text-foreground">{stats.todo}</p>
          </div>
          <div className="p-4 rounded-xl border bg-card border-border">
            <div className="flex items-center gap-2 mb-2">
              <Play className="h-4 w-4 text-info-text" />
              <span className="text-sm text-muted-foreground">In Progress</span>
            </div>
            <p className="text-2xl font-semibold text-foreground">{stats.inProgress}</p>
          </div>
          <div className="p-4 rounded-xl border bg-card border-border">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-success-text" />
              <span className="text-sm text-muted-foreground">Done</span>
            </div>
            <p className="text-2xl font-semibold text-foreground">{stats.done}</p>
          </div>
          <div className="p-4 rounded-xl border bg-card border-border">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-warning-text" />
              <span className="text-sm text-muted-foreground">Story Points</span>
            </div>
            <p className="text-2xl font-semibold text-foreground">{stats.points}</p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Sprints List */}
        <div className="w-80 shrink-0 overflow-auto space-y-3">
          <h2 className="text-sm font-medium mb-3 text-muted-foreground">Sprints</h2>
          {loading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-28 rounded-xl bg-muted" />
              ))}
            </div>
          ) : sprints.length === 0 ? (
            <div className="rounded-xl border p-6 text-center bg-card border-border">
              <GitBranch className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium text-foreground">No sprints yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first sprint to get started
              </p>
            </div>
          ) : (
            sprints.map((sprint) => {
              const StatusIcon = statusIcons[sprint.status] || Clock;
              const isSelected = selectedSprint?.id === sprint.id;
              const progress = getSprintProgress(sprint);

              return (
                <div
                  key={sprint.id}
                  onClick={() => setSelectedSprint(sprint)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all bg-card hover:border-primary/50 ${
                    isSelected ? 'ring-2 ring-offset-2 ring-primary border-primary' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-foreground">
                      {sprint.name}
                    </h3>
                    <span
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs capitalize ${
                        sprint.status === 'active'
                          ? 'bg-success-subtle text-success-text'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {sprint.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs mb-3 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden bg-muted">
                      <div
                        className="h-full rounded-full transition-all bg-primary"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Stories Board */}
        <div className="flex-1 rounded-xl border overflow-hidden flex flex-col bg-card border-border">
          {selectedSprint ? (
            <>
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {selectedSprint.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedSprint.goal}
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateStory(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-muted text-foreground hover:bg-muted/80"
                >
                  <Plus className="h-4 w-4" />
                  Add Story
                </button>
              </div>
              <div className="flex-1 overflow-auto p-6">
                {stories.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="font-medium text-foreground">No stories yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Generate stories with AI or add them manually
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4 h-full">
                    {/* To Do Column */}
                    <div className="flex flex-col">
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        To Do ({stories.filter(s => s.status === 'backlog' || s.status === 'todo').length})
                      </h3>
                      <div className="flex-1 space-y-3 overflow-auto">
                        {stories
                          .filter(s => s.status === 'backlog' || s.status === 'todo')
                          .map(story => (
                            <StoryCard
                              key={story.id}
                              story={story}
                              onStatusChange={handleUpdateStoryStatus}
                            />
                          ))}
                      </div>
                    </div>

                    {/* In Progress Column */}
                    <div className="flex flex-col">
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-info-text">
                        <Play className="h-4 w-4" />
                        In Progress ({stories.filter(s => s.status === 'in_progress').length})
                      </h3>
                      <div className="flex-1 space-y-3 overflow-auto">
                        {stories
                          .filter(s => s.status === 'in_progress')
                          .map(story => (
                            <StoryCard
                              key={story.id}
                              story={story}
                              onStatusChange={handleUpdateStoryStatus}
                            />
                          ))}
                      </div>
                    </div>

                    {/* Done Column */}
                    <div className="flex flex-col">
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-success-text">
                        <CheckCircle2 className="h-4 w-4" />
                        Done ({stories.filter(s => s.status === 'done').length})
                      </h3>
                      <div className="flex-1 space-y-3 overflow-auto">
                        {stories
                          .filter(s => s.status === 'done')
                          .map(story => (
                            <StoryCard
                              key={story.id}
                              story={story}
                              onStatusChange={handleUpdateStoryStatus}
                            />
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Select a sprint to view stories</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface StoryCardProps {
  story: UserStory;
  onStatusChange: (id: string, status: UserStory['status']) => void;
}

const StoryCard: React.FC<StoryCardProps> = ({ story, onStatusChange }) => {
  const [showMenu, setShowMenu] = useState(false);
  const priority = priorityClasses[story.priority] || priorityClasses.medium;

  return (
    <div className="p-3 rounded-lg border bg-background border-border">
      <div className="flex items-start justify-between mb-2">
        <span className={`px-2 py-0.5 rounded text-xs capitalize ${priority.bg} ${priority.text}`}>
          {story.priority}
        </span>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded hover:bg-muted"
          >
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 py-1 rounded-lg shadow-lg border z-10 min-w-32 bg-card border-border">
              {story.status !== 'todo' && (
                <button
                  onClick={() => { onStatusChange(story.id, 'todo'); setShowMenu(false); }}
                  className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                >
                  Move to To Do
                </button>
              )}
              {story.status !== 'in_progress' && (
                <button
                  onClick={() => { onStatusChange(story.id, 'in_progress'); setShowMenu(false); }}
                  className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                >
                  Move to In Progress
                </button>
              )}
              {story.status !== 'done' && (
                <button
                  onClick={() => { onStatusChange(story.id, 'done'); setShowMenu(false); }}
                  className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                >
                  Move to Done
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <h4 className="font-medium text-sm mb-2 text-foreground">
        {story.title}
      </h4>
      <p className="text-xs line-clamp-2 mb-3 text-muted-foreground">
        {story.description}
      </p>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {story.assignee && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {story.assignee}
            </span>
          )}
        </div>
        {story.storyPoints && (
          <span className="px-1.5 py-0.5 rounded bg-muted">
            {story.storyPoints} pts
          </span>
        )}
      </div>
    </div>
  );
};

export default AgileDevPage;
