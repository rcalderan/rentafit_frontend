import { LoginFailure } from '../../data/login-failure';

export interface LoginFeedback {
  error: string;
  /** Aviso extra (ex.: última tentativa antes do bloqueio). */
  warning: string | null;
  offerResendVerification: boolean;
}

export const LAST_ATTEMPT_WARNING =
  'Atenção: mais uma tentativa incorreta bloqueará sua conta por 30 minutos.';

/**
 * Traduz a falha de login em mensagens para a tela.
 * Ex.: `describeLoginFailure(new LoginFailure('INVALID_CREDENTIALS', 'x', 1)).warning` → aviso de bloqueio.
 */
export function describeLoginFailure(failure: unknown): LoginFeedback {
  if (!(failure instanceof LoginFailure)) {
    const message = failure instanceof Error && failure.message ? failure.message : 'Erro ao realizar login';
    return { error: message, warning: null, offerResendVerification: false };
  }
  switch (failure.code) {
    case 'INVALID_CREDENTIALS':
      return {
        error: 'Usuário ou senha inválidos.',
        warning: failure.remainingAttempts === 1 ? LAST_ATTEMPT_WARNING : null,
        offerResendVerification: false,
      };
    case 'ACCOUNT_LOCKED':
      return { error: lockedMessage(failure.lockedUntil), warning: null, offerResendVerification: false };
    case 'EMAIL_NOT_VERIFIED':
      return {
        error: 'Confirme seu e-mail para acessar. Verifique sua caixa de entrada ou reenvie o link abaixo.',
        warning: null,
        offerResendVerification: true,
      };
    case 'RATE_LIMITED':
      return { error: rateLimitedMessage(failure.retryAfterSeconds), warning: null, offerResendVerification: false };
    default:
      return { error: failure.message || 'Erro ao realizar login', warning: null, offerResendVerification: false };
  }
}

function lockedMessage(lockedUntil: Date | null): string {
  const until = lockedUntil
    ? ` até ${lockedUntil.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : ' por 30 minutos';
  return `Conta bloqueada${until} por excesso de tentativas. Enviamos um link de desbloqueio para o e-mail cadastrado.`;
}

function rateLimitedMessage(retryAfterSeconds: number | null): string {
  const wait = retryAfterSeconds ? `${retryAfterSeconds} segundos` : 'alguns instantes';
  return `Muitas tentativas deste dispositivo. Aguarde ${wait} e tente novamente.`;
}
