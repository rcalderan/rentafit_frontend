import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ReturnComponent } from './return.component';
import { ReturnFacadeService } from '../../service/return-facade.service';
import { ReturnApiPort } from './data/return-api.port';
import { Router, ActivatedRoute } from '@angular/router';
import { ReturnSummaryModel, ReturnFormState } from './data/return.model';
import { APP_CONFIG } from '../../../../shared/data/app-config.token';
import { TabService } from '../../../../shared/services/tab.service';
import { TerminalOperatorService } from '../../../auth/services/terminal-operator.service';
import { RentalContractService } from '../../service/rental-contract.service';

const buildReturnSummary = (overrides: Partial<ReturnSummaryModel> = {}): ReturnSummaryModel => ({
  contractId: 'contract-123',
  legacyId: '2024-001',
  customerName: 'João Silva',
  contractStatus: 'FINALIZED',
  totalValue: 0,
  returnDate: '2026-06-01',
  pendingCount: 2,
  isFullyReturned: false,
  delayDays: 0,
  suggestedFine: 0,
  items: [],
  paymentsPreview: [],
  ...overrides,
});

const defaultFormState: ReturnFormState = {
  returnerName: '',
  selectedItems: new Set<string>(),
  selectedAccessories: new Map<string, Set<string>>(),
  applyFine: false,
  fineAmount: null,
};

interface MockFacade {
  summary: WritableSignal<ReturnSummaryModel | null>;
  loading: WritableSignal<boolean>;
  error: WritableSignal<string | null>;
  saving: WritableSignal<boolean>;
  closing: WritableSignal<boolean>;
  form: WritableSignal<ReturnFormState>;
  canDirectClose: WritableSignal<boolean>;
  hasChanges: WritableSignal<boolean>;
  delayWarning: WritableSignal<string | null>;
  unpaidPaymentsCount: WritableSignal<number>;
  showConfirmButton: WritableSignal<boolean>;
  loadContract: ReturnType<typeof vi.fn>;
  setReturnerName: ReturnType<typeof vi.fn>;
  toggleItem: ReturnType<typeof vi.fn>;
  toggleAccessory: ReturnType<typeof vi.fn>;
  setApplyFine: ReturnType<typeof vi.fn>;
  setFineAmount: ReturnType<typeof vi.fn>;
  saveMarkings: ReturnType<typeof vi.fn>;
  closeContract: ReturnType<typeof vi.fn>;
  withdraw: ReturnType<typeof vi.fn>;
  clearError: ReturnType<typeof vi.fn>;
}

