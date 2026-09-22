import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { lastValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { FiscalDocumentHttpService } from './fiscal-document-http.service';
import { APP_CONFIG } from '../../../shared/data/app-config.token';
import { IEmitInvoiceRequest } from '../data/fiscal-document.types';

const appConfig = {
  appName: 'RentAFit Test',
  apiBaseUrl: '',
  s3BucketUrl: '',
  fiscalDefaults: {
    nfse: {
      serviceCode: '010101',
      nbsCode: '',
      serviceDescription: 'Serviço de teste',
      totalTaxRate: 6,
      ibsRate: 0.025,
      cbsRate: 0.015,
      isqnRate: 0,
    },
    nfe: {
      ncm: '95059000',
      cfop: '5102',
      unit: 'UN',
    },
  },
};

const nfeCustomer = {
  name: 'Cliente Teste',
  document: '12345678901',
  street: 'Rua do Cliente',
  number: '100',
  neighborhood: 'Centro',
  cityName: 'Sao Carlos',
  state: 'SP',
  zipCode: '13560000',
};

const nfeItem = {
  productCode: 'SKU-001',
  description: 'Fantasia',
  ncm: '95059000',
  cfop: '5102',
  unit: 'UN',
  quantity: 1,
  unitValue: 1234.56,
};

const nfeRequest: IEmitInvoiceRequest = {
  fiscalDocumentType: 'NFE',
  origin: 'SALES',
  originId: 'order-1',
  customerId: 'cust-1',
  customerEmail: 'teste@example.com',
  value: 1234.56,
  natureOperation: 'Venda de mercadoria',
  purpose: 'NORMAL',
  customer: nfeCustomer,
  items: [nfeItem],
};

const nfseRequest: IEmitInvoiceRequest = {
  fiscalDocumentType: 'NFSE',
  origin: 'RENTAL',
  originId: 'contract-1',
  customerId: 'cust-1',
  customerName: 'Maria Souza',
  customerDocument: '98765432100',
  customerEmail: 'maria@example.com',
  value: 800.0,
};

describe('FiscalDocumentHttpService', () => {
  let service: FiscalDocumentHttpService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FiscalDocumentHttpService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: appConfig },
      ],
    });
    service = TestBed.inject(FiscalDocumentHttpService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('emite NF-e para /nfe-api/emit e persiste em /api/fiscal-documents', async () => {
    const promise = lastValueFrom(service.emit(nfeRequest));
    const emitReq = httpMock.expectOne('/nfe-api/emit');
    expect(emitReq.request.method).toBe('POST');
    expect(emitReq.request.body).toMatchObject({
      customerId: 'cust-1',
      natureOperation: 'Venda de mercadoria',
      origin: 'SALES',
      originId: 'order-1',
      customer: nfeCustomer,
      items: [nfeItem],
    });
    emitReq.flush({
      accessKey: '12345678901234567890123456789012345678901234',
      protocol: '123456789012345',
      status: 'AUTHORIZED',
      authorizedXml: '<nfe></nfe>',
    });

    const doc = await promise;
    expect(doc.type).toBe('NFE');
    expect(doc.status).toBe('EMITTED');
    expect(doc.accessKey).toHaveLength(44);
  });

  it('emite NFS-e enviando apenas dados da operação (emitente fica no backend)', async () => {
    const promise = lastValueFrom(service.emit(nfseRequest));
    const req = httpMock.expectOne('/nfse-api/nfse/emit');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({
      vServ: 800,
      nomeTomador: 'Maria Souza',
      docTomador: '98765432100',
      emailTomador: 'maria@example.com',
    });
    // O backend resolve emitente, certificado, cTribNac, alíquotas e município
    // a partir do cadastro em sistema/cnpj — nada disso sai do browser.
    expect(req.request.body).not.toHaveProperty('cnpjEmitente');
    expect(req.request.body).not.toHaveProperty('inscricaoMunicipal');
    expect(req.request.body).not.toHaveProperty('opSimpNac');
    expect(req.request.body).not.toHaveProperty('cTribNac');
    expect(req.request.body).not.toHaveProperty('aliqIss');
    expect(req.request.body).not.toHaveProperty('codigoMunicipioPrestacao');
    req.flush({
      accessKey: '12345678901234567890123456789012345678901234567890',
      invoiceNumber: 123456,
      series: '1',
      protocol: 'DPS123456789',
      status: 'AUTHORIZED',
      issueDate: '2026-06-21T12:00:00-03:00',
      processingDate: '2026-06-21T12:00:01-03:00',
      serviceValue: 800,
      authorizedXml: '<NFSe/>',
    });

    const doc = await promise;
    expect(doc.type).toBe('NFSE');
    expect(doc.status).toBe('EMITTED');
    expect(doc.id).toContain('NFSE-');
    expect(doc.xmlUrl).toBe('<NFSe/>');
  });

  it('consulta status NF-e pela chave de acesso', async () => {
    const current = {
      id: 'nfe-id',
      type: 'NFE' as const,
      status: 'PENDING_EMISSION' as const,
      value: 100,
      accessKey: '12345678901234567890123456789012345678901234',
    };
    const promise = lastValueFrom(service.checkStatus(current));
    const req = httpMock.expectOne('/nfe-api/12345678901234567890123456789012345678901234');
    expect(req.request.method).toBe('GET');
    req.flush({
      accessKey: '12345678901234567890123456789012345678901234',
      protocol: '123456789012345',
      status: 'AUTHORIZED',
      authorizedXml: '<nfe/>',
    });

    const doc = await promise;
    expect(doc.status).toBe('EMITTED');
    expect(doc.protocol).toBe('123456789012345');
  });

  it('consulta status NFS-e pelo id interno do Rentafit', async () => {
    const current = {
      id: 'nfse-uuid',
      type: 'NFSE' as const,
      status: 'PENDING_EMISSION' as const,
      value: 800,
    };
    const promise = lastValueFrom(service.checkStatus(current));
    const req = httpMock.expectOne('/api/fiscal-documents/nfse-uuid');
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'nfse-uuid',
      type: 'NFSE',
      status: 'AUTHORIZED',
      accessKey: '12345678901234567890123456789012345678901234567890',
      number: 123456,
      protocol: 'PR123456789',
      issueDate: '2026-06-21T12:00:00-03:00',
      totalValue: 800,
    });

    const doc = await promise;
    expect(doc.status).toBe('EMITTED');
    expect(doc.number).toBe('123456');
  });

  it('rejeitado no backend mapeia para DENIED', async () => {
    const promise = lastValueFrom(service.emit(nfeRequest));
    httpMock.expectOne('/nfe-api/emit').flush({
      accessKey: '12345678901234567890123456789012345678901234',
      status: 'REJECTED',
      xMotivo: 'Rejeição de teste',
    });

    const doc = await promise;
    expect(doc.status).toBe('DENIED');
  });

  it('erro 422 expõe mensagem do campo error e XML do campo data', async () => {
    const promise = lastValueFrom(service.emit(nfeRequest));
    const req = httpMock.expectOne('/nfe-api/emit');
    req.flush(
      { error: 'Erro na validação do XML', data: '<nfe>assinado</nfe>' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    await expect(promise).rejects.toThrow('Erro na validação do XML');
    try {
      await promise;
    } catch (err: any) {
      expect(err.xml).toBe('<nfe>assinado</nfe>');
    }
  });

  it('downloadXml busca blob autorizado por id interno', async () => {
    const promise = lastValueFrom(service.downloadXml('document-id'));
    const req = httpMock.expectOne('/api/fiscal-documents/document-id/xml');
    expect(req.request.method).toBe('GET');
    req.flush(new Blob(['<xml/>'], { type: 'application/xml' }));

    const blob = await promise;
    expect(blob.type).toBe('application/xml');
  });

  it('downloadDanfe informa indisponibilidade até o renderer local estar disponível', async () => {
    await expect(lastValueFrom(service.downloadDanfe('document-id'))).rejects.toThrow(
      'DANF-e local',
    );
  });

  it('cancela NF-e via /nfe-api/{chave}/cancelar', async () => {
    const current = {
      id: 'doc-uuid',
      type: 'NFE' as const,
      status: 'EMITTED' as const,
      accessKey: '12345678901234567890123456789012345678901234',
      protocol: '123456789012345',
      value: 100,
    };
    const promise = lastValueFrom(
      service.cancel(current, { reason: 'Erro de teste', sequence: '1' }),
    );
    const req = httpMock.expectOne(
      '/nfe-api/12345678901234567890123456789012345678901234/cancelar',
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({
      protocol: '123456789012345',
      justification: 'Erro de teste',
      sequence: '1',
    });
    req.flush({
      accessKey: '12345678901234567890123456789012345678901234',
      protocol: 'CANCEL-PROTOCOL',
      status: 'AUTHORIZED',
    });

    const doc = await promise;
    expect(doc.status).toBe('EMITTED');
  });

  it('lista documentos fiscais via /api/fiscal-documents mapeando status e paginação', async () => {
    const params = {
      type: 'NFE' as const,
      origin: 'SALES' as const,
      status: 'EMITTED' as const,
      page: 0,
      size: 20,
    };
    const promise = lastValueFrom(service.list(params));
    const req = httpMock.expectOne(
      '/api/fiscal-documents?page=0&size=20&type=NFE&origin=SALES&status=AUTHORIZED',
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      content: [
        {
          id: 'doc-1',
          type: 'NFE',
          status: 'AUTHORIZED',
          accessKey: '12345678901234567890123456789012345678901234',
          number: 123456,
          series: '1',
          issueDate: '2026-06-21T12:00:00-03:00',
          totalValue: 1234.56,
          customerName: 'Maria Souza',
          origin: 'SALES',
          originId: 'order-1',
        },
      ],
      number: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });

    const page = await promise;
    expect(page.content).toHaveLength(1);
    expect(page.content[0].status).toBe('EMITTED');
    expect(page.content[0].customerName).toBe('Maria Souza');
    expect(page.totalElements).toBe(1);
  });

  it('busca documento por id via /api/fiscal-documents/{id}', async () => {
    const promise = lastValueFrom(service.findById('doc-1'));
    const req = httpMock.expectOne('/api/fiscal-documents/doc-1');
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'doc-1',
      type: 'NFSE',
      status: 'AUTHORIZED',
      accessKey: '12345678901234567890123456789012345678901234567890',
      number: 654321,
      issueDate: '2026-06-21T12:00:00-03:00',
      totalValue: 800,
      customerEmail: 'maria@example.com',
      customerName: 'Maria Souza',
      origin: 'RENTAL',
      originId: 'contract-1',
    });

    const doc = await promise;
    expect(doc.status).toBe('EMITTED');
    expect(doc.customerEmail).toBe('maria@example.com');
  });
});
