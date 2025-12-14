import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  BookOpen,
  ChevronRight,
  TrendingUp,
  Clock,
  ThumbsUp,
  Eye,
  Star,
  FileText,
  HelpCircle,
  Lightbulb,
  AlertTriangle,
  Scroll,
  Bell,
  Folder,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

type ArticleType = 'article' | 'faq' | 'how_to' | 'troubleshooting' | 'policy' | 'announcement';

interface Article {
  id: string;
  number: string;
  title: string;
  summary: string;
  categoryId: string;
  categoryLabel: string;
  articleType: ArticleType;
  tags: string[];
  viewCount: number;
  helpfulCount: number;
  isFeatured: boolean;
  publishedAt: string;
}

interface Category {
  id: string;
  label: string;
  icon: React.ElementType;
  articleCount: number;
}

const articleTypeConfig: Record<ArticleType, { label: string; icon: React.ElementType; color: string }> = {
  article: { label: 'Article', icon: FileText, color: '#6366f1' },
  faq: { label: 'FAQ', icon: HelpCircle, color: '#10b981' },
  how_to: { label: 'How-To', icon: Lightbulb, color: '#f59e0b' },
  troubleshooting: { label: 'Troubleshooting', icon: AlertTriangle, color: '#ef4444' },
  policy: { label: 'Policy', icon: Scroll, color: '#8b5cf6' },
  announcement: { label: 'Announcement', icon: Bell, color: '#06b6d4' },
};

