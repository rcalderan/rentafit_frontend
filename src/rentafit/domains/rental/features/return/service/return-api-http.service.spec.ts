import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { lastValueFrom } from 'rxjs';
import { ReturnApiHttpService } from './return-api-http.service';
import { APP_CONFIG } from '../../../../../shared/data/app-config.token';
import { CloseReturnRequestModel, MarkReturnRequestModel } from '../data/return.model';

const BASE = '/api/v1/rental/contracts';
const CONTRACT_ID = 'contract-uuid-1';

const backendSummary = {
  contractId: CONTRACT_ID,
  legacyId: '20260502-1',
  customerName: 'Maria Silva',
  customerId: 'customer-uuid-1',
  contractStatus: 'FINALIZED',
  pickupDate: '2026-04-28',
  eventDate: '2026-04-30',
  returnDate: '2026-05-01',
  totalValue: 1000,
  pendingCount: 1,
  isFullyReturned: false,
  delayDays: 1,
  suggestedFine: 50,
  items: [
    {
      itemId: 'item-1',
      description: 'Vestido',
      isReturned: false,
      accessories: [
        { accessoryId: 'acc-1', description: 'Véu', isReturned: false },
      ],
    },
  ],
  paymentsPreview: [
    { paymentId: 'pay-1', installmentNumber: 1, value: 800, status: 'PAID' },
    { paymentId: 'pay-2', installmentNumber: 2, value: 200, status: 'PENDING' },
  ],
};

