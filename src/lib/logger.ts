import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARNING: 30,
  ERROR: 40,
  CRITICAL: 50,
};

const configuredLevel = ((process.env.LOG_LEVEL || 'INFO').toUpperCase() as LogLevel);
const SERVICE_NAME = process.env.SERVICE_NAME || 'bar-backend';
const SERVICE_VERSION = process.env.SERVICE_VERSION || process.env.npm_package_version || '1.0.0';
const LOGGER_PREFIX = process.env.LOGGER_PREFIX || 'bar';
const TIMEZONE = 'Asia/Kolkata';

export type LogContext = {
  requestId?: string;
  correlationId?: string;
  module?: string;
  category?: string;
  component?: string;
  event?: string;
  operation?: string;
  method?: string;
  endpoint?: string;
  path?: string;
  userId?: string;
  entityId?: string;
  statusCode?: number;
  durationMs?: number;
  clientIp?: string;
  [key: string]: unknown;
};

type RequestStore = {
  requestId: string;
  correlationId: string;
  method?: string;
  endpoint?: string;
  path?: string;
  userId?: string;
  clientIp?: string;
};

const requestContext = new AsyncLocalStorage<RequestStore>();

const REDACT_KEYS = [
  'password',
  'token',
  'authorization',
  'secret',
  'apikey',
  'accesskey',
  'passwordhash',
  'cookie',
  'otp',
  'refreshtoken',
  'accesstoken',
];

const RESERVED_KEYS = new Set([
  'ts',
  'tz',
  'level',
  'logger',
  'message',
  'service',
  'version',
  'pid',
  'request_id',
  'correlation_id',
  'module',
  'category',
  'requestId',
  'correlationId',
  'endpoint',
  'statusCode',
  'durationMs',
  'clientIp',
  'userId',
  'entityId',
]);

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitizeValue);

  const output: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (REDACT_KEYS.some((k) => lower.includes(k))) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = sanitizeValue(val);
    }
  }
  return output;
}

function formatTimestampIst(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  const datePart = `${byType.year}-${byType.month}-${byType.day}`;
  return `${datePart}T${byType.hour}:${byType.minute}:${byType.second}.${ms}+05:30`;
}

function normalizeComponent(categoryOrComponent?: string): string {
  if (!categoryOrComponent) return 'app';
  return categoryOrComponent
    .toLowerCase()
    .replace(new RegExp(`^${LOGGER_PREFIX}\\.`), '')
    .replace(/_/g, '.')
    .replace(/\s+/g, '.');
}

function toLoggerName(component: string, event?: string): string {
  if (event === 'http.access' || component === 'http') return `${LOGGER_PREFIX}.access`;
  return `${LOGGER_PREFIX}.${component}`;
}

function deriveEvent(component: string, operation: string | undefined, explicit?: string): string {
  if (explicit) return explicit;
  if (component === 'http') return 'http.access';
  if (component === 'database') return 'database.query';
  if (component === 'auth') return 'auth.event';
  if (component === 'validation') return 'validation.failed';
  if (component === 'audit') return 'audit.event';
  if (operation) {
    return `${component}.${operation}`
      .toLowerCase()
      .replace(/[^a-z0-9._/-]+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 120);
  }
  return `${component}.event`;
}

function snakeExtra(context: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (RESERVED_KEYS.has(key)) continue;
    if (value === undefined) continue;
    const snake = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    out[snake] = value;
  }
  return out;
}

