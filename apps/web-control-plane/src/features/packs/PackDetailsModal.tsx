import { useState, useCallback, useMemo } from 'react';
import {
  X,
  Package,
  Download,
  ArrowDownCircle,
  RotateCcw,
  Copy,
  Check,
  ExternalLink,
  Clock,
  Tag,
  FileArchive,
  Shield,
} from 'lucide-react';
import { colors } from '../../app/theme/theme';
import {
  controlPlaneApi,
  PackWithReleases,
  PackRelease,
  PackInstallStatusRecord,
  TenantInstance,
} from '../../app/services/api';

interface PackDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pack: PackWithReleases | null;
  instances: TenantInstance[];
  installStatusMap: Map<string, PackInstallStatusRecord>;
  onInstall: (packCode: string, releaseId: string, instanceId: string) => Promise<void>;
  onRollback: (packCode: string, releaseId: string, instanceId: string) => Promise<void>;
}

type ActionState = 'idle' | 'loading';

interface DownloadUrlState {
  releaseId: string;
  url: string;
  expiresAt: Date;
}

export function PackDetailsModal({
  isOpen,
  onClose,
  pack,
  instances,
  installStatusMap,
  onInstall,
  onRollback,
}: PackDetailsModalProps) {
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [downloadUrls, setDownloadUrls] = useState<Map<string, DownloadUrlState>>(new Map());
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [generatingDownloadFor, setGeneratingDownloadFor] = useState<string | null>(null);

  const selectedRelease = useMemo(() => {
    if (!pack || !selectedReleaseId) return null;
    return pack.releases.find((r) => r.releaseId === selectedReleaseId) || null;
  }, [pack, selectedReleaseId]);

  const selectedInstance = useMemo(() => {
    return instances.find((i) => i.id === selectedInstanceId) || null;
  }, [instances, selectedInstanceId]);

  const formatDate = useCallback((value?: string) => {
    if (!value) return '\u2014';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }, []);

  const handleGenerateDownloadUrl = useCallback(async (releaseId: string) => {
    if (!pack) return;

    const existing = downloadUrls.get(releaseId);
    if (existing && existing.expiresAt > new Date()) {
      return;
    }

    setGeneratingDownloadFor(releaseId);
    try {
      const response = await controlPlaneApi.getPackDownloadUrl(pack.code, releaseId, 3600);
      const expiresAt = new Date(Date.now() + response.expiresInSeconds * 1000);
      setDownloadUrls((prev) => {
        const next = new Map(prev);
        next.set(releaseId, { releaseId, url: response.url, expiresAt });
        return next;
      });
    } catch (error) {
      console.error('Failed to generate download URL:', error);
    } finally {
      setGeneratingDownloadFor(null);
    }
  }, [pack, downloadUrls]);

  const handleCopyUrl = useCallback(async (releaseId: string) => {
    const urlState = downloadUrls.get(releaseId);
    if (!urlState) return;

    try {
      await navigator.clipboard.writeText(urlState.url);
      setCopiedUrl(releaseId);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  }, [downloadUrls]);

  const handleInstall = useCallback(async (releaseId: string) => {
    if (!pack || !selectedInstanceId) return;
    setActionState('loading');
    try {
      await onInstall(pack.code, releaseId, selectedInstanceId);
    } finally {
      setActionState('idle');
    }
  }, [pack, selectedInstanceId, onInstall]);

  const handleRollback = useCallback(async (releaseId: string) => {
    if (!pack || !selectedInstanceId) return;
    setActionState('loading');
    try {
      await onRollback(pack.code, releaseId, selectedInstanceId);
    } finally {
      setActionState('idle');
    }
  }, [pack, selectedInstanceId, onRollback]);

  const getInstallStatus = useCallback((releaseId: string): PackInstallStatusRecord | undefined => {
    if (!pack) return undefined;
    return installStatusMap.get(`${pack.code}:${releaseId}`);
  }, [pack, installStatusMap]);

  const statusBadge = useCallback((status?: string) => {
    if (!status) {
      return { label: 'Not installed', background: colors.glass.medium, color: colors.text.tertiary };
    }
    switch (status) {
      case 'applied':
        return { label: 'Applied', background: colors.success.glow, color: colors.success.base };
      case 'applying':
        return { label: 'Applying', background: colors.warning.glow, color: colors.warning.base };
      case 'failed':
        return { label: 'Failed', background: colors.danger.glow, color: colors.danger.base };
      case 'rolled_back':
        return { label: 'Rolled back', background: colors.info.glow, color: colors.info.base };
      case 'skipped':
        return { label: 'Skipped', background: colors.glass.medium, color: colors.text.tertiary };
      default:
        return { label: status, background: colors.glass.medium, color: colors.text.tertiary };
    }
  }, []);

  const getCompatibilityInfo = useCallback((release: PackRelease) => {
    const compatibility = release.compatibility as {
      platform_min_release_id?: string;
      platform_max_release_id?: string;
    } | null;
    if (!compatibility) return null;
    return {
      min: compatibility.platform_min_release_id,
      max: compatibility.platform_max_release_id,
    };
  }, []);

  if (!isOpen || !pack) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] rounded-2xl border overflow-hidden flex flex-col"
        style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: colors.glass.border }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: colors.glass.medium }}
            >
              <Package size={24} style={{ color: colors.brand.primary }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: colors.text.primary }}>
                {pack.name}
              </h2>
              <div className="flex items-center gap-2 text-sm" style={{ color: colors.text.tertiary }}>
                <span>{pack.code}</span>
                <span>\u2022</span>
                <span>{pack.publisher}</span>
                {pack.license && (
                  <>
                    <span>\u2022</span>
                    <span>{pack.license}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: colors.text.muted }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {pack.description && (
            <p className="text-sm mb-6" style={{ color: colors.text.secondary }}>
              {pack.description}
            </p>
          )}

          <div className="mb-6">
            <div
              className="flex items-center justify-between p-4 rounded-xl border"
              style={{ backgroundColor: colors.glass.subtle, borderColor: colors.glass.border }}
            >
              <div>
                <div className="text-sm font-semibold" style={{ color: colors.text.primary }}>
                  Target Instance
                </div>
                <div className="text-xs" style={{ color: colors.text.tertiary }}>
                  Select an instance to view installation status and perform actions.
                </div>
              </div>
              <select
                value={selectedInstanceId}
                onChange={(e) => setSelectedInstanceId(e.target.value)}
                className="px-3 py-2 rounded-lg border text-sm min-w-[280px]"
                style={{
                  backgroundColor: colors.glass.medium,
                  borderColor: colors.glass.border,
                  color: colors.text.primary,
                }}
              >
                <option value="">Select an instance</option>
                {instances.map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    {instance.domain || instance.id} \u2022 {instance.environment} \u2022 {instance.region}
                  </option>
                ))}
              </select>
            </div>
            {selectedInstance && (
              <div className="mt-2 text-xs px-4" style={{ color: colors.text.secondary }}>
                {selectedInstance.customer?.name || selectedInstance.customerId} \u2022{' '}
                {selectedInstance.status} \u2022 v{selectedInstance.version}
              </div>
            )}
          </div>

          <div className="mb-4">
            <h3 className="text-base font-semibold mb-3" style={{ color: colors.text.primary }}>
              Releases ({pack.releases.length})
            </h3>
          </div>

          <div className="flex flex-col gap-3">
            {pack.releases.length === 0 ? (
              <div
                className="text-center py-8 rounded-xl border"
                style={{ backgroundColor: colors.glass.subtle, borderColor: colors.glass.border }}
              >
                <FileArchive size={32} className="mx-auto mb-2" style={{ color: colors.text.muted }} />
                <p className="text-sm" style={{ color: colors.text.secondary }}>
                  No releases registered for this pack.
                </p>
              </div>
            ) : (
              pack.releases.map((release) => {
                const installStatus = getInstallStatus(release.releaseId);
                const statusMeta = statusBadge(installStatus?.status);
                const compatibility = getCompatibilityInfo(release);
                const downloadUrlState = downloadUrls.get(release.releaseId);
                const isExpanded = selectedReleaseId === release.releaseId;
                const isGeneratingDownload = generatingDownloadFor === release.releaseId;
                const hasValidDownloadUrl =
                  downloadUrlState && downloadUrlState.expiresAt > new Date();
                const canRollback =
                  selectedInstanceId && installStatus?.status === 'applied';

                return (
                  <div
                    key={release.id}
                    className="rounded-xl border overflow-hidden"
                    style={{ backgroundColor: colors.glass.subtle, borderColor: colors.glass.border }}
                  >
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer"
                      onClick={() => setSelectedReleaseId(isExpanded ? null : release.releaseId)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Tag size={16} style={{ color: colors.brand.primary }} />
                          <span className="font-mono font-semibold" style={{ color: colors.text.primary }}>
                            {release.releaseId}
                          </span>
                        </div>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: release.isActive ? colors.success.glow : colors.glass.medium,
                            color: release.isActive ? colors.success.base : colors.text.tertiary,
                          }}
                        >
                          {release.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {selectedInstanceId && (
                          <span
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{ backgroundColor: statusMeta.background, color: statusMeta.color }}
                          >
                            {statusMeta.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-xs" style={{ color: colors.text.tertiary }}>
                          <Clock size={12} />
                          <span>{formatDate(release.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div
                        className="px-4 pb-4 pt-2 border-t"
                        style={{ borderColor: colors.glass.border }}
                      >
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <div className="text-xs uppercase tracking-wide mb-1" style={{ color: colors.text.muted }}>
                              Manifest Revision
                            </div>
                            <div className="text-sm font-mono" style={{ color: colors.text.secondary }}>
                              {release.manifestRevision}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide mb-1" style={{ color: colors.text.muted }}>
                              Assets
                            </div>
                            <div className="text-sm" style={{ color: colors.text.secondary }}>
                              {Array.isArray(release.assets) ? release.assets.length : 0} files
                            </div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide mb-1" style={{ color: colors.text.muted }}>
                              Artifact SHA256
                            </div>
                            <div
                              className="text-sm font-mono truncate"
                              style={{ color: colors.text.secondary }}
                              title={release.artifactSha256}
                            >
                              {release.artifactSha256.slice(0, 16)}...
                            </div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide mb-1" style={{ color: colors.text.muted }}>
                              Signature Key
                            </div>
                            <div className="text-sm font-mono" style={{ color: colors.text.secondary }}>
                              {release.signatureKeyId}
                            </div>
                          </div>
                        </div>

                        {compatibility && (
                          <div
                            className="flex items-center gap-2 p-3 rounded-lg mb-4"
                            style={{ backgroundColor: colors.glass.medium }}
                          >
                            <Shield size={14} style={{ color: colors.info.base }} />
                            <span className="text-xs" style={{ color: colors.text.secondary }}>
                              Compatible with platform versions {compatibility.min} - {compatibility.max}
                              {selectedInstance && (
                                <span style={{ color: colors.text.tertiary }}>
                                  {' '}(Instance: v{selectedInstance.version})
                                </span>
                              )}
                            </span>
                          </div>
                        )}

                        {installStatus?.completedAt && (
                          <div
                            className="flex items-center gap-2 p-3 rounded-lg mb-4"
                            style={{ backgroundColor: colors.glass.medium }}
                          >
                            <Clock size={14} style={{ color: colors.text.muted }} />
                            <span className="text-xs" style={{ color: colors.text.secondary }}>
                              Last action completed: {formatDate(installStatus.completedAt)}
                            </span>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateDownloadUrl(release.releaseId);
                            }}
                            disabled={isGeneratingDownload}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50"
                            style={{ borderColor: colors.glass.border, color: colors.text.secondary }}
                          >
                            <Download size={14} />
                            {isGeneratingDownload ? 'Generating...' : 'Generate Download URL'}
                          </button>

                          {hasValidDownloadUrl && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyUrl(release.releaseId);
                                }}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors"
                                style={{ borderColor: colors.glass.border, color: colors.text.secondary }}
                              >
                                {copiedUrl === release.releaseId ? (
                                  <>
                                    <Check size={14} style={{ color: colors.success.base }} />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy size={14} />
                                    Copy URL
                                  </>
                                )}
                              </button>
                              <a
                                href={downloadUrlState.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors"
                                style={{ borderColor: colors.glass.border, color: colors.text.secondary }}
                              >
                                <ExternalLink size={14} />
                                Open URL
                              </a>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInstall(release.releaseId);
                            }}
                            disabled={!selectedInstanceId || actionState === 'loading'}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50"
                            style={{
                              backgroundColor: colors.brand.primary,
                              color: colors.text.primary,
                            }}
                          >
                            <ArrowDownCircle size={14} />
                            Install
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRollback(release.releaseId);
                            }}
                            disabled={!canRollback || actionState === 'loading'}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50"
                            style={{
                              backgroundColor: colors.glass.medium,
                              color: colors.text.primary,
                            }}
                          >
                            <RotateCcw size={14} />
                            Rollback
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
