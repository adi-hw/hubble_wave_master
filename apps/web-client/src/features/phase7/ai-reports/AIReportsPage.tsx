import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import {
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  Sparkles,
  FileSpreadsheet,
  File,
  LayoutTemplate,
} from 'lucide-react';
import {
  aiReportsApi,
  AIReport,
  AIReportTemplate,
} from '../../../services/phase7Api';

const statusStyles = {
  pending: { bgClass: 'bg-muted', textClass: 'text-muted-foreground', icon: Clock },
  generating: { bgClass: 'bg-info-subtle', textClass: 'text-info-text', icon: RefreshCw },
  completed: { bgClass: 'bg-success-subtle', textClass: 'text-success-text', icon: CheckCircle },
  failed: { bgClass: 'bg-danger-subtle', textClass: 'text-danger-text', icon: XCircle },
};

const formatIcons: Record<string, React.ElementType> = {
  pdf: File,
  xlsx: FileSpreadsheet,
  csv: FileText,
  html: FileText,
};

export const AIReportsPage: React.FC = () => {
  const [reports, setReports] = useState<AIReport[]>([]);
  const [templates, setTemplates] = useState<AIReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reports' | 'templates'>('reports');
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [format, setFormat] = useState<'detailed' | 'summary' | 'executive'>('summary');
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AIReport | null>(null);

  useEffect(() => {
    loadReports();
    loadTemplates();
  }, []);

  const loadReports = async () => {
    try {
      const response = await aiReportsApi.listReports();
      setReports(response.reports);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await aiReportsApi.listTemplates(true);
      setTemplates(response.templates);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const handleGenerateReport = async () => {
    if (!prompt.trim()) return;

    setGenerating(true);
    try {
      await aiReportsApi.generateReport(prompt, { format });
      setGenerateModalOpen(false);
      setPrompt('');
      loadReports();
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    try {
      await aiReportsApi.deleteReport(id);
      loadReports();
      if (selectedReport?.id === id) {
        setSelectedReport(null);
      }
    } catch (error) {
      console.error('Failed to delete report:', error);
    }
  };

  const handleExportReport = async (id: string, exportFormat: string) => {
    try {
      const blob = await aiReportsApi.exportReport(id, exportFormat);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${id}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export report:', error);
    }
  };

  const handleGenerateFromTemplate = async (templateId: string) => {
    try {
      await aiReportsApi.generateFromTemplate(templateId);
      loadReports();
    } catch (error) {
      console.error('Failed to generate from template:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 rounded bg-muted" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 rounded-xl bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            AI Reports
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate intelligent reports from your data using natural language
          </p>
        </div>
        <button
          onClick={() => setGenerateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Generate Report
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {[
          { id: 'reports', label: 'Reports', icon: FileText },
          { id: 'templates', label: 'Templates', icon: LayoutTemplate },
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
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* List */}
        <div className="w-1/2 overflow-auto space-y-3">
          {activeTab === 'reports' ? (
            reports.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium text-foreground">
                  No reports yet
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Generate your first AI-powered report
                </p>
              </div>
            ) : (
              reports.map((report) => {
                const status = statusStyles[report.status];
                const StatusIcon = status.icon;

                return (
                  <div
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all bg-card hover:bg-muted/50 ${
                      selectedReport?.id === report.id
                        ? 'ring-2 ring-offset-2 ring-primary border-primary'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground">
                            {report.title}
                          </h3>
                          <span
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${status.bgClass} ${status.textClass}`}
                          >
                            <StatusIcon className={`h-3 w-3 ${report.status === 'generating' ? 'animate-spin' : ''}`} />
                            {report.status}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-2 text-muted-foreground">
                          {report.prompt}
                        </p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{report.format}</span>
                          <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {report.status === 'completed' && (
                          <div className="flex gap-1">
                            {['pdf', 'xlsx', 'csv'].map((fmt) => {
                              const FormatIcon = formatIcons[fmt] || File;
                              return (
                                <button
                                  key={fmt}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleExportReport(report.id, fmt);
                                  }}
                                  className="p-1.5 rounded bg-muted hover:bg-muted/80 transition-colors"
                                  title={`Export as ${fmt.toUpperCase()}`}
                                >
                                  <FormatIcon className="h-4 w-4 text-muted-foreground" />
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteReport(report.id);
                          }}
                          className="p-1.5 rounded bg-muted hover:bg-danger-subtle transition-colors"
                        >
                          <Trash2 className="h-4 w-4 text-danger-text" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            templates.length === 0 ? (
              <div className="text-center py-12">
                <LayoutTemplate className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium text-foreground">
                  No templates yet
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create reusable report templates
                </p>
              </div>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  className="p-4 rounded-xl border bg-card border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground">
                        {template.name}
                      </h3>
                      {template.description && (
                        <p className="text-sm mt-1 text-muted-foreground">
                          {template.description}
                        </p>
                      )}
                      <p className="text-xs mt-2 font-mono text-muted-foreground">
                        {template.prompt.substring(0, 100)}...
                      </p>
                    </div>
                    <button
                      onClick={() => handleGenerateFromTemplate(template.id)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Sparkles className="h-4 w-4" />
                      Generate
                    </button>
                  </div>
                </div>
              ))
            )
          )}
        </div>

        {/* Preview */}
        <div className="w-1/2 rounded-xl border overflow-hidden bg-card border-border">
          {selectedReport ? (
            <div className="h-full flex flex-col">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-medium text-foreground">
                  {selectedReport.title}
                </h3>
                {selectedReport.status === 'completed' && (
                  <button
                    onClick={() => handleExportReport(selectedReport.id, 'pdf')}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-auto p-4">
                {selectedReport.status === 'generating' ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
                      <p className="text-muted-foreground">Generating report...</p>
                    </div>
                  </div>
                ) : selectedReport.status === 'failed' ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <XCircle className="h-8 w-8 mx-auto mb-3 text-danger-text" />
                      <p className="text-danger-text">Report generation failed</p>
                    </div>
                  </div>
                ) : selectedReport.content ? (
                  <div
                    className="prose max-w-none text-foreground dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedReport.content) }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No content available</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Select a report to preview</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generate Modal */}
      {generateModalOpen && (
        <div className="fixed inset-0 bg-overlay/50 flex items-center justify-center z-50">
          <div className="w-full max-w-lg rounded-xl p-6 bg-card">
            <h2 className="text-lg font-semibold mb-4 text-foreground">
              Generate AI Report
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">
                  What would you like to know?
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  placeholder="e.g., Generate a summary of all work orders completed this month, including performance metrics and any notable trends"
                  className="w-full px-3 py-2 rounded-lg border bg-background border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">
                  Report Format
                </label>
                <div className="flex gap-3">
                  {(['summary', 'detailed', 'executive'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setFormat(fmt)}
                      className={`flex-1 py-2 px-3 rounded-lg border text-sm capitalize transition-colors ${
                        format === fmt
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-background border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setGenerateModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-muted text-foreground hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={!prompt.trim() || generating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIReportsPage;
