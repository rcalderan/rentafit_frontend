import { HttpErrorResponse } from '@angular/common/http';

/** Códigos de erro de autenticação devolvidos pelo backend (ErrorResponse.code) e pelo Caddy (429). */
export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'EMAIL_NOT_VERIFIED'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

interface AuthErrorBody {
  code?: string;
  message?: string;
  details?: { remainingAttempts?: number; lockedUntil?: string };
}

const KNOWN_CODES: readonly AuthErrorCode[] = ['INVALID_CREDENTIALS', 'ACCOUNT_LOCKED', 'EMAIL_NOT_VERIFIED', 'RATE_LIMITED'];

/**
 * Falha de login tipada, para a tela avisar antes do bloqueio, mostrar o fim do bloqueio etc.
 * Ex.: `LoginFailure.fromHttp(error).remainingAttempts === 1` → exibir aviso de bloqueio.
 */
export class LoginFailure extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string,
    readonly remainingAttempts: number | null = null,
    readonly lockedUntil: Date | null = null,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = 'LoginFailure';
  }

  static fromHttp(error: HttpErrorResponse, fallbackMessage: string): LoginFailure {
    const body = (typeof error.error === 'object' && error.error !== null ? error.error : {}) as AuthErrorBody;
    const code = resolveCode(error.status, body.code);
    const lockedUntil = body.details?.lockedUntil ? new Date(body.details.lockedUntil) : null;
    return new LoginFailure(
      code,
      body.message || fallbackMessage,
      body.details?.remainingAttempts ?? null,
      lockedUntil && !Number.isNaN(lockedUntil.getTime()) ? lockedUntil : null,
      parseRetryAfter(error.headers?.get('Retry-After') ?? null),
    );
  }
}

function resolveCode(status: number, code: string | undefined): AuthErrorCode {
  if (code && (KNOWN_CODES as readonly string[]).includes(code)) return code as AuthErrorCode;
  if (status === 429) return 'RATE_LIMITED';
  if (status === 423) return 'ACCOUNT_LOCKED';
  return 'UNKNOWN';
}

function parseRetryAfter(raw: string | null): number | null {
  const seconds = raw === null ? NaN : Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}
