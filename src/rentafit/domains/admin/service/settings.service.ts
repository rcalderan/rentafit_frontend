import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { APP_CONFIG } from '../../../shared/data/app-config.token';
import { ErrorMessages, HTTP_ERROR_MAP } from '../../../shared/data/error-messages';

export interface ISettingEntry {
  key: string;
  value: string;
}

/**
 * Reads/writes global application settings (`/api/v1/settings/{key}`).
 * Reads degrade to null when the endpoint or key does not exist yet, so
 * callers keep working with local defaults until the backend ships.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly apiUrl = `${inject(APP_CONFIG).apiBaseUrl}/api/v1/settings`;

  constructor(private readonly http: HttpClient) {}

  get(key: string): Observable<string | null> {
    return this.http.get<ISettingEntry>(`${this.apiUrl}/${encodeURIComponent(key)}`).pipe(
      map(entry => entry?.value ?? null),
      catchError(() => of(null)),
    );
  }

  getNumber(key: string, fallback: number): Observable<number> {
    return this.get(key).pipe(
      map(value => {
        if (value === null || value.trim() === '') return fallback;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      }),
    );
  }

  put(key: string, value: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${encodeURIComponent(key)}`, { value }).pipe(
      catchError(this.handleError.bind(this)),
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('SettingsService error:', error);
    const msg = HTTP_ERROR_MAP[error.status] ?? error.error?.message ?? ErrorMessages.UNKNOWN_ERROR;
    return throwError(() => new Error(msg));
  }
}
