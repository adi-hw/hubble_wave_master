import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  History,
} from 'lucide-react';
import {
  voiceControlApi,
  VoiceCommand,
  VoiceCommandStatus,
} from '../../../services/phase7Api';

// Web Speech API type definitions
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent {
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  readonly error: string;
  readonly message: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface IWindow extends Window {
  SpeechRecognition?: new () => ISpeechRecognition;
  webkitSpeechRecognition?: new () => ISpeechRecognition;
}

interface VoiceControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const statusConfig: Record<VoiceCommandStatus, { icon: React.ElementType; colorClass: string; label: string }> = {
  pending: { icon: Clock, colorClass: 'text-muted-foreground', label: 'Processing...' },
  understood: { icon: Sparkles, colorClass: 'text-info-text', label: 'Understood' },
  executing: { icon: Play, colorClass: 'text-primary', label: 'Executing' },
  completed: { icon: CheckCircle2, colorClass: 'text-success-text', label: 'Completed' },
  failed: { icon: AlertTriangle, colorClass: 'text-destructive', label: 'Failed' },
};

export const VoiceControlPanel: React.FC<VoiceControlPanelProps> = ({ isOpen, onClose }) => {
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [currentCommand, setCurrentCommand] = useState<VoiceCommand | null>(null);
  const [commandHistory, setCommandHistory] = useState<VoiceCommand[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [processing, setProcessing] = useState(false);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    loadCommandHistory();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const windowWithSpeech = window as IWindow;
      const SpeechRecognitionClass = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        recognitionRef.current = new SpeechRecognitionClass();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event) => {
          const result = event.results[event.results.length - 1];
          const transcriptText = result[0].transcript;
          setTranscript(transcriptText);

          if (result.isFinal) {
            handleVoiceCommand(transcriptText);
          }
        };

        recognitionRef.current.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          if (isListening) {
            recognitionRef.current?.start();
          }
        };
      }

      synthRef.current = new SpeechSynthesisUtterance();
    }

    return () => {
      recognitionRef.current?.stop();
    };
  }, [isListening]);

  const loadCommandHistory = async () => {
    try {
      const response = await voiceControlApi.getCommandHistory(10);
      setCommandHistory(response.commands);
    } catch (error) {
      console.error('Failed to load command history:', error);
    }
  };

  const handleVoiceCommand = async (text: string) => {
    if (!text.trim()) return;
    setProcessing(true);
    try {
      const response = await voiceControlApi.processCommand(text);
      setCurrentCommand(response.command);
      if (!isMuted && response.command.response) {
        speak(response.command.response);
      }
      loadCommandHistory();
    } catch (error) {
      console.error('Failed to process command:', error);
    } finally {
      setProcessing(false);
      setTranscript('');
    }
  };

  const speak = useCallback((text: string) => {
    if (synthRef.current && !isMuted) {
      synthRef.current.text = text;
      window.speechSynthesis.speak(synthRef.current);
    }
  }, [isMuted]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
      setTranscript('');
    }
  };

  const toggleMute = () => {
    if (!isMuted) {
      window.speechSynthesis.cancel();
    }
    setIsMuted(!isMuted);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-overlay/50 flex items-center justify-center z-50">
      <div className="w-full max-w-md rounded-2xl overflow-hidden bg-card">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">
                Voice Control
              </h2>
              <p className="text-xs text-muted-foreground">
                Speak commands to control the platform
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-lg transition-colors ${showHistory ? 'bg-muted' : 'hover:bg-muted'}`}
            >
              <History className="h-5 w-5 text-muted-foreground" />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6">
          {showHistory ? (
            <div className="space-y-3 max-h-80 overflow-auto">
              <h3 className="text-sm font-medium text-muted-foreground">
                Recent Commands
              </h3>
              {commandHistory.length === 0 ? (
                <div className="py-8 text-center">
                  <History className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No commands yet
                  </p>
                </div>
              ) : (
                commandHistory.map((cmd) => {
                  const status = statusConfig[cmd.status];
                  const StatusIcon = status.icon;
                  return (
                    <div
                      key={cmd.id}
                      className="p-3 rounded-lg bg-muted"
                    >
                      <div className="flex items-start gap-3">
                        <StatusIcon className={`h-4 w-4 mt-0.5 shrink-0 ${status.colorClass}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            "{cmd.text}"
                          </p>
                          {cmd.response && (
                            <p className="text-xs mt-1 text-muted-foreground">
                              {cmd.response}
                            </p>
                          )}
                          <p className="text-xs mt-1 text-muted-foreground/70">
                            {new Date(cmd.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <>
              {/* Voice Visualization */}
              <div className="flex flex-col items-center py-8">
                <button
                  onClick={toggleListening}
                  className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                    isListening
                      ? 'animate-pulse bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {isListening ? (
                    <Mic className="h-10 w-10 text-primary-foreground" />
                  ) : (
                    <MicOff className="h-10 w-10 text-muted-foreground" />
                  )}
                </button>
                <p className="mt-4 text-sm text-muted-foreground">
                  {isListening ? 'Listening...' : 'Click to start'}
                </p>
                {isListening && (
                  <div className="flex items-center gap-1 mt-2">
                    <div className="w-1 h-4 rounded-full animate-pulse bg-primary" />
                    <div className="w-1 h-6 rounded-full animate-pulse bg-primary [animation-delay:0.1s]" />
                    <div className="w-1 h-5 rounded-full animate-pulse bg-primary [animation-delay:0.2s]" />
                    <div className="w-1 h-7 rounded-full animate-pulse bg-primary [animation-delay:0.3s]" />
                    <div className="w-1 h-3 rounded-full animate-pulse bg-primary [animation-delay:0.4s]" />
                  </div>
                )}
              </div>

              {/* Transcript */}
              {transcript && (
                <div className="p-4 rounded-lg mb-4 bg-muted">
                  <p className="text-sm text-muted-foreground">
                    Transcript:
                  </p>
                  <p className="text-lg mt-1 text-foreground">
                    "{transcript}"
                  </p>
                </div>
              )}

              {/* Current Command Status */}
              {(processing || currentCommand) && (
                <div className="p-4 rounded-lg bg-muted">
                  {processing ? (
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 animate-pulse text-primary" />
                      <span className="text-foreground">Processing command...</span>
                    </div>
                  ) : currentCommand && (
                    <>
                      <div className="flex items-center gap-3 mb-2">
                        {(() => {
                          const status = statusConfig[currentCommand.status];
                          const StatusIcon = status.icon;
                          return (
                            <>
                              <StatusIcon className={`h-5 w-5 ${status.colorClass}`} />
                              <span className={`font-medium ${status.colorClass}`}>
                                {status.label}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                      {currentCommand.action && (
                        <p className="text-sm mb-2 text-muted-foreground">
                          Action: {currentCommand.action}
                        </p>
                      )}
                      {currentCommand.response && (
                        <p className="text-sm text-foreground">
                          {currentCommand.response}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <button
            onClick={toggleMute}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-muted text-foreground hover:bg-muted/80 transition-colors"
          >
            {isMuted ? (
              <>
                <VolumeX className="h-4 w-4" />
                Unmute
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4" />
                Mute
              </>
            )}
          </button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-success' : 'bg-muted-foreground'}`} />
              {isListening ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceControlPanel;
