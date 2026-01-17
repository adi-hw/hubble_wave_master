import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ShieldAlert, DatabaseBackup, AlertTriangle } from 'lucide-react';
import { colors } from '../theme/theme';
import { controlPlaneApi, TenantInstance } from '../services/api';

type ActionState = 'idle' | 'running' | 'success' | 'error';

export function RecoveryPage() {
  const [instances, setInstances] = useState<TenantInstance[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [backupId, setBackupId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedId) || null,
    [instances, selectedId],
  );

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const response = await controlPlaneApi.getInstances();
      setInstances(response.data);
      if (!selectedId && response.data.length > 0) {
        setSelectedId(response.data[0].id);
      }
    } catch (error: any) {
      setMessage(error.response?.data?.message || error.message || 'Failed to load instances');
      setActionState('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  const handleBackup = async () => {
    if (!selectedId) {
      setMessage('Select an instance to run a backup');
      setActionState('error');
      return;
    }
    setActionState('running');
    setMessage(null);
    try {
      await controlPlaneApi.triggerInstanceBackup({ instanceId: selectedId });
      setActionState('success');
      setMessage('Backup triggered successfully.');
    } catch (error: any) {
      setActionState('error');
      setMessage(error.response?.data?.message || error.message || 'Backup trigger failed.');
    }
  };

  const handleRestore = async () => {
    if (!selectedId) {
      setMessage('Select an instance to restore');
      setActionState('error');
      return;
    }
    if (!backupId.trim()) {
      setMessage('Enter the backup ID to restore');
      setActionState('error');
      return;
    }
    setActionState('running');
    setMessage(null);
    try {
      await controlPlaneApi.triggerInstanceRestore({
        instanceId: selectedId,
        backupId: backupId.trim(),
      });
      setActionState('success');
      setMessage('Restore triggered successfully.');
    } catch (error: any) {
      setActionState('error');
      setMessage(error.response?.data?.message || error.message || 'Restore trigger failed.');
    }
  };

  const statusColor = actionState === 'success'
    ? colors.success.base
    : actionState === 'error'
    ? colors.danger.base
    : colors.text.secondary;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: colors.text.primary }}>
            Recovery Operations
          </h1>
          <p className="text-sm mt-1" style={{ color: colors.text.tertiary }}>
            Trigger instance backups or restores with audit logging.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchInstances}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50"
          style={{ borderColor: colors.glass.border, color: colors.text.secondary }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {message && (
        <div
          className="p-4 rounded-2xl border mb-6 flex items-start gap-3"
          style={{
            backgroundColor: actionState === 'error' ? colors.danger.glow : colors.glass.subtle,
            borderColor: actionState === 'error' ? colors.danger.base : colors.glass.border,
            color: statusColor,
          }}
        >
          <AlertTriangle size={18} />
          <span className="text-sm">{message}</span>
        </div>
      )}

      <div
        className="rounded-2xl border p-6 mb-6"
        style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
      >
        <h2 className="text-base font-semibold mb-4" style={{ color: colors.text.primary }}>
          Select Instance
        </h2>
        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
          style={{
            backgroundColor: colors.glass.medium,
            borderColor: colors.glass.border,
            color: colors.text.primary,
          }}
        >
          {instances.length === 0 ? (
            <option value="">No instances available</option>
          ) : (
            instances.map((instance) => (
              <option key={instance.id} value={instance.id}>
                {instance.domain || instance.id} · {instance.environment} · {instance.status}
              </option>
            ))
          )}
        </select>

        {selectedInstance && (
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <div style={{ color: colors.text.tertiary }}>Customer</div>
              <div style={{ color: colors.text.primary }}>
                {selectedInstance.customer?.name || 'Unknown'}
              </div>
            </div>
            <div>
              <div style={{ color: colors.text.tertiary }}>Version</div>
              <div style={{ color: colors.text.primary }}>{selectedInstance.version}</div>
            </div>
            <div>
              <div style={{ color: colors.text.tertiary }}>Status</div>
              <div style={{ color: colors.text.primary }}>{selectedInstance.status}</div>
            </div>
            <div>
              <div style={{ color: colors.text.tertiary }}>Health</div>
              <div style={{ color: colors.text.primary }}>{selectedInstance.health}</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div
          className="rounded-2xl border p-6"
          style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
        >
          <div className="flex items-center gap-3 mb-4">
            <DatabaseBackup size={20} style={{ color: colors.info.base }} />
            <h3 className="text-base font-semibold" style={{ color: colors.text.primary }}>
              Run Backup
            </h3>
          </div>
          <p className="text-sm mb-6" style={{ color: colors.text.secondary }}>
            Generate a backup snapshot for the selected instance. The backup is stored in the instance bucket.
          </p>
          <button
            type="button"
            onClick={handleBackup}
            disabled={actionState === 'running' || !selectedId}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-opacity disabled:opacity-50 w-full"
            style={{
              background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
            }}
          >
            <DatabaseBackup size={16} />
            Trigger Backup
          </button>
        </div>

        <div
          className="rounded-2xl border p-6"
          style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
        >
          <div className="flex items-center gap-3 mb-4">
            <ShieldAlert size={20} style={{ color: colors.warning.base }} />
            <h3 className="text-base font-semibold" style={{ color: colors.text.primary }}>
              Restore Backup
            </h3>
          </div>
          <p className="text-sm mb-4" style={{ color: colors.text.secondary }}>
            Provide a backup ID to restore the instance. This will overwrite current data.
          </p>
          <input
            value={backupId}
            onChange={(event) => setBackupId(event.target.value)}
            placeholder="Backup ID"
            className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none mb-4"
            style={{
              backgroundColor: colors.glass.medium,
              borderColor: colors.glass.border,
              color: colors.text.primary,
            }}
          />
          <button
            type="button"
            onClick={handleRestore}
            disabled={actionState === 'running' || !selectedId}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-opacity disabled:opacity-50 w-full"
            style={{ backgroundColor: colors.warning.base }}
          >
            <ShieldAlert size={16} />
            Trigger Restore
          </button>
        </div>
      </div>
    </div>
  );
}

export default RecoveryPage;