export function KnowledgeBase() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const selectedCategory = searchParams.get('category');
  const selectedType = searchParams.get('type') as ArticleType | null;

  // Mock data
  const categories: Category[] = [
    { id: '1', label: 'IT Support', icon: Folder, articleCount: 45 },
    { id: '2', label: 'HR & Benefits', icon: Folder, articleCount: 32 },
    { id: '3', label: 'Security', icon: Folder, articleCount: 28 },
    { id: '4', label: 'Facilities', icon: Folder, articleCount: 18 },
    { id: '5', label: 'Finance', icon: Folder, articleCount: 15 },
    { id: '6', label: 'Getting Started', icon: Folder, articleCount: 12 },
  ];

  const articles: Article[] = [
    {
      id: '1',
      number: 'KB0001234',
      title: 'How to connect to the VPN from home',
      summary: 'Step-by-step guide to setting up and connecting to the corporate VPN for remote work.',
      categoryId: '1',
      categoryLabel: 'IT Support',
      articleType: 'how_to',
      tags: ['vpn', 'remote work', 'network'],
      viewCount: 2456,
      helpfulCount: 892,
      isFeatured: true,
      publishedAt: 'Dec 1, 2024',
    },
    {
      id: '2',
      number: 'KB0001235',
      title: 'Password reset guide',
      summary: 'Learn how to reset your password using self-service or with IT support assistance.',
      categoryId: '1',
      categoryLabel: 'IT Support',
      articleType: 'how_to',
      tags: ['password', 'account', 'security'],
      viewCount: 1876,
      helpfulCount: 654,
      isFeatured: true,
      publishedAt: 'Nov 28, 2024',
    },
    {
      id: '3',
      number: 'KB0001236',
      title: 'What are the company holidays for 2025?',
      summary: 'Complete list of official company holidays and observances for the upcoming year.',
      categoryId: '2',
      categoryLabel: 'HR & Benefits',
      articleType: 'faq',
      tags: ['holidays', 'time off', 'calendar'],
      viewCount: 1234,
      helpfulCount: 421,
      isFeatured: false,
      publishedAt: 'Dec 5, 2024',
    },
    {
      id: '4',
      number: 'KB0001237',
      title: 'Troubleshooting: Outlook not syncing emails',
      summary: 'Steps to resolve common Outlook synchronization issues and connectivity problems.',
      categoryId: '1',
      categoryLabel: 'IT Support',
      articleType: 'troubleshooting',
      tags: ['outlook', 'email', 'sync'],
      viewCount: 987,
      helpfulCount: 312,
      isFeatured: false,
      publishedAt: 'Nov 20, 2024',
    },
    {
      id: '5',
      number: 'KB0001238',
      title: 'Information Security Policy',
      summary: 'Company-wide policy on information security, data handling, and compliance requirements.',
      categoryId: '3',
      categoryLabel: 'Security',
      articleType: 'policy',
      tags: ['security', 'policy', 'compliance'],
      viewCount: 756,
      helpfulCount: 189,
      isFeatured: false,
      publishedAt: 'Oct 15, 2024',
    },
    {
      id: '6',
      number: 'KB0001239',
      title: 'New employee onboarding checklist',
      summary: 'Everything new employees need to know and complete in their first week.',
      categoryId: '6',
      categoryLabel: 'Getting Started',
      articleType: 'article',
      tags: ['onboarding', 'new hire', 'checklist'],
      viewCount: 654,
      helpfulCount: 234,
      isFeatured: true,
      publishedAt: 'Nov 10, 2024',
    },
    {
      id: '7',
      number: 'KB0001240',
      title: 'How do I submit an expense report?',
      summary: 'Guide to submitting expense reports including required documentation and approval process.',
      categoryId: '5',
      categoryLabel: 'Finance',
      articleType: 'faq',
      tags: ['expense', 'reimbursement', 'finance'],
      viewCount: 543,
      helpfulCount: 178,
      isFeatured: false,
      publishedAt: 'Nov 5, 2024',
    },
    {
      id: '8',
      number: 'KB0001241',
      title: 'System maintenance scheduled for December 20th',
      summary: 'Important announcement about upcoming system maintenance and expected downtime.',
      categoryId: '1',
      categoryLabel: 'IT Support',
      articleType: 'announcement',
      tags: ['maintenance', 'downtime', 'announcement'],
      viewCount: 432,
      helpfulCount: 45,
      isFeatured: false,
      publishedAt: 'Dec 10, 2024',
    },
  ];

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const matchesSearch =
        !search ||
        article.title.toLowerCase().includes(search.toLowerCase()) ||
        article.summary.toLowerCase().includes(search.toLowerCase()) ||
        article.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
      const matchesCategory = !selectedCategory || article.categoryId === selectedCategory;
      const matchesType = !selectedType || article.articleType === selectedType;
      return matchesSearch && matchesCategory && matchesType;
    });
  }, [search, selectedCategory, selectedType]);

  const featuredArticles = articles.filter((a) => a.isFeatured);
  const popularArticles = [...articles].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5);

  const handleCategorySelect = (categoryId: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (categoryId) {
      params.set('category', categoryId);
    } else {
      params.delete('category');
    }
    setSearchParams(params);
  };

  const handleTypeSelect = (type: ArticleType | null) => {
    const params = new URLSearchParams(searchParams);
    if (type) {
      params.set('type', type);
    } else {
      params.delete('type');
    }
    setSearchParams(params);
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
            <span className="text-gray-900 dark:text-white">Knowledge Base</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center">
                <BookOpen className="w-7 h-7 mr-3 text-emerald-600" />
                Knowledge Base
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Find answers and learn how to use our services
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="mt-6 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search articles, FAQs, and guides..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12 py-3 text-lg"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0 hidden lg:block space-y-6">
            {/* Categories */}
            <Card>
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="font-medium text-gray-900 dark:text-white">Categories</h3>
              </div>
              <div className="p-2">
                <button
                  onClick={() => handleCategorySelect(null)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    !selectedCategory
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <BookOpen className="w-5 h-5" />
                  <span>All Articles</span>
                </button>
                {categories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleCategorySelect(category.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        selectedCategory === category.id
                          ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{category.label}</span>
                      <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                        {category.articleCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Article Types */}
            <Card>
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="font-medium text-gray-900 dark:text-white">Article Types</h3>
              </div>
              <div className="p-2">
                <button
                  onClick={() => handleTypeSelect(null)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    !selectedType
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  All Types
                </button>
                {(Object.keys(articleTypeConfig) as ArticleType[]).map((type) => {
                  const config = articleTypeConfig[type];
                  const Icon = config.icon;
                  return (
                    <button
                      key={type}
                      onClick={() => handleTypeSelect(type)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        selectedType === type
                          ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <Icon className="w-5 h-5" style={{ color: config.color }} />
                      <span>{config.label}</span>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Popular Articles */}
            <Card>
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="font-medium text-gray-900 dark:text-white flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2 text-emerald-500" />
                  Popular
                </h3>
              </div>
              <div className="p-2">
                {popularArticles.slice(0, 5).map((article) => (
                  <Link
                    key={article.id}
                    to={`/portal/knowledge/${article.id}`}
                    className="block px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {article.title}
                  </Link>
                ))}
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Featured Articles (only show when no search/filter) */}
            {!search && !selectedCategory && !selectedType && featuredArticles.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <Star className="w-5 h-5 mr-2 text-amber-500" />
                  Featured Articles
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {featuredArticles.map((article) => {
                    const typeConfig = articleTypeConfig[article.articleType];
                    const TypeIcon = typeConfig.icon;
                    return (
                      <Link key={article.id} to={`/portal/knowledge/${article.id}`}>
                        <Card className="p-5 h-full hover:shadow-lg transition-shadow border-l-4" style={{ borderLeftColor: typeConfig.color }}>
                          <div className="flex items-start gap-3">
                            <div
                              className="p-2 rounded-lg"
                              style={{ backgroundColor: `${typeConfig.color}20` }}
                            >
                              <TypeIcon className="w-5 h-5" style={{ color: typeConfig.color }} />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 dark:text-white">
                                {article.title}
                              </h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                {article.summary}
                              </p>
                              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                                <span className="flex items-center">
                                  <Eye className="w-3.5 h-3.5 mr-1" />
                                  {article.viewCount.toLocaleString()}
                                </span>
                                <span className="flex items-center">
                                  <ThumbsUp className="w-3.5 h-3.5 mr-1" />
                                  {article.helpfulCount}
                                </span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Results */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {search || selectedCategory || selectedType ? 'Search Results' : 'All Articles'}
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {filteredArticles.length} articles
                </span>
              </div>

              <div className="space-y-3">
                {filteredArticles.map((article) => {
                  const typeConfig = articleTypeConfig[article.articleType];
                  const TypeIcon = typeConfig.icon;
                  return (
                    <Link key={article.id} to={`/portal/knowledge/${article.id}`}>
                      <Card className="p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-4">
                          <div
                            className="p-2.5 rounded-lg flex-shrink-0"
                            style={{ backgroundColor: `${typeConfig.color}20` }}
                          >
                            <TypeIcon className="w-5 h-5" style={{ color: typeConfig.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                                {article.number}
                              </span>
                              <span
                                className="px-2 py-0.5 text-xs font-medium rounded"
                                style={{
                                  backgroundColor: `${typeConfig.color}20`,
                                  color: typeConfig.color,
                                }}
                              >
                                {typeConfig.label}
                              </span>
                            </div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {article.title}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                              {article.summary}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                              <span>{article.categoryLabel}</span>
                              <span className="flex items-center">
                                <Eye className="w-3.5 h-3.5 mr-1" />
                                {article.viewCount.toLocaleString()} views
                              </span>
                              <span className="flex items-center">
                                <Clock className="w-3.5 h-3.5 mr-1" />
                                {article.publishedAt}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>

              {filteredArticles.length === 0 && (
                <div className="text-center py-12">
                  <BookOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No articles found
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Try adjusting your search or browse by category
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
