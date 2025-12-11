import React, { useState, useMemo } from 'react';
import {
  ArrowUpCircle,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Loader2,
  ChevronRight,
  Clock,
  FileText,
  Shield,
  Layers,
  Info,
} from 'lucide-react';
import { PageHeader } from '../components/Breadcrumb';
import { useUpgradeManifests, useCustomizationList } from '../hooks';
import { Button } from '../../../components/ui';

export const UpgradeCenterPage: React.FC = () => {
  const [selectedManifest, setSelectedManifest] = useState<string | null>(null);

  // Fetch upgrade manifests
  const { manifests, loading: manifestsLoading, error: manifestsError, refetch: refetchManifests } = useUpgradeManifests();

  // Fetch customizations to show summary
  const { customizations, loading: customizationsLoading } = useCustomizationList({ active: true });

  // Calculate customization stats
  const customizationStats = useMemo(() => {
    return {
      total: customizations.length,
      overrides: customizations.filter(c => c.customizationType === 'override').length,
      extensions: customizations.filter(c => c.customizationType === 'extend').length,
      custom: customizations.filter(c => c.customizationType === 'new').length,
    };
  }, [customizations]);

  // Simulated current version (since the endpoint returns placeholder)
  const currentVersion = '1.0.0';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Upgrade Center"
        description="Manage platform upgrades and analyze customization impacts"
        breadcrumbs={[
          { label: 'Studio', href: '/studio' },
          { label: 'Upgrade Center' },
        ]}
      />

      {/* Current Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Current Version */}
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
            >
              <Layers className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <div className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                Current Version
              </div>
              <div className="text-xl font-semibold" style={{ color: 'var(--hw-text)' }}>
                v{currentVersion}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            Up to date
          </div>
        </div>

        {/* Available Upgrades */}
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
            >
              <ArrowUpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                Available Upgrades
              </div>
              <div className="text-xl font-semibold" style={{ color: 'var(--hw-text)' }}>
                {manifestsLoading ? '-' : manifests.length}
              </div>
            </div>
          </div>
          <div className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
            {manifests.length === 0 ? 'No upgrades available' : 'Ready to install'}
          </div>
        </div>

        {/* Active Customizations */}
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
            >
              <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                Active Customizations
              </div>
              <div className="text-xl font-semibold" style={{ color: 'var(--hw-text)' }}>
                {customizationsLoading ? '-' : customizationStats.total}
              </div>
            </div>
          </div>
          <div className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
            {customizationStats.overrides} overrides, {customizationStats.extensions} extensions
          </div>
        </div>

        {/* Last Upgrade */}
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
            >
              <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                Last Upgrade
              </div>
              <div className="text-xl font-semibold" style={{ color: 'var(--hw-text)' }}>
                Initial
              </div>
            </div>
          </div>
          <div className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
            Platform installed
          </div>
        </div>
      </div>

      {/* Error State */}
      {manifestsError && (
        <div
          className="mb-6 p-4 rounded-xl border flex items-center gap-3"
          style={{
            backgroundColor: 'var(--hw-danger-subtle)',
            borderColor: 'var(--hw-danger)',
            color: 'var(--hw-danger)',
          }}
        >
          <XCircle className="h-5 w-5 flex-shrink-0" />
          <div>
            <div className="font-medium">Failed to load upgrade information</div>
            <div className="text-sm opacity-80">{manifestsError}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetchManifests()} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upgrade Manifests List */}
        <div className="lg:col-span-2">
          <div
            className="rounded-xl border"
            style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
          >
            <div
              className="p-4 border-b flex items-center justify-between"
              style={{ borderColor: 'var(--hw-border)' }}
            >
              <h2 className="font-medium" style={{ color: 'var(--hw-text)' }}>
                Available Upgrades
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchManifests()}
                disabled={manifestsLoading}
              >
                <RefreshCw className={`h-4 w-4 ${manifestsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {manifestsLoading && (
              <div className="p-12 text-center">
                <Loader2
                  className="h-8 w-8 mx-auto mb-3 animate-spin"
                  style={{ color: 'var(--hw-text-muted)' }}
                />
                <p className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                  Checking for upgrades...
                </p>
              </div>
            )}

            {!manifestsLoading && manifests.length === 0 && (
              <div className="p-12 text-center">
                <CheckCircle
                  className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50"
                />
                <p className="text-lg font-medium" style={{ color: 'var(--hw-text)' }}>
                  You're up to date!
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--hw-text-muted)' }}>
                  No platform upgrades are currently available.
                </p>
                <p className="text-xs mt-4" style={{ color: 'var(--hw-text-muted)' }}>
                  The upgrade system will notify you when new versions are released.
                </p>
              </div>
            )}

            {!manifestsLoading && manifests.length > 0 && (
              <div className="divide-y" style={{ borderColor: 'var(--hw-border)' }}>
                {manifests.map((manifest) => (
                  <div
                    key={manifest.id}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedManifest === manifest.id ? 'ring-2 ring-inset ring-primary-500' : ''
                    }`}
                    onClick={() => setSelectedManifest(manifest.id)}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = 'var(--hw-bg-subtle)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = 'transparent')
                    }
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
                        >
                          <ArrowUpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: 'var(--hw-text)' }}>
                              v{manifest.fromVersion} → v{manifest.toVersion}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full ${
                                manifest.upgradeType === 'major'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : manifest.upgradeType === 'minor'
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              }`}
                            >
                              {manifest.upgradeType}
                            </span>
                            {manifest.isMandatory && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                Required
                              </span>
                            )}
                          </div>
                          <p className="text-sm mt-1" style={{ color: 'var(--hw-text-muted)' }}>
                            {manifest.description || 'No description provided'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight
                        className="h-5 w-5 flex-shrink-0"
                        style={{ color: 'var(--hw-text-muted)' }}
                      />
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                      {manifest.releaseDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {new Date(manifest.releaseDate).toLocaleDateString()}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        {manifest.configChanges?.length || 0} changes
                      </span>
                      {manifest.breakingChanges?.length > 0 && (
                        <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                          <AlertTriangle className="h-4 w-4" />
                          {manifest.breakingChanges.length} breaking
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Customization Summary & Impact Preview */}
        <div className="space-y-6">
          {/* Customization Summary */}
          <div
            className="rounded-xl border"
            style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
          >
            <div
              className="p-4 border-b"
              style={{ borderColor: 'var(--hw-border)' }}
            >
              <h2 className="font-medium" style={{ color: 'var(--hw-text)' }}>
                Your Customizations
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--hw-text-muted)' }}>
                These may be affected by upgrades
              </p>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                  Overrides
                </span>
                <span
                  className="px-2 py-0.5 text-sm rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                >
                  {customizationStats.overrides}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                  Extensions
                </span>
                <span
                  className="px-2 py-0.5 text-sm rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                >
                  {customizationStats.extensions}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                  Custom
                </span>
                <span
                  className="px-2 py-0.5 text-sm rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                >
                  {customizationStats.custom}
                </span>
              </div>

              <div className="pt-2 border-t" style={{ borderColor: 'var(--hw-border)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                  <Shield className="h-4 w-4" />
                  <span>
                    {customizationStats.overrides > 0
                      ? 'Overrides may require review during upgrades'
                      : 'No overrides to review'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Upgrade Guidelines */}
          <div
            className="rounded-xl border"
            style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
          >
            <div
              className="p-4 border-b"
              style={{ borderColor: 'var(--hw-border)' }}
            >
              <h2 className="font-medium" style={{ color: 'var(--hw-text)' }}>
                Before You Upgrade
              </h2>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span style={{ color: 'var(--hw-text-muted)' }}>
                  Back up your tenant database
                </span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span style={{ color: 'var(--hw-text-muted)' }}>
                  Review the impact analysis for your customizations
                </span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span style={{ color: 'var(--hw-text-muted)' }}>
                  Test in a staging environment first
                </span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span style={{ color: 'var(--hw-text-muted)' }}>
                  Schedule during a maintenance window
                </span>
              </div>
            </div>
          </div>

          {/* Help Card */}
          <div
            className="rounded-xl border p-4"
            style={{
              backgroundColor: 'var(--hw-bg-subtle)',
              borderColor: 'var(--hw-border)',
            }}
          >
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-sm" style={{ color: 'var(--hw-text)' }}>
                  Need Help?
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--hw-text-muted)' }}>
                  Contact your platform administrator for assistance with complex
                  upgrades or customization conflicts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradeCenterPage;
