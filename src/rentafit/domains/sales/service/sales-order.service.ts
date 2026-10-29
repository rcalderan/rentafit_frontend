import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { APP_CONFIG } from '../../../shared/data/app-config.token';
import { apiErrorMessage } from '../../../shared/utils/api-error';
import { ISalesOrder, ISalesOrderSummary, ISalesPayment } from '../data/sales-order.interface';
import {
  ICancelSalesOrderRequest,
  ISalesOrderCreateRequest,
  ISalesOrderUpdateRequest,
  ISalesPaymentRequest,
} from '../data/sales-order-request.interface';
import { IPageResponse } from '../../rental/data/rental-contract-response.interface';
import { SalesOrderStatusApi } from '../data/sales-api.types';

export interface SalesListParams {
  page?: number;
  size?: number;
  sort?: string;
  status?: SalesOrderStatusApi;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable({ providedIn: 'root' })
export class SalesOrderService {
  private readonly apiUrl = `${inject(APP_CONFIG).apiBaseUrl}/api/v1/sales/orders`;

  constructor(private readonly http: HttpClient) {}

  // ─── Error handling ──────────────────────────────────────────────────────────

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('SalesOrderService error:', error);
    return throwError(() => new Error(apiErrorMessage(error)));
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  list(params?: SalesListParams): Observable<IPageResponse<ISalesOrderSummary>> {
    let httpParams = new HttpParams();
    if (params?.page != null) httpParams = httpParams.set('page', params.page);
    if (params?.size != null) httpParams = httpParams.set('size', params.size);
    if (params?.sort) httpParams = httpParams.set('sort', params.sort);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.dateFrom) httpParams = httpParams.set('dateFrom', params.dateFrom);
    if (params?.dateTo) httpParams = httpParams.set('dateTo', params.dateTo);

    return this.http
      .get<IPageResponse<ISalesOrderSummary>>(this.apiUrl, { params: httpParams })
      .pipe(catchError(this.handleError.bind(this)));
  }

  getById(id: string): Observable<ISalesOrder> {
    return this.http
      .get<ISalesOrder>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError.bind(this)));
  }

  getByLegacyId(legacyId: string): Observable<ISalesOrder> {
    return this.http
      .get<ISalesOrder>(`${this.apiUrl}/legacyId/${legacyId}`)
      .pipe(catchError(this.handleError.bind(this)));
  }

  getByCustomer(customerId: string): Observable<ISalesOrderSummary[]> {
    return this.http
      .get<ISalesOrderSummary[]>(`${this.apiUrl}/byCustomer/${customerId}`)
      .pipe(catchError(this.handleError.bind(this)));
  }

  create(request: ISalesOrderCreateRequest): Observable<ISalesOrder> {
    return this.http
      .post<ISalesOrder>(this.apiUrl, request)
      .pipe(catchError(this.handleError.bind(this)));
  }

  update(id: string, request: ISalesOrderUpdateRequest): Observable<ISalesOrder> {
    return this.http
      .put<ISalesOrder>(`${this.apiUrl}/${id}`, request)
      .pipe(catchError(this.handleError.bind(this)));
  }

  // ─── Workflow ────────────────────────────────────────────────────────────────

  confirm(id: string): Observable<ISalesOrder> {
    return this.http
      .patch<ISalesOrder>(`${this.apiUrl}/${id}/confirm`, {})
      .pipe(catchError(this.handleError.bind(this)));
  }

  cancel(id: string, request: ICancelSalesOrderRequest): Observable<ISalesOrder> {
    return this.http
      .patch<ISalesOrder>(`${this.apiUrl}/${id}/cancel`, request)
      .pipe(catchError(this.handleError.bind(this)));
  }

  markItemReady(orderId: string, itemId: string): Observable<ISalesOrder> {
    return this.http
      .patch<ISalesOrder>(`${this.apiUrl}/${orderId}/items/${itemId}/ready`, {})
      .pipe(catchError(this.handleError.bind(this)));
  }

  deliverItem(orderId: string, itemId: string, employeeId?: string): Observable<ISalesOrder> {
    let httpParams = new HttpParams();
    if (employeeId) httpParams = httpParams.set('employeeId', employeeId);

    return this.http
      .patch<ISalesOrder>(`${this.apiUrl}/${orderId}/items/${itemId}/deliver`, {}, { params: httpParams })
      .pipe(catchError(this.handleError.bind(this)));
  }

  // ─── NFS-e ───────────────────────────────────────────────────────────────────

  emitInvoice(id: string): Observable<ISalesOrder> {
    return this.http
      .post<ISalesOrder>(`${this.apiUrl}/${id}/emit-invoice`, {})
      .pipe(catchError(this.handleError.bind(this)));
  }

  // ─── Payments ────────────────────────────────────────────────────────────────

  listPayments(orderId: string): Observable<ISalesPayment[]> {
    return this.http
      .get<ISalesPayment[]>(`${this.apiUrl}/${orderId}/payments`)
      .pipe(catchError(this.handleError.bind(this)));
  }

  addPayment(orderId: string, request: ISalesPaymentRequest): Observable<ISalesOrder> {
    return this.http
      .post<ISalesOrder>(`${this.apiUrl}/${orderId}/payments`, request)
      .pipe(catchError(this.handleError.bind(this)));
  }

  updatePayment(orderId: string, paymentId: string, request: ISalesPaymentRequest): Observable<ISalesOrder> {
    return this.http
      .put<ISalesOrder>(`${this.apiUrl}/${orderId}/payments/${paymentId}`, request)
      .pipe(catchError(this.handleError.bind(this)));
  }

  cancelPayment(orderId: string, paymentId: string): Observable<ISalesOrder> {
    return this.http
      .delete<ISalesOrder>(`${this.apiUrl}/${orderId}/payments/${paymentId}`)
      .pipe(catchError(this.handleError.bind(this)));
  }
}
