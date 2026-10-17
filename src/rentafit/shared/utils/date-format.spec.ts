import { formatDateBr } from './date-format';

describe('formatDateBr', () => {
  it('converte ISO YYYY-MM-DD para DD/MM/YYYY sem shift de fuso', () => {
    expect(formatDateBr('2026-06-01')).toBe('01/06/2026');
  });

  it('retorna — quando a data é undefined', () => {
    expect(formatDateBr(undefined)).toBe('—');
  });
});
