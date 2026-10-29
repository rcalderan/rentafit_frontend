import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { APP_CONFIG } from '../../../shared/data/app-config.token';
import { apiErrorMessage } from '../../../shared/utils/api-error';
import { IActiveAttendant, IEmployee, IEmployeeCheckResponse } from '../data/employee.interface';

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly apiUrl = `${inject(APP_CONFIG).apiBaseUrl}/api/v1/employees`;

  constructor(private readonly http: HttpClient) {}

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('EmployeeService error:', error);
    if (error.status === 422) {
      return throwError(() => new Error('Credenciais inválidas. Verifique as iniciais e o PIN.'));
    }
    return throwError(() => new Error(apiErrorMessage(error)));
  }

  getById(id: string): Observable<IEmployee> {
    return this.http.get<IEmployee>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError.bind(this)),
    );
  }

  listActiveAttendants(): Observable<IActiveAttendant[]> {
    return this.http.get<IActiveAttendant[]>(`${this.apiUrl}/attendants`).pipe(
      catchError(this.handleError.bind(this)),
    );
  }

  /** Returns the Employee for the given Person/User id, or null when 404 (no Employee row yet). */
  findByIdOrNull(id: string): Observable<IEmployee | null> {
    return this.http.get<IEmployee>(`${this.apiUrl}/${id}`).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return of(null);
        }
        return this.handleError(error);
      }),
    );
  }

  getByInitials(initials: string): Observable<IEmployee> {
    return this.http.get<IEmployee>(`${this.apiUrl}/initials/${encodeURIComponent(initials)}`).pipe(
      catchError(this.handleError.bind(this)),
    );
  }

  /** POST /check with initials + pin — returns employee data or 422 if credentials invalid. */
  checkInitials(initials: string, pin: string): Observable<IEmployeeCheckResponse> {
    return this.http.post<IEmployeeCheckResponse>(`${this.apiUrl}/check`, { initials, pin }).pipe(
      catchError(this.handleError.bind(this)),
    );
  }
}
