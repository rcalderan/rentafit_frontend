import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { APP_CONFIG } from '../../../shared/data/app-config.token';
import { ErrorMessages, HTTP_ERROR_MAP } from '../../../shared/data/error-messages';
import { IDailyRentalReport } from '../data/daily-report.interface';

@Injectable({ providedIn: 'root' })
export class DailyRentalReportService {
  private readonly apiUrl = `${inject(APP_CONFIG).apiBaseUrl}/api/v1/rental/reports`;

  constructor(private readonly http: HttpClient) {}

  /**
   * Relatório de locação por período (YYYY-MM-DD). Se endDate omitido, relatório de dia único.
   * `sectorId` restringe aos contratos abertos naquele setor (locais de retirada).
   */
  getByPeriod(startDate: string, endDate?: string, sectorId?: string | null): Observable<IDailyRentalReport> {
    let params = new HttpParams().set('date', startDate);
    if (endDate && endDate !== startDate) {
      params = params.set('endDate', endDate);
    }
    if (sectorId) {
      params = params.set('sectorId', sectorId);
    }
    return this.http
      .get<IDailyRentalReport>(`${this.apiUrl}/daily`, { params })
      .pipe(catchError(this.handleError.bind(this)));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('DailyRentalReportService error:', error);
    const msg =
      HTTP_ERROR_MAP[error.status] ?? error.error?.message ?? ErrorMessages.UNKNOWN_ERROR;
    return throwError(() => new Error(msg));
  }
}
