import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { APP_CONFIG } from '../../../../../shared/data/app-config.token';
import { ErrorMessages, HTTP_ERROR_MAP } from '../../../../../shared/data/error-messages';
import { ReturnApiPort } from '../data/return-api.port';
import {
  CloseReturnRequestModel,
  MarkReturnRequestModel,
  PaymentPreviewModel,
  ReturnAccessoryModel,
  ReturnItemModel,
  ReturnSummaryModel,
  WithdrawRequestModel,
} from '../data/return.model';

/** Resposta bruta do backend — campos UUID chegam como string no JSON. */
interface BackendReturnSummary {
  contractId: string;
  legacyId: string;
  customerName: string;
  customerId?: string;
  contractStatus: string;
  pickupDate?: string;
  eventDate?: string;
  returnDate: string;
  actualReturnDate?: string;
  totalValue: number;
  pendingCount: number;
  isFullyReturned: boolean;
  delayDays: number;
  suggestedFine: number;
  items: BackendReturnItem[];
  paymentsPreview: BackendPaymentPreview[];
}

interface BackendReturnItem {
  itemId: string;
  description: string;
  isReturned: boolean;
  returnedAt?: string;
  returnedBy?: string;
  accessories: BackendReturnAccessory[];
}

interface BackendReturnAccessory {
  accessoryId: string;
  description: string;
  isReturned: boolean;
  returnedAt?: string;
}

interface BackendPaymentPreview {
  paymentId: string;
  installmentNumber: number;
  value: number;
  status: string;
}

@Injectable()
export class ReturnApiHttpService implements ReturnApiPort {
  private readonly config = inject(APP_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/api/v1/rental/contracts`;
  private readonly http = inject(HttpClient);

  getReturnSummary(contractId: string): Observable<ReturnSummaryModel> {
    return this.http
      .get<BackendReturnSummary>(`${this.baseUrl}/${contractId}/return-summary`)
      .pipe(
        map(this.mapSummary),
        catchError(this.handleError)
      );
  }

  markItemsReturned(
    contractId: string,
    request: MarkReturnRequestModel
  ): Observable<ReturnSummaryModel> {
    const body = {
      returnerName: request.returnerName,
      entries: request.entries.map(e => ({
        itemId: e.itemId,
        accessoryId: e.accessoryId ?? null,
        returnedAt: e.returnedAt,
      })),
    };

    return this.http
      .post<BackendReturnSummary>(`${this.baseUrl}/${contractId}/return-mark`, body)
      .pipe(
        map(this.mapSummary),
        catchError(this.handleError)
      );
  }

  closeReturn(
    contractId: string,
    request: CloseReturnRequestModel
  ): Observable<ReturnSummaryModel> {
    const body = {
      employeeId: request.employeeId,
      applyFine: request.applyFine,
      fineAmount: request.applyFine ? (request.fineAmount ?? null) : null,
    };

    return this.http
      .post<BackendReturnSummary>(`${this.baseUrl}/${contractId}/return-close`, body)
      .pipe(
        map(this.mapSummary),
        catchError(this.handleError)
      );
  }

  withdraw(contractId: string, request: WithdrawRequestModel): Observable<void> {
    const body = {
      employeeId: request.employeeId,
      refundAmount: request.refundAmount ?? null,
      applyFine: request.applyFine,
      fineAmount: request.applyFine ? (request.fineAmount ?? null) : null,
    };

    return this.http
      .post<unknown>(`${this.baseUrl}/${contractId}/withdraw`, body)
      .pipe(
        map(() => undefined),
        catchError(this.handleError)
      );
  }

  private mapSummary(raw: BackendReturnSummary): ReturnSummaryModel {
    const items: ReturnItemModel[] = raw.items.map(i => ({
      itemId: i.itemId,
      description: i.description,
      isReturned: i.isReturned,
      returnedAt: i.returnedAt,
      returnedBy: i.returnedBy,
      accessories: i.accessories.map((a): ReturnAccessoryModel => ({
        accessoryId: a.accessoryId,
        description: a.description,
        type: 'ACESSORIO',
        isReturned: a.isReturned,
        returnedAt: a.returnedAt,
      })),
    }));

    const paymentsPreview: PaymentPreviewModel[] = raw.paymentsPreview.map(p => ({
      paymentId: p.paymentId,
      installmentNumber: p.installmentNumber,
      value: p.value,
      status: p.status as PaymentPreviewModel['status'],
    }));

    return {
      contractId: raw.contractId,
      legacyId: raw.legacyId,
      customerName: raw.customerName,
      customerId: raw.customerId,
      contractStatus: raw.contractStatus,
      pickupDate: raw.pickupDate,
      eventDate: raw.eventDate,
      returnDate: raw.returnDate,
      actualReturnDate: raw.actualReturnDate,
      totalValue: raw.totalValue ?? 0,
      pendingCount: raw.pendingCount,
      isFullyReturned: raw.isFullyReturned,
      delayDays: raw.delayDays,
      suggestedFine: raw.suggestedFine,
      items,
      paymentsPreview,
    };
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const msg =
      HTTP_ERROR_MAP[error.status] ?? error.error?.message ?? ErrorMessages.UNKNOWN_ERROR;
    return throwError(() => new Error(msg));
  }
}
