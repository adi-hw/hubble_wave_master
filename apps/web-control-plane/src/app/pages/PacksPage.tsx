import { useEffect, useMemo, useState } from 'react';
import { Package, RefreshCw, ArrowDownCircle, RotateCcw } from 'lucide-react';
import { colors } from '../theme/theme';
import {
  controlPlaneApi,
  PackInstallStatusRecord,
  PackWithReleases,
  TenantInstance,
} from '../services/api';

type StatusMessage = {
  type: 'success' | 'error';
  text: string;
};

export function PacksPage() {
  const [packs, setPacks] = useState<PackWithReleases[]>([]);
  const [instances, setInstances] = useState<TenantInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [installStatuses, setInstallStatuses] = useState<PackInstallStatusRecord[]>([]);
  const [installingKey, setInstallingKey] = useState<string | null>(null);
  const [rollingBackKey, setRollingBackKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);

  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedInstanceId),
    [instances, selectedInstanceId]
  );

  const fetchData = async () => {
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
    } catch (err: any) {
      console.error('Failed to load packs:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load packs.');
    } finally {
      setLoading(false);
    }
  };

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
        if (!active) {
          return;
        }
        const sorted = [...records].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setInstallStatuses(sorted);
      } catch (err: any) {
        console.error('Failed to load pack install status:', err);
      }
    };
    loadStatuses();
    const intervalId = setInterval(loadStatuses, 15000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [selectedInstanceId]);

  const handleInstall = async (packCode: string, releaseId: string) => {
    if (!selectedInstanceId) {
      setStatusMessage({
        type: 'error',
        text: 'Select a target instance before installing a pack.',
      });
      return;
    }
    const key = `${packCode}:${releaseId}`;
    setInstallingKey(key);
    setStatusMessage(null);
    try {
      await controlPlaneApi.triggerPackInstall({
        instanceId: selectedInstanceId,
        packCode,
        releaseId,
      });
      const records = await controlPlaneApi.getPackInstallStatus({
        instanceId: selectedInstanceId,
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
    } catch (err: any) {
      console.error('Failed to trigger install:', err);
      const message = err.response?.data?.message || err.message || 'Pack install failed.';
      const isCompatibility = typeof message === 'string' && message.toLowerCase().includes('compatibility');
      setStatusMessage({
        type: 'error',
        text: isCompatibility ? `Compatibility check failed: ${message}` : message,
      });
    } finally {
      setInstallingKey(null);
    }
  };

  const handleRollback = async (packCode: string, releaseId: string) => {
    if (!selectedInstanceId) {
      setStatusMessage({
        type: 'error',
        text: 'Select a target instance before rolling back a pack.',
      });
      return;
    }
    const key = `${packCode}:${releaseId}`;
    setRollingBackKey(key);
    setStatusMessage(null);
    try {
      await controlPlaneApi.triggerPackRollback({
        instanceId: selectedInstanceId,
        packCode,
        releaseId,
      });
      const records = await controlPlaneApi.getPackInstallStatus({
        instanceId: selectedInstanceId,
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
    } catch (err: any) {
      console.error('Failed to trigger rollback:', err);
      const message = err.response?.data?.message || err.message || 'Pack rollback failed.';
      setStatusMessage({
        type: 'error',
        text: message,
      });
    } finally {
      setRollingBackKey(null);
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  };

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

  const statusBadge = (status?: string) => {
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
  };

  const compatibilityLabel = (release: PackWithReleases['releases'][number]) => {
    const compatibility = release.compatibility as { platform_min_release_id?: string; platform_max_release_id?: string } | null;
    if (!compatibility) {
      return 'Compatibility: not defined';
    }
    const min = compatibility.platform_min_release_id;
    const max = compatibility.platform_max_release_id;
    if (!min || !max) {
      return 'Compatibility: not defined';
    }
    const instanceRelease = selectedInstance?.version || 'unknown';
    return `Compatibility: ${min}..${max} | Instance: ${instanceRelease}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: colors.text.primary }}>
          Packs
        </h1>
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
      </div>

      {error && (
        <div
          className="p-4 rounded-2xl border mb-6"
          style={{
            backgroundColor: colors.danger.glow,
            borderColor: colors.danger.base,
            color: colors.danger.base,
          }}
        >
          {error}
        </div>
      )}

      {statusMessage && (
        <div
          className="p-4 rounded-2xl border mb-6"
          style={{
            backgroundColor:
              statusMessage.type === 'success' ? colors.success.glow : colors.danger.glow,
            borderColor:
              statusMessage.type === 'success' ? colors.success.base : colors.danger.base,
            color: statusMessage.type === 'success' ? colors.success.base : colors.danger.base,
          }}
        >
          {statusMessage.text}
        </div>
      )}

      <div
        className="p-4 rounded-2xl border mb-6"
        style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold" style={{ color: colors.text.primary }}>
              Target instance
            </div>
            <div className="text-xs" style={{ color: colors.text.tertiary }}>
              Packs install into a single instance at a time.
            </div>
          </div>
          <select
            value={selectedInstanceId}
            onChange={(event) => setSelectedInstanceId(event.target.value)}
            className="px-3 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: colors.glass.subtle, borderColor: colors.glass.border, color: colors.text.primary }}
          >
            <option value="" style={{ color: colors.text.muted }}>
              Select an instance
            </option>
            {instances.map((instance) => (
              <option key={instance.id} value={instance.id}>
                {instance.domain || instance.id} • {instance.environment} • {instance.region}
              </option>
            ))}
          </select>
        </div>
        {selectedInstance && (
          <div className="mt-3 text-xs" style={{ color: colors.text.secondary }}>
            {selectedInstance.customer?.name || selectedInstance.customerId} • {selectedInstance.status}
            {' • '}health {selectedInstance.health}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8" style={{ color: colors.text.secondary }}>
          Loading packs...
        </div>
      ) : packs.length === 0 ? (
        <div className="text-center py-8" style={{ color: colors.text.secondary }}>
          No packs registered yet.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {packs.map((pack) => (
            <div
              key={pack.id}
              className="p-5 rounded-2xl border"
              style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
            >
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: colors.glass.medium, color: colors.brand.primary }}
                    >
                      <Package size={18} />
                    </div>
                    <div>
                      <div className="text-lg font-semibold" style={{ color: colors.text.primary }}>
                        {pack.name}
                      </div>
                      <div className="text-xs" style={{ color: colors.text.tertiary }}>
                        {pack.code} • {pack.publisher}
                        {pack.license ? ` • ${pack.license}` : ''}
                      </div>
                    </div>
                  </div>
                  {pack.description && (
                    <p className="text-sm mt-3" style={{ color: colors.text.secondary }}>
                      {pack.description}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide" style={{ color: colors.text.tertiary }}>
                    Releases
                  </div>
                  <div className="text-lg font-semibold" style={{ color: colors.text.primary }}>
                    {pack.releases?.length || 0}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border overflow-hidden" style={{ borderColor: colors.glass.border }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ backgroundColor: colors.glass.subtle }}>
                      {['Release', 'Created', 'Assets', 'Status', 'Install Status', 'Install', 'Rollback'].map((label) => (
                        <th
                          key={label}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                          style={{ color: colors.text.tertiary }}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(pack.releases || []).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-sm" style={{ color: colors.text.secondary }}>
                          No releases registered for this pack.
                        </td>
                      </tr>
                    ) : (
                      (pack.releases || []).map((release) => {
                        const installKey = `${pack.code}:${release.releaseId}`;
                        const isInstalling = installingKey === installKey;
                        const isRollingBack = rollingBackKey === installKey;
                        const statusRecord = installStatusMap.get(installKey);
                        const statusMeta = statusBadge(statusRecord?.status);
                        const rollbackDisabled =
                          !selectedInstanceId || isRollingBack || statusRecord?.status !== 'applied';
                        return (
                          <tr
                            key={release.id}
                            style={{ borderTop: `1px solid ${colors.glass.border}` }}
                          >
                            <td className="px-4 py-3 text-sm" style={{ color: colors.text.primary }}>
                              {release.releaseId}
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: colors.text.tertiary }}>
                              {formatDate(release.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: colors.text.tertiary }}>
                              {Array.isArray(release.assets) ? release.assets.length : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <span
                                className="px-2 py-0.5 rounded"
                                style={{
                                  backgroundColor: release.isActive ? colors.success.glow : colors.glass.medium,
                                  color: release.isActive ? colors.success.base : colors.text.tertiary,
                                }}
                              >
                                {release.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <div className="flex flex-col gap-1">
                                <span
                                  className="px-2 py-0.5 rounded inline-flex w-fit"
                                  style={{ backgroundColor: statusMeta.background, color: statusMeta.color }}
                                >
                                  {selectedInstanceId ? statusMeta.label : 'Select instance'}
                                </span>
                                {statusRecord?.completedAt && (
                                  <span style={{ color: colors.text.tertiary }}>
                                    {formatDate(statusRecord.completedAt)}
                                  </span>
                                )}
                                {selectedInstanceId && (
                                  <span style={{ color: colors.text.muted }}>
                                    {compatibilityLabel(release)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                disabled={!selectedInstanceId || isInstalling}
                                onClick={() => handleInstall(pack.code, release.releaseId)}
                                title={compatibilityLabel(release)}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50"
                                style={{
                                  backgroundColor: colors.brand.primary,
                                  color: colors.text.primary,
                                }}
                              >
                                <ArrowDownCircle size={14} />
                                {isInstalling ? 'Installing...' : 'Install'}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                disabled={rollbackDisabled}
                                onClick={() => handleRollback(pack.code, release.releaseId)}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50"
                                style={{
                                  backgroundColor: colors.glass.medium,
                                  color: colors.text.primary,
                                }}
                              >
                                <RotateCcw size={14} />
                                {isRollingBack ? 'Rolling back...' : 'Rollback'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
