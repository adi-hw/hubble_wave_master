/**
 * CommitmentPanel
 * HubbleWave Platform - Phase 3
 *
 * Panel displaying commitment trackers for a specific record.
 */

import React, { useEffect, useState, useRef } from 'react';
import { MoreVertical, Play, Pause, XCircle, Loader2 } from 'lucide-react';
import { commitmentApi, CommitmentTracker } from '../../../services/commitmentApi';
import { CommitmentBadge } from './CommitmentBadge';

interface CommitmentPanelProps {
  collectionCode: string;
  recordId: string;
}

export const CommitmentPanel: React.FC<CommitmentPanelProps> = ({ collectionCode, recordId }) => {
  const [trackers, setTrackers] = useState<CommitmentTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTrackers();
  }, [collectionCode, recordId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadTrackers = async () => {
    try {
      const data = await commitmentApi.getTrackersByRecord(collectionCode, recordId);
      setTrackers(data);
    } catch (error) {
      console.error('Failed to load commitments', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (trackerId: string, action: 'pause' | 'resume' | 'cancel') => {
    try {
      if (action === 'pause') await commitmentApi.pauseTracker(trackerId, 'User paused');
      if (action === 'resume') await commitmentApi.resumeTracker(trackerId);
      if (action === 'cancel') await commitmentApi.cancelTracker(trackerId, 'User cancelled');
      await loadTrackers();
    } catch (error) {
      console.error(`Failed to ${action} tracker`, error);
    }
    setMenuOpen(null);
  };

  if (loading) {
    return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
  }

  if (trackers.length === 0) return null;

  return (
    <div className="rounded-lg border mb-4 bg-card border-border">
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-3 text-foreground">
          Service Commitments
        </h3>

        <div className="space-y-2">
          {trackers.map((tracker) => (
            <div
              key={tracker.id}
              className="flex items-center justify-between py-2 border-b border-border"
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">
                  {tracker.commitmentDefinition?.name || tracker.tracker_type}
                </div>
                <div className="text-xs text-muted-foreground">
                  Target: {new Date(tracker.target_at).toLocaleString()}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <CommitmentBadge tracker={tracker} />

                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(menuOpen === tracker.id ? null : tracker.id)}
                    className="p-1.5 rounded transition-colors hover:bg-hover"
                    aria-label="More actions"
                  >
                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                  </button>

                  {menuOpen === tracker.id && (
                    <div className="absolute right-0 z-10 mt-1 w-36 rounded border shadow-lg bg-card border-border">
                      <button
                        type="button"
                        onClick={() => handleAction(tracker.id, 'pause')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-hover text-foreground"
                      >
                        <Pause className="w-4 h-4" />
                        Pause
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction(tracker.id, 'resume')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-hover text-foreground"
                      >
                        <Play className="w-4 h-4" />
                        Resume
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction(tracker.id, 'cancel')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-hover text-foreground"
                      >
                        <XCircle className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