describe('ReturnComponent', () => {
  let facade: MockFacade;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let route: {
    paramMap: unknown;
    snapshot: { paramMap: { get: ReturnType<typeof vi.fn> } };
  };
  let paramMapGet: (k: string) => string | null;
  let contractServiceMock: { getByLegacyId: ReturnType<typeof vi.fn> };
  let tabServiceMock: { getTabId: ReturnType<typeof vi.fn>; updateTitle: ReturnType<typeof vi.fn>; updateActiveTitle: ReturnType<typeof vi.fn> };

  const makeComponent = () => TestBed.createComponent(ReturnComponent).componentInstance;

  beforeEach(async () => {
    facade = {
      summary: signal<ReturnSummaryModel | null>(null),
      loading: signal(false),
      error: signal(null),
      saving: signal(false),
      closing: signal(false),
      form: signal<ReturnFormState>(defaultFormState),
      canDirectClose: signal(false),
      hasChanges: signal(false),
      delayWarning: signal(null),
      unpaidPaymentsCount: signal(0),
      showConfirmButton: signal(false),
      loadContract: vi.fn(),
      setReturnerName: vi.fn(),
      toggleItem: vi.fn(),
      toggleAccessory: vi.fn(),
      setApplyFine: vi.fn(),
      setFineAmount: vi.fn(),
      saveMarkings: vi.fn().mockReturnValue(of(true)),
      closeContract: vi.fn().mockReturnValue(of(true)),
      withdraw: vi.fn().mockReturnValue(of(true)),
      clearError: vi.fn(),
    };

    router = { navigate: vi.fn() };
    paramMapGet = (k: string) => (k === 'contractId' ? 'contract-123' : null);
    route = {
      paramMap: of({ get: (k: string) => paramMapGet(k) }),
      snapshot: {
        paramMap: {
          get: vi.fn().mockReturnValue('contract-123'),
        },
      },
    };
    contractServiceMock = { getByLegacyId: vi.fn() };
    tabServiceMock = { getTabId: vi.fn(), updateTitle: vi.fn(), updateActiveTitle: vi.fn() };

    TestBed.configureTestingModule({
      imports: [ReturnComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: route },
        {
          provide: APP_CONFIG,
          useValue: {
            appName: 'RentAFit Test',
            apiBaseUrl: '',
            s3BucketUrl: 'https://test-bucket.s3.amazonaws.com',
          },
        },
        { provide: TabService, useValue: tabServiceMock },
        { provide: RentalContractService, useValue: contractServiceMock },
        {
          provide: TerminalOperatorService,
          useValue: {
            authorize: vi.fn().mockReturnValue(
              of({ employeeId: 'emp-1', name: 'Operador', initials: 'OP', pinTrustedUntil: 0 }),
            ),
          },
        },
      ],
    });

    // Sobrescreve os providers do componente para usar mocks
    TestBed.overrideComponent(ReturnComponent, {
      set: {
        providers: [
          { provide: ReturnFacadeService, useValue: facade },
          { provide: ReturnApiPort, useValue: {} },
        ],
      },
    });

    await TestBed.compileComponents();
  });

  describe('onContractIdClick', () => {
    it('navega para /rental/new com queryParam id quando summary tem contractId', () => {
      const summary = buildReturnSummary({ contractId: 'contract-456', legacyId: '2024-002' });
      facade.summary.set(summary);

      const component = makeComponent();
      component.onContractIdClick();

      expect(router.navigate).toHaveBeenCalledWith(
        ['/rental/new'],
        { queryParams: { id: 'contract-456' } }
      );
    });

    it('não navega quando summary é null', () => {
      facade.summary.set(null);

      const component = makeComponent();
      component.onContractIdClick();

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('usa o contractId correto do summary (não o legacyId)', () => {
      const summary = buildReturnSummary({ contractId: 'uuid-abc-123', legacyId: '2024-999' });
      facade.summary.set(summary);

      const component = makeComponent();
      component.onContractIdClick();

      expect(router.navigate).toHaveBeenCalledWith(
        ['/rental/new'],
        { queryParams: { id: 'uuid-abc-123' } }
      );
      expect(router.navigate).not.toHaveBeenCalledWith(
        ['/rental/new'],
        { queryParams: { id: '2024-999' } }
      );
    });
  });

  describe('onCancel', () => {
    it('navega para /rental/management', () => {
      const component = makeComponent();
      component.onCancel();

      expect(router.navigate).toHaveBeenCalledWith(['/rental/management']);
    });
  });

  describe('ngOnInit', () => {
    it('carrega contrato quando contractId está na rota', () => {
      paramMapGet = (k: string) => (k === 'contractId' ? 'contract-789' : null);

      const component = makeComponent();
      component.ngOnInit();

      expect(facade.loadContract).toHaveBeenCalledWith('contract-789');
    });

    it('entra em modo lookup quando contractId não está na rota', () => {
      paramMapGet = () => null;

      const component = makeComponent();
      component.ngOnInit();

      expect(component.lookupMode()).toBe(true);
      expect(facade.loadContract).not.toHaveBeenCalled();
    });
  });

  describe('lookup de contrato', () => {
    it('resolve legacyId e navega para /rental/return/:id', () => {
      contractServiceMock.getByLegacyId.mockReturnValue(of({ id: 'uuid-42' }));
      const component = makeComponent();
      component.lookupQuery.set('20261006-1');

      component.onLookupSubmit();

      expect(contractServiceMock.getByLegacyId).toHaveBeenCalledWith('20261006-1');
      expect(router.navigate).toHaveBeenCalledWith(['/rental/return', 'uuid-42']);
    });

    it('exibe erro quando contrato não é encontrado', () => {
      contractServiceMock.getByLegacyId.mockReturnValue(
        throwError(() => new Error('Contrato não encontrado'))
      );
      const component = makeComponent();
      component.lookupQuery.set('9999');

      component.onLookupSubmit();

      expect(component.lookupError()).toBe('Contrato não encontrado');
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('desistência', () => {
    it('openCancellation abre o modal quando status é FINALIZED', () => {
      const component = makeComponent();
      facade.summary.set(buildReturnSummary({ contractStatus: 'FINALIZED' }));

      component.openCancellation();

      expect(component.showCancellation()).toBe(true);
    });

    it('openCancellation abre o modal quando status é SIGNED', () => {
      const component = makeComponent();
      facade.summary.set(buildReturnSummary({ contractStatus: 'SIGNED' }));

      component.openCancellation();

      expect(component.showCancellation()).toBe(true);
    });

    it('openCancellation não abre para status não elegível', () => {
      const component = makeComponent();
      facade.summary.set(buildReturnSummary({ contractStatus: 'CLOSED' }));

      component.openCancellation();

      expect(component.showCancellation()).toBe(false);
    });

    it('openCancellation não abre para contrato CANCELLED', () => {
      const component = makeComponent();
      facade.summary.set(buildReturnSummary({ contractStatus: 'CANCELLED' }));

      component.openCancellation();

      expect(component.showCancellation()).toBe(false);
    });

    it('confirmação autoriza operador e chama withdraw com reembolso', () => {
      const component = makeComponent();
      facade.summary.set(buildReturnSummary());
      component.showCancellation.set(true);

      component.onCancellationConfirmed({
        refundPaymentIds: ['pay-1'],
        applyFine: true,
        fineAmount: 300,
      });

      expect(facade.withdraw).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: 'emp-1',
          refundPaymentIds: ['pay-1'],
          applyFine: true,
          fineAmount: 300,
        })
      );
      expect(component.showCancellation()).toBe(false);
      expect(component.withdrawSuccess()).toBe(true);
    });

    it('não chama withdraw quando operador cancela a autorização', () => {
      const opService = TestBed.inject(TerminalOperatorService) as unknown as {
        authorize: ReturnType<typeof vi.fn>;
      };
      opService.authorize.mockReturnValue(of(null));
      const component = makeComponent();
      facade.summary.set(buildReturnSummary());

      component.onCancellationConfirmed({ refundPaymentIds: [], applyFine: false });

      expect(facade.withdraw).not.toHaveBeenCalled();
    });
  });

  describe('estado terminal (somente leitura)', () => {
    it('CLOSED: isTerminal true e banner de contrato concluído', () => {
      const component = makeComponent();
      facade.summary.set(buildReturnSummary({ contractStatus: 'CLOSED' }));

      expect(component.isTerminal()).toBe(true);
      expect(component.terminalBanner()).toContain('concluído');
    });

    it('CANCELLED: isTerminal true e banner de desistência', () => {
      const component = makeComponent();
      facade.summary.set(buildReturnSummary({ contractStatus: 'CANCELLED' }));

      expect(component.isTerminal()).toBe(true);
      expect(component.terminalBanner()).toContain('desistência');
    });

    it('FINALIZED: isTerminal false e sem banner', () => {
      const component = makeComponent();
      facade.summary.set(buildReturnSummary({ contractStatus: 'FINALIZED' }));

      expect(component.isTerminal()).toBe(false);
      expect(component.terminalBanner()).toBeNull();
    });

    it('banner terminal é renderizado no template', () => {
      const fixture = TestBed.createComponent(ReturnComponent);
      fixture.detectChanges();
      facade.summary.set(buildReturnSummary({ contractStatus: 'CANCELLED' }));
      fixture.detectChanges();

      const banner = fixture.nativeElement.querySelector('.terminal-notice');
      expect(banner).toBeTruthy();
      expect(banner.textContent).toContain('desistência');
    });
  });

  it('atualiza título da aba com legacyId da devolução', () => {
    const fixture = TestBed.createComponent(ReturnComponent);
    fixture.detectChanges();
    facade.summary.set(buildReturnSummary({ legacyId: '2024-007' }));
    fixture.detectChanges();

    expect(tabServiceMock.updateActiveTitle).toHaveBeenCalledWith('Devolução 2024-007');
  });
});
