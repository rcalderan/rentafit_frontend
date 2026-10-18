import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APP_CONFIG } from '../../../shared/data/app-config.token';
import {
  IMonthlyMovementResponse,
  IYearlyMovementResponse,
} from '../data/financial-movement.model';
import { FinancialMovementService } from './financial-movement.service';

describe('FinancialMovementService', () => {
  let service: FinancialMovementService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: 'http://localhost:8080' } },
        FinancialMovementService,
      ],
    });
    service = TestBed.inject(FinancialMovementService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('deve consultar movimentação mensal com parâmetros year, month e source', () => {
    let result: IMonthlyMovementResponse | undefined;
    service.getMonthlyMovement(2026, 10, 'RENTAL').subscribe((res) => (result = res));

    const req = httpMock.expectOne(
      (r) =>
        r.url === 'http://localhost:8080/api/v1/finance/movements/monthly' &&
        r.params.get('year') === '2026' &&
        r.params.get('month') === '10' &&
        r.params.get('source') === 'RENTAL',
    );
    expect(req.request.method).toBe('GET');

    const mockPayload: IMonthlyMovementResponse = {
      year: 2026,
      month: 10,
      paidTotal: 1000,
      fineTotal: 50,
      refundedTotal: 120,
      netRealizedTotal: 930,
      pendingTotal: 400,
      rentalNetTotal: 930,
      saleNetTotal: 0,
      rentalPendingTotal: 400,
      salePendingTotal: 0,
      byPaymentMethod: [],
      days: [],
      transactions: [],
    };
    req.flush(mockPayload);

    expect(result).toEqual(mockPayload);
  });

  it('deve consultar movimentação anual com parâmetros year e source', () => {
    let result: IYearlyMovementResponse | undefined;
    service.getYearlyMovement(2026, 'ALL').subscribe((res) => (result = res));

    const req = httpMock.expectOne(
      (r) =>
        r.url === 'http://localhost:8080/api/v1/finance/movements/yearly' &&
        r.params.get('year') === '2026' &&
        r.params.get('source') === 'ALL',
    );
    expect(req.request.method).toBe('GET');

    const mockYearly: IYearlyMovementResponse = {
      year: 2026,
      availableYears: [2026, 2025],
      paidTotal: 12000,
      fineTotal: 100,
      refundedTotal: 300,
      netRealizedTotal: 11800,
      pendingTotal: 2500,
      rentalNetTotal: 9800,
      saleNetTotal: 2000,
      rentalPendingTotal: 2000,
      salePendingTotal: 500,
      byPaymentMethod: [],
      months: [],
    };
    req.flush(mockYearly);

    expect(result).toEqual(mockYearly);
  });
});
