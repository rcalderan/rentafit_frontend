/**
 * Converte data ISO do backend ('YYYY-MM-DD') para 'DD/MM/YYYY'.
 * Faz split manual — `new Date('YYYY-MM-DD')` interpreta como UTC e
 * mudaria o dia em fusos negativos (ex.: Brasil UTC-3).
 */
export function formatDateBr(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
