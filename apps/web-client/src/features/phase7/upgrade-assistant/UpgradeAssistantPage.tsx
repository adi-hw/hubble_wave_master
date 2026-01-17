import { useState, useEffect } from 'react';
import {
  ArrowUpCircle,
  Shield,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  FileText,
  Code,
  Database,
  Settings,
  ChevronRight,
  History,
  Zap,
  XCircle,
  Info,
} from 'lucide-react';
import {
  upgradeAssistantApi,
  UpgradeAnalysis,
  UpgradeImpact,
} from '../../../services/phase7Api';

const impactColors: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  none: { bg: 'bg-success-subtle', text: 'text-success-text', icon: CheckCircle2 },
  low: { bg: 'bg-info-subtle', text: 'text-info-text', icon: Info },
  medium: { bg: 'bg-warning-subtle', text: 'text-warning-text', icon: AlertTriangle },
  high: { bg: 'bg-danger-subtle', text: 'text-danger-text', icon: XCircle },
  critical: { bg: 'bg-danger-subtle', text: 'text-danger-text', icon: XCircle },
};

const categoryIcons: Record<string, React.ElementType> = {
  schema: Database,
  automation: Zap,
  process_flow: Settings,
  view: FileText,
  code: Code,
};

export const UpgradeAssistantPage: React.FC = () => {
  const [analysis, setAnalysis] = useState<UpgradeAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedImpact, setSelectedImpact] = useState<UpgradeImpact | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [targetVersion, setTargetVersion] = useState('');
  const [currentVersion, setCurrentVersion] = useState('');

  useEffect(() => {
    loadCurrentStatus();
  }, []);

  const loadCurrentStatus = async () => {
    setLoading(true);
    try {
      const response = await upgradeAssistantApi.getCurrentVersion();
      setCurrentVersion(response.version || '2.4.0');
      setTargetVersion(response.latestVersion || '2.5.0');
      if (response.pendingAnalysis) {
        setAnalysis(response.pendingAnalysis);
      }
    } catch (error) {
      console.error('Failed to load status:', error);
      setCurrentVersion('2.4.0');
      setTargetVersion('2.5.0');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!targetVersion || !currentVersion) return;
    setAnalyzing(true);
    try {
      const response = await upgradeAssistantApi.analyzeUpgrade(currentVersion, targetVersion);
      setAnalysis(response.analysis);
    } catch (error) {
      console.error('Failed to analyze:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApplyUpgrade = async () => {
    if (!analysis) return;
    setUpgrading(true);
    try {
      await upgradeAssistantApi.applyUpgrade(analysis.id);
      loadCurrentStatus();
    } catch (error) {
      console.error('Failed to apply upgrade:', error);
    } finally {
      setUpgrading(false);
    }
  };

  const handleApplyFix = async (impactId: string) => {
    try {
      await upgradeAssistantApi.applyFix(impactId);
      if (analysis) {
        handleAnalyze();
      }
    } catch (error) {
      console.error('Failed to apply fix:', error);
    }
  };

  const getImpactSummary = () => {
    if (!analysis) return { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
    const impacts = analysis.impacts || [];
    return {
      total: impacts.length,
      critical: impacts.filter(i => i.severity === 'critical').length,
      high: impacts.filter(i => i.severity === 'high').length,
      medium: impacts.filter(i => i.severity === 'medium').length,
      low: impacts.filter(i => i.severity === 'low' || i.severity === 'none').length,
    };
  };

  const summary = getImpactSummary();

  const getCompatibilityClasses = (score: number) => {
    if (score >= 80) return { bg: 'bg-success-subtle', text: 'text-success-text' };
    if (score >= 50) return { bg: 'bg-warning-subtle', text: 'text-warning-text' };
    return { bg: 'bg-danger-subtle', text: 'text-danger-text' };
  };

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Upgrade Assistant
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered impact analysis and safe upgrades
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-lg border bg-card border-border flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Current:</span>
            <span className="font-mono font-medium text-foreground">
              {currentVersion || 'Loading...'}
            </span>
          </div>
        </div>
      </div>

      {/* Version Selection & Analyze */}
      <div className="p-6 rounded-xl border bg-card border-border mb-6">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2 text-muted-foreground">
              Target Version
            </label>
            <input
              type="text"
              value={targetVersion}
              onChange={(e) => setTargetVersion(e.target.value)}
              placeholder="e.g., 2.5.0"
              className="w-full px-4 py-2 rounded-lg border font-mono bg-background border-border text-foreground"
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={!targetVersion || analyzing}
            className="flex items-center gap-2 px-6 py-2 rounded-lg font-medium bg-primary text-primary-foreground disabled:opacity-50"
          >
            {analyzing ? (
              <>
                <RotateCcw className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4" />
                Analyze Impact
              </>
            )}
          </button>
        </div>
      </div>

      {/* Analysis Results */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <RotateCcw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : analysis ? (
        <div className="flex-1 flex gap-6 overflow-hidden">
          {/* Impact Summary */}
          <div className="w-80 shrink-0 space-y-4">
            <div className="p-4 rounded-xl border bg-card border-border">
              <div className="flex items-center gap-2 mb-4">
                <ArrowUpCircle className="h-5 w-5 text-primary" />
                <h3 className="font-medium text-foreground">
                  Upgrade to {analysis.targetVersion}
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Impacts</span>
                  <span className="font-medium text-foreground">{summary.total}</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between items-center">
                  <span className="text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-danger" />
                    Critical
                  </span>
                  <span className="font-medium text-danger-text">{summary.critical}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-warning" />
                    High
                  </span>
                  <span className="font-medium text-warning-text">{summary.high}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-info" />
                    Medium
                  </span>
                  <span className="font-medium text-info-text">{summary.medium}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-success" />
                    Low/None
                  </span>
                  <span className="font-medium text-success-text">{summary.low}</span>
                </div>
              </div>
            </div>

            {/* Compatibility Score */}
            <div className="p-4 rounded-xl border bg-card border-border">
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                Compatibility Score
              </h3>
              <div className="flex items-center gap-4">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold ${getCompatibilityClasses(analysis.compatibilityScore).bg} ${getCompatibilityClasses(analysis.compatibilityScore).text}`}
                >
                  {analysis.compatibilityScore}%
                </div>
                <div className="flex-1">
                  <p className="text-sm text-foreground">
                    {analysis.compatibilityScore >= 80
                      ? 'Safe to upgrade'
                      : analysis.compatibilityScore >= 50
                      ? 'Review recommended'
                      : 'High risk upgrade'}
                  </p>
                  <p className="text-xs mt-1 text-muted-foreground">
                    Based on customization analysis
                  </p>
                </div>
              </div>
            </div>

            {/* Apply Upgrade Button */}
            <button
              onClick={handleApplyUpgrade}
              disabled={summary.critical > 0 || upgrading}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium ${
                summary.critical > 0
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-primary text-primary-foreground'
              }`}
            >
              {upgrading ? (
                <>
                  <RotateCcw className="h-4 w-4 animate-spin" />
                  Upgrading...
                </>
              ) : (
                <>
                  <ArrowUpCircle className="h-4 w-4" />
                  Apply Upgrade
                </>
              )}
            </button>
            {summary.critical > 0 && (
              <p className="text-xs text-center text-danger-text">
                Resolve critical issues before upgrading
              </p>
            )}
          </div>

          {/* Impacts List */}
          <div className="flex-1 rounded-xl border bg-card border-border overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                Impact Analysis
              </h2>
              <p className="text-sm text-muted-foreground">
                Review and resolve potential upgrade conflicts
              </p>
            </div>
            <div className="flex-1 overflow-auto">
              {(analysis.impacts || []).length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-success-text" />
                    <p className="font-medium text-foreground">No conflicts detected</p>
                    <p className="text-sm mt-1 text-muted-foreground">
                      Your instance is fully compatible with this upgrade
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {(analysis.impacts || []).map((impact) => {
                    const severity = impactColors[impact.severity] || impactColors.low;
                    const SeverityIcon = severity.icon;
                    const CategoryIcon = categoryIcons[impact.category] || FileText;
                    const isSelected = selectedImpact?.id === impact.id;

                    return (
                      <div
                        key={impact.id}
                        onClick={() => setSelectedImpact(isSelected ? null : impact)}
                        className={`p-4 cursor-pointer transition-all hover:bg-muted/50 ${isSelected ? 'bg-muted' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg shrink-0 ${severity.bg}`}>
                            <SeverityIcon className={`h-4 w-4 ${severity.text}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-foreground">
                                {impact.title}
                              </h4>
                              <span className="px-2 py-0.5 rounded text-xs capitalize flex items-center gap-1 bg-muted text-muted-foreground">
                                <CategoryIcon className="h-3 w-3" />
                                {impact.category}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {impact.description}
                            </p>
                            {isSelected && (
                              <div className="mt-4 space-y-3">
                                <div className="p-3 rounded-lg bg-background">
                                  <h5 className="text-xs font-medium mb-1 text-muted-foreground">
                                    Affected Artifact
                                  </h5>
                                  <p className="text-sm font-mono text-foreground">
                                    {impact.affectedArtifact}
                                  </p>
                                </div>
                                {impact.suggestedFix && (
                                  <div className="p-3 rounded-lg bg-success-subtle">
                                    <h5 className="text-xs font-medium mb-1 text-success-text">
                                      Suggested Fix
                                    </h5>
                                    <p className="text-sm text-foreground">
                                      {impact.suggestedFix}
                                    </p>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleApplyFix(impact.id); }}
                                      className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium bg-primary text-primary-foreground"
                                    >
                                      <Zap className="h-3 w-3" />
                                      Apply Fix
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <ChevronRight
                            className={`h-5 w-5 shrink-0 transition-transform text-muted-foreground ${isSelected ? 'rotate-90' : ''}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 rounded-xl border bg-card border-border flex items-center justify-center">
          <div className="text-center max-w-md">
            <ArrowUpCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2 text-foreground">
              Safe Platform Upgrades
            </h2>
            <p className="text-sm mb-6 text-muted-foreground">
              Enter a target version to analyze the impact on your customizations, automations, and configurations.
              The AI will identify potential conflicts and suggest fixes.
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                Impact Analysis
              </span>
              <span className="flex items-center gap-1">
                <Zap className="h-4 w-4" />
                Auto-Fix
              </span>
              <span className="flex items-center gap-1">
                <History className="h-4 w-4" />
                Rollback Support
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpgradeAssistantPage;
