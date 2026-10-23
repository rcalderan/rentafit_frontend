import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Espelho das regras do backend (UsernameRules, PasswordRules, PinRules) para feedback imediato.
 * O backend continua sendo a autoridade: a blocklist de senhas comuns só é verificada lá.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 64;
const BCRYPT_MAX_BYTES = 72;

const USERNAME_FORMAT = /^[a-z][a-z0-9._-]{2,29}$/;
const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'administrador', 'root', 'system', 'sistema', 'suporte', 'support',
  'rentafit', 'null', 'undefined', 'api', 'operator', 'operador', 'manager', 'gerente',
  'superuser', 'sysadmin', 'webmaster', 'security', 'seguranca',
]);
const COMMON_PINS = new Set([
  '1212', '2580', '0852', '1004', '2000', '2001', '1122', '6969', '1313', '1010', '2020', '0101',
  '1221', '2112', '1984', '1999', '1969', '4200', '1230', '2468', '1357', '5683', '0007', '9876',
]);

export function normalizeUsername(raw: string): string {
  return (raw ?? '').trim().toLowerCase();
}

/** Ex.: `usernameViolation('joao.silva')` → `null`. */
export function usernameViolation(raw: string): string | null {
  const username = normalizeUsername(raw);
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return `Username deve ter entre ${USERNAME_MIN} e ${USERNAME_MAX} caracteres`;
  }
  if (!USERNAME_FORMAT.test(username)) {
    return "Comece com letra e use apenas letras minúsculas, números, '.', '_' ou '-'";
  }
  if (/[._-]{2}/.test(username) || /[._-]$/.test(username)) {
    return 'Não use separadores seguidos nem termine com . _ ou -';
  }
  return RESERVED_USERNAMES.has(username) ? 'Username reservado pelo sistema; escolha outro' : null;
}

/** Lista todas as regras não atendidas, para exibir como checklist. Ex.: `passwordViolations('abc')`. */
export function passwordViolations(password: string): string[] {
  if (!password) return [];
  const violations: string[] = [];
  const length = [...password].length;
  if (length < PASSWORD_MIN || length > PASSWORD_MAX) violations.push(`Entre ${PASSWORD_MIN} e ${PASSWORD_MAX} caracteres`);
  if (new TextEncoder().encode(password).length > BCRYPT_MAX_BYTES) violations.push('Máximo de 72 bytes (menos acentos/emojis)');
  if (!/\p{Ll}/u.test(password)) violations.push('Pelo menos 1 letra minúscula');
  if (!/\p{Lu}/u.test(password)) violations.push('Pelo menos 1 letra maiúscula');
  if (!/\p{Nd}/u.test(password)) violations.push('Pelo menos 1 número');
  if (!/[^\p{L}\p{N}\s]/u.test(password)) violations.push('Pelo menos 1 caractere especial (ex.: @ # $ ! %)');
  if (password !== password.trim()) violations.push('Sem espaço no início ou no fim');
  if (/(.)\1\1/u.test(password)) violations.push('Sem repetir o mesmo caractere 3 vezes seguidas');
  return violations;
}

/** Ex.: `pinViolation('4831')` → `null`. */
export function pinViolation(pin: string): string | null {
  if (!pin) return null;
  if (!/^\d{4}$/.test(pin)) return 'PIN deve ter exatamente 4 dígitos numéricos';
  if (new Set(pin).size === 1) return 'PIN não pode repetir o mesmo dígito (ex.: 0000)';
  if (isSequence(pin)) return 'PIN não pode ser uma sequência (ex.: 1234, 4321)';
  return COMMON_PINS.has(pin) ? 'PIN muito comum; escolha outro' : null;
}

function isSequence(pin: string): boolean {
  const steps = [...pin].slice(1).map((digit, i) => Number(digit) - Number(pin[i]));
  return steps.every(step => step === 1) || steps.every(step => step === -1);
}

export const usernameValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as string;
  if (!value) return null;
  const violation = usernameViolation(value);
  return violation ? { invalidFormat: violation } : null;
};
