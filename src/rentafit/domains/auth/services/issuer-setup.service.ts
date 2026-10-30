import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { APP_CONFIG } from '../../../shared/data/app-config.token';
import { apiErrorMessage } from '../../../shared/utils/api-error';
import { IssuerBranchSetupRequest, IssuerInfo, IssuerSetupRequest } from '../data/issuer.model';

@Injectable({
  providedIn: 'root'
})
export class IssuerSetupService {
  private readonly config = inject(APP_CONFIG);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${this.config.apiBaseUrl}/nfe-api/issuer`;

  getCurrentIssuer(): Observable<IssuerInfo | null> {
    return this.http.get<IssuerInfo>(this.baseUrl).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return of(null);
        }
        return this.handleError(error);
      })
    );
  }

  listBranches(): Observable<IssuerInfo[]> {
    return this.http.get<IssuerInfo[]>(`${this.baseUrl}/branches`).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return of([]);
        }
        return this.handleError(error);
      })
    );
  }

  configureIssuer(request: IssuerSetupRequest): Observable<IssuerInfo> {
    return this.http.post<IssuerInfo>(`${this.baseUrl}/setup`, request).pipe(
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  configureBranch(request: IssuerBranchSetupRequest): Observable<IssuerInfo> {
    return this.http.post<IssuerInfo>(`${this.baseUrl}/branch`, request).pipe(
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => new Error(apiErrorMessage(error, 'Erro ao comunicar com o serviço de emitente')));
  }
}
