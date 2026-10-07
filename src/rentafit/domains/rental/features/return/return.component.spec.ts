import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ReturnComponent } from './return.component';
import { ReturnFacadeService } from '../../service/return-facade.service';
import { ReturnApiPort } from './data/return-api.port';
import { Router, ActivatedRoute } from '@angular/router';
import { ReturnSummaryModel, ReturnFormState } from './data/return.model';
import { APP_CONFIG } from '../../../../shared/data/app-config.token';
import { TabService } from '../../../../shared/services/tab.service';
import { TerminalOperatorService } from '../../../auth/services/terminal-operator.service';

const buildReturnSummary = (overrides: Partial<ReturnSummaryModel> = {}): ReturnSummaryModel => ({
  contractId: 'contract-123',
  legacyId: '2024-001',
  customerName: 'João Silva',
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
  clearError: ReturnType<typeof vi.fn>;
}

describe('ReturnComponent', () => {
  let facade: MockFacade;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let route: { snapshot: { paramMap: { get: ReturnType<typeof vi.fn> } } };
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
      clearError: vi.fn(),
    };

    router = { navigate: vi.fn() };
    route = {
      snapshot: {
        paramMap: {
          get: vi.fn().mockReturnValue('contract-123'),
        },
      },
    };
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
      route.snapshot.paramMap.get.mockReturnValue('contract-789');

      const component = makeComponent();
      component.ngOnInit();

      expect(facade.loadContract).toHaveBeenCalledWith('contract-789');
    });

    it('navega para / quando contractId não está na rota', () => {
      route.snapshot.paramMap.get.mockReturnValue(null);

      const component = makeComponent();
      component.ngOnInit();

      expect(router.navigate).toHaveBeenCalledWith(['/']);
      expect(facade.loadContract).not.toHaveBeenCalled();
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
