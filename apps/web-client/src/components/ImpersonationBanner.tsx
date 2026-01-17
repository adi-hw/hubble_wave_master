import { useState, useEffect } from 'react';
import { AlertTriangle, X, Clock, User, Activity } from 'lucide-react';
import { authService } from '../services/auth';

interface ImpersonationStatus {
  isImpersonating: boolean;
  sessionId?: string;
  targetUser?: { id: string; email: string; displayName: string };
  startedAt?: Date;
  expiresAt?: Date;
  actionsCount?: number;
}

function formatTimeRemaining(expiresAt: Date): string {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();
  if (diff <= 0) return 'Expired';

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function ImpersonationBanner() {
  const [status, setStatus] = useState<ImpersonationStatus | null>(null);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const result = await authService.getImpersonationStatus();
        setStatus(result);
      } catch (err) {
        console.error('Failed to check impersonation status:', err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleEndImpersonation = async () => {
    try {
      setEnding(true);
      await authService.endImpersonation();
      window.location.reload();
    } catch (err) {
      console.error('Failed to end impersonation:', err);
      setEnding(false);
    }
  };

  if (!status?.isImpersonating) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] px-4 py-2 flex items-center justify-between bg-gradient-to-br from-red-600 to-orange-600 text-danger-foreground"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-semibold">Impersonation Active</span>
        </div>

        <div className="h-4 w-px bg-danger-foreground/30" />

        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4" />
          <span>
            Viewing as{' '}
            <strong>{status.targetUser?.displayName || status.targetUser?.email}</strong>
          </span>
        </div>

        {status.expiresAt && (
          <>
            <div className="h-4 w-px bg-danger-foreground/30" />
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              <span>{formatTimeRemaining(status.expiresAt)} remaining</span>
            </div>
          </>
        )}

        {status.actionsCount !== undefined && status.actionsCount > 0 && (
          <>
            <div className="h-4 w-px bg-danger-foreground/30" />
            <div className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4" />
              <span>{status.actionsCount} actions logged</span>
            </div>
          </>
        )}
      </div>

      <button
        onClick={handleEndImpersonation}
        disabled={ending}
        className="flex items-center gap-2 px-4 py-1.5 rounded-lg font-medium transition-colors bg-danger-foreground/20 text-danger-foreground hover:bg-danger-foreground/30"
      >
        {ending ? (
          <span>Ending...</span>
        ) : (
          <>
            <X className="h-4 w-4" />
            End Impersonation
          </>
        )}
      </button>
    </div>
  );
}
