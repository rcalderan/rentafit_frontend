import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, EMPTY, Observable, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import {
  IItemReservationResponse,
  IRentalContractResponse,
} from '../../data/rental-contract-response.interface';
import { IRentalContractSignRequest } from '../../data/rental-contract-request.interface';
import { DEFAULT_RENTAL_CONTRACT_TEMPLATE } from '../../../print/data/default-templates';
import { PrintTemplate, TemplateType } from '../../../print/data/print-template.model';
import { PrintTemplateStorageService } from '../../../print/services/print-template-storage.service';
const emptyQueryParams = of({});
import { EmployeeService } from '../../../admin/service/employee.service';
import { CustomerService } from '../../../customer/service/customer.service';
import { ICustomer } from '../../../customer/data/Customer.interface';
import { ProductService } from '../../../product/service/product.service';
import { HolidayService } from '../../../../shared/services/holiday.service';
import { AutosaveService } from '../../service/autosave.service';
import { RentalContractService } from '../../service/rental-contract.service';
import { ContractStatus } from '../../data/contract-status.enum';
import { PaymentMethod } from '../../data/payment-method.enum';
import { PaymentStatus } from '../../data/payment-status.enum';
import { IProductCatalog } from '../../data/product-catalog.interface';
import { NewRental } from './new-rental.component';
import { copyUnsavedRentalProposal } from '../../service/rental-proposal-copy';
import { SessionFormStorageService } from '../../../../shared/services/session-form-storage.service';
import { TabService } from '../../../../shared/services/tab.service';
import { TerminalOperatorService } from '../../../auth/services/terminal-operator.service';
import { APP_CONFIG } from '../../../../shared/data/app-config.token';

const product: IProductCatalog = {
  _id: 10,
  nome: 'Terno',
  locado: false,
  obs: '',
  valor: 150,
  tamanho: 'M',
  nloc: 0,
  no_estoque: true,
  cor: 'Preto',
  base: 150,
  ajuste: 0,
  data: '',
  preco_id: 0,
  status: 1,
  tipo: 1,
};

class FakeCustomerService {
  readonly requestedIds: string[] = [];
  readonly customer: ICustomer = {
    id: 'customer-1',
    legacyId: '42',
    name: 'Cliente de teste',
    document: '00000000000',
    isAuthenticated: false,
    email: 'cliente@example.test',
    notes: '',
    complement: 'Casa 2',
    number: '10',
    phones: ['(11) 1111-1111'],
    address: {
      zipCode: '01000-000',
      street: 'Rua de Teste',
      neighborhood: 'Centro',
      city: 'São Paulo',
      state: 'SP',
    },
  };

  getCustomerById(customerId: string): Observable<ICustomer> {
    this.requestedIds.push(customerId);
    return of(this.customer);
  }
}

class FakePrintTemplateStorage {
  initialize(): Promise<void> {
    return Promise.resolve();
  }

  getDefaultByType(type: TemplateType): PrintTemplate | undefined {
    return type === 'RENTAL_CONTRACT' ? DEFAULT_RENTAL_CONTRACT_TEMPLATE : undefined;
  }
}

class FakeRentalContractService {
  readonly signRequests: Array<{ contractId: string; request: IRentalContractSignRequest }> = [];
  readonly saveRequests: unknown[] = [];
  readonly reservationCalls: Array<{ rentalItemId: string; excludeContractId?: string }> = [];
  itemReservations: IItemReservationResponse[] = [];

  create(request: unknown): Observable<IRentalContractResponse> {
    this.saveRequests.push(request);
    return EMPTY;
  }

  update(_contractId: string, request: unknown): Observable<IRentalContractResponse> {
    this.saveRequests.push(request);
    return EMPTY;
  }

  sign(
    contractId: string,
    request: IRentalContractSignRequest,
  ): Observable<IRentalContractResponse> {
    this.signRequests.push({ contractId, request });
    return EMPTY;
  }

  getItemReservations(
    rentalItemId: string,
    excludeContractId?: string,
  ): Observable<IItemReservationResponse[]> {
    this.reservationCalls.push({ rentalItemId, excludeContractId });
    return of(this.itemReservations);
  }
}

const rentalItemResult = {
  id: 'item-uuid-1',
  legacyId: '001',
  name: 'Vestido Longo',
  notes: '',
  value: 300,
  size: 'M',
  color: 'Preto',
};

