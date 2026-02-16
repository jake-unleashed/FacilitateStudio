import * as Sentry from '@sentry/react';
import { AppError } from './errors';

const isSentryEnabled = import.meta.env.PROD && Boolean(import.meta.env.VITE_SENTRY_DSN);

function toMessage(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.message;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}

function addBreadcrumb(level: 'info' | 'warning' | 'error', args: unknown[]): void {
  if (!isSentryEnabled) return;
  Sentry.addBreadcrumb({
    category: 'app',
    level,
    message: toMessage(args),
  });
}

export const logger = {
  log: (...args: unknown[]): void => {
    if (import.meta.env.DEV) {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]): void => {
    console.warn(...args);
    addBreadcrumb('warning', args);
  },
  error: (...args: unknown[]): void => {
    console.error(...args);
    addBreadcrumb('error', args);
    const maybeError = args.find((arg) => arg instanceof Error);
    if (isSentryEnabled && maybeError instanceof Error && !(maybeError instanceof AppError)) {
      Sentry.captureException(maybeError);
    }
  },
};