describe('ReturnApiHttpService', () => {
  let service: ReturnApiHttpService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ReturnApiHttpService,
        { provide: APP_CONFIG, useValue: { apiBaseUrl: '', s3BucketUrl: '' } },
      ],
    });

    service = TestBed.inject(ReturnApiHttpService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ── getReturnSummary ────────────────────────────────────────────────────────

  describe('getReturnSummary', () => {
    it('faz GET no endpoint correto e mapeia resposta', () => {
      let captured: any;
      service.getReturnSummary(CONTRACT_ID).subscribe(r => { captured = r; });

      const req = httpMock.expectOne(`${BASE}/${CONTRACT_ID}/return-summary`);
      expect(req.request.method).toBe('GET');
      req.flush(backendSummary);

      expect(captured!.contractId).toBe(CONTRACT_ID);
      expect(captured!.customerName).toBe('Maria Silva');
      expect(captured!.items.length).toBe(1);
      expect(captured!.items[0].accessories[0].type).toBe('ACESSORIO');
      expect(captured!.paymentsPreview[1].status).toBe('PENDING');
    });

    it('mapeia returnedBy e returnedAt dos itens', () => {
      const withReturned = {
        ...backendSummary,
        items: [{
          itemId: 'item-1',
          description: 'Vestido',
          isReturned: true,
          returnedAt: '2026-05-02T10:00:00Z',
          returnedBy: 'João',
          accessories: [],
        }],
      };

      let returnedBy: string | undefined;
      let returnedAt: string | undefined;
      service.getReturnSummary(CONTRACT_ID).subscribe(r => {
        returnedBy = r.items[0].returnedBy;
        returnedAt = r.items[0].returnedAt;
      });

      httpMock.expectOne(`${BASE}/${CONTRACT_ID}/return-summary`).flush(withReturned);

      expect(returnedBy).toBe('João');
      expect(returnedAt).toBe('2026-05-02T10:00:00Z');
    });

    it('propaga erro 404 com mensagem amigável', async () => {
      const promise = lastValueFrom(service.getReturnSummary('bad-id'));

      httpMock
        .expectOne(`${BASE}/bad-id/return-summary`)
        .flush({}, { status: 404, statusText: 'Not Found' });

      await expect(promise).rejects.toThrow();
    });

    it('usa mensagem do backend quando status não mapeado', async () => {
      const promise = lastValueFrom(service.getReturnSummary(CONTRACT_ID));

      httpMock
        .expectOne(`${BASE}/${CONTRACT_ID}/return-summary`)
        .flush({ message: 'Contrato não elegível' }, { status: 422, statusText: 'Unprocessable' });

      await expect(promise).rejects.toThrow('Contrato não elegível');
    });
  });

  // ── markItemsReturned ───────────────────────────────────────────────────────

  describe('markItemsReturned', () => {
    const request: MarkReturnRequestModel = {
      returnerName: 'João',
      employeeId: 'emp-uuid',
      entries: [
        { itemId: 'item-1', returnedAt: '2026-05-02T10:00:00Z' },
        { itemId: 'item-1', accessoryId: 'acc-1', returnedAt: '2026-05-02T10:00:00Z' },
      ],
    };

    it('faz POST no endpoint correto com body correto', () => {
      let contractId: string | undefined;
      service.markItemsReturned(CONTRACT_ID, request).subscribe(r => { contractId = r.contractId; });

      const req = httpMock.expectOne(`${BASE}/${CONTRACT_ID}/return-mark`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.returnerName).toBe('João');
      expect(req.request.body.entries.length).toBe(2);
      expect(req.request.body.entries[0].accessoryId).toBeNull();
      expect(req.request.body.entries[1].accessoryId).toBe('acc-1');
      req.flush(backendSummary);

      expect(contractId).toBe(CONTRACT_ID);
    });

    it('envia accessoryId como null quando não fornecido', () => {
      const reqWithoutAccessory: MarkReturnRequestModel = {
        returnerName: 'Ana',
        employeeId: 'emp-1',
        entries: [{ itemId: 'item-1', returnedAt: '2026-05-02T10:00:00Z' }],
      };

      service.markItemsReturned(CONTRACT_ID, reqWithoutAccessory).subscribe();

      const req = httpMock.expectOne(`${BASE}/${CONTRACT_ID}/return-mark`);
      expect(req.request.body.entries[0].accessoryId).toBeNull();
      req.flush(backendSummary);
    });

    it('propaga erro 400 quando itemId inválido', async () => {
      const promise = lastValueFrom(service.markItemsReturned(CONTRACT_ID, request));

      httpMock
        .expectOne(`${BASE}/${CONTRACT_ID}/return-mark`)
        .flush({ message: 'Item não encontrado' }, { status: 400, statusText: 'Bad Request' });

      await expect(promise).rejects.toThrow();
    });
  });

  // ── closeReturn ─────────────────────────────────────────────────────────────

  describe('closeReturn', () => {
    const closeRequest: CloseReturnRequestModel = {
      employeeId: 'emp-uuid',
      applyFine: false,
    };

    it('faz POST no endpoint correto', () => {
      let contractId: string | undefined;
      service.closeReturn(CONTRACT_ID, closeRequest).subscribe(r => { contractId = r.contractId; });

      const req = httpMock.expectOne(`${BASE}/${CONTRACT_ID}/return-close`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.employeeId).toBe('emp-uuid');
      expect(req.request.body.applyFine).toBe(false);
      expect(req.request.body.fineAmount).toBeNull();
      req.flush(backendSummary);

      expect(contractId).toBe(CONTRACT_ID);
    });

    it('envia fineAmount quando applyFine=true', () => {
      const withFine: CloseReturnRequestModel = {
        employeeId: 'emp-uuid',
        applyFine: true,
        fineAmount: 75,
      };

      service.closeReturn(CONTRACT_ID, withFine).subscribe();

      const req = httpMock.expectOne(`${BASE}/${CONTRACT_ID}/return-close`);
      expect(req.request.body.applyFine).toBe(true);
      expect(req.request.body.fineAmount).toBe(75);
      req.flush(backendSummary);
    });

    it('envia fineAmount=null quando applyFine=false mesmo com fineAmount preenchido', () => {
      const withFineIgnored: CloseReturnRequestModel = {
        employeeId: 'emp-uuid',
        applyFine: false,
        fineAmount: 100,
      };

      service.closeReturn(CONTRACT_ID, withFineIgnored).subscribe();

      const req = httpMock.expectOne(`${BASE}/${CONTRACT_ID}/return-close`);
      expect(req.request.body.fineAmount).toBeNull();
      req.flush(backendSummary);
    });

    it('propaga erro 422 com mensagem do backend', async () => {
      const promise = lastValueFrom(service.closeReturn(CONTRACT_ID, closeRequest));

      httpMock
        .expectOne(`${BASE}/${CONTRACT_ID}/return-close`)
        .flush({ message: 'Itens pendentes de devolução' }, { status: 422, statusText: 'Unprocessable' });

      await expect(promise).rejects.toThrow('Itens pendentes de devolução');
    });
  });

  // ── withdraw (desistência) ──────────────────────────────────────────────────

  describe('withdraw', () => {
    it('faz POST no endpoint /withdraw com refundAmount e multa', () => {
      service
        .withdraw(CONTRACT_ID, {
          employeeId: 'emp-1',
          refundAmount: 120.5,
          applyFine: true,
          fineAmount: 300,
        })
        .subscribe();

      const req = httpMock.expectOne(`${BASE}/${CONTRACT_ID}/withdraw`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        employeeId: 'emp-1',
        refundAmount: 120.5,
        applyFine: true,
        fineAmount: 300,
      });
      req.flush({});
    });

    it('envia fineAmount=null quando applyFine=false', () => {
      service
        .withdraw(CONTRACT_ID, {
          employeeId: 'emp-1',
          refundAmount: 50,
          applyFine: false,
          fineAmount: 300,
        })
        .subscribe();

      const req = httpMock.expectOne(`${BASE}/${CONTRACT_ID}/withdraw`);
      expect(req.request.body.fineAmount).toBeNull();
      req.flush({});
    });

    it('propaga erro 422 com mensagem do backend', async () => {
      const promise = lastValueFrom(
        service.withdraw(CONTRACT_ID, { employeeId: 'e', applyFine: false })
      );

      httpMock
        .expectOne(`${BASE}/${CONTRACT_ID}/withdraw`)
        .flush({ message: 'Status inválido' }, { status: 422, statusText: 'Unprocessable' });

      await expect(promise).rejects.toThrow('Status inválido');
    });
  });

  // ── mapeamento de paymentsPreview ───────────────────────────────────────────

  describe('mapeamento de paymentsPreview', () => {
    it('mapeia status MULTA corretamente', () => {
      const withMulta = {
        ...backendSummary,
        paymentsPreview: [
          { installmentNumber: 1, value: 500, status: 'PAID' },
          { installmentNumber: 2, value: 50, status: 'MULTA' },
        ],
      };

      let status: string | undefined;
      service.getReturnSummary(CONTRACT_ID).subscribe(r => { status = r.paymentsPreview[1].status; });
      httpMock.expectOne(`${BASE}/${CONTRACT_ID}/return-summary`).flush(withMulta);

      expect(status).toBe('MULTA');
    });
  });
});
