/**
 * useVoiceControl - Voice Recognition Hook
 * HubbleWave Platform - Phase 7
 *
 * Provides voice control functionality using Web Speech API.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Web Speech API type declarations
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognition extends EventTarget {
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

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

type VoiceCommandIntent =
  | 'navigate'
  | 'search'
  | 'create'
  | 'update'
  | 'delete'
  | 'report'
  | 'help'
  | 'status'
  | 'unknown';

interface VoiceCommand {
  intent: VoiceCommandIntent;
  entities: Record<string, string>;
  rawText: string;
  confidence: number;
}

interface VoiceControlState {
  isListening: boolean;
  isSupported: boolean;
  isProcessing: boolean;
  transcript: string;
  error: string | null;
  lastCommand: VoiceCommand | null;
}

interface VoiceControlOptions {
  wakeWord?: string;
  continuous?: boolean;
  language?: string;
  onCommand?: (command: VoiceCommand) => void;
  onError?: (error: string) => void;
}

interface UseVoiceControlReturn extends VoiceControlState {
  start: () => void;
  stop: () => void;
  speak: (text: string) => void;
}

// Command patterns for intent recognition
const commandPatterns: Array<{ pattern: RegExp; intent: VoiceCommandIntent }> = [
  { pattern: /(?:go to|navigate to|open|show)\s+(.+)/i, intent: 'navigate' },
  { pattern: /(?:search|find|look for)\s+(.+)/i, intent: 'search' },
  { pattern: /(?:create|new|add)\s+(.+)/i, intent: 'create' },
  { pattern: /(?:update|edit|modify|change)\s+(.+)/i, intent: 'update' },
  { pattern: /(?:delete|remove)\s+(.+)/i, intent: 'delete' },
  { pattern: /(?:generate|create)\s+(?:a\s+)?report\s*(?:for|on|about)?\s*(.+)?/i, intent: 'report' },
  { pattern: /(?:help|what can you do|commands)/i, intent: 'help' },
  { pattern: /(?:status|what is the status)\s*(?:of)?\s*(.+)?/i, intent: 'status' },
];

export function useVoiceControl(options: VoiceControlOptions = {}): UseVoiceControlReturn {
  const {
    wakeWord = 'hey ava',
    continuous = true,
    language = 'en-US',
    onCommand,
    onError,
  } = options;

  const [state, setState] = useState<VoiceControlState>({
    isListening: false,
    isSupported: false,
    isProcessing: false,
    transcript: '',
    error: null,
    lastCommand: null,
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wakeWordDetectedRef = useRef(false);

  // Check for browser support
  useEffect(() => {
    const SpeechRecognitionClass =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;

    setState((prev) => ({ ...prev, isSupported: !!SpeechRecognitionClass }));

    if (SpeechRecognitionClass) {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = continuous;
      recognition.interimResults = false;
      recognition.lang = language;

      recognition.onresult = handleResult;
      recognition.onerror = handleError;
      recognition.onend = handleEnd;

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [continuous, language]);

  const parseCommand = useCallback((text: string): VoiceCommand => {
    const normalizedText = text.toLowerCase().trim();

    for (const { pattern, intent } of commandPatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        const entities: Record<string, string> = {};
        if (match[1]) {
          entities.target = match[1].trim();
        }

        return {
          intent,
          entities,
          rawText: text,
          confidence: 0.9,
        };
      }
    }

    return {
      intent: 'unknown',
      entities: { query: text },
      rawText: text,
      confidence: 0.5,
    };
  }, []);

  const handleResult = useCallback(
    (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join('')
        .toLowerCase()
        .trim();

      setState((prev) => ({ ...prev, transcript }));

      // Check for wake word
      if (transcript.includes(wakeWord)) {
        wakeWordDetectedRef.current = true;
        playAcknowledgmentSound();
        const command = transcript.replace(wakeWord, '').trim();
        if (command) {
          processCommand(command);
        }
        return;
      }

      // If wake word was detected, process the command
      if (wakeWordDetectedRef.current) {
        processCommand(transcript);
        wakeWordDetectedRef.current = false;
      }
    },
    [wakeWord]
  );

  const processCommand = useCallback(
    (text: string) => {
      setState((prev) => ({ ...prev, isProcessing: true }));

      const command = parseCommand(text);
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        lastCommand: command,
      }));

      if (onCommand) {
        onCommand(command);
      }

      // Provide voice feedback
      if (command.intent !== 'unknown') {
        speak(`Processing ${command.intent} command`);
      } else {
        speak("I didn't understand that command. Please try again.");
      }
    },
    [parseCommand, onCommand]
  );

  const handleError = useCallback(
    (event: SpeechRecognitionErrorEvent) => {
      const errorMessage = `Voice recognition error: ${event.error}`;
      setState((prev) => ({ ...prev, error: errorMessage }));

      if (onError) {
        onError(errorMessage);
      }

      // Restart on non-critical errors
      if (event.error === 'no-speech' && state.isListening && recognitionRef.current) {
        recognitionRef.current.start();
      }
    },
    [state.isListening, onError]
  );

  const handleEnd = useCallback(() => {
    // Restart if still supposed to be listening
    if (state.isListening && recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch {
        // Already running
      }
    }
  }, [state.isListening]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;

    try {
      recognitionRef.current.start();
      setState((prev) => ({ ...prev, isListening: true, error: null }));
    } catch {
      // Already running
    }
  }, []);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setState((prev) => ({ ...prev, isListening: false }));
  }, []);

  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  return {
    ...state,
    start,
    stop,
    speak,
  };
}

function playAcknowledgmentSound(): void {
  try {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    gainNode.gain.value = 0.1;

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch {
    // Audio context not available
  }
}

export default useVoiceControl;
