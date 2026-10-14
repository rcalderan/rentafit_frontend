import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import {
  normalizeUsername, passwordViolations, pinViolation, usernameValidator, usernameViolation,
} from './credential-rules';

describe('credential-rules', () => {
  describe('usernameViolation', () => {
    it.each(['joao.silva', 'ana_2026', 'm-costa', '  Joao.Silva '])('aceita %s', username => {
      expect(usernameViolation(username)).toBeNull();
    });

    it.each([
      ['ab', 'entre 3 e 30'],
      ['1joao', 'Comece com letra'],
      ['joao@mail.com', 'Comece com letra'],
      ['joão', 'Comece com letra'],
      ['joao..silva', 'separadores'],
      ['joao.', 'separadores'],
      ['admin', 'reservado'],
    ])('rejeita %s', (username, expected) => {
      expect(usernameViolation(username)).toContain(expected);
    });

    it('normaliza caixa e espaços', () => {
      expect(normalizeUsername('  Joao.Silva ')).toBe('joao.silva');
    });

    it('validator do form usa a chave invalidFormat e ignora vazio', () => {
      expect(usernameValidator(new FormControl('1abc'))).toEqual({ invalidFormat: expect.any(String) });
      expect(usernameValidator(new FormControl(''))).toBeNull();
    });
  });

  describe('passwordViolations', () => {
    it('senha forte não tem violações', () => {
      expect(passwordViolations('Vestido#Azul42')).toEqual([]);
    });

    it('vazio não exibe checklist', () => {
      expect(passwordViolations('')).toEqual([]);
    });

    it.each([
      ['Curta1!x', 'Entre 10 e 64'],
      ['vestido#azul42', 'maiúscula'],
      ['VESTIDO#AZUL42', 'minúscula'],
      ['Vestido#AzulXX', 'número'],
      ['VestidoAzul42x', 'especial'],
      [' Vestido#Azul42', 'espaço'],
      ['Vestido#Azuuul42', '3 vezes'],
      ['Aa1!' + 'ção'.repeat(18), '72 bytes'],
    ])('aponta a regra quebrada em %s', (password, expected) => {
      expect(passwordViolations(password).join('|')).toContain(expected);
    });
  });

  describe('pinViolation', () => {
    it.each(['4831', '9071', '0429'])('aceita %s', pin => {
      expect(pinViolation(pin)).toBeNull();
    });

    it.each([
      ['12a4', '4 dígitos'],
      ['123', '4 dígitos'],
      ['0000', 'repetir'],
      ['1234', 'sequência'],
      ['4321', 'sequência'],
      ['1212', 'comum'],
    ])('rejeita %s', (pin, expected) => {
      expect(pinViolation(pin)).toContain(expected);
    });
  });
});
