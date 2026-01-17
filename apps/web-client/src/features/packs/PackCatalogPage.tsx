import { useCallback, useEffect, useMemo, useState } from 'react';
import { GlassCard } from '../../components/ui/glass/GlassCard';
import { installPackFromCatalog, listPackCatalog, type PackCatalogItem } from '../../services/packCatalog.service';

type InstallState = {
  key: string;
  status: 'idle' | 'installing' | 'success' | 'error';
  message?: string;
};

export function PackCatalogPage() {
  const [packs, setPacks] = useState<PackCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installState, setInstallState] = useState<InstallState>({ key: '', status: 'idle' });

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPackCatalog();
      setPacks(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load pack catalog';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const handleInstall = useCallback(async (item: PackCatalogItem) => {
    const key = `${item.pack.code}@${item.release.releaseId}`;
    setInstallState({ key, status: 'installing' });
    try {
      await installPackFromCatalog(item.pack.code, item.release.releaseId);
      setInstallState({ key, status: 'success', message: 'Install started' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Install failed';
      setInstallState({ key, status: 'error', message });
    }
  }, []);

  const renderedPacks = useMemo(() => {
    return packs.map((item) => {
      const key = `${item.pack.code}@${item.release.releaseId}`;
      const installing = installState.status === 'installing' && installState.key === key;
      const compatibility = item.release.compatibility as Record<string, unknown> | null | undefined;
      const min = typeof compatibility?.platform_min_release_id === 'string'
        ? compatibility.platform_min_release_id
        : 'unknown';
      const max = typeof compatibility?.platform_max_release_id === 'string'
        ? compatibility.platform_max_release_id
        : 'unknown';

      return (
        <GlassCard key={key} className="pack-card">
          <div className="pack-card__header">
            <div>
              <h3 className="pack-card__title">{item.pack.name}</h3>
              <p className="pack-card__subtitle">{item.pack.code}</p>
            </div>
            <span className="pack-card__release">Release {item.release.releaseId}</span>
          </div>
          <p className="pack-card__description">{item.pack.description || 'No description provided.'}</p>
          <div className="pack-card__meta">
            <span>Publisher: {item.pack.publisher || 'Unknown'}</span>
            <span>Compatibility: {min} → {max}</span>
          </div>
          <div className="pack-card__footer">
            <button
              className="button button--primary"
              onClick={() => handleInstall(item)}
              disabled={installing}
            >
              {installing ? 'Installing…' : 'Install'}
            </button>
            {installState.key === key && installState.message && (
              <span className={`pack-card__status pack-card__status--${installState.status}`}>
                {installState.message}
              </span>
            )}
          </div>
        </GlassCard>
      );
    });
  }, [packs, installState, handleInstall]);

  return (
    <div className="pack-catalog">
      <header className="pack-catalog__header">
        <div>
          <h1>Pack Catalog</h1>
          <p>Install platform-ready packs approved for client use.</p>
        </div>
        <button className="button button--secondary" onClick={loadCatalog} disabled={loading}>
          Refresh
        </button>
      </header>

      {error && <div className="pack-catalog__error">{error}</div>}
      {loading ? (
        <div className="pack-catalog__loading">Loading catalog…</div>
      ) : packs.length === 0 ? (
        <div className="pack-catalog__empty">No installable packs are available.</div>
      ) : (
        <div className="pack-catalog__grid">{renderedPacks}</div>
      )}

      <style>{`
        .pack-catalog {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .pack-catalog__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .pack-catalog__header h1 {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
        }

        .pack-catalog__header p {
          color: var(--text-secondary);
        }

        .pack-catalog__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
        }

        .pack-card {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1.5rem;
        }

        .pack-card__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
        }

        .pack-card__title {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .pack-card__subtitle {
          color: var(--text-secondary);
          font-size: 0.875rem;
        }

        .pack-card__release {
          font-size: 0.75rem;
          padding: 0.35rem 0.6rem;
          border-radius: 999px;
          background: var(--bg-surface-secondary);
          border: 1px solid var(--border-subtle);
        }

        .pack-card__description {
          color: var(--text-secondary);
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .pack-card__meta {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .pack-card__footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .pack-card__status {
          font-size: 0.8rem;
        }

        .pack-card__status--success {
          color: var(--text-success);
        }

        .pack-card__status--error {
          color: var(--text-danger);
        }

        .pack-catalog__error,
        .pack-catalog__loading,
        .pack-catalog__empty {
          padding: 1rem;
          border-radius: 8px;
          background: var(--bg-surface-secondary);
          color: var(--text-secondary);
        }

        .button {
          padding: 0.65rem 1.1rem;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
        }

        .button--primary {
          background: var(--gradient-brand);
          color: var(--text-on-primary);
        }

        .button--secondary {
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}
