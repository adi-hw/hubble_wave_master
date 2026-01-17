import React from 'react';
import {
  AlertTriangle,
  X,
  RefreshCw,
  GitMerge,
  RotateCcw,
  Info,
  Clock,
  User,
} from 'lucide-react';

export interface LayoutVersionInfo {
  version: number;
  lastModified: Date;
  modifiedBy: string;
  changesSummary?: string[];
}

interface VersionConflictModalProps {
  /**
   * Information about the user's current layout version
   */
  userVersion: LayoutVersionInfo;

  /**
   * Information about the admin's updated layout version
   */
  adminVersion: LayoutVersionInfo;

  /**
   * Name of the collection this layout is for
   */
  collectionName: string;

  /**
   * Callback when user chooses to keep their layout
   */
  onKeepMyLayout: () => void;

  /**
   * Callback when user chooses to merge changes
   */
  onMergeChanges: () => void;

  /**
   * Callback when user chooses to reset to admin layout
   */
  onResetToAdmin: () => void;

  /**
   * Callback to close the modal
   */
  onClose: () => void;

  /**
   * Whether merge operation is in progress
   */
  isMerging?: boolean;
}

export const VersionConflictModal: React.FC<VersionConflictModalProps> = ({
  userVersion,
  adminVersion,
  collectionName,
  onKeepMyLayout,
  onMergeChanges,
  onResetToAdmin,
  onClose,
  isMerging = false,
}) => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay/50"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="version-conflict-title"
      aria-describedby="version-conflict-description"
    >
      <div className="bg-card rounded-xl shadow-xl w-[520px] max-h-[80vh] flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-warning-subtle">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-warning-subtle">
              <AlertTriangle className="h-5 w-5 text-warning-text" />
            </div>
            <div className="flex-1">
              <h2
                id="version-conflict-title"
                className="text-lg font-semibold text-foreground"
              >
                Layout Update Available
              </h2>
              <p
                id="version-conflict-description"
                className="text-sm mt-0.5 text-muted-foreground"
              >
                The default layout for <span className="font-medium">{collectionName}</span> has been updated.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Version Comparison */}
        <div className="p-6 space-y-4">
          {/* Info Banner */}
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-info-subtle border-info-border">
            <Info className="h-5 w-5 flex-shrink-0 mt-0.5 text-info-text" />
            <p className="text-sm text-info-text">
              Your personalized layout is based on an older version of the admin layout.
              Choose how you'd like to handle this update.
            </p>
          </div>

          {/* Version Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Your Layout */}
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Your Layout</h3>
                  <span className="text-[10px] text-muted-foreground">Version {userVersion.version}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{formatDate(userVersion.lastModified)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  <span>By {userVersion.modifiedBy}</span>
                </div>
              </div>
            </div>

            {/* Admin Layout */}
            <div className="border-2 border-warning-border rounded-lg p-4 bg-warning-subtle">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-warning-subtle">
                  <RefreshCw className="h-4 w-4 text-warning-text" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Updated Layout</h3>
                  <span className="text-[10px] font-medium text-warning-text">Version {adminVersion.version}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{formatDate(adminVersion.lastModified)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  <span>By {adminVersion.modifiedBy}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Changes Summary */}
          {adminVersion.changesSummary && adminVersion.changesSummary.length > 0 && (
            <div className="border border-border rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-2 text-foreground">What's Changed</h4>
              <ul className="space-y-1.5">
                {adminVersion.changesSummary.map((change, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-muted-foreground/50" />
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-muted">
          <div className="flex flex-col gap-3">
            {/* Primary Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={onKeepMyLayout}
                disabled={isMerging}
                className="px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] text-muted-foreground hover:text-foreground"
              >
                Keep My Layout
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={onMergeChanges}
                  disabled={isMerging}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors min-h-[44px] text-primary bg-primary/10 hover:bg-primary/20"
                >
                  {isMerging ? (
                    <>
                      <div className="w-4 h-4 border-2 rounded-full animate-spin border-primary/30 border-t-primary" />
                      Merging...
                    </>
                  ) : (
                    <>
                      <GitMerge className="h-4 w-4" />
                      Merge Changes
                    </>
                  )}
                </button>

                <button
                  onClick={onResetToAdmin}
                  disabled={isMerging}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors min-h-[44px] text-primary-foreground bg-primary hover:bg-primary/90"
                >
                  <RotateCcw className="h-4 w-4" />
                  Use New Layout
                </button>
              </div>
            </div>

            {/* Help Text */}
            <div className="text-[11px] text-center text-muted-foreground">
              <strong>Keep My Layout:</strong> Ignore update and continue using your layout&nbsp;&nbsp;|&nbsp;&nbsp;
              <strong>Merge:</strong> Add new fields while keeping your customizations&nbsp;&nbsp;|&nbsp;&nbsp;
              <strong>Use New:</strong> Replace your layout with the updated version
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersionConflictModal;
