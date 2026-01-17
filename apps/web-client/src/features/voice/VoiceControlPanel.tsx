/**
 * VoiceControlPanel - Voice Control UI Component
 * HubbleWave Platform - Phase 7
 *
 * Floating voice control panel with command suggestions.
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Volume2,
  HelpCircle,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassButton } from '../../components/ui/glass/GlassButton';
import { useVoiceControl } from './useVoiceControl';

interface VoiceControlPanelProps {
  className?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  onClose?: () => void;
}

const commandExamples = [
  { phrase: 'Hey AVA, go to assets', description: 'Navigate to assets page' },
  { phrase: 'Hey AVA, search for pump', description: 'Search for assets' },
  { phrase: 'Hey AVA, create work order', description: 'Create a new work order' },
  { phrase: 'Hey AVA, generate maintenance report', description: 'Generate a report' },
  { phrase: 'Hey AVA, what is the status of PUMP-001', description: 'Check asset status' },
];

export const VoiceControlPanel: React.FC<VoiceControlPanelProps> = ({
  className,
  position = 'bottom-right',
  onClose,
}) => {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);
  const [commandFeedback, setCommandFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleCommand = useCallback(
    (command: { intent: string; entities: Record<string, string>; rawText: string }) => {
      setCommandFeedback(null);

      switch (command.intent) {
        case 'navigate':
          handleNavigation(command.entities.target || '');
          break;
        case 'search':
          navigate(`/search?q=${encodeURIComponent(command.entities.target || '')}`);
          setCommandFeedback({ type: 'success', message: 'Opening search...' });
          break;
        case 'create':
          if (command.entities.target?.includes('work order')) {
            navigate('/work-orders/new');
            setCommandFeedback({ type: 'success', message: 'Creating work order...' });
          } else {
            navigate('/records/new');
          }
          break;
        case 'report':
          navigate('/reports/generate');
          setCommandFeedback({ type: 'success', message: 'Opening report generator...' });
          break;
        case 'help':
          setShowHelp(true);
          break;
        case 'status':
          if (command.entities.target) {
            navigate(`/assets/${command.entities.target}`);
          }
          break;
        default:
          setCommandFeedback({
            type: 'error',
            message: "I didn't understand. Try 'Hey AVA, help'",
          });
      }

      // Clear feedback after 3 seconds
      setTimeout(() => setCommandFeedback(null), 3000);
    },
    [navigate]
  );

  const handleNavigation = (target: string) => {
    const routes: Record<string, string> = {
      assets: '/assets',
      'work orders': '/work-orders',
      workorders: '/work-orders',
      dashboard: '/dashboard',
      reports: '/reports',
      settings: '/settings',
      home: '/',
    };

    const normalizedTarget = target.toLowerCase();
    const route = routes[normalizedTarget];

    if (route) {
      navigate(route);
      setCommandFeedback({ type: 'success', message: `Navigating to ${target}...` });
    } else {
      setCommandFeedback({ type: 'error', message: `Unknown destination: ${target}` });
    }
  };

  const {
    isListening,
    isSupported,
    isProcessing,
    transcript,
    error,
    start,
    stop,
  } = useVoiceControl({
    onCommand: handleCommand,
  });

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  if (!isSupported) {
    return (
      <div
        className={cn(
          'fixed z-50 p-4 rounded-xl',
          'bg-card border border-border',
          'shadow-lg',
          positionClasses[position],
          className
        )}
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MicOff className="h-4 w-4" />
          <span>Voice control not supported in this browser</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'fixed z-50 w-80',
        'bg-card border border-border',
        'rounded-xl shadow-xl overflow-hidden',
        positionClasses[position],
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              isListening ? 'bg-success-subtle' : 'bg-muted'
            )}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Mic
                className={cn(
                  'h-4 w-4',
                  isListening ? 'text-success-text' : 'text-muted-foreground'
                )}
              />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Voice Control
            </p>
            <p className="text-xs text-muted-foreground">
              {isListening ? 'Listening...' : 'Click to start'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <GlassButton
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => setShowHelp(!showHelp)}
            aria-label="Help"
          >
            <HelpCircle className="h-4 w-4" />
          </GlassButton>
          {onClose && (
            <GlassButton
              variant="ghost"
              size="sm"
              iconOnly
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </GlassButton>
          )}
        </div>
      </div>

      {transcript && (
        <div className="px-4 py-2 text-sm bg-muted text-muted-foreground">
          <span className="opacity-60">Heard: </span>
          "{transcript}"
        </div>
      )}

      {commandFeedback && (
        <div
          className={cn(
            'px-4 py-2 text-sm flex items-center gap-2',
            commandFeedback.type === 'success'
              ? 'bg-success-subtle text-success-text'
              : 'bg-destructive/10 text-destructive'
          )}
        >
          {commandFeedback.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {commandFeedback.message}
        </div>
      )}

      {error && (
        <div className="px-4 py-2 text-sm flex items-center gap-2 bg-destructive/10 text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {showHelp && (
        <div className="p-4 space-y-2 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground">
            Try saying:
          </p>
          {commandExamples.map((example, index) => (
            <div key={index} className="text-xs">
              <p className="text-foreground">"{example.phrase}"</p>
              <p className="text-muted-foreground">{example.description}</p>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 flex items-center gap-2">
        <GlassButton
          variant={isListening ? 'solid' : 'outline'}
          className={cn('flex-1', isListening && 'animate-pulse')}
          onClick={isListening ? stop : start}
        >
          {isListening ? (
            <>
              <Volume2 className="h-4 w-4 mr-2" />
              Stop Listening
            </>
          ) : (
            <>
              <Mic className="h-4 w-4 mr-2" />
              Start Listening
            </>
          )}
        </GlassButton>
      </div>

      <div className="px-4 pb-3 text-center text-muted-foreground">
        <p className="text-[10px]">
          Say <strong>"Hey AVA"</strong> followed by your command
        </p>
      </div>
    </div>
  );
};

export default VoiceControlPanel;