function emit(level: LogLevel, message: string, context: LogContext = {}): void {
  if (LEVEL_PRIORITY[level] < (LEVEL_PRIORITY[configuredLevel] ?? LEVEL_PRIORITY.INFO)) {
    return;
  }

  const current = requestContext.getStore();
  const merged = sanitizeValue({
    ...current,
    ...context,
    requestId: context.requestId ?? current?.requestId,
    correlationId: context.correlationId ?? current?.correlationId,
    method: context.method ?? current?.method,
    endpoint: context.endpoint ?? context.path ?? current?.endpoint ?? current?.path,
    path: context.path ?? context.endpoint ?? current?.path ?? current?.endpoint,
    userId: context.userId ?? current?.userId,
    clientIp: context.clientIp ?? current?.clientIp,
  }) as Record<string, unknown>;

  const component = normalizeComponent(
    (merged.component as string) || (merged.category as string) || (merged.module as string) || 'app'
  );
  const operation = (merged.operation as string) || undefined;
  const path = (merged.path as string) || (merged.endpoint as string) || undefined;
  const method = (merged.method as string) || undefined;
  const statusCode = merged.statusCode as number | undefined;
  const durationMs = merged.durationMs as number | undefined;
  const event = deriveEvent(component, operation, merged.event as string | undefined);

  const payload: Record<string, unknown> = {
    ts: formatTimestampIst(),
    tz: TIMEZONE,
    level,
    logger: toLoggerName(component, event),
    message,
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    pid: process.pid,
    request_id: (merged.requestId as string) || null,
    correlation_id: (merged.correlationId as string) || null,
    event,
    component: event === 'http.access' ? 'http' : component,
  };

  if (method) payload.method = method;
  if (path) payload.path = path;
  if (statusCode !== undefined) payload.status_code = statusCode;
  if (durationMs !== undefined) {
    payload.duration_ms = typeof durationMs === 'number' ? Number(durationMs.toFixed(2)) : durationMs;
  }
  if (merged.clientIp) payload.client_ip = merged.clientIp;
  if (merged.userId) payload.user_id = merged.userId;
  if (merged.entityId) payload.entity_id = merged.entityId;
  if (operation) payload.operation = operation;

  Object.assign(payload, snakeExtra(merged));

  const line = JSON.stringify(payload);
  if (level === 'ERROR' || level === 'CRITICAL') {
    console.error(line);
  } else if (level === 'WARNING') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit('DEBUG', message, context),
  info: (message: string, context?: LogContext) => emit('INFO', message, context),
  warning: (message: string, context?: LogContext) => emit('WARNING', message, context),
  warn: (message: string, context?: LogContext) => emit('WARNING', message, context),
  error: (message: string, context?: LogContext) => emit('ERROR', message, context),
  critical: (message: string, context?: LogContext) => emit('CRITICAL', message, context),
};

export function setRequestUser(userId?: string): void {
  const current = requestContext.getStore();
  if (!current || !userId) return;
  requestContext.enterWith({ ...current, userId });
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      correlationId?: string;
    }
  }
}

function headerValue(req: Request, name: string): string | undefined {
  const raw = req.headers[name];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw[0]) return String(raw[0]).trim();
  return undefined;
}

/** Assigns request_id + correlation_id and emits http.access on response finish. */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = headerValue(req, 'x-request-id') || randomUUID();
  const correlationId = headerValue(req, 'x-correlation-id') || requestId;
  req.requestId = requestId;
  req.correlationId = correlationId;
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Correlation-Id', correlationId);

  const startedAt = Date.now();
  const path = req.originalUrl || req.url || req.path;
  const clientIp = req.ip || (req.socket && req.socket.remoteAddress) || undefined;

  requestContext.run(
    {
      requestId,
      correlationId,
      method: req.method,
      endpoint: path,
      path,
      clientIp,
    },
    () => {
      res.on('finish', () => {
        if (path === '/' || path === '/health' || path === '/favicon.ico') return;
        const durationMs = Date.now() - startedAt;
        const store = requestContext.getStore();
        logger.info(`${req.method} ${path} ${res.statusCode}`, {
          component: 'http',
          event: 'http.access',
          operation: `${req.method} ${path}`,
          requestId,
          correlationId,
          method: req.method,
          path,
          endpoint: path,
          statusCode: res.statusCode,
          durationMs,
          clientIp: store?.clientIp || clientIp,
          userId: store?.userId,
        });
      });

      next();
    }
  );
}

export function logException(err: unknown, module: string, operation: string, context: LogContext = {}): void {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error(`Exception in ${operation}: ${error.message}`, {
    ...context,
    component: normalizeComponent(module),
    event: 'exception',
    operation,
    error_name: error.name,
    error_message: error.message,
    stack: error.stack,
  });
}
