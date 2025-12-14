import { useState } from 'react';
import {
  FileText,
  Plus,
  Search,
  Download,
  Play,
  Clock,
  Table,
  PieChart,
  BarChart2,
  FileSpreadsheet,
  Calendar,
  Star,
  MoreHorizontal,
  Folder,
} from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';

type ReportType = 'table' | 'pivot' | 'chart' | 'summary' | 'detail';

interface ReportDefinition {
  id: string;
  code: string;
  label: string;
  description: string;
  reportType: ReportType;
  moduleLabel?: string;
  category?: string;
  isFavorite: boolean;
  isScheduled: boolean;
  lastRun?: string;
  runCount: number;
}

const reportTypeIcons: Record<ReportType, React.ElementType> = {
  table: Table,
  pivot: FileSpreadsheet,
  chart: BarChart2,
  summary: PieChart,
  detail: FileText,
};

export function ReportsPage() {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Mock data - would be fetched from API
  const [reports] = useState<ReportDefinition[]>([
    {
      id: '1',
      code: 'incident_summary',
      label: 'Incident Summary Report',
      description: 'Daily summary of incident metrics by priority and category',
      reportType: 'summary',
      moduleLabel: 'IT Service Management',
      category: 'Operations',
      isFavorite: true,
      isScheduled: true,
      lastRun: '2 hours ago',
      runCount: 142,
    },
    {
      id: '2',
      code: 'asset_inventory',
      label: 'Asset Inventory Report',
      description: 'Complete inventory of all hardware and software assets',
      reportType: 'table',
      moduleLabel: 'Asset Management',
      category: 'Inventory',
      isFavorite: true,
      isScheduled: false,
      lastRun: '1 day ago',
      runCount: 89,
    },
    {
      id: '3',
      code: 'sla_performance',
      label: 'SLA Performance Dashboard',
      description: 'Real-time SLA compliance metrics and trends',
      reportType: 'chart',
      moduleLabel: 'IT Service Management',
      category: 'Performance',
      isFavorite: false,
      isScheduled: true,
      lastRun: '30 minutes ago',
      runCount: 256,
    },
    {
      id: '4',
      code: 'change_calendar',
      label: 'Change Calendar Report',
      description: 'Scheduled changes and maintenance windows',
      reportType: 'detail',
      moduleLabel: 'IT Service Management',
      category: 'Planning',
      isFavorite: false,
      isScheduled: false,
      lastRun: '3 days ago',
      runCount: 34,
    },
    {
      id: '5',
      code: 'cost_analysis',
      label: 'Cost Analysis Pivot',
      description: 'Cost breakdown by department, category, and vendor',
      reportType: 'pivot',
      moduleLabel: 'Asset Management',
      category: 'Finance',
      isFavorite: false,
      isScheduled: true,
      lastRun: '1 hour ago',
      runCount: 67,
    },
    {
      id: '6',
      code: 'user_activity',
      label: 'User Activity Report',
      description: 'Track user logins, actions, and productivity metrics',
      reportType: 'table',
      moduleLabel: 'Analytics',
      category: 'Audit',
      isFavorite: false,
      isScheduled: false,
      runCount: 45,
    },
  ]);

  const reportTypes: { type: ReportType; label: string }[] = [
    { type: 'table', label: 'Table' },
    { type: 'pivot', label: 'Pivot' },
    { type: 'chart', label: 'Chart' },
    { type: 'summary', label: 'Summary' },
    { type: 'detail', label: 'Detail' },
  ];

  const filteredReports = reports.filter((report) => {
    const matchesSearch = !search ||
      report.label.toLowerCase().includes(search.toLowerCase()) ||
      report.description.toLowerCase().includes(search.toLowerCase());
    const matchesType = !selectedType || report.reportType === selectedType;
    const matchesFavorites = !showFavoritesOnly || report.isFavorite;
    return matchesSearch && matchesType && matchesFavorites;
  });

  const handleRunReport = (reportId: string) => {
    console.log('Run report:', reportId);
    // Would navigate to report viewer or open modal
  };

  const handleExportReport = (reportId: string, format: string) => {
    console.log('Export report:', reportId, format);
    // Would trigger download
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Reports
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create, run, and schedule custom reports
          </p>
        </div>
        <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
          <Plus className="w-4 h-4 mr-2" />
          Create Report
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
                  placeholder="Search reports..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Report Type Filter */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedType(null)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  !selectedType
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                All Types
              </button>
              {reportTypes.map((rt) => {
                const Icon = reportTypeIcons[rt.type];
                return (
                  <button
                    key={rt.type}
                    onClick={() => setSelectedType(rt.type)}
                    className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      selectedType === rt.type
                        ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-1.5" />
                    {rt.label}
                  </button>
                );
              })}
            </div>

            {/* Favorites Toggle */}
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ml-auto ${
                showFavoritesOnly
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Star className="w-4 h-4 mr-1.5" />
              Favorites
            </button>
          </div>
        </div>
      </Card>

      {/* Reports List */}
      <div className="space-y-3">
        {filteredReports.map((report) => {
          const TypeIcon = reportTypeIcons[report.reportType];
          return (
            <Card key={report.id} className="hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="p-3 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex-shrink-0">
                    <TypeIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {report.label}
                      </h3>
                      {report.isFavorite && (
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      )}
                      {report.isScheduled && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                          <Calendar className="w-3 h-3 mr-1" />
                          Scheduled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {report.description}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                      {report.moduleLabel && (
                        <span className="inline-flex items-center">
                          <Folder className="w-3.5 h-3.5 mr-1" />
                          {report.moduleLabel}
                        </span>
                      )}
                      {report.category && (
                        <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                          {report.category}
                        </span>
                      )}
                      {report.lastRun && (
                        <span className="inline-flex items-center">
                          <Clock className="w-3.5 h-3.5 mr-1" />
                          Last run: {report.lastRun}
                        </span>
                      )}
                      <span>{report.runCount} runs</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRunReport(report.id)}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                    >
                      <Play className="w-4 h-4 mr-1.5" />
                      Run
                    </button>
                    <div className="relative group">
                      <button className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <Download className="w-4 h-4 mr-1.5" />
                        Export
                      </button>
                      {/* Dropdown would go here */}
                      <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                        <button
                          onClick={() => handleExportReport(report.id, 'csv')}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t-lg"
                        >
                          Export as CSV
                        </button>
                        <button
                          onClick={() => handleExportReport(report.id, 'excel')}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          Export as Excel
                        </button>
                        <button
                          onClick={() => handleExportReport(report.id, 'pdf')}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 last:rounded-b-lg"
                        >
                          Export as PDF
                        </button>
                      </div>
                    </div>
                    <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                      <MoreHorizontal className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredReports.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No reports found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {search
              ? 'Try adjusting your search or filters'
              : 'Get started by creating your first report'}
          </p>
          <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            Create Report
          </button>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              {reports.length}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Reports</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              {reports.filter((r) => r.isScheduled).length}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Scheduled</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              {reports.filter((r) => r.isFavorite).length}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Favorites</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              {reports.reduce((sum, r) => sum + r.runCount, 0)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Runs</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
