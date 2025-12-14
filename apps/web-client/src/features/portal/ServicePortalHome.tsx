import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  BookOpen,
  HelpCircle,
  Bell,
  ChevronRight,
  Star,
  Clock,
  TrendingUp,
  Zap,
  Monitor,
  Users,
  Shield,
  Briefcase,
  Wrench,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';

interface ServiceCategory {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  itemCount: number;
}

interface FeaturedItem {
  id: string;
  label: string;
  description: string;
  category: string;
  icon: React.ElementType;
  deliveryTime?: string;
}

interface RecentArticle {
  id: string;
  title: string;
  category: string;
  viewCount: number;
}

interface Announcement {
  id: string;
  title: string;
  type: 'info' | 'warning' | 'critical' | 'maintenance';
  date: string;
}

export function ServicePortalHome() {
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data
  const categories: ServiceCategory[] = [
    {
      id: '1',
      label: 'IT Services',
      description: 'Hardware, software, and technical support',
      icon: Monitor,
      color: '#6366f1',
      itemCount: 24,
    },
    {
      id: '2',
      label: 'HR Services',
      description: 'Employee services and HR requests',
      icon: Users,
      color: '#f59e0b',
      itemCount: 18,
    },
    {
      id: '3',
      label: 'Security',
      description: 'Access requests and security services',
      icon: Shield,
      color: '#ef4444',
      itemCount: 12,
    },
    {
      id: '4',
      label: 'Facilities',
      description: 'Building and workspace services',
      icon: Wrench,
      color: '#10b981',
      itemCount: 15,
    },
    {
      id: '5',
      label: 'Finance',
      description: 'Procurement and expense management',
      icon: Briefcase,
      color: '#8b5cf6',
      itemCount: 9,
    },
    {
      id: '6',
      label: 'General',
      description: 'Other services and requests',
      icon: FileText,
      color: '#64748b',
      itemCount: 21,
    },
  ];

  const featuredItems: FeaturedItem[] = [
    {
      id: '1',
      label: 'New Laptop Request',
      description: 'Request a new laptop or computer',
      category: 'IT Services',
      icon: Monitor,
      deliveryTime: '3-5 days',
    },
    {
      id: '2',
      label: 'Software Installation',
      description: 'Request software to be installed',
      category: 'IT Services',
      icon: Zap,
      deliveryTime: '1-2 days',
    },
    {
      id: '3',
      label: 'VPN Access',
      description: 'Request VPN access for remote work',
      category: 'Security',
      icon: Shield,
      deliveryTime: '1 day',
    },
    {
      id: '4',
      label: 'Meeting Room Booking',
      description: 'Book a conference room',
      category: 'Facilities',
      icon: Users,
      deliveryTime: 'Instant',
    },
  ];

  const recentArticles: RecentArticle[] = [
    { id: '1', title: 'How to connect to VPN', category: 'IT', viewCount: 1234 },
    { id: '2', title: 'Password reset guide', category: 'IT', viewCount: 987 },
    { id: '3', title: 'Expense submission process', category: 'Finance', viewCount: 654 },
    { id: '4', title: 'Remote work policy', category: 'HR', viewCount: 543 },
    { id: '5', title: 'IT security best practices', category: 'Security', viewCount: 432 },
  ];

  const announcements: Announcement[] = [
    {
      id: '1',
      title: 'Scheduled maintenance this weekend',
      type: 'maintenance',
      date: 'Dec 16, 2024',
    },
    {
      id: '2',
      title: 'New self-service features available',
      type: 'info',
      date: 'Dec 14, 2024',
    },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Navigate to search results
    console.log('Search:', searchQuery);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">How can we help you today?</h1>
            <p className="text-lg text-indigo-100 mb-8">
              Search for services, browse the catalog, or find answers in our knowledge base
            </p>
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search for services, articles, or help..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 text-lg rounded-xl bg-white text-gray-900 placeholder-gray-500 shadow-lg focus:outline-none focus:ring-2 focus:ring-white"
                />
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <Link
            to="/portal/catalog"
            className="flex flex-col items-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl mb-3">
              <ShoppingCart className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="font-medium text-gray-900 dark:text-white">Service Catalog</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">Browse services</span>
          </Link>
          <Link
            to="/portal/knowledge"
            className="flex flex-col items-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl mb-3">
              <BookOpen className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="font-medium text-gray-900 dark:text-white">Knowledge Base</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">Find answers</span>
          </Link>
          <Link
            to="/portal/my-items"
            className="flex flex-col items-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl mb-3">
              <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="font-medium text-gray-900 dark:text-white">My Requests</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">Track status</span>
          </Link>
          <Link
            to="/portal/help"
            className="flex flex-col items-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl mb-3">
              <HelpCircle className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="font-medium text-gray-900 dark:text-white">Get Help</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">Contact support</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Service Categories */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Browse by Category
                </h2>
                <Link
                  to="/portal/catalog"
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center"
                >
                  View all
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {categories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <Link
                      key={category.id}
                      to={`/portal/catalog?category=${category.id}`}
                      className="group"
                    >
                      <Card className="p-4 hover:shadow-md transition-all group-hover:border-indigo-300 dark:group-hover:border-indigo-700">
                        <div
                          className="p-3 rounded-xl mb-3 w-fit"
                          style={{ backgroundColor: `${category.color}20` }}
                        >
                          <Icon className="w-6 h-6" style={{ color: category.color }} />
                        </div>
                        <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                          {category.label}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {category.itemCount} services
                        </p>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* Featured Services */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                  <Star className="w-5 h-5 mr-2 text-amber-500" />
                  Featured Services
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {featuredItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.id} to={`/portal/catalog/${item.id}`}>
                      <Card className="p-4 hover:shadow-md transition-shadow h-full">
                        <div className="flex items-start gap-4">
                          <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                            <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              {item.label}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {item.description}
                            </p>
                            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                              <span>{item.category}</span>
                              {item.deliveryTime && (
                                <span className="flex items-center">
                                  <Clock className="w-3.5 h-3.5 mr-1" />
                                  {item.deliveryTime}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* Popular Articles */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-emerald-500" />
                  Popular Articles
                </h2>
                <Link
                  to="/portal/knowledge"
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center"
                >
                  Browse all
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
              <Card>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {recentArticles.map((article) => (
                    <Link
                      key={article.id}
                      to={`/portal/knowledge/${article.id}`}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <BookOpen className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {article.title}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {article.category}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {article.viewCount.toLocaleString()} views
                      </span>
                    </Link>
                  ))}
                </div>
              </Card>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Announcements */}
            <Card>
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="font-medium text-gray-900 dark:text-white flex items-center">
                  <Bell className="w-5 h-5 mr-2 text-indigo-500" />
                  Announcements
                </h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {announcements.map((announcement) => (
                  <div key={announcement.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                          announcement.type === 'critical'
                            ? 'bg-red-500'
                            : announcement.type === 'warning'
                            ? 'bg-amber-500'
                            : announcement.type === 'maintenance'
                            ? 'bg-blue-500'
                            : 'bg-gray-400'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {announcement.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {announcement.date}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Quick Stats */}
            <Card>
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="font-medium text-gray-900 dark:text-white">Your Activity</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Open Requests</span>
                  <span className="font-semibold text-gray-900 dark:text-white">3</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Pending Approvals</span>
                  <span className="font-semibold text-gray-900 dark:text-white">1</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Completed This Month</span>
                  <span className="font-semibold text-gray-900 dark:text-white">7</span>
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 dark:border-gray-800">
                <Link
                  to="/portal/my-items"
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center"
                >
                  View all my items
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </Card>

            {/* Need Help */}
            <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              <div className="p-6 text-center">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-80" />
                <h3 className="font-semibold mb-2">Need Help?</h3>
                <p className="text-sm text-indigo-100 mb-4">
                  Can't find what you're looking for? Our support team is here to help.
                </p>
                <Link
                  to="/portal/help"
                  className="inline-flex items-center px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition-colors"
                >
                  Contact Support
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
