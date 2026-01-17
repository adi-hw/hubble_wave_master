/**
 * ImportProgress - Production-Ready Import Progress Component
 *
 * Displays real-time import progress with:
 * - Record counts (total, processed, succeeded, failed)
 * - Animated progress bar with percentage
 * - Estimated time remaining
 * - Error log viewer with expandable details
 * - Cancel operation button
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Check, AlertCircle, X, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

export interface ImportProgressProps {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
  onCancel?: () => void;
}

export const ImportProgress: React.FC<ImportProgressProps> = ({
  total,
  processed,
  succeeded,
  failed,
  errors,
  onCancel,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const progress = total > 0 ? (processed / total) * 100 : 0;
  const isComplete = processed === total;
  const hasErrors = failed > 0;

  const estimateTimeRemaining = useCallback(() => {
    if (processed === 0 || isComplete) return null;

    const recordsPerSecond = processed / elapsedTime;
    const remainingRecords = total - processed;
    const estimatedSeconds = Math.ceil(remainingRecords / recordsPerSecond);

    if (estimatedSeconds < 60) {
      return `${estimatedSeconds}s`;
    } else if (estimatedSeconds < 3600) {
      const minutes = Math.ceil(estimatedSeconds / 60);
      return `${minutes}m`;
    } else {
      const hours = Math.floor(estimatedSeconds / 3600);
      const minutes = Math.ceil((estimatedSeconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }, [processed, total, elapsedTime, isComplete]);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${mins}m`;
    }
  };

  const timeRemaining = estimateTimeRemaining();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div
          className={cn(
            'w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center',
            isComplete
              ? hasErrors
                ? 'bg-warning-subtle'
                : 'bg-success-subtle'
              : 'bg-primary/10'
          )}
        >
          {isComplete ? (
            hasErrors ? (
              <AlertCircle
                className="h-8 w-8 text-warning-text"
                aria-label="Import completed with errors"
              />
            ) : (
              <Check
                className="h-8 w-8 text-success-text"
                aria-label="Import completed successfully"
              />
            )
          ) : (
            <Loader2
              className="h-8 w-8 animate-spin text-primary"
              aria-label="Import in progress"
            />
          )}
        </div>

        <h3 className="text-lg font-semibold mb-2 text-foreground">
          {isComplete
            ? hasErrors
              ? 'Import Completed with Errors'
              : 'Import Complete'
            : 'Importing Records'}
        </h3>

        {!isComplete && timeRemaining && (
          <p className="text-sm text-muted-foreground">
            Estimated time remaining: {timeRemaining}
          </p>
        )}

        {isComplete && (
          <p className="text-sm text-muted-foreground">
            Completed in {formatTime(elapsedTime)}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">
            Progress
          </span>
          <span className="text-sm font-semibold text-foreground">
            {Math.round(progress)}%
          </span>
        </div>
        <div
          className="relative w-full h-3 rounded-full overflow-hidden bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Import progress"
        >
          <div
            className={cn(
              'absolute inset-y-0 left-0 transition-all duration-300 rounded-full',
              isComplete
                ? hasErrors
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                  : 'bg-gradient-to-r from-green-400 to-green-500'
                : 'bg-gradient-to-r from-primary to-primary/80'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-muted border border-border">
          <div className="text-xs font-medium mb-1 text-muted-foreground">
            Total Records
          </div>
          <div className="text-2xl font-bold text-foreground">
            {total.toLocaleString()}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-muted border border-border">
          <div className="text-xs font-medium mb-1 text-muted-foreground">
            Processed
          </div>
          <div className="text-2xl font-bold text-foreground">
            {processed.toLocaleString()}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-success-subtle border border-success-border">
          <div className="text-xs font-medium mb-1 text-success-text">
            Succeeded
          </div>
          <div className="text-2xl font-bold text-success-text">
            {succeeded.toLocaleString()}
          </div>
        </div>

        <div
          className={cn(
            'p-4 rounded-lg',
            hasErrors
              ? 'bg-destructive/10 border border-destructive/30'
              : 'bg-muted border border-border'
          )}
        >
          <div
            className={cn(
              'text-xs font-medium mb-1',
              hasErrors ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            Failed
          </div>
          <div
            className={cn(
              'text-2xl font-bold',
              hasErrors ? 'text-destructive' : 'text-foreground'
            )}
          >
            {failed.toLocaleString()}
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg overflow-hidden bg-muted border border-destructive/30">
          <button
            onClick={() => setShowErrors(!showErrors)}
            className="w-full flex items-center justify-between p-4 transition-colors bg-destructive/10 min-h-[44px] hover:bg-muted"
            aria-expanded={showErrors}
            aria-label={showErrors ? 'Hide error details' : 'Show error details'}
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-sm font-semibold text-destructive">
                {errors.length} Error{errors.length !== 1 ? 's' : ''}
              </span>
            </div>
            <ChevronDown
              className={cn('h-5 w-5 transition-transform text-destructive', showErrors && 'rotate-180')}
            />
          </button>

          {showErrors && (
            <div className="max-h-[200px] overflow-y-auto scrollbar-thin bg-card border-t border-destructive/30">
              <div className="p-4 space-y-2">
                {errors.map((error, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/30"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-destructive text-destructive-foreground">
                      {error.row}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-destructive">
                        Row {error.row}: {error.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {onCancel && !isComplete && (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            onClick={onCancel}
            leftIcon={<X className="h-4 w-4" />}
            aria-label="Cancel import"
          >
            Cancel Import
          </Button>
        </div>
      )}
    </div>
  );
};

export default ImportProgress;
