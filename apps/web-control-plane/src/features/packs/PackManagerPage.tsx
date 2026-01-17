import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Package,
  RefreshCw,
  Upload,
  Search,
  ChevronRight,
  Clock,
  Tag,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { colors } from '../../app/theme/theme';
import {
  controlPlaneApi,
  PackWithReleases,
  PackInstallStatusRecord,
  TenantInstance,
} from '../../app/services/api';
import { PackUploadModal } from './PackUploadModal';
import { PackDetailsModal } from './PackDetailsModal';

type StatusMessage = {
  type: 'success' | 'error';
  text: string;
};

export function PackManagerPage() {
  const [packs, setPacks] = useState<PackWithReleases[]>([]);
  const [instances, setInstances] = useState<TenantInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [installStatuses, setInstallStatuses] = useState<PackInstallStatusRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedPack, setSelectedPack] = useState<PackWithReleases | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedInstanceId),
    [instances, selectedInstanceId]
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [packsResponse, instancesResponse] = await Promise.all([
        controlPlaneApi.getPacks(),
        controlPlaneApi.getInstances(),
      ]);
      setPacks(packsResponse);
      setInstances(instancesResponse.data);
      if (!selectedInstanceId && instancesResponse.data.length > 0) {
        const preferred =
          instancesResponse.data.find((instance) => instance.status === 'active') ||
          instancesResponse.data[0];
        if (preferred) {
          setSelectedInstanceId(preferred.id);
        }
      }
      setError(null);
    } catch (err: unknown) {
      console.error('Failed to load packs:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load packs. Ensure the control plane service is running.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedInstanceId]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedInstanceId) {
      setInstallStatuses([]);
      return;
    }

    let active = true;

    const loadStatuses = async () => {
      try {
        const records = await controlPlaneApi.getPackInstallStatus({
          instanceId: selectedInstanceId,
          limit: 200,
        });
        if (!active) return;
        const sorted = [...records].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setInstallStatuses(sorted);
      } catch (err) {
        console.error('Failed to load pack install statuses:', err);
      }
    };

    loadStatuses();
    const intervalId = setInterval(loadStatuses, 15000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [selectedInstanceId]);

  const installStatusMap = useMemo(() => {
    const map = new Map<string, PackInstallStatusRecord>();
    for (const record of installStatuses) {
      const key = `${record.packCode}:${record.packReleaseId}`;
      if (!map.has(key)) {
        map.set(key, record);
      }
    }
    return map;
  }, [installStatuses]);

  const filteredPacks = useMemo(() => {
    if (!searchQuery.trim()) return packs;
    const query = searchQuery.toLowerCase();
    return packs.filter(
      (pack) =>
        pack.name.toLowerCase().includes(query) ||
        pack.code.toLowerCase().includes(query) ||
        pack.publisher.toLowerCase().includes(query) ||
        pack.description?.toLowerCase().includes(query)
    );
  }, [packs, searchQuery]);

  const handleInstall = useCallback(
    async (packCode: string, releaseId: string, instanceId: string) => {
      setStatusMessage(null);
      try {
        await controlPlaneApi.triggerPackInstall({
          instanceId,
          packCode,
          releaseId,
        });
        const records = await controlPlaneApi.getPackInstallStatus({
          instanceId,
          packCode,
          releaseId,
          limit: 20,
        });
        if (records.length > 0) {
          const sorted = [...records].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setInstallStatuses((prev) => [...sorted, ...prev]);
        }
        setStatusMessage({
          type: 'success',
          text: `Install triggered for ${packCode}@${releaseId}.`,
        });
      } catch (err: unknown) {
        console.error('Failed to trigger install:', err);
        const message =
          err instanceof Error ? err.message : 'Pack install failed.';
        const isCompatibility =
          typeof message === 'string' && message.toLowerCase().includes('compatibility');
        setStatusMessage({
          type: 'error',
          text: isCompatibility ? `Compatibility check failed: ${message}` : message,
        });
        throw err;
      }
    },
    []
  );

  const handleRollback = useCallback(
    async (packCode: string, releaseId: string, instanceId: string) => {
      setStatusMessage(null);
      try {
        await controlPlaneApi.triggerPackRollback({
          instanceId,
          packCode,
          releaseId,
        });
        const records = await controlPlaneApi.getPackInstallStatus({
          instanceId,
          packCode,
          releaseId,
          limit: 20,
        });
        if (records.length > 0) {
          const sorted = [...records].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setInstallStatuses((prev) => [...sorted, ...prev]);
        }
        setStatusMessage({
          type: 'success',
          text: `Rollback triggered for ${packCode}@${releaseId}.`,
        });
      } catch (err: unknown) {
        console.error('Failed to trigger rollback:', err);
        const message = err instanceof Error ? err.message : 'Pack rollback failed.';
        setStatusMessage({ type: 'error', text: message });
        throw err;
      }
    },
    []
  );

  const handleUploadComplete = useCallback(() => {
    setIsUploadModalOpen(false);
    fetchData();
    setStatusMessage({
      type: 'success',
      text: 'Pack artifact uploaded and registered successfully.',
    });
  }, [fetchData]);

  const handleOpenDetails = useCallback((pack: PackWithReleases) => {
    setSelectedPack(pack);
    setIsDetailsModalOpen(true);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setIsDetailsModalOpen(false);
    setSelectedPack(null);
  }, []);

  const formatDate = useCallback((value?: string) => {
    if (!value) return '\u2014';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
  }, []);

  const getLatestRelease = useCallback((pack: PackWithReleases) => {
    if (!pack.releases || pack.releases.length === 0) return null;
    const activeRelease = pack.releases.find((r) => r.isActive);
    if (activeRelease) return activeRelease;
    const sorted = [...pack.releases].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return sorted[0];
  }, []);

  const getPackInstallStatus = useCallback(
    (pack: PackWithReleases) => {
      if (!selectedInstanceId) return null;
      for (const release of pack.releases) {
        const status = installStatusMap.get(`${pack.code}:${release.releaseId}`);
        if (status) return status;
      }
      return null;
    },
    [selectedInstanceId, installStatusMap]
  );

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: colors.text.primary }}>
          Pack Manager
        </h1>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50"
            style={{ borderColor: colors.glass.border, color: colors.text.secondary }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Sync
          </button>
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-opacity hover:opacity-90"
            style={{
              background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
            }}
          >
            <Upload size={18} />
            Upload Pack
          </button>
        </div>
      </div>

      {error && (
        <div
          className="flex items-start gap-3 p-4 rounded-2xl border mb-6"
          style={{
            backgroundColor: colors.danger.glow,
            borderColor: colors.danger.base,
          }}
        >
          <AlertCircle size={20} style={{ color: colors.danger.base, flexShrink: 0, marginTop: 2 }} />
          <span style={{ color: colors.danger.base }}>{error}</span>
        </div>
      )}

      {statusMessage && (
        <div
          className="flex items-start gap-3 p-4 rounded-2xl border mb-6"
          style={{
            backgroundColor:
              statusMessage.type === 'success' ? colors.success.glow : colors.danger.glow,
            borderColor:
              statusMessage.type === 'success' ? colors.success.base : colors.danger.base,
          }}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle
              size={20}
              style={{ color: colors.success.base, flexShrink: 0, marginTop: 2 }}
            />
          ) : (
            <AlertCircle
              size={20}
              style={{ color: colors.danger.base, flexShrink: 0, marginTop: 2 }}
            />
          )}
          <span
            style={{
              color: statusMessage.type === 'success' ? colors.success.base : colors.danger.base,
            }}
          >
            {statusMessage.text}
          </span>
        </div>
      )}

      <div
        className="p-4 rounded-2xl border mb-6"
        style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
      >
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg border"
              style={{ backgroundColor: colors.glass.medium, borderColor: colors.glass.border }}
            >
              <Search size={18} style={{ color: colors.text.muted }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search packs by name, code, or publisher..."
                className="flex-1 bg-transparent border-none outline-none text-sm"
                style={{ color: colors.text.primary }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium" style={{ color: colors.text.secondary }}>
              Target Instance:
            </label>
            <select
              value={selectedInstanceId}
              onChange={(e) => setSelectedInstanceId(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm min-w-[240px]"
              style={{
                backgroundColor: colors.glass.medium,
                borderColor: colors.glass.border,
                color: colors.text.primary,
              }}
            >
              <option value="">Select an instance</option>
              {instances.map((instance) => (
                <option key={instance.id} value={instance.id}>
                  {instance.domain || instance.id} \u2022 {instance.environment}
                </option>
              ))}
            </select>
          </div>
        </div>
        {selectedInstance && (
          <div className="mt-2 text-xs px-1" style={{ color: colors.text.tertiary }}>
            {selectedInstance.customer?.name || selectedInstance.customerId} \u2022{' '}
            {selectedInstance.status} \u2022 {selectedInstance.region} \u2022 v
            {selectedInstance.version}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: colors.text.secondary }}>
          <RefreshCw size={32} className="animate-spin mx-auto mb-4" />
          <p>Loading packs...</p>
        </div>
      ) : filteredPacks.length === 0 ? (
        <div className="text-center py-16" style={{ color: colors.text.tertiary }}>
          <Package size={48} className="mx-auto mb-4" style={{ color: colors.text.muted }} />
          <h3 className="text-base font-semibold mb-2" style={{ color: colors.text.secondary }}>
            {searchQuery ? 'No packs match your search' : 'No packs registered'}
          </h3>
          <p className="text-sm">
            {searchQuery
              ? 'Try adjusting your search criteria.'
              : 'Click "Upload Pack" to register your first pack artifact.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPacks.map((pack) => {
            const latestRelease = getLatestRelease(pack);
            const installStatus = getPackInstallStatus(pack);
            const statusMeta = statusBadge(installStatus?.status);

            return (
              <div
                key={pack.id}
                onClick={() => handleOpenDetails(pack)}
                className="p-5 rounded-2xl border cursor-pointer transition-all"
                style={{
                  backgroundColor: colors.void.base,
                  borderColor: colors.glass.border,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.glass.subtle;
                  e.currentTarget.style.borderColor = colors.glass.strong;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.void.base;
                  e.currentTarget.style.borderColor = colors.glass.border;
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: colors.glass.medium }}
                  >
                    <Package size={20} style={{ color: colors.brand.primary }} />
                  </div>
                  <ChevronRight size={18} style={{ color: colors.text.muted }} />
                </div>

                <h3 className="text-base font-semibold mb-1" style={{ color: colors.text.primary }}>
                  {pack.name}
                </h3>
                <div className="text-xs mb-3" style={{ color: colors.text.tertiary }}>
                  {pack.code} \u2022 {pack.publisher}
                </div>

                {pack.description && (
                  <p
                    className="text-sm mb-4 line-clamp-2"
                    style={{ color: colors.text.secondary }}
                  >
                    {pack.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: colors.glass.border }}>
                  <div className="flex items-center gap-3">
                    {latestRelease && (
                      <div className="flex items-center gap-1 text-xs" style={{ color: colors.text.tertiary }}>
                        <Tag size={12} />
                        <span className="font-mono">{latestRelease.releaseId}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs" style={{ color: colors.text.tertiary }}>
                      <Clock size={12} />
                      <span>{formatDate(pack.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ backgroundColor: colors.glass.medium, color: colors.text.secondary }}
                    >
                      {pack.releases.length} release{pack.releases.length !== 1 ? 's' : ''}
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
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PackUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={handleUploadComplete}
      />

      <PackDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={handleCloseDetails}
        pack={selectedPack}
        instances={instances}
        installStatusMap={installStatusMap}
        onInstall={async (packCode, releaseId, instanceId) => {
          await handleInstall(packCode, releaseId, instanceId);
        }}
        onRollback={async (packCode, releaseId, instanceId) => {
          await handleRollback(packCode, releaseId, instanceId);
        }}
      />
    </div>
  );
}
