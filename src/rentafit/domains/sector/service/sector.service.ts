import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { APP_CONFIG } from '../../../shared/data/app-config.token';
import { ErrorMessages, HTTP_ERROR_MAP } from '../../../shared/data/error-messages';
import { CreateSectorRequest, Sector, UpdateSectorRequest } from '../data/sector.model';

/**
 * CRUD de setores de atendimento/retirada (`/api/v1/sectors`).
 * Leitura liberada a todos os perfis operacionais; escrita exige MANAGER/ADMIN no backend.
 */
@Injectable({ providedIn: 'root' })
export class SectorService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(APP_CONFIG).apiBaseUrl}/api/v1/sectors`;

  /** Lista setores; `activeOnly=true` omite setores desativados. */
  list(activeOnly = false): Observable<Sector[]> {
    const params = new HttpParams().set('activeOnly', String(activeOnly));
    return this.http
      .get<Sector[]>(this.baseUrl, { params })
      .pipe(catchError(this.handleError.bind(this)));
  }

  create(request: CreateSectorRequest): Observable<Sector> {
    return this.http
      .post<Sector>(this.baseUrl, request)
      .pipe(catchError(this.handleError.bind(this)));
  }

  update(id: string, request: UpdateSectorRequest): Observable<Sector> {
    return this.http
      .put<Sector>(`${this.baseUrl}/${id}`, request)
      .pipe(catchError(this.handleError.bind(this)));
  }

  /** Marca o setor como padrão do estabelecimento (desmarca o padrão anterior). */
  setDefault(id: string): Observable<Sector> {
    return this.http
      .patch<Sector>(`${this.baseUrl}/${id}/default`, {})
      .pipe(catchError(this.handleError.bind(this)));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('SectorService error:', error);
    const msg =
      HTTP_ERROR_MAP[error.status] ?? error.error?.message ?? ErrorMessages.UNKNOWN_ERROR;
    return throwError(() => new Error(msg));
  }
}
