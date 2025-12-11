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
   * Name of the table this layout is for
   */
  tableName: string;

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
  tableName,
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50">
      <div className="bg-white rounded-xl shadow-xl w-[520px] max-h-[80vh] flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-900">
                Layout Update Available
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                The default layout for <span className="font-medium">{tableName}</span> has been updated.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Version Comparison */}
        <div className="p-6 space-y-4">
          {/* Info Banner */}
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              Your personalized layout is based on an older version of the admin layout.
              Choose how you'd like to handle this update.
            </p>
          </div>

          {/* Version Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Your Layout */}
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <User className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Your Layout</h3>
                  <span className="text-[10px] text-slate-500">Version {userVersion.version}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{formatDate(userVersion.lastModified)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <User className="h-3.5 w-3.5" />
                  <span>By {userVersion.modifiedBy}</span>
                </div>
              </div>
            </div>

            {/* Admin Layout */}
            <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/50">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <RefreshCw className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Updated Layout</h3>
                  <span className="text-[10px] text-amber-600 font-medium">Version {adminVersion.version}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{formatDate(adminVersion.lastModified)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <User className="h-3.5 w-3.5" />
                  <span>By {adminVersion.modifiedBy}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Changes Summary */}
          {adminVersion.changesSummary && adminVersion.changesSummary.length > 0 && (
            <div className="border border-slate-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-900 mb-2">What's Changed</h4>
              <ul className="space-y-1.5">
                {adminVersion.changesSummary.map((change, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div className="flex flex-col gap-3">
            {/* Primary Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={onKeepMyLayout}
                disabled={isMerging}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Keep My Layout
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={onMergeChanges}
                  disabled={isMerging}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-700 bg-primary-100 hover:bg-primary-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {isMerging ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
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
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  Use New Layout
                </button>
              </div>
            </div>

            {/* Help Text */}
            <div className="text-[11px] text-slate-500 text-center">
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
