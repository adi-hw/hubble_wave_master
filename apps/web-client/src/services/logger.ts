/**
 * Centralized logging service for the web client.
 * Replaces direct console.* calls with a configurable logging layer.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
  timestamp: Date;
}

interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  onLog?: (entry: LogEntry) => void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const config: LoggerConfig = {
  minLevel: import.meta.env.PROD ? 'warn' : 'debug',
  enableConsole: !import.meta.env.PROD,
};

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[config.minLevel];
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: string,
  data?: unknown
): LogEntry {
  return {
    level,
    message,
    context,
    data,
    timestamp: new Date(),
  };
}

function formatMessage(context: string | undefined, message: string): string {
  return context ? `[${context}] ${message}` : message;
}

export const logger = {
  debug(message: string, data?: unknown, context?: string): void {
    if (!shouldLog('debug')) return;
    const entry = createLogEntry('debug', message, context, data);
    if (config.enableConsole) {
      // eslint-disable-next-line no-console
      console.debug(formatMessage(context, message), data ?? '');
    }
    config.onLog?.(entry);
  },

  info(message: string, data?: unknown, context?: string): void {
    if (!shouldLog('info')) return;
    const entry = createLogEntry('info', message, context, data);
    if (config.enableConsole) {
      // eslint-disable-next-line no-console
      console.info(formatMessage(context, message), data ?? '');
    }
    config.onLog?.(entry);
  },

  warn(message: string, data?: unknown, context?: string): void {
    if (!shouldLog('warn')) return;
    const entry = createLogEntry('warn', message, context, data);
    if (config.enableConsole) {
       
      console.warn(formatMessage(context, message), data ?? '');
    }
    config.onLog?.(entry);
  },

  error(message: string, error?: unknown, context?: string): void {
    if (!shouldLog('error')) return;
    const entry = createLogEntry('error', message, context, error);
    if (config.enableConsole) {
       
      console.error(formatMessage(context, message), error ?? '');
    }
    config.onLog?.(entry);
  },

  configure(options: Partial<LoggerConfig>): void {
    Object.assign(config, options);
  },
};

export type { LogLevel, LogEntry, LoggerConfig };
