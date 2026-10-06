import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { APP_CONFIG } from '../../../shared/data/app-config.token';
import { ErrorMessages, HTTP_ERROR_MAP } from '../../../shared/data/error-messages';
import {
  IProcessReturnRequest,
  IRentalContractCreateRequest,
  IRentalContractSignRequest,
  IRentalContractUpdateRequest,
  IRentalPaymentRequest,
} from '../data/rental-contract-request.interface';
import {
  IItemReservationResponse,
  IPageResponse,
  IRentalContractResponse,
  IRentalContractSummaryResponse,
  IRentalPaymentResponse,
} from '../data/rental-contract-response.interface';

export interface ContractListParams {
  page?: number;
  size?: number;
  sort?: string;
}

@Injectable({ providedIn: 'root' })
export class RentalContractService {
  private readonly apiUrl = `${inject(APP_CONFIG).apiBaseUrl}/api/v1/rental/contracts`;

  constructor(private readonly http: HttpClient) {}

  // ─── Error handling ──────────────────────────────────────────────────────────

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('RentalContractService error:', error);
    const msg =
      (error.status === 422 ? error.error?.message : null) ??
      HTTP_ERROR_MAP[error.status] ??
      error.error?.message ??
      ErrorMessages.UNKNOWN_ERROR;
    return throwError(() => new Error(msg));
  }

  // ─── Contract CRUD ───────────────────────────────────────────────────────────

  list(params?: ContractListParams): Observable<IPageResponse<IRentalContractSummaryResponse>> {
    let httpParams = new HttpParams();
    if (params?.page != null) httpParams = httpParams.set('page', params.page);
    if (params?.size != null) httpParams = httpParams.set('size', params.size);
    if (params?.sort) httpParams = httpParams.set('sort', params.sort);

    return this.http
      .get<IPageResponse<IRentalContractSummaryResponse>>(this.apiUrl, { params: httpParams })
      .pipe(catchError(this.handleError.bind(this)));
  }

  getById(id: string): Observable<IRentalContractResponse> {
    return this.http
      .get<IRentalContractResponse>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError.bind(this)));
  }

  getByLegacyId(legacyId: string): Observable<IRentalContractResponse> {
    return this.http
      .get<IRentalContractResponse>(`${this.apiUrl}/legacyId/${legacyId}`)
      .pipe(catchError(this.handleError.bind(this)));
  }

  // getByLegacyId(legacyId: string): Observable<IRentalContractResponse> {
  //   return this.list({ page: 0, size: 500, sort: 'createdAt,desc' }).pipe(
  //     map((page) => {
  //       const contract = page.content.find((c) => c.legacyId === legacyId);
  //       if (!contract) {
  //         throw new Error(`Contrato codigo ${legacyId} não encontrado.`);
  //       }
  //       return contract;
  //     }),
  //   );
  // }

  getByCustomer(
    customerId: string,
    params?: ContractListParams,
  ): Observable<IPageResponse<IRentalContractResponse>> {
    let httpParams = new HttpParams();
    if (params?.page != null) httpParams = httpParams.set('page', params.page);
    if (params?.size != null) httpParams = httpParams.set('size', params.size);

    return this.http
      .get<
        IPageResponse<IRentalContractResponse>
      >(`${this.apiUrl}/byCustomer/${customerId}`, { params: httpParams })
      .pipe(catchError(this.handleError.bind(this)));
  }

  /**
   * Reservas ativas do item (SIGNED/FINALIZED, eventDate >= hoje).
   * Chamado ao carregar um item na proposta para alertar reservas existentes.
   */
  getItemReservations(
    rentalItemId: string,
    excludeContractId?: string,
  ): Observable<IItemReservationResponse[]> {
    let httpParams = new HttpParams();
    if (excludeContractId) {
      httpParams = httpParams.set('excludeContractId', excludeContractId);
    }

    return this.http
      .get<IItemReservationResponse[]>(`${this.apiUrl}/byItem/${rentalItemId}`, {
        params: httpParams,
      })
      .pipe(catchError(this.handleError.bind(this)));
  }

  create(request: IRentalContractCreateRequest): Observable<IRentalContractResponse> {
    return this.http
      .post<IRentalContractResponse>(this.apiUrl, request)
      .pipe(catchError(this.handleError.bind(this)));
  }

  update(id: string, request: IRentalContractUpdateRequest): Observable<IRentalContractResponse> {
    return this.http
      .put<IRentalContractResponse>(`${this.apiUrl}/${id}`, request)
      .pipe(catchError(this.handleError.bind(this)));
  }

  // ─── State transitions ───────────────────────────────────────────────────────

  /**
   * DRAFT → SIGNED.
   * Response may include `warnings[]` for soft conflicts (±3 days).
   * Hard conflicts result in 422 (mapped to error by handleError).
   */
  sign(id: string, request: IRentalContractSignRequest): Observable<IRentalContractResponse> {
    return this.http
      .patch<IRentalContractResponse>(`${this.apiUrl}/${id}/sign`, request)
      .pipe(catchError(this.handleError.bind(this)));
  }

  /**
   * SIGNED → FINALIZED.
   * Response may include `warnings[]`. Hard conflicts result in 422.
   */
  finalize(id: string): Observable<IRentalContractResponse> {
    return this.http
      .patch<IRentalContractResponse>(`${this.apiUrl}/${id}/finalize`, {})
      .pipe(catchError(this.handleError.bind(this)));
  }

  /** Register physical return of all items. */
  processReturn(id: string, request: IProcessReturnRequest): Observable<IRentalContractResponse> {
    return this.http
      .patch<IRentalContractResponse>(`${this.apiUrl}/${id}/return`, request)
      .pipe(catchError(this.handleError.bind(this)));
  }

  /** Mark a single item as delivered (RESERVED → RENTED). */
  deliverItem(contractId: string, itemId: string): Observable<IRentalContractResponse> {
    return this.http
      .patch<IRentalContractResponse>(`${this.apiUrl}/${contractId}/items/${itemId}/deliver`, {})
      .pipe(catchError(this.handleError.bind(this)));
  }

  /** Creates a new DRAFT copying this contract's data. */
  duplicate(id: string): Observable<IRentalContractResponse> {
    return this.http
      .post<IRentalContractResponse>(`${this.apiUrl}/${id}/duplicate`, {})
      .pipe(catchError(this.handleError.bind(this)));
  }

  /** Creates a REVISION contract from a SIGNED/FINALIZED contract. */
  revise(id: string): Observable<IRentalContractResponse> {
    return this.http
      .post<IRentalContractResponse>(`${this.apiUrl}/${id}/revise`, {})
      .pipe(catchError(this.handleError.bind(this)));
  }

  restartRevision(id: string): Observable<IRentalContractResponse> {
    return this.http
      .post<IRentalContractResponse>(`${this.apiUrl}/${id}/revision-restart`, {})
      .pipe(catchError(this.handleError.bind(this)));
  }

  // ─── Payments ────────────────────────────────────────────────────────────────

  listPayments(contractId: string): Observable<IRentalPaymentResponse[]> {
    return this.http
      .get<IRentalPaymentResponse[]>(`${this.apiUrl}/${contractId}/payments`)
      .pipe(catchError(this.handleError.bind(this)));
  }

  addPayment(
    contractId: string,
    request: IRentalPaymentRequest,
  ): Observable<IRentalPaymentResponse> {
    return this.http
      .post<IRentalPaymentResponse>(`${this.apiUrl}/${contractId}/payments`, request)
      .pipe(catchError(this.handleError.bind(this)));
  }

  updatePayment(
    contractId: string,
    paymentId: string,
    request: IRentalPaymentRequest,
  ): Observable<IRentalPaymentResponse> {
    return this.http
      .put<IRentalPaymentResponse>(`${this.apiUrl}/${contractId}/payments/${paymentId}`, request)
      .pipe(catchError(this.handleError.bind(this)));
  }

  /** Cancels a payment (204 No Content — returns void). */
  cancelPayment(contractId: string, paymentId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${contractId}/payments/${paymentId}`)
      .pipe(catchError(this.handleError.bind(this)));
  }
}
