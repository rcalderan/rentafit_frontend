import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../shared/data/app-config.token';
import {
  IMonthlyMovementResponse,
  IYearlyMovementResponse,
  MovementSourceFilter,
} from '../data/financial-movement.model';

/**
 * Serviço HTTP para consulta de movimentação financeira (diária, mensal e anual)
 * consolidando parcelas de aluguéis e vendas.
 */
@Injectable({ providedIn: 'root' })
export class FinancialMovementService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(APP_CONFIG).apiBaseUrl}/api/v1/finance/movements`;

  /**
   * Busca o consolidado mensal (totais, dias do calendário, formas de pagamento e extrato).
   * `sectorId` restringe às parcelas recebidas no caixa daquele setor.
   *
   * Exemplo: `service.getMonthlyMovement(2026, 10, 'ALL', null)`
   */
  getMonthlyMovement(
    year: number,
    month: number,
    source: MovementSourceFilter = 'ALL',
    sectorId: string | null = null,
  ): Observable<IMonthlyMovementResponse> {
    let params = new HttpParams()
      .set('year', String(year))
      .set('month', String(month))
      .set('source', source);
    if (sectorId) {
      params = params.set('sectorId', sectorId);
    }
    return this.http.get<IMonthlyMovementResponse>(`${this.baseUrl}/monthly`, { params });
  }

  /**
   * Busca o consolidado anual (12 meses de Jan a Dez, formas de pagamento e setores).
   *
   * Exemplo: `service.getYearlyMovement(2026, 'ALL', null)`
   */
  getYearlyMovement(
    year: number,
    source: MovementSourceFilter = 'ALL',
    sectorId: string | null = null,
  ): Observable<IYearlyMovementResponse> {
    let params = new HttpParams()
      .set('year', String(year))
      .set('source', source);
    if (sectorId) {
      params = params.set('sectorId', sectorId);
    }
    return this.http.get<IYearlyMovementResponse>(`${this.baseUrl}/yearly`, { params });
  }
}
