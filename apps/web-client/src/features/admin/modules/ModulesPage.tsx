import { useState } from 'react';
import {
  Search,
  Grid3X3,
  List,
  Star,
  StarOff,
  Plus,
  Settings,
  MoreHorizontal,
  ChevronRight,
  Zap,
  Box,
  Users,
  FileText,
  BarChart2,
  Shield,
  HardDrive,
  MessageSquare,
  Calendar,
  Briefcase,
  Wrench,
} from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';

interface ApplicationModule {
  id: string;
  code: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  isFavorite: boolean;
  isActive: boolean;
  collectionCount: number;
  userCount: number;
}

type ViewMode = 'grid' | 'list';

const iconMap: Record<string, React.ElementType> = {
  zap: Zap,
  box: Box,
  users: Users,
  'file-text': FileText,
  'bar-chart-2': BarChart2,
  shield: Shield,
  'hard-drive': HardDrive,
  'message-square': MessageSquare,
  calendar: Calendar,
  briefcase: Briefcase,
  wrench: Wrench,
};

export function ModulesPage() {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Mock data - would be fetched from API
  const [modules, setModules] = useState<ApplicationModule[]>([
    {
      id: '1',
      code: 'itsm',
      label: 'IT Service Management',
      description: 'Manage incidents, problems, changes, and service requests',
      icon: 'zap',
      color: '#6366f1',
      category: 'IT Operations',
      isFavorite: true,
      isActive: true,
      collectionCount: 12,
      userCount: 145,
    },
    {
      id: '2',
      code: 'asset',
      label: 'Asset Management',
      description: 'Track and manage hardware, software, and infrastructure assets',
      icon: 'hard-drive',
      color: '#10b981',
      category: 'IT Operations',
      isFavorite: true,
      isActive: true,
      collectionCount: 8,
      userCount: 89,
    },
    {
      id: '3',
      code: 'hr',
      label: 'Human Resources',
      description: 'Employee onboarding, time off, and HR case management',
      icon: 'users',
      color: '#f59e0b',
      category: 'Employee Services',
      isFavorite: false,
      isActive: true,
      collectionCount: 6,
      userCount: 234,
    },
    {
      id: '4',
      code: 'security',
      label: 'Security Operations',
      description: 'Security incidents, vulnerability management, and compliance',
      icon: 'shield',
      color: '#ef4444',
      category: 'IT Operations',
      isFavorite: false,
      isActive: true,
      collectionCount: 5,
      userCount: 32,
    },
    {
      id: '5',
      code: 'project',
      label: 'Project Management',
      description: 'Plan, track, and deliver projects across teams',
      icon: 'briefcase',
      color: '#8b5cf6',
      category: 'Business',
      isFavorite: false,
      isActive: true,
      collectionCount: 4,
      userCount: 67,
    },
    {
      id: '6',
      code: 'cmdb',
      label: 'Configuration Management',
      description: 'Configuration items, relationships, and dependency mapping',
      icon: 'box',
      color: '#06b6d4',
      category: 'IT Operations',
      isFavorite: false,
      isActive: true,
      collectionCount: 3,
      userCount: 45,
    },
    {
      id: '7',
      code: 'facilities',
      label: 'Facilities Management',
      description: 'Space management, work orders, and building operations',
      icon: 'wrench',
      color: '#84cc16',
      category: 'Operations',
      isFavorite: false,
      isActive: true,
      collectionCount: 5,
      userCount: 28,
    },
    {
      id: '8',
      code: 'knowledge',
      label: 'Knowledge Management',
      description: 'Articles, FAQs, and documentation',
      icon: 'file-text',
      color: '#ec4899',
      category: 'Self-Service',
      isFavorite: false,
      isActive: true,
      collectionCount: 2,
      userCount: 312,
    },
  ]);

  const categories = Array.from(new Set(modules.map((m) => m.category)));

  const filteredModules = modules.filter((module) => {
    const matchesSearch = !search ||
      module.label.toLowerCase().includes(search.toLowerCase()) ||
      module.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || module.category === selectedCategory;
    const matchesFavorites = !showFavoritesOnly || module.isFavorite;
    return matchesSearch && matchesCategory && matchesFavorites && module.isActive;
  });

  const toggleFavorite = (moduleId: string) => {
    setModules(modules.map((m) =>
      m.id === moduleId ? { ...m, isFavorite: !m.isFavorite } : m
    ));
  };

  const getIcon = (iconName: string) => {
    return iconMap[iconName] || Box;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Application Modules
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Browse and access platform applications
          </p>
        </div>
        <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
          <Plus className="w-4 h-4 mr-2" />
          Create Module
        </button>
      </div>

      {/* Filters Bar */}
      <Card>
        <div className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Search */}
            <div className="flex-1 min-w-[240px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search modules..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  !selectedCategory
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    selectedCategory === category
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* View Mode & Favorites */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  showFavoritesOnly
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Star className="w-4 h-4 mr-1.5" />
                Favorites
              </button>
              <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${
                    viewMode === 'grid'
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${
                    viewMode === 'list'
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Module Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredModules.map((module) => {
            const Icon = getIcon(module.icon);
            return (
              <Card
                key={module.id}
                className="hover:shadow-lg transition-all cursor-pointer group"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="p-3 rounded-xl"
                      style={{ backgroundColor: `${module.color}20` }}
                    >
                      <Icon className="w-6 h-6" style={{ color: module.color }} />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(module.id);
                        }}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                      >
                        {module.isFavorite ? (
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        ) : (
                          <StarOff className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                        <Settings className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {module.label}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                    {module.description}
                  </p>
                  <div className="flex items-center gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>{module.collectionCount} collections</span>
                    <span>{module.userCount} users</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredModules.map((module) => {
            const Icon = getIcon(module.icon);
            return (
              <Card key={module.id} className="hover:shadow-md transition-shadow">
                <div className="p-4 flex items-center gap-4">
                  <div
                    className="p-3 rounded-xl flex-shrink-0"
                    style={{ backgroundColor: `${module.color}20` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: module.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {module.label}
                      </h3>
                      {module.isFavorite && (
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {module.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                    <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
                      {module.category}
                    </span>
                    <span>{module.collectionCount} collections</span>
                    <span>{module.userCount} users</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleFavorite(module.id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    >
                      {module.isFavorite ? (
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      ) : (
                        <StarOff className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                      <MoreHorizontal className="w-4 h-4 text-gray-400" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {filteredModules.length === 0 && (
        <div className="text-center py-12">
          <Box className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No modules found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {search
              ? 'Try adjusting your search or filters'
              : 'Get started by creating your first module'}
          </p>
          <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            Create Module
          </button>
        </div>
      )}
    </div>
  );
}
