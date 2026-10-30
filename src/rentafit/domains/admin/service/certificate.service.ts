import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { APP_CONFIG } from '../../../shared/data/app-config.token';
import { apiErrorMessage } from '../../../shared/utils/api-error';
import { ICertificateDetails } from '../data/certificate.model';

@Injectable({ providedIn: 'root' })
export class CertificateService {
  private readonly config = inject(APP_CONFIG);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${this.config.apiBaseUrl}/nfe-api/certificates`;

  status(): Observable<ICertificateDetails> {
    return this.http.get<ICertificateDetails>(`${this.baseUrl}/status`).pipe(
      catchError((error: HttpErrorResponse) => this.handleError(error)),
    );
  }

  upload(file: File, password: string): Observable<ICertificateDetails> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);
    return this.http.post<ICertificateDetails>(`${this.baseUrl}/upload`, formData).pipe(
      catchError((error: HttpErrorResponse) => this.handleError(error)),
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => new Error(apiErrorMessage(error, 'Erro ao processar o certificado digital.')));
  }
}
