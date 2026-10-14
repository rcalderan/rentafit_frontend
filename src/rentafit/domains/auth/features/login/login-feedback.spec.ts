import { describe, expect, it } from 'vitest';
import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { LoginFailure } from '../../data/login-failure';
import { describeLoginFailure, LAST_ATTEMPT_WARNING } from './login-feedback';

describe('describeLoginFailure', () => {
  it('avisa do bloqueio quando resta 1 tentativa (4º erro)', () => {
    const feedback = describeLoginFailure(new LoginFailure('INVALID_CREDENTIALS', 'x', 1));
    expect(feedback.error).toBe('Usuário ou senha inválidos.');
    expect(feedback.warning).toBe(LAST_ATTEMPT_WARNING);
  });

  it('não avisa quando restam 2 ou mais tentativas', () => {
    expect(describeLoginFailure(new LoginFailure('INVALID_CREDENTIALS', 'x', 3)).warning).toBeNull();
  });

  it('conta bloqueada mostra horário e menciona o link por e-mail', () => {
    const until = new Date('2026-10-12T15:30:00Z');
    const feedback = describeLoginFailure(new LoginFailure('ACCOUNT_LOCKED', 'x', null, until));
    expect(feedback.error).toContain('Conta bloqueada até');
    expect(feedback.error).toContain('link de desbloqueio');
  });

  it('conta bloqueada sem horário cai no texto padrão', () => {
    expect(describeLoginFailure(new LoginFailure('ACCOUNT_LOCKED', 'x')).error).toContain('por 30 minutos');
  });

  it('e-mail não verificado oferece reenvio', () => {
    expect(describeLoginFailure(new LoginFailure('EMAIL_NOT_VERIFIED', 'x')).offerResendVerification).toBe(true);
  });

  it('rate limit mostra os segundos do Retry-After', () => {
    const feedback = describeLoginFailure(new LoginFailure('RATE_LIMITED', 'x', null, null, 42));
    expect(feedback.error).toContain('42 segundos');
  });

  it('erro genérico preserva a mensagem', () => {
    expect(describeLoginFailure(new Error('Falha de rede')).error).toBe('Falha de rede');
    expect(describeLoginFailure(new LoginFailure('UNKNOWN', 'Algo falhou')).error).toBe('Algo falhou');
  });
});

describe('LoginFailure.fromHttp', () => {
  it('lê code, details e Retry-After do backend', () => {
    const error = new HttpErrorResponse({
      status: 423,
      error: { code: 'ACCOUNT_LOCKED', message: 'bloqueada', details: { lockedUntil: '2026-10-12T15:30:00Z' } },
      headers: new HttpHeaders({ 'Retry-After': '1800' }),
    });
    const failure = LoginFailure.fromHttp(error, 'fallback');
    expect(failure.code).toBe('ACCOUNT_LOCKED');
    expect(failure.lockedUntil?.toISOString()).toBe('2026-10-12T15:30:00.000Z');
    expect(failure.retryAfterSeconds).toBe(1800);
  });

  it('429 do Caddy sem code vira RATE_LIMITED', () => {
    const failure = LoginFailure.fromHttp(new HttpErrorResponse({ status: 429, error: null }), 'fallback');
    expect(failure.code).toBe('RATE_LIMITED');
    expect(failure.message).toBe('fallback');
  });

  it('403 com remainingAttempts', () => {
    const failure = LoginFailure.fromHttp(new HttpErrorResponse({
      status: 403, error: { code: 'INVALID_CREDENTIALS', details: { remainingAttempts: 1 } },
    }), 'fallback');
    expect(failure.remainingAttempts).toBe(1);
  });
});