const itemReservation: IItemReservationResponse = {
  contractId: 'contract-uuid-1',
  legacyId: '251006-1',
  customerId: 'customer-uuid-1',
  customerName: 'Ana Lima',
  customerLegacyId: 101,
  eventDate: '2026-10-12',
  pickupDate: '2026-10-10',
  returnDate: '2026-10-14',
  status: 'SIGNED',
  statusDescription: 'Assinado',
};

const AUTHORIZED_OPERATOR = {
  employeeId: 'employee-1',
  name: 'Ana',
  initials: 'AN',
  pinTrustedUntil: 0,
};

describe('NewRental item attendant', () => {
  let customerService: FakeCustomerService;
  let printTemplateStorage: FakePrintTemplateStorage;
  let rentalContractService: FakeRentalContractService;
  let employeeService: { listActiveAttendants: ReturnType<typeof vi.fn> };
  let operatorService: {
    authorize: ReturnType<typeof vi.fn>;
    currentOperator: ReturnType<typeof vi.fn>;
  };
  let tabServiceMock: {
    open: ReturnType<typeof vi.fn>;
    closeActiveIf: ReturnType<typeof vi.fn>;
    getTabId: ReturnType<typeof vi.fn>;
    updateTitle: ReturnType<typeof vi.fn>;
  };
  let productService: { getRentalItemByLegacyId: ReturnType<typeof vi.fn> };
  let component: NewRental;

  beforeEach(() => {
    employeeService = {
      listActiveAttendants: vi.fn().mockReturnValue(
        of([
          { id: 'employee-1', name: 'Ana', role: 'EMPLOYEE' },
          { id: 'manager-1', name: 'Bruno', role: 'MANAGER' },
          { id: 'admin-1', name: 'Carla', role: 'ADMIN' },
        ]),
      ),
    };
    operatorService = {
      authorize: vi.fn().mockReturnValue(of(AUTHORIZED_OPERATOR)),
      currentOperator: vi.fn().mockReturnValue(null),
    };
    tabServiceMock = {
      open: vi.fn(),
      closeActiveIf: vi.fn(),
      getTabId: vi.fn((path, draftId) => `${path}::${draftId}`),
      updateTitle: vi.fn(),
    };
    customerService = new FakeCustomerService();
    printTemplateStorage = new FakePrintTemplateStorage();
    rentalContractService = new FakeRentalContractService();
    productService = { getRentalItemByLegacyId: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParams: {} }, queryParams: emptyQueryParams },
        },
        { provide: EmployeeService, useValue: employeeService },
        { provide: CustomerService, useValue: customerService },
        { provide: ProductService, useValue: productService },
        {
          provide: HolidayService,
          useValue: { getHolidays: vi.fn().mockReturnValue(of(new Set<string>())) },
        },
        { provide: RentalContractService, useValue: rentalContractService },
        { provide: PrintTemplateStorageService, useValue: printTemplateStorage },
        {
          provide: AutosaveService,
          useValue: { status$: of('idle'), lastError: null, reset: vi.fn() },
        },
        {
          provide: SessionFormStorageService,
          useValue: {
            saveDraft: vi.fn(),
            loadDraft: vi.fn().mockReturnValue(null),
            clearDraft: vi.fn(),
          },
        },
        { provide: TabService, useValue: tabServiceMock },
        { provide: TerminalOperatorService, useValue: operatorService },
        {
          provide: APP_CONFIG,
          useValue: { appName: 'RentAFit Test', apiBaseUrl: '', s3BucketUrl: '' },
        },
      ],
    });

    component = TestBed.runInInjectionContext(() => new NewRental());
  });

  it('restores the revision draft and catalog UUIDs when returning from a copied tab', () => {
    component.contractId = 'revision';
    component.parentContractId = 'original';
    component.contractLoaded = true;
    component.contract.situacao = ContractStatus.REVISION;
    component.contract.itens = [
      {
        codigo: '42',
        descricao: 'Vestido',
        valor: 100,
        entregue: false,
        attendantEmployeeId: 'employee',
        sub: [],
      },
    ];
    component['itemRentalIds'].set('42', 'catalog-uuid');
    const origin = component['createDraftSnapshot']();
    const copy = copyUnsavedRentalProposal(origin, '2026-10-04');
    const params = new BehaviorSubject({ draftId: 'origin-tab', id: 'original' });
    Object.assign(TestBed.inject(ActivatedRoute), { queryParams: params.asObservable() });
    const storage = TestBed.inject(SessionFormStorageService);
    vi.mocked(storage.loadDraft).mockImplementation((_type, id) =>
      id === 'origin-tab' ? origin : copy,
    );
    component.ngOnInit();
    params.next({ draftId: 'copied-tab', id: '' });
    expect(component.contractId).toBeNull();
    params.next({ draftId: 'origin-tab', id: 'original' });
    expect(component.contractId).toBe('revision');
    expect(component['itemRentalIds'].get('42')).toBe('catalog-uuid');
    component.ngOnDestroy();
  });

  it('keeps paid installment numbers when planning the remaining revision balance', () => {
    component.contractId = 'revision';
    component.contract.situacao = ContractStatus.REVISION;
    component.contract.pagamentos = [1, 3].map((parcela) => ({
      parcela,
      data: '2026-10-01',
      forma: PaymentMethod.PIX,
      valor: 50,
      vezes: 1,
      status: PaymentStatus.PAID,
    }));
    component.total = 150;
    component.paymentModalValor = 50;
    component.paymentModalData = '2026-10-01';
    component.dividePayment();
    expect(component.contract.pagamentos.map((payment) => payment.parcela)).toEqual([1, 3, 4]);
    expect(
      component.contract.pagamentos.filter((payment) => payment.status === PaymentStatus.PAID),
    ).toHaveLength(2);
  });

  it('copies into another draft tab without saving or changing the origin', () => {
    component.contractId = 'original';
    component.contract.situacao = ContractStatus.FINALIZED;
    component.duplicateContract();
    expect(tabServiceMock.open).toHaveBeenCalledWith(
      '/rental/new',
      'Nova proposta não salva',
      'rental',
      expect.any(String),
    );
    expect(component.contractId).toBe('original');
    expect(component.contract.situacao).toBe(ContractStatus.FINALIZED);
    expect(rentalContractService.saveRequests).toHaveLength(0);
  });

  it('preserves copied dates when holidays are resolved after restoring a draft', () => {
    component.contract.usa = '2026-12-24';
    component.contract.retirada = '2026-12-22';
    component.contract.devolucao = '2026-12-26';
    component.autoFillDates();
    expect(component.contract.usa).toBe('2026-12-24');
    expect(component.contract.retirada).toBe('2026-12-22');
    expect(component.contract.devolucao).toBe('2026-12-26');
  });

  it('locks customer and paid value while allowing dates/items in a revision', () => {
    component.contractId = 'revision';
    component.contract.situacao = ContractStatus.REVISION;
    component.customerUuid = 'original-customer';
    component.customerFound = true;
    component.clearCustomer();
    expect(component.customerUuid).toBe('original-customer');
    expect(component.isEditable()).toBe(true);
    component.paymentModalStatus = PaymentStatus.PAID;
    component.confirmAddPayment();
    expect(component.paymentModalError).toContain('preserva o valor pago');
  });

  it('carrega atendentes uma vez na inicialização e abre Adicionar Item desmarcado', () => {
    component.ngOnInit();
    component.openItemModal();
    component.openItemModal();

    expect(component.showItemModal).toBe(true);
    expect(component.itemModalEmployee).toBe('');
    expect(employeeService.listActiveAttendants).toHaveBeenCalledOnce();
    expect(component.activeAttendants).toHaveLength(3);
  });

  it('pré-seleciona o operador em comando como atendente do item', () => {
    operatorService.currentOperator.mockReturnValue(AUTHORIZED_OPERATOR);

    component.openItemModal();

    expect(component.itemModalEmployee).toBe('employee-1');
  });

  it('opens print confirmation only after the proposal has an ID', () => {
    component.requestContractPrint();
    expect(component.showPrintConfirmation()).toBe(false);

    component.contractId = 'saved-contract';
    component.requestContractPrint();
    expect(component.showPrintConfirmation()).toBe(true);

    component.cancelContractPrint();
    expect(component.showPrintConfirmation()).toBe(false);
  });

  it('opens the rental-contract print preview with saved proposal values after confirmation', () => {
    component.contractId = 'saved-contract';
    component.contract.legacyId = '20260929-1';
    component.contract.clienteNome = 'Cliente de teste';
    component.contract.clienteCpf = '00000000000';
    component.contract.retirada = '2026-09-29';
    component.contract.usa = '2026-10-01';
    component.contract.devolucao = '2026-10-02';
    component.contract.itens = [
      {
        codigo: '10',
        descricao: 'Terno',
        valor: 150,
        entregue: false,
        attendantEmployeeId: '',
        sub: [],
      },
    ];
    component.contract.pagamentos = [
      {
        parcela: 1,
        data: '2026-09-29',
        forma: PaymentMethod.CASH,
        valor: 150,
        vezes: 1,
        status: PaymentStatus.PENDING,
      },
    ];
    component.total = 150;

    component.requestContractPrint();
    component.confirmContractPrint();

    expect(component.showPrintConfirmation()).toBe(false);
    expect(component.showContractPrintModal()).toBe(true);
    expect(component.contractPrintData()?.cliente?.nome).toBe('Cliente de teste');
    expect(component.contractPrintData()?.contrato?.numero).toBe('20260929-1');
    expect(component.contractPrintData()?.itensContrato).toEqual([
      { codigo: '10', descricao: 'Terno', valor: 150 },
    ]);
    component.closeContractPrintPreview();
    expect(component.showContractPrintModal()).toBe(false);
    expect(component.contractPrintData()).toBeNull();
  });

  it('loads customer address details before opening a saved contract for print', () => {
    component.contractId = 'saved-contract';
    component.customerUuid = 'customer-1';
    component.contract.clienteNome = 'Cliente de teste';
    component.contract.clienteCpf = '00000000000';

    component.requestContractPrint();
    component.confirmContractPrint();

    expect(customerService.requestedIds).toEqual(['customer-1']);
    expect(component.contractPrintData()?.cliente?.endereco).toBe('Rua de Teste, 10, Casa 2');
    expect(component.showContractPrintModal()).toBe(true);
  });

  it('sends the active default template ID when signing the proposal', async () => {
    component.contractId = 'saved-contract';
    component.contract.situacao = ContractStatus.DRAFT;
    component.contract.cliente = 'Cliente de teste';
    component.contract.itens = [
      {
        codigo: '10',
        descricao: 'Terno',
        valor: 150,
        entregue: false,
        attendantEmployeeId: 'employee-1',
        sub: [],
      },
    ];

    component.assinarContrato();
    await vi.waitFor(() => expect(rentalContractService.signRequests).toHaveLength(1));

    expect(operatorService.authorize).toHaveBeenCalledWith(
      expect.objectContaining({ requirePin: false }),
    );
    expect(rentalContractService.signRequests[0]).toEqual({
      contractId: 'saved-contract',
      request: { printTemplateId: DEFAULT_RENTAL_CONTRACT_TEMPLATE.id },
    });
  });

  it('exige PIN do operador ao salvar proposta', () => {
    component.customerUuid = 'customer-1';
    component.contract.pagamentos = [
      {
        parcela: 1,
        data: '2026-09-29',
        forma: PaymentMethod.CASH,
        valor: 150,
        vezes: 1,
        status: PaymentStatus.PENDING,
      },
    ];
    component.contract.itens = [
      {
        codigo: '10',
        descricao: 'Terno',
        valor: 150,
        entregue: false,
        attendantEmployeeId: 'employee-1',
        sub: [],
      },
    ];

    component.salvarProposta();

    expect(operatorService.authorize).toHaveBeenCalledWith(
      expect.objectContaining({ requirePin: true }),
    );
  });

  it('não adiciona novo item sem atendente', () => {
    component.openItemModal();
    component.itemModalFoundProduct = product;
    component.itemModalCode = '10';
    component.itemModalName = product.nome;
    component.itemModalValor = product.valor;

    component.confirmAddItem();

    expect(component.contract.itens).toHaveLength(0);
    expect(component.showItemModal).toBe(true);
  });

  it('associa o atendente selecionado ao novo item', () => {
    component.openItemModal();
    component.itemModalFoundProduct = product;
    component.itemModalCode = '10';
    component.itemModalName = product.nome;
    component.itemModalValor = product.valor;
    component.itemModalEmployee = 'manager-1';

    component.confirmAddItem();

    expect(component.contract.itens[0].attendantEmployeeId).toBe('manager-1');
    expect(component.showItemModal).toBe(false);
  });

  it('preserva o atendente ao editar item existente', () => {
    component.ngOnInit();
    component.contract.situacao = ContractStatus.DRAFT;
    component.contract.itens = [
      {
        codigo: '10',
        descricao: 'Terno',
        valor: 150,
        entregue: false,
        attendantEmployeeId: 'employee-1',
        sub: [],
      },
    ];

    component.openEditItemModal(0);
    component.itemModalValor = 175;
    component.confirmAddItem();

    expect(component.contract.itens[0].valor).toBe(175);
    expect(component.contract.itens[0].attendantEmployeeId).toBe('employee-1');
    expect(employeeService.listActiveAttendants).toHaveBeenCalledOnce();
  });

  it('não disponibiliza multa no seletor de status', () => {
    expect(component.paymentStatusKeys).not.toContain(PaymentStatus.MULTA);
    expect(component.paymentStatusKeys).not.toContain(PaymentStatus.CANCELLED);
  });

  it('usa dinheiro como forma padrão da primeira parcela', () => {
    component.contract.itens = [
      {
        codigo: '10',
        descricao: 'Terno',
        valor: 150,
        entregue: false,
        attendantEmployeeId: 'employee-1',
        sub: [],
      },
    ];

    component.openPaymentModal();

    expect(component.paymentModalForma).toBe(PaymentMethod.CASH);
  });

  it('exibe erro e limpa opções quando a lista falha', () => {
    employeeService.listActiveAttendants.mockReturnValue(
      throwError(() => new Error('API indisponível')),
    );

    component.ngOnInit();
    component.openItemModal();

    expect(component.activeAttendants).toEqual([]);
    expect(component.attendantsError).toBe('API indisponível');
    expect(component.attendantsLoading).toBe(false);
  });

  it('atualiza título da aba com legacyId do contrato', () => {
    component.contract.legacyId = '2024-001';
    (component as any).updateTabTitle();

    expect(tabServiceMock.updateTitle).toHaveBeenCalledWith(
      expect.stringContaining('/rental/new'),
      'Contrato 2024-001',
    );
  });

  it('mantém título genérico quando contrato não tem legacyId', () => {
    component.contract.legacyId = undefined;
    (component as any).updateTabTitle();

    expect(tabServiceMock.updateTitle).toHaveBeenCalledWith(
      expect.stringContaining('/rental/new'),
      'Nova Locação',
    );
  });

  // ── Reservas do item ──

  it('abre o modal de reservas quando o item já está reservado em outro contrato', () => {
    rentalContractService.itemReservations = [itemReservation];
    productService.getRentalItemByLegacyId.mockReturnValue(of(rentalItemResult));

    component.openItemModal();
    component.itemModalCode = '001';
    component.searchItemByCode();

    expect(rentalContractService.reservationCalls).toEqual([
      { rentalItemId: 'item-uuid-1', excludeContractId: undefined },
    ]);
    expect(component.showReservationsModal).toBe(true);
    expect(component.itemReservations).toHaveLength(1);
    expect(component.itemReservations[0].customerName).toBe('Ana Lima');
  });

  it('não abre o modal de reservas quando o item não tem reservas', () => {
    productService.getRentalItemByLegacyId.mockReturnValue(of(rentalItemResult));

    component.openItemModal();
    component.itemModalCode = '001';
    component.searchItemByCode();

    expect(rentalContractService.reservationCalls).toHaveLength(1);
    expect(component.showReservationsModal).toBe(false);
  });

  it('exclui o contrato em edição da consulta de reservas', () => {
    component.contractId = 'contract-em-edicao';
    productService.getRentalItemByLegacyId.mockReturnValue(of(rentalItemResult));

    component.itemModalCode = '001';
    component.searchItemByCode();

    expect(rentalContractService.reservationCalls).toEqual([
      { rentalItemId: 'item-uuid-1', excludeContractId: 'contract-em-edicao' },
    ]);
  });

  it('consulta reservas ao editar item vinculado ao catálogo', () => {
    component.contract.itens = [
      {
        codigo: '10',
        descricao: 'Terno',
        valor: 150,
        entregue: false,
        attendantEmployeeId: 'employee-1',
        sub: [],
      },
    ];
    component['itemRentalIds'].set('10', 'item-uuid-1');

    component.openEditItemModal(0);

    expect(rentalContractService.reservationCalls).toEqual([
      { rentalItemId: 'item-uuid-1', excludeContractId: undefined },
    ]);
  });

  it('abre o contrato da reserva em outra aba ao clicar em Abrir', () => {
    component.openReservationContract(itemReservation);

    expect(tabServiceMock.open).toHaveBeenCalledWith(
      '/rental/new',
      'Contrato 251006-1',
      'rental',
      'contract-uuid-1',
      { id: 'contract-uuid-1' },
    );
  });
});

