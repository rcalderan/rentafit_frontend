import { HttpErrorResponse } from '@angular/common/http';
import { ErrorMessages, HTTP_ERROR_MAP } from '../data/error-messages';

const MASKED_BACKEND_MESSAGES = new Set<string>([
  'Validation failed for one or more fields',
  'Invalid request body',
  'Invalid JSON format',
  'Invalid JSON format or type mismatch',
  'Invalid argument',
  'Invalid parameter type',
  'Missing required parameter',
  'Unauthorized',
  'Method not allowed',
  'Not found',
  'Endpoint not found',
  'External service error',
  'Database error occurred',
  'An unexpected error occurred',
]);

interface ApiFieldError {
  field?: string;
  message?: string;
}

interface ApiErrorPayload {
  status?: number;
  path?: string;
  error?: string;
   erro?: string;
  message?: string | string[];
  statusMessage?: string;
  errors?: (ApiFieldError | string)[];
}

/**
 * Extrai mensagem amigável de um erro HTTP dos 3 backends (/api, /nfe-api, /nfse-api)
 * ou de um Error já embrulhado por um service.
 *
 * Exemplo: `apiErrorMessage(httpErr, 'Erro ao salvar.')`
 */
export function apiErrorMessage(err: unknown, fallback?: string): string {
  if (err instanceof HttpErrorResponse) {
    return extractFromHttp(err, fallback);
  }
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message;
  }
  return fallback ?? ErrorMessages.UNKNOWN_ERROR;
}

/**
 * Extrai lista de mensagens de validação de campo (400) ou a mensagem principal como item único.
 *
 * Exemplo: `apiErrorMessages(httpErr, 'Erro de validação.')`
 */
export function apiErrorMessages(err: unknown, fallback?: string): string | string[] {
  if (err instanceof HttpErrorResponse) {
    const fieldList = extractFieldErrorList(err.error);
    if (fieldList.length > 0) return fieldList;
  }
  return apiErrorMessage(err, fallback);
}

function extractFromHttp(err: HttpErrorResponse, fallback?: string): string {
  const body = err.error;
  if (body instanceof ErrorEvent) {
    return HTTP_ERROR_MAP[0] ?? fallback ?? ErrorMessages.CONNECTION_ERROR;
  }
  const fromBody = extractFromBody(body);
  if (fromBody) return fromBody;
  return fallback ?? HTTP_ERROR_MAP[err.status] ?? ErrorMessages.UNKNOWN_ERROR;
}

function extractFromBody(body: unknown): string | null {
  if (typeof body === 'string') {
    const trimmed = body.trim();
    return trimmed.length > 0 && !trimmed.startsWith('<') ? trimmed : null;
  }
  if (!body || typeof body !== 'object') return null;

  const payload = body as ApiErrorPayload;
  const fieldList = extractFieldErrorList(payload);
  if (fieldList.length > 0) return fieldList.join(' | ');

  const statusMsg = usableText(payload.statusMessage);
  if (statusMsg) return statusMsg;

  const message = extractMessageField(payload.message);
  if (message) return message;

  const certErr = usableText(payload.erro);
  if (certErr) return certErr;

  if (!isRentafitEnvelope(payload)) {
    const nfeErr = usableText(payload.error);
    if (nfeErr) return nfeErr;
    const flatMap = extractFlatValidationMap(body as Record<string, unknown>);
    if (flatMap) return flatMap;
  }

  return null;
}

function extractFieldErrorList(body: unknown): string[] {
  if (!body || typeof body !== 'object') return [];
  const errors = (body as ApiErrorPayload).errors;
  if (!Array.isArray(errors)) return [];
  return errors
    .map(item => (typeof item === 'string' ? item.trim() : (item?.message ?? '').trim()))
    .filter(msg => msg.length > 0);
}

function extractMessageField(message: string | string[] | undefined): string | null {
  if (Array.isArray(message)) {
    const joined = message.map(m => (typeof m === 'string' ? m.trim() : '')).filter(Boolean).join(' | ');
    return joined.length > 0 ? joined : null;
  }
  return usableText(message);
}

function usableText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || MASKED_BACKEND_MESSAGES.has(trimmed)) return null;
  return trimmed;
}

function isRentafitEnvelope(payload: ApiErrorPayload): boolean {
  return typeof payload.status === 'number' || typeof payload.path === 'string';
}

const ENVELOPE_KEYS = new Set<string>([
  'status',
  'statusCode',
  'timestamp',
  'path',
  'error',
  'erro',
  'message',
  'statusMessage',
  'errors',
  'code',
  'details',
]);

function extractFlatValidationMap(record: Record<string, unknown>): string | null {
  const keys = Object.keys(record).filter(k => k !== 'type' && k !== 'data');
  if (keys.length === 0 || keys.some(k => ENVELOPE_KEYS.has(k))) return null;
  const values: string[] = [];
  for (const key of keys) {
    const val = record[key];
    if (typeof val !== 'string' || val.trim().length === 0) return null;
    values.push(val.trim());
  }
  return values.join(' | ');
}
