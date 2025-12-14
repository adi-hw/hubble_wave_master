import React, { useState } from 'react';
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
  Clock,
  Settings,
  ChevronRight,
  Download,
  Calendar,
  Lock,
  Eye,
  Users,
  Database,
} from 'lucide-react';

type ComplianceFramework = 'gdpr' | 'hipaa' | 'sox' | 'pci';
type ComplianceStatus = 'compliant' | 'partial' | 'non_compliant';

interface FrameworkStatus {
  framework: ComplianceFramework;
  name: string;
  enabled: boolean;
  status: ComplianceStatus;
  score: number;
  lastAssessment?: string;
  controls: {
    total: number;
    passed: number;
    failed: number;
    notApplicable: number;
  };
  upcomingDeadlines: Array<{
    task: string;
    dueDate: string;
  }>;
}

interface DataClassification {
  level: string;
  label: string;
  color: string;
  count: number;
  percentage: number;
}

interface ConsentStat {
  type: string;
  granted: number;
  withdrawn: number;
  pending: number;
}

interface DSRStat {
  type: string;
  label: string;
  count: number;
  avgDays: number;
}

const mockFrameworks: FrameworkStatus[] = [
  {
    framework: 'gdpr',
    name: 'GDPR',
    enabled: true,
    status: 'compliant',
    score: 94,
    lastAssessment: '2024-01-10T00:00:00Z',
    controls: { total: 45, passed: 42, failed: 1, notApplicable: 2 },
    upcomingDeadlines: [
      { task: 'Annual Privacy Impact Assessment', dueDate: '2024-02-15' },
      { task: 'DPO Report Submission', dueDate: '2024-03-01' },
    ],
  },
  {
    framework: 'hipaa',
    name: 'HIPAA',
    enabled: true,
    status: 'partial',
    score: 78,
    lastAssessment: '2024-01-08T00:00:00Z',
    controls: { total: 52, passed: 38, failed: 8, notApplicable: 6 },
    upcomingDeadlines: [
      { task: 'Security Risk Analysis', dueDate: '2024-01-30' },
    ],
  },
  {
    framework: 'sox',
    name: 'SOX',
    enabled: true,
    status: 'compliant',
    score: 91,
    lastAssessment: '2024-01-05T00:00:00Z',
    controls: { total: 38, passed: 35, failed: 2, notApplicable: 1 },
    upcomingDeadlines: [],
  },
  {
    framework: 'pci',
    name: 'PCI DSS',
    enabled: false,
    status: 'non_compliant',
    score: 0,
    controls: { total: 0, passed: 0, failed: 0, notApplicable: 0 },
    upcomingDeadlines: [],
  },
];

const mockClassifications: DataClassification[] = [
  { level: 'public', label: 'Public', color: 'bg-green-500', count: 12500, percentage: 45 },
  { level: 'internal', label: 'Internal', color: 'bg-blue-500', count: 8200, percentage: 30 },
  { level: 'confidential', label: 'Confidential', color: 'bg-amber-500', count: 5100, percentage: 18 },
  { level: 'restricted', label: 'Restricted', color: 'bg-red-500', count: 1800, percentage: 7 },
];

const mockConsents: ConsentStat[] = [
  { type: 'marketing', granted: 8500, withdrawn: 450, pending: 200 },
  { type: 'analytics', granted: 12000, withdrawn: 800, pending: 150 },
  { type: 'third_party', granted: 5200, withdrawn: 1200, pending: 300 },
];

const mockDSRStats: DSRStat[] = [
  { type: 'access', label: 'Access Requests', count: 45, avgDays: 12 },
  { type: 'deletion', label: 'Deletion Requests', count: 23, avgDays: 8 },
  { type: 'rectification', label: 'Rectification', count: 12, avgDays: 5 },
  { type: 'portability', label: 'Data Portability', count: 8, avgDays: 15 },
];

const statusColors: Record<ComplianceStatus, { bg: string; text: string; icon: React.ElementType }> = {
  compliant: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: CheckCircle },
  partial: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: AlertTriangle },
  non_compliant: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: XCircle },
};

