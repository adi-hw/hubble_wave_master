import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  Grid3X3,
  List,
  ChevronRight,
  Clock,
  Star,
  Tag,
  Monitor,
  Users,
  Shield,
  Wrench,
  Briefcase,
  FileText,
  Zap,
  ShoppingCart,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

interface CatalogItem {
  id: string;
  code: string;
  label: string;
  shortDescription: string;
  categoryId: string;
  categoryLabel: string;
  icon: string;
  color: string;
  deliveryTime?: string;
  price?: number;
  isFeatured: boolean;
  isPopular: boolean;
  tags: string[];
}

interface Category {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  itemCount: number;
}

type ViewMode = 'grid' | 'list';

const iconMap: Record<string, React.ElementType> = {
  monitor: Monitor,
  users: Users,
  shield: Shield,
  wrench: Wrench,
  briefcase: Briefcase,
  'file-text': FileText,
  zap: Zap,
};

export function ServiceCatalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const selectedCategory = searchParams.get('category');

  // Mock data
  const categories: Category[] = [
    { id: '1', label: 'IT Services', icon: Monitor, color: '#6366f1', itemCount: 24 },
    { id: '2', label: 'HR Services', icon: Users, color: '#f59e0b', itemCount: 18 },
    { id: '3', label: 'Security', icon: Shield, color: '#ef4444', itemCount: 12 },
    { id: '4', label: 'Facilities', icon: Wrench, color: '#10b981', itemCount: 15 },
    { id: '5', label: 'Finance', icon: Briefcase, color: '#8b5cf6', itemCount: 9 },
    { id: '6', label: 'General', icon: FileText, color: '#64748b', itemCount: 21 },
  ];

  const catalogItems: CatalogItem[] = [
    {
      id: '1',
      code: 'new_laptop',
      label: 'New Laptop Request',
      shortDescription: 'Request a new laptop or desktop computer for work',
      categoryId: '1',
      categoryLabel: 'IT Services',
      icon: 'monitor',
      color: '#6366f1',
      deliveryTime: '3-5 business days',
      isFeatured: true,
      isPopular: true,
      tags: ['hardware', 'computer', 'laptop'],
    },
    {
      id: '2',
      code: 'software_install',
      label: 'Software Installation',
      shortDescription: 'Request installation of approved software',
      categoryId: '1',
      categoryLabel: 'IT Services',
      icon: 'zap',
      color: '#6366f1',
      deliveryTime: '1-2 business days',
      isFeatured: true,
      isPopular: false,
      tags: ['software', 'installation'],
    },
    {
      id: '3',
      code: 'vpn_access',
      label: 'VPN Access Request',
      shortDescription: 'Request VPN access for remote work',
      categoryId: '3',
      categoryLabel: 'Security',
      icon: 'shield',
      color: '#ef4444',
      deliveryTime: '1 business day',
      isFeatured: true,
      isPopular: true,
      tags: ['vpn', 'remote', 'access'],
    },
    {
      id: '4',
      code: 'meeting_room',
      label: 'Meeting Room Booking',
      shortDescription: 'Book a conference room for meetings',
      categoryId: '4',
      categoryLabel: 'Facilities',
      icon: 'users',
      color: '#10b981',
      deliveryTime: 'Instant',
      isFeatured: false,
      isPopular: true,
      tags: ['room', 'meeting', 'booking'],
    },
    {
      id: '5',
      code: 'expense_report',
      label: 'Expense Report Submission',
      shortDescription: 'Submit expense reports for reimbursement',
      categoryId: '5',
      categoryLabel: 'Finance',
      icon: 'briefcase',
      color: '#8b5cf6',
      deliveryTime: '5-7 business days',
      isFeatured: false,
      isPopular: false,
      tags: ['expense', 'reimbursement', 'finance'],
    },
    {
      id: '6',
      code: 'new_hire',
      label: 'New Hire Onboarding',
      shortDescription: 'Request onboarding for a new team member',
      categoryId: '2',
      categoryLabel: 'HR Services',
      icon: 'users',
      color: '#f59e0b',
      deliveryTime: '2-3 business days',
      isFeatured: true,
      isPopular: false,
      tags: ['onboarding', 'new hire', 'hr'],
    },
    {
      id: '7',
      code: 'password_reset',
      label: 'Password Reset',
      shortDescription: 'Reset your account password',
      categoryId: '3',
      categoryLabel: 'Security',
      icon: 'shield',
      color: '#ef4444',
      deliveryTime: 'Instant',
      isFeatured: false,
      isPopular: true,
      tags: ['password', 'reset', 'account'],
    },
    {
      id: '8',
      code: 'desk_move',
      label: 'Desk Move Request',
      shortDescription: 'Request to move to a different desk or office',
      categoryId: '4',
      categoryLabel: 'Facilities',
      icon: 'wrench',
      color: '#10b981',
      deliveryTime: '3-5 business days',
      isFeatured: false,
      isPopular: false,
      tags: ['desk', 'move', 'office'],
    },
  ];

  const filteredItems = useMemo(() => {
    return catalogItems.filter((item) => {
      const matchesSearch =
        !search ||
        item.label.toLowerCase().includes(search.toLowerCase()) ||
        item.shortDescription.toLowerCase().includes(search.toLowerCase()) ||
        item.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
      const matchesCategory = !selectedCategory || item.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, selectedCategory]);

  const handleCategorySelect = (categoryId: string | null) => {
    if (categoryId) {
      setSearchParams({ category: categoryId });
    } else {
      setSearchParams({});
    }
  };

  const getIcon = (iconName: string) => {
    return iconMap[iconName] || FileText;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
            <Link to="/portal" className="hover:text-indigo-600 dark:hover:text-indigo-400">
              Service Portal
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Service Catalog</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center">
                <ShoppingCart className="w-7 h-7 mr-3 text-indigo-600" />
                Service Catalog
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Browse and request services from our catalog
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar - Categories */}
          <div className="w-64 flex-shrink-0 hidden lg:block">
            <Card className="sticky top-4">
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="font-medium text-gray-900 dark:text-white">Categories</h3>
              </div>
              <div className="p-2">
                <button
                  onClick={() => handleCategorySelect(null)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    !selectedCategory
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Grid3X3 className="w-5 h-5" />
                  <span>All Services</span>
                  <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                    {catalogItems.length}
                  </span>
                </button>
                {categories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleCategorySelect(category.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        selectedCategory === category.id
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <Icon className="w-5 h-5" style={{ color: category.color }} />
                      <span>{category.label}</span>
                      <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                        {category.itemCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Search and Filters */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search services..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${
                    viewMode === 'grid'
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Grid3X3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${
                    viewMode === 'list'
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Results Count */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {filteredItems.length} services found
              </p>
              {selectedCategory && (
                <button
                  onClick={() => handleCategorySelect(null)}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>

            {/* Catalog Items */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredItems.map((item) => {
                  const Icon = getIcon(item.icon);
                  return (
                    <Link key={item.id} to={`/portal/catalog/${item.id}`}>
                      <Card className="p-5 h-full hover:shadow-lg transition-shadow group">
                        <div className="flex items-start justify-between mb-3">
                          <div
                            className="p-2.5 rounded-xl"
                            style={{ backgroundColor: `${item.color}20` }}
                          >
                            <Icon className="w-6 h-6" style={{ color: item.color }} />
                          </div>
                          <div className="flex items-center gap-1">
                            {item.isFeatured && (
                              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                            )}
                            {item.isPopular && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded">
                                Popular
                              </span>
                            )}
                          </div>
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {item.label}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {item.shortDescription}
                        </p>
                        <div className="flex items-center gap-3 mt-4 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center">
                            <Tag className="w-3.5 h-3.5 mr-1" />
                            {item.categoryLabel}
                          </span>
                          {item.deliveryTime && (
                            <span className="flex items-center">
                              <Clock className="w-3.5 h-3.5 mr-1" />
                              {item.deliveryTime}
                            </span>
                          )}
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => {
                  const Icon = getIcon(item.icon);
                  return (
                    <Link key={item.id} to={`/portal/catalog/${item.id}`}>
                      <Card className="p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                          <div
                            className="p-3 rounded-xl flex-shrink-0"
                            style={{ backgroundColor: `${item.color}20` }}
                          >
                            <Icon className="w-6 h-6" style={{ color: item.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900 dark:text-white">
                                {item.label}
                              </h3>
                              {item.isFeatured && (
                                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                              )}
                              {item.isPopular && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded">
                                  Popular
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                              {item.shortDescription}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                            <span>{item.categoryLabel}</span>
                            {item.deliveryTime && (
                              <span className="flex items-center">
                                <Clock className="w-4 h-4 mr-1" />
                                {item.deliveryTime}
                              </span>
                            )}
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {filteredItems.length === 0 && (
              <div className="text-center py-12">
                <ShoppingCart className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No services found
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Try adjusting your search or filter criteria
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
