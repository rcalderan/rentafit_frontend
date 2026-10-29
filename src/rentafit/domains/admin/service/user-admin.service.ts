import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { APP_CONFIG } from '../../../shared/data/app-config.token';
import { IUserSummary, IUpdateRoleRequest, IPagedResponse } from '../data/user-admin.model';
import { apiErrorMessage } from '../../../shared/utils/api-error';

@Injectable({ providedIn: 'root' })
export class UserAdminService {
  private readonly config = inject(APP_CONFIG);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${this.config.apiBaseUrl}/api/auth/users`;

  listUsers(page = 0, size = 20): Observable<IPagedResponse<IUserSummary>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<IPagedResponse<IUserSummary>>(this.baseUrl, { params }).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  updateRole(userId: string, req: IUpdateRoleRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${userId}/role`, req).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => new Error(apiErrorMessage(error)));
  }
}
