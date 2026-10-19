import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TerminalSectorService } from '../service/terminal-sector.service';

/**
 * Interceptor que propaga o setor do terminal em todas as chamadas à API.
 * O backend (`TerminalSectorResolver`) usa `X-Terminal-Sector-Id` para atribuir
 * contratos, vendas, retiradas, devoluções e baixas de caixa ao setor correto.
 */
export const terminalSectorInterceptor: HttpInterceptorFn = (req, next) => {
  const sectorId = inject(TerminalSectorService).sectorId();
  if (!sectorId) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { 'X-Terminal-Sector-Id': sectorId } }));
};
