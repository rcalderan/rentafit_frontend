import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NfseEmissionComponent } from './nfse-emission.component';
import { FiscalDocumentService } from '../../service/fiscal-document.service';
import { IssuerSetupService } from '../../../auth/services/issuer-setup.service';
import { APP_CONFIG } from '../../../../shared/data/app-config.token';
import { IFiscalContext, IFiscalDocument } from '../../data/fiscal-document.types';
import { IssuerInfo } from '../../../auth/data/issuer.model';

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

const issuerWithNfseFields: IssuerInfo = {
  cnpj: '08299621000120',
  rootCnpj: '08299621',
  branchOrder: '0001',
  digitoControle: '20',
  matriz: true,
  razaoSocial: 'RentAFit LTDA',
  crt: '1',
  logradouro: 'Rua Teste',
  numero: '100',
  bairro: 'Centro',
  municipioCodigo: '3548906',
  municipioNome: 'São Carlos',
  uf: 'SP',
  cep: '13560000',
  paisCodigo: '1058',
  paisNome: 'BRASIL',
  certificateConfigured: true,
  nfseServiceCode: '010101',
  nfseNbsCode: '10101',
  nfseServiceDescription: 'Locação de trajes e vestuário',
  nfseIssRate: 2.5,
  nfseTotalTaxRate: 6,
};

const paidContext: IFiscalContext = {
  origin: 'RENTAL',
  originId: 'contract-1',
  isPaid: true,
  totalValue: 800,
  customerId: 'cust-1',
  customerName: 'Maria Souza',
  customerDocument: '98765432100',
};

const pendingDoc: IFiscalDocument = {
  id: 'NFSE-1',
  type: 'NFSE',
  status: 'PENDING_EMISSION',
  value: 800,
};

describe('NfseEmissionComponent', () => {
  let fiscalService: {
    emit: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    checkStatus: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    reemit: ReturnType<typeof vi.fn>;
    sendEmail: ReturnType<typeof vi.fn>;
    downloadXml: ReturnType<typeof vi.fn>;
    downloadDanfe: ReturnType<typeof vi.fn>;
  };
  let issuerSetupService: { getCurrentIssuer: ReturnType<typeof vi.fn> };

  const build = (context: IFiscalContext): ComponentFixture<NfseEmissionComponent> => {
    const fixture = TestBed.createComponent(NfseEmissionComponent);
    fixture.componentRef.setInput('context', context);
    fixture.componentRef.setInput('initialDocument', null);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(async () => {
    fiscalService = {
      emit: vi.fn().mockReturnValue(of(pendingDoc)),
      save: vi.fn().mockReturnValue(of(pendingDoc)),
      checkStatus: vi.fn(),
      cancel: vi.fn(),
      reemit: vi.fn(),
      sendEmail: vi.fn(),
      downloadXml: vi.fn(),
      downloadDanfe: vi.fn(),
    };
    issuerSetupService = {
      getCurrentIssuer: vi.fn().mockReturnValue(of(issuerWithNfseFields)),
    };
    await TestBed.configureTestingModule({
      imports: [NfseEmissionComponent],
      providers: [
        { provide: FiscalDocumentService, useValue: fiscalService },
        { provide: IssuerSetupService, useValue: issuerSetupService },
        { provide: APP_CONFIG, useValue: appConfig },
      ],
    }).compileComponents();
  });

  it('monta a requisição de NFS-e com origem RENTAL e descrição do emitente', () => {
    const comp = build(paidContext).componentInstance as any;
    comp.emit();
    expect(fiscalService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        fiscalDocumentType: 'NFSE',
        origin: 'RENTAL',
        value: 800,
        serviceDescription: 'Locação de trajes e vestuário',
        customerDocument: '98765432100',
      }),
    );
  });

  it('resolve campos fiscais a partir do emitente configurado', () => {
    const comp = build(paidContext).componentInstance as any;
    expect(comp.fiscalFields()).toEqual({
      serviceCode: '010101',
      nbsCode: '10101',
      cityCode: '3548906',
      issRate: 2.5,
      totalTaxRate: 6,
    });
  });

  it('bloqueia emissão quando o cliente não possui CPF ou CNPJ', () => {
    const comp = build({ ...paidContext, customerDocument: '' }).componentInstance as any;
    expect(comp.hasCustomerDocument()).toBe(false);
    expect(comp.canEmit()).toBe(false);
  });
});