export const ComplianceDashboard: React.FC = () => {
  const [frameworks] = useState(mockFrameworks);
  const [classifications] = useState(mockClassifications);
  const [consents] = useState(mockConsents);
  const [dsrStats] = useState(mockDSRStats);
  const [activeTab, setActiveTab] = useState<'overview' | 'frameworks' | 'data' | 'privacy'>('overview');

  const enabledFrameworks = frameworks.filter((f) => f.enabled);
  const overallScore = enabledFrameworks.length > 0
    ? Math.round(enabledFrameworks.reduce((sum, f) => sum + f.score, 0) / enabledFrameworks.length)
    : 0;

  const pendingDSRs = dsrStats.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Compliance Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitor compliance status and manage regulatory requirements
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <Download className="h-4 w-4" />
            Export Report
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            <Settings className="h-4 w-4" />
            Configure
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'frameworks', label: 'Frameworks' },
          { id: 'data', label: 'Data Classification' },
          { id: 'privacy', label: 'Privacy' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Score Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Overall Compliance
                </h3>
                <Shield className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="flex items-end gap-2">
                <span className={`text-4xl font-bold ${
                  overallScore >= 90 ? 'text-green-600' :
                  overallScore >= 70 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {overallScore}%
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400 mb-1">score</span>
              </div>
              <div className="mt-3 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    overallScore >= 90 ? 'bg-green-500' :
                    overallScore >= 70 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${overallScore}%` }}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Active Frameworks
                </h3>
                <FileText className="h-5 w-5 text-indigo-600" />
              </div>
              <p className="text-4xl font-bold text-slate-900 dark:text-white">
                {enabledFrameworks.length}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                of {frameworks.length} available
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Pending DSRs
                </h3>
                <Users className="h-5 w-5 text-indigo-600" />
              </div>
              <p className="text-4xl font-bold text-slate-900 dark:text-white">
                {pendingDSRs}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                data subject requests
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Sensitive Data
                </h3>
                <Lock className="h-5 w-5 text-indigo-600" />
              </div>
              <p className="text-4xl font-bold text-slate-900 dark:text-white">
                {classifications
                  .filter((c) => c.level === 'confidential' || c.level === 'restricted')
                  .reduce((sum, c) => sum + c.count, 0)
                  .toLocaleString()}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                restricted records
              </p>
            </div>
          </div>

          {/* Framework Status Grid */}
          <div className="grid grid-cols-2 gap-4">
            {frameworks.map((framework) => {
              const statusInfo = statusColors[framework.status];
              const StatusIcon = statusInfo.icon;
              return (
                <div
                  key={framework.framework}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-12 w-12 rounded-xl ${statusInfo.bg} flex items-center justify-center`}>
                        <StatusIcon className={`h-6 w-6 ${statusInfo.text}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {framework.name}
                        </h3>
                        <p className={`text-sm ${statusInfo.text} capitalize`}>
                          {framework.status.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    {framework.enabled && (
                      <span className="text-3xl font-bold text-slate-900 dark:text-white">
                        {framework.score}%
                      </span>
                    )}
                  </div>

                  {framework.enabled ? (
                    <>
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        <div className="text-center p-2 bg-slate-50 dark:bg-slate-700 rounded-lg">
                          <p className="text-lg font-semibold text-slate-900 dark:text-white">
                            {framework.controls.total}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
                        </div>
                        <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <p className="text-lg font-semibold text-green-700 dark:text-green-400">
                            {framework.controls.passed}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Passed</p>
                        </div>
                        <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <p className="text-lg font-semibold text-red-700 dark:text-red-400">
                            {framework.controls.failed}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Failed</p>
                        </div>
                        <div className="text-center p-2 bg-slate-50 dark:bg-slate-700 rounded-lg">
                          <p className="text-lg font-semibold text-slate-500 dark:text-slate-400">
                            {framework.controls.notApplicable}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">N/A</p>
                        </div>
                      </div>

                      {framework.upcomingDeadlines.length > 0 && (
                        <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                          <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                            Upcoming Deadlines
                          </h4>
                          <div className="space-y-2">
                            {framework.upcomingDeadlines.map((deadline, index) => (
                              <div key={index} className="flex items-center justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-300">
                                  {deadline.task}
                                </span>
                                <span className="flex items-center gap-1 text-amber-600">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(deadline.dueDate).toLocaleDateString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Framework not enabled
                      </p>
                      <button className="mt-2 text-sm text-indigo-600 hover:text-indigo-700">
                        Enable Framework
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Data Classification Tab */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
              Data Classification Overview
            </h3>

            <div className="grid grid-cols-4 gap-4 mb-6">
              {classifications.map((classification) => (
                <div
                  key={classification.level}
                  className="p-4 bg-slate-50 dark:bg-slate-750 rounded-xl"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-3 h-3 rounded-full ${classification.color}`} />
                    <span className="font-medium text-slate-900 dark:text-white">
                      {classification.label}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {classification.count.toLocaleString()}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {classification.percentage}% of total
                  </p>
                </div>
              ))}
            </div>

            {/* Classification Bar */}
            <div className="h-8 rounded-full overflow-hidden flex">
              {classifications.map((classification) => (
                <div
                  key={classification.level}
                  className={`${classification.color} transition-all`}
                  style={{ width: `${classification.percentage}%` }}
                  title={`${classification.label}: ${classification.percentage}%`}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Total records classified:{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {classifications.reduce((sum, c) => sum + c.count, 0).toLocaleString()}
                </span>
              </p>
              <button className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
                View Classification Rules
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* DLP Incidents */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                DLP Policy Violations
              </h3>
              <button className="text-sm text-indigo-600 hover:text-indigo-700">
                View All Incidents
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800 dark:text-red-200">
                        Sensitive data detected in export
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        Credit card numbers found in customer_data.csv export
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-red-600 dark:text-red-400">
                        <span>User: analyst@company.com</span>
                        <span>2 hours ago</span>
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-medium">
                    Blocked
                  </span>
                </div>
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Eye className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        PII access from unusual location
                      </p>
                      <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                        Employee records accessed from new IP address
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-amber-600 dark:text-amber-400">
                        <span>User: hr.manager@company.com</span>
                        <span>5 hours ago</span>
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-xs font-medium">
                    Allowed with Alert
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Tab */}
      {activeTab === 'privacy' && (
        <div className="space-y-6">
          {/* Consent Management */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
              Consent Management
            </h3>

            <div className="space-y-4">
              {consents.map((consent) => {
                const total = consent.granted + consent.withdrawn + consent.pending;
                const grantedPercent = Math.round((consent.granted / total) * 100);
                return (
                  <div key={consent.type} className="p-4 bg-slate-50 dark:bg-slate-750 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-slate-900 dark:text-white capitalize">
                        {consent.type.replace('_', ' ')} Consent
                      </span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {grantedPercent}% opt-in rate
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-green-600 font-semibold">
                          {consent.granted.toLocaleString()}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 ml-1">granted</span>
                      </div>
                      <div>
                        <span className="text-red-600 font-semibold">
                          {consent.withdrawn.toLocaleString()}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 ml-1">withdrawn</span>
                      </div>
                      <div>
                        <span className="text-amber-600 font-semibold">
                          {consent.pending.toLocaleString()}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 ml-1">pending</span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full mt-3 overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${grantedPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data Subject Requests */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Data Subject Requests (DSR)
              </h3>
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg">
                <FileText className="h-4 w-4" />
                View All Requests
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4">
              {dsrStats.map((dsr) => (
                <div key={dsr.type} className="p-4 bg-slate-50 dark:bg-slate-750 rounded-xl text-center">
                  <Database className="h-8 w-8 mx-auto text-indigo-600 mb-2" />
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {dsr.count}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {dsr.label}
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-2 text-xs text-slate-500 dark:text-slate-400">
                    <Clock className="h-3 w-3" />
                    Avg: {dsr.avgDays} days
                  </div>
                </div>
              ))}
            </div>

            {/* Deadline Warning */}
            <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    3 requests approaching deadline
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    GDPR requires response within 30 days. Action needed for 3 access
                    requests due within the next 5 days.
                  </p>
                  <button className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline">
                    View urgent requests →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Frameworks Tab */}
      {activeTab === 'frameworks' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
              Compliance Framework Configuration
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              Configure and manage compliance frameworks for your organization. Each
              framework has specific controls and requirements that need to be met.
            </p>

            <div className="mt-6 space-y-4">
              {frameworks.map((framework) => (
                <div
                  key={framework.framework}
                  className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <div className="flex items-center gap-4">
                    <Shield className={`h-6 w-6 ${framework.enabled ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {framework.name}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {framework.controls.total} controls
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {framework.enabled && (
                      <span className={`text-lg font-semibold ${
                        framework.score >= 90 ? 'text-green-600' :
                        framework.score >= 70 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {framework.score}%
                      </span>
                    )}
                    <button className="px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                      {framework.enabled ? 'Configure' : 'Enable'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