describe('Home last contract link', () => {
  let queryParams$: BehaviorSubject<Record<string, string>>;
  let rentalContractService: { getById: ReturnType<typeof vi.fn> };
  let tabServiceMock: {
    open: ReturnType<typeof vi.fn>;
    closeActiveIf: ReturnType<typeof vi.fn>;
    getTabId: ReturnType<typeof vi.fn>;
    updateTitle: ReturnType<typeof vi.fn>;
  };
  let component: NewRental;

  const buildContractResponse = (id: string, legacyId: string): IRentalContractResponse => ({
    id,
    legacyId,
    status: 0,
    statusDescription: 'Rascunho',
    isReturned: false,
    contractType: 1,
    customerId: 'customer-1',
    customerName: 'João Silva',
    customerDocument: '12345678901',
    pickupDate: '2024-01-01',
    eventDate: '2024-01-05',
    returnDate: '2024-01-10',
    totalValue: 100,
    paidValue: 0,
    remainingValue: 100,
    items: [],
    payments: [],
    createdAt: '2024-01-01T00:00:00Z',
  });

  beforeEach(() => {
    queryParams$ = new BehaviorSubject<Record<string, string>>({});
    rentalContractService = { getById: vi.fn() };
    tabServiceMock = {
      open: vi.fn(),
      closeActiveIf: vi.fn(),
      getTabId: vi.fn((path, draftId) => `${path}::${draftId}`),
      updateTitle: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParams: {} }, queryParams: queryParams$.asObservable() },
        },
        {
          provide: EmployeeService,
          useValue: { listActiveAttendants: vi.fn().mockReturnValue(of([])) },
        },
        { provide: CustomerService, useValue: {} },
        { provide: ProductService, useValue: {} },
        {
          provide: HolidayService,
          useValue: { getHolidays: vi.fn().mockReturnValue(of(new Set<string>())) },
        },
        { provide: RentalContractService, useValue: rentalContractService },
        { provide: PrintTemplateStorageService, useValue: new FakePrintTemplateStorage() },
        {
          provide: AutosaveService,
          useValue: { status$: of('idle'), lastError: null, reset: vi.fn() },
        },
        {
          provide: SessionFormStorageService,
          useValue: {
            saveDraft: vi.fn(),
            loadDraft: vi.fn().mockReturnValue(null),
            clearDraft: vi.fn(),
          },
        },
        { provide: TabService, useValue: tabServiceMock },
        {
          provide: TerminalOperatorService,
          useValue: { authorize: vi.fn(), currentOperator: vi.fn().mockReturnValue(null) },
        },
        {
          provide: APP_CONFIG,
          useValue: { appName: 'RentAFit Test', apiBaseUrl: '', s3BucketUrl: '' },
        },
      ],
    });

    vi.useFakeTimers({ shouldAdvanceTime: true });
    component = TestBed.runInInjectionContext(() => new NewRental());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('carrega contrato quando queryParam id é emitido após inicialização', () => {
    const response = {
      ...buildContractResponse('contract-1', '2024-001'),
      printTemplateId: DEFAULT_RENTAL_CONTRACT_TEMPLATE.id,
    };
    rentalContractService.getById.mockReturnValue(of(response));

    component.ngOnInit();

    queryParams$.next({ id: 'contract-1' });

    expect(rentalContractService.getById).toHaveBeenCalledWith('contract-1');
    expect(component.contractId).toBe('contract-1');
    expect(component.contractPrintTemplateId).toBe(DEFAULT_RENTAL_CONTRACT_TEMPLATE.id);
    expect(component.contract.clienteNome).toBe('João Silva');
    expect(tabServiceMock.updateTitle).toHaveBeenCalledWith(
      expect.stringContaining('/rental/new'),
      'Contrato 2024-001',
    );
  });

  it('carrega outro contrato quando queryParam id muda', () => {
    rentalContractService.getById
      .mockReturnValueOnce(of(buildContractResponse('contract-1', '2024-001')))
      .mockReturnValueOnce(of(buildContractResponse('contract-2', '2024-002')));

    component.ngOnInit();
    queryParams$.next({ id: 'contract-1' });
    queryParams$.next({ id: 'contract-2' });

    expect(rentalContractService.getById).toHaveBeenCalledTimes(2);
    expect(component.contractId).toBe('contract-2');
    expect(component.contract.clienteNome).toBe('João Silva');
  });
});
