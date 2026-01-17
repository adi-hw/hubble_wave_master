/**
 * VersionHistory - Record Version History Panel
 *
 * Displays the complete version history for a record with:
 * - Chronological list of all versions
 * - Timestamp and user information for each version
 * - Version comparison capabilities
 * - Rollback functionality
 * - Version details modal
 *
 * Uses Tailwind CSS for consistent styling.
 */

import React, { useState, useMemo } from 'react';
import {
  History,
  Clock,
  User,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  Eye,
  ArrowLeftRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatRelativeTime, formatDateTime } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { VersionCompare } from './VersionCompare';

export interface RecordVersion {
  id: string;
  version: number;
  timestamp: Date | string;
  userId: string;
  userName: string;
  userEmail?: string;
  userAvatar?: string;
  changeType: 'created' | 'updated' | 'deleted' | 'restored';
  changeDescription?: string;
  changedFields?: string[];
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface VersionHistoryProps {
  versions: RecordVersion[];
  currentVersion: number;
  onRollback?: (versionId: string) => Promise<void>;
  onCompare?: (versionId1: string, versionId2: string) => void;
  loading?: boolean;
  error?: string;
  className?: string;
  maxHeight?: string;
  showRollback?: boolean;
  showCompare?: boolean;
  isReadOnly?: boolean;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  versions,
  currentVersion,
  onRollback,
  onCompare,
  loading = false,
  error,
  className = '',
  maxHeight = '600px',
  showRollback = true,
  showCompare = true,
  isReadOnly = false,
}) => {
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [detailsModal, setDetailsModal] = useState<RecordVersion | null>(null);
  const [rollbackModal, setRollbackModal] = useState<RecordVersion | null>(null);
  const [compareModal, setCompareModal] = useState<boolean>(false);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const sortedVersions = useMemo(() => {
    return [...versions].sort((a, b) => b.version - a.version);
  }, [versions]);

  const toggleExpanded = (versionId: string) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(versionId)) {
      newExpanded.delete(versionId);
    } else {
      newExpanded.add(versionId);
    }
    setExpandedVersions(newExpanded);
  };

  const toggleSelection = (versionId: string) => {
    if (selectedVersions.includes(versionId)) {
      setSelectedVersions(selectedVersions.filter((id) => id !== versionId));
    } else if (selectedVersions.length < 2) {
      setSelectedVersions([...selectedVersions, versionId]);
    } else {
      setSelectedVersions([selectedVersions[1], versionId]);
    }
  };

  const handleRollback = async (version: RecordVersion) => {
    if (!onRollback || isRollingBack) return;

    setIsRollingBack(true);
    try {
      await onRollback(version.id);
      setRollbackModal(null);
    } catch (err) {
      console.error('Rollback failed:', err);
    } finally {
      setIsRollingBack(false);
    }
  };

  const handleCompare = () => {
    if (selectedVersions.length === 2 && onCompare) {
      onCompare(selectedVersions[0], selectedVersions[1]);
    }
    setCompareModal(true);
  };

  const getChangeTypeClasses = (changeType: RecordVersion['changeType']) => {
    switch (changeType) {
      case 'created':
        return {
          badge: 'bg-success-subtle text-success-text',
          timeline: 'bg-success-subtle text-success-text border-success-border',
        };
      case 'updated':
        return {
          badge: 'bg-info-subtle text-info-text',
          timeline: 'bg-info-subtle text-info-text border-info-border',
        };
      case 'deleted':
        return {
          badge: 'bg-danger-subtle text-danger-text',
          timeline: 'bg-danger-subtle text-danger-text border-danger-border',
        };
      case 'restored':
        return {
          badge: 'bg-warning-subtle text-warning-text',
          timeline: 'bg-warning-subtle text-warning-text border-warning-border',
        };
      default:
        return {
          badge: 'bg-muted text-muted-foreground',
          timeline: 'bg-muted text-muted-foreground border-border',
        };
    }
  };

  if (loading) {
    return (
      <div
        className={cn('flex items-center justify-center p-8 rounded-xl bg-card border border-border', className)}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn('p-6 rounded-xl bg-danger-subtle border border-danger-border', className)}
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-danger-text" />
          <div>
            <h3 className="text-sm font-semibold mb-1 text-danger-text">
              Failed to load version history
            </h3>
            <p className="text-sm text-muted-foreground">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div
        className={cn('p-8 rounded-xl text-center bg-card border border-border', className)}
      >
        <History className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No version history available
        </p>
      </div>
    );
  }

  const selectedVersionObjects = selectedVersions
    .map((id) => versions.find((v) => v.id === id))
    .filter(Boolean) as RecordVersion[];

  return (
    <>
      <div
        className={cn('rounded-xl overflow-hidden bg-card border border-border', className)}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-primary/10">
              <History className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Version History
              </h2>
              <p className="text-sm text-muted-foreground">
                {versions.length} {versions.length === 1 ? 'version' : 'versions'}
              </p>
            </div>
          </div>

          {showCompare && selectedVersions.length === 2 && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<ArrowLeftRight />}
              onClick={handleCompare}
              aria-label="Compare selected versions"
            >
              Compare Versions
            </Button>
          )}
        </div>

        {/* Version List */}
        <div
          className="overflow-y-auto scrollbar-thin"
          style={{ maxHeight }}
        >
          <div className="divide-y divide-border">
            {sortedVersions.map((version, index) => {
              const isExpanded = expandedVersions.has(version.id);
              const isSelected = selectedVersions.includes(version.id);
              const isCurrent = version.version === currentVersion;
              const classes = getChangeTypeClasses(version.changeType);

              return (
                <div
                  key={version.id}
                  className={cn(
                    'transition-colors',
                    isSelected && 'bg-primary/5'
                  )}
                >
                  {/* Version Header */}
                  <div className="px-6 py-4">
                    <div className="flex items-start gap-4">
                      {/* Timeline */}
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div
                          className={cn(
                            'h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold border-2',
                            isCurrent ? classes.timeline : 'bg-muted text-muted-foreground/50 border-border'
                          )}
                        >
                          v{version.version}
                        </div>
                        {index < sortedVersions.length - 1 && (
                          <div className="w-0.5 h-full min-h-[24px] mt-2 bg-border" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={cn(
                                  'text-xs font-medium px-2 py-0.5 rounded-full',
                                  classes.badge
                                )}
                              >
                                {version.changeType}
                              </span>
                              {isCurrent && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                  Current
                                </span>
                              )}
                            </div>
                            {version.changeDescription && (
                              <p className="text-sm font-medium mb-1 text-foreground">
                                {version.changeDescription}
                              </p>
                            )}
                          </div>

                          <button
                            onClick={() => toggleExpanded(version.id)}
                            className="flex-shrink-0 p-2 -m-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] hover:bg-muted"
                            aria-label={isExpanded ? 'Collapse version details' : 'Expand version details'}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>
                        </div>

                        {/* Metadata */}
                        <div className="flex flex-wrap items-center gap-4 text-xs mb-3">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            <span>{version.userName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span title={formatDateTime(version.timestamp)}>
                              {formatRelativeTime(version.timestamp)}
                            </span>
                          </div>
                          {version.changedFields && version.changedFields.length > 0 && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <span>
                                {version.changedFields.length} field{version.changedFields.length !== 1 ? 's' : ''} changed
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {showCompare && (
                            <button
                              onClick={() => toggleSelection(version.id)}
                              className={cn(
                                'px-3 h-9 min-h-[44px] rounded-lg text-xs font-medium transition-all flex items-center gap-2',
                                isSelected
                                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                                  : 'bg-muted text-muted-foreground border border-border hover:bg-accent hover:text-foreground'
                              )}
                              aria-label={isSelected ? 'Deselect for comparison' : 'Select for comparison'}
                              aria-pressed={isSelected}
                            >
                              {isSelected ? 'Selected' : 'Select'}
                            </button>
                          )}

                          <button
                            onClick={() => setDetailsModal(version)}
                            className="px-3 h-9 min-h-[44px] rounded-lg text-xs font-medium transition-all flex items-center gap-2 bg-muted text-muted-foreground border border-border hover:bg-accent hover:text-foreground"
                            aria-label="View version details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View Details
                          </button>

                          {showRollback && !isCurrent && !isReadOnly && onRollback && (
                            <button
                              onClick={() => setRollbackModal(version)}
                              className="px-3 h-9 min-h-[44px] rounded-lg text-xs font-medium transition-all flex items-center gap-2 bg-muted text-muted-foreground border border-border hover:bg-warning-subtle hover:text-warning-text"
                              aria-label="Rollback to this version"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Rollback
                            </button>
                          )}
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && version.changedFields && version.changedFields.length > 0 && (
                          <div className="mt-4 p-4 rounded-lg bg-muted border border-border">
                            <h4 className="text-xs font-semibold mb-2 text-foreground">
                              Changed Fields
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {version.changedFields.map((field) => (
                                <span
                                  key={field}
                                  className="text-xs px-2 py-1 rounded-md font-mono bg-card text-muted-foreground border border-border/50"
                                >
                                  {field}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Version Details Modal */}
      {detailsModal && (
        <Modal
          open={true}
          onClose={() => setDetailsModal(null)}
          title={`Version ${detailsModal.version} Details`}
          size="lg"
          icon={<History />}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground/70">
                  Change Type
                </label>
                <p className="text-sm mt-1 text-foreground">
                  {detailsModal.changeType}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground/70">
                  Modified By
                </label>
                <p className="text-sm mt-1 text-foreground">
                  {detailsModal.userName}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground/70">
                  Timestamp
                </label>
                <p className="text-sm mt-1 text-foreground">
                  {formatDateTime(detailsModal.timestamp)}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground/70">
                  Version Number
                </label>
                <p className="text-sm mt-1 text-foreground">
                  {detailsModal.version}
                </p>
              </div>
            </div>

            {detailsModal.changeDescription && (
              <div>
                <label className="text-xs font-medium text-muted-foreground/70">
                  Description
                </label>
                <p className="text-sm mt-1 text-foreground">
                  {detailsModal.changeDescription}
                </p>
              </div>
            )}

            <div>
              <label className="text-xs font-medium mb-2 block text-muted-foreground/70">
                Record Data
              </label>
              <pre
                className="text-xs p-4 rounded-lg overflow-auto font-mono bg-muted text-muted-foreground max-h-[400px]"
              >
                {JSON.stringify(detailsModal.data, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}

      {/* Rollback Confirmation Modal */}
      {rollbackModal && (
        <Modal
          open={true}
          onClose={() => !isRollingBack && setRollbackModal(null)}
          title="Confirm Rollback"
          size="sm"
          variant="warning"
          icon={<RotateCcw />}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setRollbackModal(null)}
                disabled={isRollingBack}
              >
                Cancel
              </Button>
              <Button
                variant="accent"
                onClick={() => handleRollback(rollbackModal)}
                loading={isRollingBack}
                leftIcon={<RotateCcw />}
              >
                Rollback
              </Button>
            </>
          }
        >
          <p className="text-sm mb-4 text-muted-foreground">
            Are you sure you want to rollback to version {rollbackModal.version}? This will create a new
            version with the data from version {rollbackModal.version}.
          </p>
          <div className="p-4 rounded-lg bg-warning-subtle border border-warning-border">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-warning-text" />
              <div>
                <p className="text-sm font-medium text-warning-text">
                  This action cannot be undone
                </p>
                <p className="text-xs mt-1 text-muted-foreground">
                  Modified by {rollbackModal.userName} on {formatDateTime(rollbackModal.timestamp)}
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Compare Modal */}
      {compareModal && selectedVersionObjects.length === 2 && (
        <Modal
          open={true}
          onClose={() => setCompareModal(false)}
          title="Compare Versions"
          size="xl"
          icon={<ArrowLeftRight />}
        >
          <VersionCompare
            oldVersion={selectedVersionObjects[0]}
            newVersion={selectedVersionObjects[1]}
          />
        </Modal>
      )}
    </>
  );
};

export default VersionHistory;
