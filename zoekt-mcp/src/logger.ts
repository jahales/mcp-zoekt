import pino from 'pino';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Create a Pino logger instance with the specified log level
 */
export function createLogger(level: LogLevel): pino.Logger {
  return pino({
    level,
    serializers: {
      err: pino.stdSerializers.err,
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["set-cookie"]',
        'req.headers["proxy-authorization"]',
        'headers.authorization',
        'headers.cookie',
        'headers["set-cookie"]',
        'headers["proxy-authorization"]',
      ],
      censor: '[REDACTED]',
    },
    transport: {
      target: 'pino/file',
      options: {
        destination: 2, // stderr
      },
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type Logger = pino.Logger;
