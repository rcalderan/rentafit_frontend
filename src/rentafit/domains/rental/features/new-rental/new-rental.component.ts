import { RentalDraftSnapshot } from '../../data/rental-draft-snapshot';
import { copyUnsavedRentalProposal } from '../../service/rental-proposal-copy';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { from, forkJoin, Observable, Subject, Subscription, throwError } from 'rxjs';
import { distinctUntilChanged, finalize, map, switchMap, takeUntil } from 'rxjs/operators';
import { CustomerService } from '../../../customer/service/customer.service';
import { ICustomer } from '../../../customer/data/Customer.interface';
import { IActiveAttendant } from '../../../admin/data/employee.interface';
import { EmployeeService } from '../../../admin/service/employee.service';
import { ProductService } from '../../../product/service/product.service';
import { HolidayService } from '../../../../shared/services/holiday.service';
import { ContractStatus } from '../../data/contract-status.enum';
import { IItemMeta } from '../../data/item-meta.interface';
import { PaymentMethod, PAYMENT_METHOD_LABELS } from '../../data/payment-method.enum';
import { PaymentStatus } from '../../data/payment-status.enum';
import { IProductCatalog } from '../../data/product-catalog.interface';
import {
  IItemMetaRequest,
  IRentalContractCreateRequest,
  IRentalContractItemRequest,
  IRentalContractSignRequest,
  IRentalPaymentRequest,
} from '../../data/rental-contract-request.interface';
import { IRentalContractResponse } from '../../data/rental-contract-response.interface';
import { IRentalContractItem } from '../../data/rental-contract-item.interface';
import { INewRentalContract } from '../../data/rental-contract.interface';
import { IRentalPayment } from '../../data/rental-payment.interface';
import { ContractStatusApi, PaymentMethodApi, PaymentStatusApi } from '../../data/rental-api.types';
import { TerminalOperatorService } from '../../../auth/services/terminal-operator.service';
import { RentalContractService } from '../../service/rental-contract.service';
import { AutosaveService, AutosaveStatus } from '../../service/autosave.service';
import { NfseEmissionComponent } from '../../../finance/features/nfse-emission/nfse-emission.component';
import { SessionFormStorageService } from '../../../../shared/services/session-form-storage.service';
import { TabService } from '../../../../shared/services/tab.service';
import { IFiscalContext, IFiscalDocument } from '../../../finance/data/fiscal-document.types';
import {
  DEFAULT_MOCK_CONTEXT,
  InterpolationContext,
} from '../../../print/services/template-interpolation.service';
import { PrintPreviewModalComponent } from '../../../print/components/print-preview-modal/print-preview-modal.component';
import { PrintTemplateStorageService } from '../../../print/services/print-template-storage.service';

export { ContractStatus, PaymentMethod, PaymentStatus };
export type { IItemMeta, INewRentalContract, IProductCatalog, IRentalContractItem, IRentalPayment };

// ==================== Component ====================

@Component({
  selector: 'rentafit-new-rental',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NfseEmissionComponent, PrintPreviewModalComponent],
  templateUrl: './new-rental.component.html',
  styleUrls: ['./new-rental.component.css'],
  providers: [AutosaveService],
})
export class NewRental implements OnInit, AfterViewInit, OnDestroy {
  private readonly contractLookupInput =
    viewChild<ElementRef<HTMLInputElement>>('contractLookupInput');
  private readonly itemCodeInput = viewChild<ElementRef<HTMLInputElement>>('itemCodeInput');
  private readonly paymentValorInput = viewChild<ElementRef<HTMLInputElement>>('paymentValorInput');

  // Expose enums to template
  ContractStatus = ContractStatus;
  PaymentStatus = PaymentStatus;
  PaymentMethod = PaymentMethod;
  get paymentMethodLabels(): Record<PaymentMethod, string> {
    return PAYMENT_METHOD_LABELS;
  }
  paymentMethodKeys = Object.values(PaymentMethod).filter(
    (v) => typeof v === 'number',
  ) as PaymentMethod[];
  paymentStatusLabels: Record<PaymentStatus, string> = {
    [PaymentStatus.PENDING]: 'Pendente',
    [PaymentStatus.PAID]: 'Pago',
    [PaymentStatus.CANCELLED]: 'Cancelado',
    [PaymentStatus.MULTA]: 'Multa',
  };
  // CANCELLED is set only via chargeBack; MULTA remains unavailable until its workflow is implemented.
  paymentStatusKeys = Object.values(PaymentStatus).filter(
    (v) => typeof v === 'number' && v !== PaymentStatus.CANCELLED && v !== PaymentStatus.MULTA,
  ) as PaymentStatus[];

  // ── Services ──
  private readonly view = inject(ChangeDetectorRef, { optional: true });
  private readonly holidayService = inject(HolidayService);
  private readonly customerService = inject(CustomerService);
  private readonly employeeService = inject(EmployeeService);
  protected readonly operatorService = inject(TerminalOperatorService);
  private readonly productService = inject(ProductService);
  private readonly rentalContractService = inject(RentalContractService);
  private readonly printTemplateStorage = inject(PrintTemplateStorageService);
  private readonly autosaveService = inject(
    AutosaveService<IRentalContractCreateRequest, IRentalContractResponse>,
  );
  private readonly formStorage = inject(SessionFormStorageService);
  private readonly tabService = inject(TabService);
  private readonly route = inject(ActivatedRoute);
  private readonly formType = 'rental-contract';
  private draftId = this.generateDraftId();

  // ── Autosave ──
  autosaveStatus: AutosaveStatus = 'idle';
  autosaveError: string | null = null;
  /** Employee ID captured during the first manual save; reused for autosave requests. */
  private autosaveEmployeeId: string | null = null;
  private autosaveSubscription?: Subscription;
  private destroy$ = new Subject<void>();
  private readonly draftChanged$ = new Subject<void>();

  // ── Enum → API string maps (used by buildPaymentRequest & buildCreateRequest) ──
  private readonly METHOD_MAP: Record<PaymentMethod, PaymentMethodApi> = {
    [PaymentMethod.CASH]: 'CASH',
    [PaymentMethod.PIX]: 'PIX',
    [PaymentMethod.CREDIT_CARD]: 'CREDIT_CARD',
    [PaymentMethod.DEBIT_CARD]: 'DEBIT_CARD',
    [PaymentMethod.BANK_TRANSFER]: 'BANK_TRANSFER',
  };

  private readonly STATUS_MAP: Record<PaymentStatus, PaymentStatusApi> = {
    [PaymentStatus.PENDING]: 'PENDING',
    [PaymentStatus.PAID]: 'PAID',
    [PaymentStatus.CANCELLED]: 'CANCELLED',
    [PaymentStatus.MULTA]: 'MULTA',
  };

  // ── Backend contract state ──
  /** UUID of the contract saved on the backend; null until first save. */
  contractId: string | null = null;
  contractPrintTemplateId: string | null = null;
  contractLoaded = false;
  readonly showPrintConfirmation = signal(false);
  readonly showContractPrintModal = signal(false);
  readonly isPreparingContractPrint = signal(false);
  readonly contractPrintData = signal<Partial<InterpolationContext> | null>(null);
  contractLookupLegacyId = '';
  contractLookupLoading = false;
  contractLookupError = '';
  isSaving = false;
  serverError = '';
  serverWarnings: string[] = [];

  /** UUID of the contract that originated this one (REVISION → original SIGNED). */
  parentContractId: string | null = null;
  /** UUID of the revision contract created from this one. */
  replacedByContractId: string | null = null;
  protected readonly revisionAudit = signal('');

  // ── Operator identification (via TerminalOperatorService + janela de PIN) ──
  /** Employee ID autorizado pela última confirmação de PIN, usado na requisição seguinte. */
  private pendingPaymentEmployeeId: string | null = null;
  /** Index of the payment pending chargeBack confirmation. */
  private pendingChargeBackIndex: number | null = null;

  // ── Customer ──
  customerFound = false;
  customerSearchQuery = '';
  customerUuid: string | null = null;
  private selectedCustomerDetails: ICustomer | null = null;
  customerLoading = false;
  customerError = '';

  // ── Contract ──
  contract: INewRentalContract = this.createEmptyContract();

  // ── Totals ──
  subtotal = 0;
  discount = 0;
  total = 0;
  totalPaid = 0;

  // ── Item modal ──
  showItemModal = false;
  itemModalCode = '';
  itemModalName = '';
  itemModalMeta = ''; // e.g. "TAM: 42 | COR: PRETO"
  itemModalValor = 0;
  itemModalEmployee = '';
  activeAttendants: IActiveAttendant[] = [];
  attendantsLoading = false;
  attendantsError = '';
  itemModalExtras: IItemMeta[] = [];
  itemModalNewExtraType: 'acessorio' | 'observacao' = 'observacao';
  itemModalNewExtraDesc = '';
  itemModalFoundProduct: IProductCatalog | null = null;
  /** UUID of the rental item found by ProductService. */
  itemModalFoundProductUuid: string | null = null;
  itemModalError = '';
  itemSearchLoading = false;

  /** Maps item legacyCode → rental item UUID from the backend. */
  private itemRentalIds = new Map<string, string>();

  // ── Payment modal ──
  showPaymentModal = false;
  paymentModalForma: PaymentMethod = PaymentMethod.CASH;
  paymentModalValor = 0;
  paymentModalData = '';
  paymentModalStatus: PaymentStatus = PaymentStatus.PENDING;
  paymentModalError = '';

  editingItemIndex: number | null = null;
  editingPaymentIndex: number | null = null;

  // ── Holidays: populated async from HolidayService on init ──
  private holidays = new Set<string>();

  ngAfterViewInit(): void {
    setTimeout(() => this.contractLookupInput()?.nativeElement.focus(), 0);
  }

  ngOnInit(): void {
    this.route.queryParams
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged((a, b) => a['draftId'] === b['draftId'] && a['id'] === b['id']),
      )
      .subscribe((params) => {
        const newDraftId = params['draftId'];
        const newId = params['id'];

        if (newDraftId && newDraftId !== this.draftId) {
          if (this.contractLoaded) this.persistDraft();
          this.clearProposal();
          this.draftId = newDraftId;
          this.contract = this.createEmptyContract();
          if (newId && !this.restoreDraft(newId)) {
            this.loadContractById(newId);
          } else {
            if (!newId) this.restoreDraft();
            this.updateTabTitle();
          }
          return;
        }

        if (newId && newId !== this.contractId) {
          this.contract = this.createEmptyContract();
          this.loadContractById(newId);
          return;
        }

        if (!newId && !newDraftId) {
          this.restoreDraft();
          this.updateTabTitle();
        }
      });

    this.loadActiveAttendants();
    // Subscribe to autosave status changes for UI feedback
    this.autosaveSubscription = this.autosaveService.status$.subscribe((status) => {
      this.autosaveStatus = status;
      this.autosaveError = this.autosaveService.lastError;
      this.view?.markForCheck();
    });

    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];
    forkJoin(years.map((y) => this.holidayService.getHolidays(y))).subscribe({
      next: (sets) => {
        sets.forEach((set) => set.forEach((d) => this.holidays.add(d)));
        this.autoFillDates();
        this.persistDraftAfterRestore();
      },
      // Silent failure: emergency cache already applied inside the service;
      // autoFillDates still runs so the form isn't stuck.
      error: () => {
        this.autoFillDates();
        this.persistDraftAfterRestore();
      },
    });

    this.draftInterval = setInterval(() => this.persistDraft(), 3000);
  }

  private refreshView(complete: () => void): () => void {
    return () => {
      complete();
      this.view?.markForCheck();
    };
  }

  private generateDraftId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private createDraftSnapshot(): RentalDraftSnapshot {
    return {
      contract: structuredClone(this.contract),
      itemRentalIds: [...this.itemRentalIds],
      contractLoaded: this.contractLoaded,
      contractPrintTemplateId: this.contractPrintTemplateId,
      fiscalDocument: this.fiscalDocument,
      revisionAudit: this.revisionAudit(),
      customerUuid: this.customerUuid,
      customerFound: this.customerFound,
      customerSearchQuery: this.customerSearchQuery,
      contractLookupLegacyId: this.contractLookupLegacyId,
      contractId: this.contractId,
      parentContractId: this.parentContractId,
      replacedByContractId: this.replacedByContractId,
      autosaveEmployeeId: this.autosaveEmployeeId,
    };
  }

  private applyDraftSnapshot(draft: RentalDraftSnapshot): void {
    if (!draft || typeof draft !== 'object') return;
    this.itemRentalIds = new Map(draft.itemRentalIds ?? []);
    this.contractLoaded = draft.contractLoaded ?? !!draft.contractId;
    this.contractPrintTemplateId = draft.contractPrintTemplateId ?? null;
    this.fiscalDocument = draft.fiscalDocument ?? null;
    this.revisionAudit.set(draft.revisionAudit ?? '');
    if (draft.contract) this.contract = { ...this.createEmptyContract(), ...draft.contract };
    if (draft.customerUuid !== undefined) this.customerUuid = draft.customerUuid;
    if (draft.customerFound !== undefined) this.customerFound = draft.customerFound;
    if (draft.customerSearchQuery !== undefined)
      this.customerSearchQuery = draft.customerSearchQuery;
    if (draft.contractLookupLegacyId !== undefined)
      this.contractLookupLegacyId = draft.contractLookupLegacyId;
    if (draft.contractId !== undefined) this.contractId = draft.contractId;
    if (draft.parentContractId !== undefined) this.parentContractId = draft.parentContractId;
    if (draft.replacedByContractId !== undefined)
      this.replacedByContractId = draft.replacedByContractId;
    if (draft.autosaveEmployeeId !== undefined) this.autosaveEmployeeId = draft.autosaveEmployeeId;
  }

  private updateTabTitle(): void {
    const label = this.contract?.legacyId ? `Contrato ${this.contract.legacyId}` : 'Nova Locação';
    const tabId = this.tabService.getTabId('/rental/new', this.draftId);
    this.tabService.updateTitle(tabId, label);
  }

  private persistDraft(): void {
    this.formStorage.saveDraft(this.formType, this.draftId, this.createDraftSnapshot());
  }

  private restoreDraft(requestedId?: string): boolean {
    const draft = this.formStorage.loadDraft<RentalDraftSnapshot>(this.formType, this.draftId);
    if (
      !draft ||
      (requestedId && draft.contractId !== requestedId && draft.parentContractId !== requestedId)
    )
      return false;
    this.applyDraftSnapshot(draft);
    this.recalculate();
    return true;
  }

  /** Persist the draft once after holidays/dates are resolved so the snapshot is fresh. */
  private persistDraftAfterRestore(): void {
    this.view?.markForCheck();
    this.persistDraft();
  }

  ngOnDestroy(): void {
    this.autosaveSubscription?.unsubscribe();
    if (this.draftInterval) {
      clearInterval(this.draftInterval);
      this.draftInterval = null;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  private draftInterval: ReturnType<typeof setInterval> | null = null;

  // ==================== Helpers ====================

  toDateString(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  parseDate(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  isHoliday(d: Date): boolean {
    return this.holidays.has(this.toDateString(d));
  }

  isWeekend(d: Date): boolean {
    return d.getDay() === 0 || d.getDay() === 6;
  }

  isBusinessDay(d: Date): boolean {
    return !this.isWeekend(d) && !this.isHoliday(d);
  }

  /** Advance date forward until it's a business day */
  nextBusinessDayFrom(d: Date): Date {
    const r = new Date(d);
    while (!this.isBusinessDay(r)) {
      r.setDate(r.getDate() + 1);
    }
    return r;
  }

  /** Go back N business days from d (exclusive) */
  prevBusinessDays(from: Date, n: number): Date {
    const r = new Date(from);
    let count = 0;
    while (count < n) {
      r.setDate(r.getDate() - 1);
      if (this.isBusinessDay(r)) count++;
    }
    return r;
  }

  /** Next Saturday from today (or today if Saturday) */
  getNextSaturday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0=Sun,6=Sat
    const daysUntilSat = day === 6 ? 7 : 6 - day;
    d.setDate(d.getDate() + daysUntilSat);
    return d;
  }

  // ==================== Date auto-fill ====================

  autoFillDates(): void {
    if (this.contract.usa || this.contract.retirada || this.contract.devolucao) return;
    const uso = this.getNextSaturday();

    // Devolução: next business day (Monday or later, skip holidays)
    const rawDevolucao = new Date(uso);
    rawDevolucao.setDate(rawDevolucao.getDate() + 2); // Monday
    const devolucao = this.nextBusinessDayFrom(rawDevolucao);

    // Retirada: 2 business days before uso (Thursday or earlier, skip holidays)
    const retirada = this.prevBusinessDays(uso, 2);

    this.contract.usa = this.toDateString(uso);
    this.contract.devolucao = this.toDateString(devolucao);
    this.contract.retirada = this.toDateString(retirada);
  }

  onUsoDateChange(): void {
    this.activateStepperMode();
    if (!this.contract.usa) return;
    const uso = this.parseDate(this.contract.usa);

    const rawDevolucao = new Date(uso);
    rawDevolucao.setDate(rawDevolucao.getDate() + 2);
    const devolucao = this.nextBusinessDayFrom(rawDevolucao);

    const retirada = this.prevBusinessDays(uso, 2);

    this.contract.devolucao = this.toDateString(devolucao);
    this.contract.retirada = this.toDateString(retirada);
    this.triggerAutosave();
  }

  onRetiradaChange(): void {
    this.activateStepperMode();
    if (!this.contract.retirada) return;
    const d = this.parseDate(this.contract.retirada);
    const adjusted = this.nextBusinessDayFrom(d);
    this.contract.retirada = this.toDateString(adjusted);
    this.triggerAutosave();
  }

  onDevolucaoChange(): void {
    this.activateStepperMode();
    if (!this.contract.devolucao) return;
    const d = this.parseDate(this.contract.devolucao);
    const adjusted = this.nextBusinessDayFrom(d);
    this.contract.devolucao = this.toDateString(adjusted);
    this.triggerAutosave();
  }

  // ==================== Customer ====================

  loadContractByLegacyId(): void {
    const legacyId = this.contractLookupLegacyId.trim();

    this.contractLookupLoading = true;
    this.contractLookupError = '';
    this.serverError = '';
    this.serverWarnings = [];

    this.rentalContractService
      .getByLegacyId(legacyId)
      .pipe(
        takeUntil(this.draftChanged$),
        takeUntil(this.destroy$),
        finalize(this.refreshView(() => (this.contractLookupLoading = false))),
      )
      .subscribe({
        next: (response) => {
          this.mapResponseToContract(response);
          this.contractLoaded = true;
        },
        error: (err: unknown) => {
          this.contractLookupError =
            err instanceof Error ? err.message : 'Contrato não encontrado.';
        },
      });
  }

  searchCustomer(): void {
    if (!this.canChangeCustomer()) return;
    const query = this.customerSearchQuery.trim();
    if (!query) return;

    this.customerLoading = true;
    this.customerError = '';

    const isNumeric = /^\d+$/.test(query) && query.length <= 9; // legacy IDs are short numbers
    const obs = isNumeric
      ? this.customerService.getCustomerByLegacyId(+query)
      : this.customerService.getCustomerByDocument(query);

    obs.pipe(finalize(this.refreshView(() => (this.customerLoading = false)))).subscribe({
      next: (customer) => {
        const previousCustomerUuid = this.customerUuid;
        this.customerUuid = customer.id ?? null;
        this.selectedCustomerDetails = customer;
        this.contract.clienteNome = customer.name;
        this.contract.clienteCpf = customer.document;
        this.contract.cliente = customer.legacyId ?? '';
        this.customerFound = true;
        this.customerError = '';
        // Autosave only when customer actually changed
        if (this.customerUuid !== previousCustomerUuid) {
          this.triggerAutosave();
        }
      },
      error: (err: Error) => {
        this.customerError = err.message || 'Cliente não encontrado.';
      },
    });
  }

  clearCustomer(): void {
    if (!this.canChangeCustomer()) return;
    this.activateStepperMode();
    this.customerFound = false;
    this.customerSearchQuery = '';
    this.customerUuid = null;
    this.selectedCustomerDetails = null;
    this.customerError = '';
    this.contract.clienteNome = '';
    this.contract.clienteCpf = '';
    this.contract.cliente = '';
  }

  // ==================== Item modal ====================

  openItemModal(): void {
    if (!this.isEditable()) return;
    this.openItemModalExecute();
  }

  private openItemModalExecute(): void {
    this.editingItemIndex = null;
    this.itemModalCode = '';
    this.itemModalName = '';
    this.itemModalMeta = '';
    this.itemModalValor = 0;
    this.itemModalEmployee = this.operatorService.currentOperator()?.employeeId ?? '';
    this.itemModalExtras = [];
    this.itemModalNewExtraDesc = '';
    this.itemModalFoundProduct = null;
    this.itemModalFoundProductUuid = null;
    this.itemModalError = '';
    this.showItemModal = true;
    setTimeout(() => this.itemCodeInput()?.nativeElement.focus(), 0);
  }

  private loadActiveAttendants(): void {
    this.attendantsLoading = true;
    this.attendantsError = '';
    this.employeeService
      .listActiveAttendants()
      .pipe(finalize(this.refreshView(() => (this.attendantsLoading = false))))
      .subscribe({
        next: (attendants) => {
          const roles = new Set(['EMPLOYEE', 'MANAGER', 'ADMIN']);
          this.activeAttendants = attendants.filter((attendant) => roles.has(attendant.role));
        },
        error: (error: Error) => {
          this.activeAttendants = [];
          this.attendantsError = error.message || 'Não foi possível carregar os atendentes ativos.';
        },
      });
  }

  openEditItemModal(index: number): void {
    const item = this.contract.itens[index];
    if (!item) return;
    this.editingItemIndex = index;
    this.itemModalCode = item.codigo;
    this.itemModalName = item.descricao;
    this.itemModalValor = item.valor;
    this.itemModalMeta = '';
    this.itemModalEmployee = item.attendantEmployeeId;
    this.itemModalExtras = [...item.sub];
    this.itemModalFoundProduct = { nome: item.descricao } as any;
    this.itemModalNewExtraDesc = '';
    this.itemModalNewExtraType = 'observacao';
    this.itemModalError = '';
    this.showItemModal = true;
    setTimeout(() => this.itemCodeInput()?.nativeElement.focus(), 0);
  }

  closeItemModal(): void {
    this.showItemModal = false;
  }

  searchItemByCode(): void {
    const code = this.itemModalCode.trim();
    if (!code) return;

    this.itemSearchLoading = true;
    this.itemModalError = '';
    this.itemModalFoundProduct = null;
    this.itemModalFoundProductUuid = null;

    this.productService
      .getRentalItemByLegacyId(code)
      .pipe(finalize(this.refreshView(() => (this.itemSearchLoading = false))))
      .subscribe({
        next: (item) => {
          this.itemModalFoundProductUuid = item.id ?? null;
          this.itemModalFoundProduct = {
            _id: parseInt(item.legacyId ?? '0', 10),
            nome: item.name,
            locado: false,
            obs: item.notes ?? '',
            valor: item.value,
            tamanho: item.size ?? '',
            nloc: 0,
            no_estoque: true,
            cor: item.color ?? '',
            base: item.value,
            ajuste: 0,
            data: '',
            preco_id: 0,
            status: 1,
            tipo: 1,
          };
          this.itemModalName = item.name;
          this.itemModalMeta = [
            item.size ? `TAM: ${item.size}` : null,
            item.color ? `COR: ${item.color}` : null,
          ]
            .filter(Boolean)
            .join(' | ');
          this.itemModalValor = item.value;
        },
        error: (err: Error) => {
          this.itemModalError = err.message || 'Produto não encontrado.';
        },
      });
  }

  addItemModalExtra(): void {
    if (!this.itemModalNewExtraDesc.trim()) return;
    this.itemModalExtras.push({
      tipo: this.itemModalNewExtraType,
      descricao: this.itemModalNewExtraDesc.trim(),
    });
    this.itemModalNewExtraDesc = '';
  }

  removeItemModalExtra(i: number): void {
    this.itemModalExtras.splice(i, 1);
  }

  confirmAddItem(): void {
    if (this.editingItemIndex === null && (!this.itemModalFoundProduct || !this.itemModalEmployee))
      return;
    if (!this.isEditable()) return;
    const item: IRentalContractItem = {
      codigo: this.itemModalCode,
      descricao: this.itemModalName,
      valor: this.itemModalValor,
      entregue: false,
      attendantEmployeeId: this.itemModalEmployee,
      sub: [
        ...(this.itemModalMeta
          ? [{ tipo: 'observacao' as const, descricao: this.itemModalMeta }]
          : []),
        ...this.itemModalExtras,
      ],
    };
    if (this.editingItemIndex !== null) {
      this.contract.itens[this.editingItemIndex] = item;
    } else {
      this.contract.itens.push(item);
      if (this.itemModalFoundProductUuid) {
        this.itemRentalIds.set(this.itemModalCode, this.itemModalFoundProductUuid);
      }
    }
    this.activateStepperMode();
    this.recalculate();
    this.closeItemModal();
    this.triggerAutosave();
  }

  removeItem(index: number): void {
    if (!this.isEditable()) return;
    this.activateStepperMode();
    const removed = this.contract.itens.splice(index, 1)[0];
    if (removed) this.itemRentalIds.delete(removed.codigo);
    this.recalculate();
    this.triggerAutosave();
  }

  // ==================== Payment modal ====================

  get canAddPayment(): boolean {
    return (
      this.contract.situacao !== ContractStatus.SUPERSEDED &&
      this.contract.situacao !== ContractStatus.CLOSED &&
      this.contract.itens.length > 0
    );
  }

  get nextParcela(): number {
    return Math.max(0, ...this.contract.pagamentos.map((payment) => payment.parcela)) + 1;
  }

  get remainingAmount(): number {
    return Math.max(0, this.total - this.totalPaid);
  }

  /** Total of all planned parcelas (regardless of payment status) */
  get totalPlanned(): number {
    return this.contract.pagamentos
      .filter((payment) => payment.status !== PaymentStatus.CANCELLED)
      .reduce((sum, payment) => sum + payment.valor, 0);
  }

  /** Amount not yet covered by any parcela */
  get unplannedAmount(): number {
    return Math.max(0, this.total - this.totalPlanned);
  }

  // ── NFS-e (documento fiscal de serviço) ──

  /** Documento fiscal mantido em sessão (fase mockada). */
  fiscalDocument: IFiscalDocument | null = null;

  /** Contexto repassado ao componente de emissão de NFS-e. */
  get fiscalContext(): IFiscalContext {
    return {
      origin: 'RENTAL',
      originId: this.contractId ?? undefined,
      isPaid: this.total > 0 && this.remainingAmount === 0,
      totalValue: this.total,
      customerId: this.customerUuid ?? undefined,
      customerName: this.contract.clienteNome,
      customerDocument: this.contract.clienteCpf,
      customerEmail: this.fiscalDocument?.customerEmail,
    };
  }

  onInvoiceChanged(doc: IFiscalDocument): void {
    this.fiscalDocument = doc;
  }

  openPaymentModal(): void {
    if (!this.canAddPayment) return;
    this.editingPaymentIndex = null;
    const prev = this.contract.pagamentos.at(-1);
    this.paymentModalForma = prev ? prev.forma : PaymentMethod.CASH;
    this.paymentModalValor = this.unplannedAmount;
    if (prev) {
      const d = new Date(prev.data + 'T12:00:00');
      d.setMonth(d.getMonth() + 1);
      const nextMonthStr = this.toDateString(d);
      const retiradaDate = this.contract.retirada;
      this.paymentModalData =
        retiradaDate && nextMonthStr > retiradaDate ? retiradaDate : nextMonthStr;
    } else {
      this.paymentModalData = this.toDateString(new Date());
    }
    this.paymentModalError = '';
    this.showPaymentModal = true;
    setTimeout(() => this.paymentValorInput()?.nativeElement.focus(), 0);
  }

  openEditPaymentModal(index: number): void {
    const p = this.contract.pagamentos[index];
    if (!p) return;
    // CANCELLED is irreversible — block modal entirely
    if (p.status === PaymentStatus.CANCELLED) return;
    if (this.contract.situacao > 0 && p.status !== PaymentStatus.PENDING) return;
    this.editingPaymentIndex = index;
    this.paymentModalForma = p.forma;
    this.paymentModalValor = p.valor;
    this.paymentModalData = p.data;
    this.paymentModalStatus = p.status;
    this.paymentModalError = '';
    this.showPaymentModal = true;
    setTimeout(() => this.paymentValorInput()?.nativeElement.focus(), 0);
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
  }

  submitPaymentModal(): void {
    if (this.editingPaymentIndex !== null) {
      this.confirmAddPayment();
    } else {
      this.dividePayment();
    }
  }

  confirmAddPayment(): void {
    if (
      this.contract.situacao === ContractStatus.REVISION &&
      this.paymentModalStatus !== PaymentStatus.PENDING
    ) {
      this.paymentModalError =
        'Alteração de contrato preserva o valor pago; esperado status Pendente.';
      return;
    }
    // Only used in edit mode now
    this.paymentModalError = '';

    const isEditing = this.editingPaymentIndex !== null;
    const existingPayment = isEditing ? this.contract.pagamentos[this.editingPaymentIndex!] : null;

    // Require employee identification when an action will be persisted to the backend:
    // - contract is SIGNED (any edit on an existing backend payment), OR
    // - payment is being marked as PAID on an existing backend payment (has a backend id)
    if (
      (this.contract.situacao === ContractStatus.SIGNED ||
        (this.paymentModalStatus === PaymentStatus.PAID && existingPayment?.id != null)) &&
      this.pendingPaymentEmployeeId === null
    ) {
      const title =
        this.paymentModalStatus === PaymentStatus.PAID
          ? 'Identificar Usuário — Registrar Pagamento'
          : 'Identificar Usuário — Editar Parcela';
      this.operatorService.authorize({ title, requirePin: true }).subscribe((op) => {
        if (!op) return;
        this.pendingPaymentEmployeeId = op.employeeId;
        this.confirmAddPayment();
      });
      return;
    }
    if (!isEditing) return;
    const currentVal = this.contract.pagamentos[this.editingPaymentIndex!].valor;
    const maxAllowed = this.unplannedAmount + currentVal;

    if (this.paymentModalValor <= 0) {
      this.paymentModalError = 'Valor deve ser maior que zero.';
      return;
    }
    if (this.paymentModalValor > maxAllowed + 0.001) {
      this.paymentModalError = `Valor supera o saldo de R$ ${maxAllowed.toFixed(2).replace('.', ',')}.`;
      return;
    }
    if (this.contract.usa && this.paymentModalData > this.contract.usa) {
      this.paymentModalError = 'Data não pode ser posterior à data de uso.';
      return;
    }

    const existing = this.contract.pagamentos[this.editingPaymentIndex!];
    const isReducingPersistedInstallment =
      !!existing.id && this.paymentModalValor < existing.valor - 0.001;

    if (isReducingPersistedInstallment) {
      const confirmed = window.confirm(
        'A redução do valor desta parcela pode gerar uma parcela compensatória automática. Deseja continuar?',
      );
      if (!confirmed) {
        return;
      }
    }

    const payment: IRentalPayment = {
      id: existing.id,
      parcela: existing.parcela,
      data: this.paymentModalData,
      forma: this.paymentModalForma,
      valor: this.paymentModalValor,
      processedByEmployeeId: this.itemModalEmployee,
      vezes: 1,
      status: this.paymentModalStatus,
    };
    this.activateStepperMode();
    this.contract.pagamentos[this.editingPaymentIndex!] = payment;
    this.recalculate();
    this.closePaymentModal();

    if (this.contractId && this.contract.situacao !== ContractStatus.REVISION) {
      this.isSaving = true;
      this.serverError = '';
      const employeeId =
        this.pendingPaymentEmployeeId ??
        this.operatorService.currentOperator()?.employeeId ??
        this.itemModalEmployee ??
        '';
      this.pendingPaymentEmployeeId = null;
      const contractId = this.contractId;
      const request = this.buildPaymentRequest(payment, employeeId);

      const save$ = payment.id
        ? this.rentalContractService.updatePayment(contractId, payment.id, request)
        : this.rentalContractService.addPayment(contractId, request);

      save$.pipe(finalize(this.refreshView(() => (this.isSaving = false)))).subscribe({
        next: () => {
          this.loadContractById(contractId);
        },
        error: (err: Error) => {
          this.serverError = err.message || 'Erro ao salvar parcela.';
          this.loadContractById(contractId);
        },
      });
    } else {
      this.pendingPaymentEmployeeId = null;
      this.triggerAutosave();
    }
  }

  dividePayment(): void {
    this.paymentModalError = '';

    if (this.paymentModalValor <= 0) {
      this.paymentModalError = 'Valor deve ser maior que zero.';
      return;
    }

    // For SIGNED contracts: require employee identification before persisting to backend
    if (
      this.contractId &&
      this.contract.situacao === ContractStatus.SIGNED &&
      this.pendingPaymentEmployeeId === null
    ) {
      this.operatorService
        .authorize({ title: 'Identificar Usuário — Adicionar Parcela', requirePin: true })
        .subscribe((op) => {
          if (!op) return;
          this.pendingPaymentEmployeeId = op.employeeId;
          this.dividePayment();
        });
      return;
    }

    this.activateStepperMode();
    let remaining = this.unplannedAmount;
    if (remaining <= 0.001) {
      this.paymentModalError = 'Não há saldo a planejar.';
      return;
    }
    if (this.paymentModalValor > remaining + 0.001) {
      this.paymentModalError = `Valor supera o saldo restante de R$ ${remaining.toFixed(2).replace('.', ',')}.`;
      return;
    }

    const retiradaDate = this.contract.retirada;
    let currentDate = this.paymentModalData; // usa a data pré-calculada do modal

    while (remaining > 0.001) {
      if (this.contract.pagamentos.length >= 24 || this.nextParcela > 24) {
        this.paymentModalError = 'Limite de 24 parcelas atingido.';
        break;
      }
      const valor = parseFloat(Math.min(this.paymentModalValor, remaining).toFixed(2));
      this.contract.pagamentos.push({
        parcela: this.nextParcela,
        data: currentDate,
        forma: this.paymentModalForma,
        valor,
        vezes: 1,
        processedByEmployeeId: '',
        status: PaymentStatus.PENDING,
      });
      remaining = parseFloat((remaining - this.paymentModalValor).toFixed(2));

      // Avança um mês; se ultrapassar a retirada, usa a data de retirada
      const d = new Date(currentDate + 'T12:00:00');
      d.setMonth(d.getMonth() + 1);
      const nextMonthStr = this.toDateString(d);
      currentDate = retiradaDate && nextMonthStr > retiradaDate ? retiradaDate : nextMonthStr;
    }

    this.recalculate();
    this.closePaymentModal();

    if (this.serverError.includes('parcela')) {
      this.serverError = '';
    }

    // For SIGNED contracts: persist each new (unsaved) payment to backend
    if (this.contractId && this.contract.situacao === ContractStatus.SIGNED) {
      const employeeId =
        this.pendingPaymentEmployeeId ?? this.operatorService.currentOperator()?.employeeId ?? '';
      this.pendingPaymentEmployeeId = null;
      const contractId = this.contractId;
      const unsaved = this.contract.pagamentos.filter((p) => !p.id);
      if (unsaved.length > 0) {
        this.isSaving = true;
        this.serverError = '';
        forkJoin(
          unsaved.map((p) =>
            this.rentalContractService.addPayment(
              contractId,
              this.buildPaymentRequest(p, employeeId),
            ),
          ),
        )
          .pipe(finalize(this.refreshView(() => (this.isSaving = false))))
          .subscribe({
            next: () => this.loadContractById(contractId),
            error: (err: Error) => {
              this.serverError = err.message || 'Erro ao salvar parcelas.';
              this.loadContractById(contractId);
            },
          });
      }
    } else {
      this.pendingPaymentEmployeeId = null;
      this.triggerAutosave();
    }
  }

  removePayment(index: number): void {
    if (!this.isEditable() || this.contract.pagamentos[index]?.status === PaymentStatus.PAID)
      return;
    this.activateStepperMode();
    this.contract.pagamentos.splice(index, 1);
    if (this.contract.situacao !== ContractStatus.REVISION)
      this.contract.pagamentos.forEach((p, i) => (p.parcela = i + 1));
    this.recalculate();
    this.triggerAutosave();
  }

  togglePaymentStatus(index: number): void {
    if (!this.isEditable() || this.contract.situacao === ContractStatus.REVISION) return;
    const p = this.contract.pagamentos[index];
    if (!p) return;
    this.activateStepperMode();
    p.status = p.status === PaymentStatus.PAID ? PaymentStatus.PENDING : PaymentStatus.PAID;
    this.recalculate();
  }

  // ==================== ChargeBack (Extorno) ====================

  canChargeBack(index: number): boolean {
    const p = this.contract.pagamentos[index];
    return (
      !!p && p.status === PaymentStatus.PAID && this.contract.situacao === ContractStatus.SIGNED
    );
  }

  requestChargeBack(index: number): void {
    if (!this.canChargeBack(index)) return;
    const confirmed = window.confirm(
      'Tem certeza que deseja extornar esta parcela? Esta ação é irreversível.',
    );
    if (!confirmed) return;
    this.pendingChargeBackIndex = index;
    this.operatorService
      .authorize({ title: 'Autorizar Extorno de Parcela', requirePin: true })
      .subscribe((op) => {
        if (!op) return;
        this.executeChargeBack(op.employeeId);
      });
  }

  private executeChargeBack(employeeId: string): void {
    const index = this.pendingChargeBackIndex;
    this.pendingChargeBackIndex = null;
    if (index === null) return;

    const p = this.contract.pagamentos[index];
    if (!p) return;

    if (p.id && this.contractId) {
      // Persisted payment: call backend DELETE (cancelPayment)
      const contractId = this.contractId;
      this.isSaving = true;
      this.serverError = '';
      this.rentalContractService
        .cancelPayment(contractId, p.id)
        .pipe(finalize(this.refreshView(() => (this.isSaving = false))))
        .subscribe({
          next: () => this.loadContractById(contractId),
          error: (err: Error) => {
            this.serverError = err.message || 'Erro ao extornar parcela.';
            this.loadContractById(contractId);
          },
        });
    } else {
      // Unsaved (local-only) payment — just mark locally
      p.status = PaymentStatus.CANCELLED;
      this.recalculate();
      this.triggerAutosave();
    }
  }

  // ==================== Totals ====================

  recalculate(): void {
    this.subtotal = this.contract.itens.reduce((s, i) => s + i.valor, 0);
    this.total = Math.max(0, this.subtotal - this.discount);
    this.totalPaid = this.contract.pagamentos
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((s, p) => s + p.valor, 0);
  }

  // ==================== Contract flow ====================

  canChangeCustomer(): boolean {
    return !this.contractId && this.contract.situacao !== ContractStatus.REVISION;
  }

  get canRevise(): boolean {
    return (
      !!this.contractId &&
      !this.contract.baixa &&
      !this.contract.itens.some((item) => item.entregue) &&
      [ContractStatus.SIGNED, ContractStatus.FINALIZED].includes(this.contract.situacao)
    );
  }

  isEditable(): boolean {
    return (
      this.contract.situacao === ContractStatus.INITIAL ||
      this.contract.situacao === ContractStatus.DRAFT ||
      this.contract.situacao === ContractStatus.REVISION
    );
  }

  get stepperStep(): number {
    switch (this.contract.situacao) {
      case ContractStatus.DRAFT:
        return 1; // step 1 done, step 2 active
      case ContractStatus.REVISION:
        return 1; // same visual position as DRAFT
      case ContractStatus.SIGNED:
        return 2; // steps 1+2 done, step 3 active
      case ContractStatus.FINALIZED:
        return 4; // all done
      case ContractStatus.CLOSED:
      case ContractStatus.SUPERSEDED:
        return 4; // terminal — differentiated by label
      default:
        return 0; // INITIAL: only step 1 active
    }
  }

  reviseContrato(): void {
    if (!this.canRevise || this.isSaving) return;
    this.operatorService
      .authorize({ title: 'Identificar Usuário — Alterar contrato', requirePin: true })
      .subscribe((operator) => {
        if (operator) this.executeRevision();
      });
  }

  private executeRevision(): void {
    if (!this.contractId) return;
    this.isSaving = true;
    this.serverError = '';
    this.serverWarnings = [];
    this.rentalContractService
      .revise(this.contractId)
      .pipe(finalize(this.refreshView(() => (this.isSaving = false))))
      .subscribe({
        next: (response) => this.mapResponseToContract(response),
        error: (err: Error) => {
          this.serverError = err.message || 'Erro ao gerar revisão.';
        },
      });
  }

  restartRevision(): void {
    if (!this.contractId || this.contract.situacao !== ContractStatus.REVISION || this.isSaving)
      return;
    if (
      !window.confirm(
        'Descartar as alterações desta revisão e copiar novamente o contrato original?',
      )
    )
      return;
    this.operatorService
      .authorize({ title: 'Reiniciar alteração de contrato', requirePin: true })
      .subscribe((operator) => {
        if (!operator || !this.contractId) return;
        this.isSaving = true;
        this.rentalContractService
          .restartRevision(this.contractId)
          .pipe(finalize(this.refreshView(() => (this.isSaving = false))))
          .subscribe({
            next: (response) => this.mapResponseToContract(response),
            error: (error: Error) => (this.serverError = error.message),
          });
      });
  }

  loadContractById(id: string): void {
    this.contractLookupLoading = true;
    this.contractLookupError = '';
    this.rentalContractService
      .getById(id)
      .pipe(
        takeUntil(this.draftChanged$),
        takeUntil(this.destroy$),
        finalize(this.refreshView(() => (this.contractLookupLoading = false))),
      )
      .subscribe({
        next: (response) => {
          this.mapResponseToContract(response);
          this.updateTabTitle();
        },
        error: (err: Error) => {
          this.contractLookupError = err.message || 'Contrato não encontrado.';
        },
      });
  }

  salvarProposta(): void {
    if (!this.isEditable()) return;
    if (!this.customerUuid) {
      this.serverError = 'Selecione um cliente antes de salvar.';
      return;
    }
    if (this.contract.pagamentos.length === 0) {
      this.serverError = 'Adicione pelo menos uma parcela de pagamento antes de salvar.';
      return;
    }
    if (this.contract.itens.length === 0) {
      this.serverError = 'Adicione pelo menos um item antes de salvar.';
      return;
    }
    // Require operator PIN before persisting
    this.operatorService
      .authorize({ title: 'Identificar Usuário — Salvar Proposta', requirePin: true })
      .subscribe((op) => {
        if (!op) return;
        this.executeSave(op.employeeId);
      });
  }

  private executeSave(employeeId: string): void {
    // Capture employee ID for subsequent autosave requests
    this.autosaveEmployeeId = employeeId;
    const request = this.buildCreateRequest(employeeId);
    this.isSaving = true;
    this.serverError = '';
    this.serverWarnings = [];

    const saveContract$ = this.contractId
      ? this.rentalContractService.update(this.contractId, request)
      : this.rentalContractService.create(request);

    saveContract$.pipe(finalize(this.refreshView(() => (this.isSaving = false)))).subscribe({
      next: (response) => {
        this.contract.situacao = ContractStatus.DRAFT;
        this.mapResponseToContract(response);
        this.formStorage.clearDraft(this.formType, this.draftId);
      },
      error: (err: unknown) => {
        this.serverError = err instanceof Error ? err.message : 'Erro ao salvar proposta.';
      },
    });
  }

  requestContractPrint(): void {
    if (!this.contractId || this.isSaving || this.isPreparingContractPrint()) return;
    this.showPrintConfirmation.set(true);
  }

  cancelContractPrint(): void {
    this.showPrintConfirmation.set(false);
  }

  confirmContractPrint(): void {
    if (!this.contractId) return;
    this.showPrintConfirmation.set(false);
    const customerId = this.customerUuid;
    const cachedCustomer = this.selectedCustomerDetails;
    if (!customerId || cachedCustomer?.id === customerId) {
      this.openContractPrintPreview(cachedCustomer);
      return;
    }
    this.loadCustomerForPrint(customerId, cachedCustomer);
  }

  closeContractPrintPreview(): void {
    this.showContractPrintModal.set(false);
    this.contractPrintData.set(null);
  }

  private loadCustomerForPrint(customerId: string, cachedCustomer: ICustomer | null): void {
    this.isPreparingContractPrint.set(true);
    this.customerService
      .getCustomerById(customerId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isPreparingContractPrint.set(false)),
      )
      .subscribe({
        next: (customer) => {
          this.selectedCustomerDetails = customer;
          this.openContractPrintPreview(customer);
        },
        error: () => this.openContractPrintPreview(cachedCustomer),
      });
  }

  private openContractPrintPreview(customer: ICustomer | null): void {
    this.contractPrintData.set(this.createContractPrintData(customer));
    this.showContractPrintModal.set(true);
  }

  private createContractPrintData(customer: ICustomer | null): Partial<InterpolationContext> {
    return {
      cliente: this.createClientPrintData(customer),
      contrato: this.createContractPrintFields(),
      itensContrato: this.createPrintItems(),
      pagamentosContrato: this.createPrintPayments(),
    };
  }

  private createClientPrintData(customer: ICustomer | null): InterpolationContext['cliente'] {
    const address = [customer?.address?.street, customer?.number, customer?.complement]
      .filter(Boolean)
      .join(', ');
    return {
      codigo: customer?.legacyId ?? '',
      nome: this.contract.clienteNome || customer?.name || '',
      documento: this.contract.clienteCpf || customer?.document || '',
      rg: '',
      endereco: address,
      bairro: customer?.address?.neighborhood ?? '',
      cidade: customer?.address?.city ?? '',
      uf: customer?.address?.state ?? '',
      cep: customer?.address?.zipCode ?? '',
      telefone: (customer?.phones ?? []).join(' / '),
      email: customer?.email ?? '',
    };
  }

  private createContractPrintFields(): InterpolationContext['contrato'] {
    return {
      ...DEFAULT_MOCK_CONTEXT.contrato,
      numero: this.contract.legacyId ?? '',
      dataRetirada: this.formatDate(this.contract.retirada),
      dataUso: this.formatDate(this.contract.usa),
      dataDevolucao: this.formatDate(this.contract.devolucao),
      dataEmissao: this.formatDate(this.contract.hoje),
      valorTotal: `R$ ${this.formatCurrency(this.total)}`,
      atendente: '',
      observacoes: this.contract.comunicado,
    };
  }

  private createPrintItems(): NonNullable<InterpolationContext['itensContrato']> {
    return this.contract.itens.map((item) => ({
      codigo: item.codigo,
      descricao: [item.descricao, ...item.sub.map((meta) => meta.descricao)]
        .filter(Boolean)
        .join(', '),
      valor: item.valor,
    }));
  }

  private createPrintPayments(): NonNullable<InterpolationContext['pagamentosContrato']> {
    return this.contract.pagamentos.map((payment) => ({
      parcela: payment.parcela === 1 ? 'Entrada' : `Parcela ${payment.parcela - 1}`,
      forma: this.paymentMethodLabels[payment.forma] ?? '',
      vencimento: this.formatDate(payment.data),
      valor: payment.valor,
      status: this.paymentStatusLabels[payment.status].toUpperCase(),
    }));
  }

  assinarContrato(): void {
    if (![ContractStatus.DRAFT, ContractStatus.REVISION].includes(this.contract.situacao)) return;
    if (!this.contract.cliente) {
      this.serverError = 'Selecione um cliente antes de assinar.';
      return;
    }
    if (this.contract.itens.length === 0) {
      this.serverError = 'Adicione pelo menos um item.';
      return;
    }
    if (!this.contractId) {
      this.serverError = 'Salve a proposta antes de assinar.';
      return;
    }
    this.operatorService
      .authorize({ title: 'Identificar Usuário — Assinatura', requirePin: false })
      .subscribe((op) => {
        if (!op) return;
        if (this.contract.situacao === ContractStatus.REVISION) {
          this.saveAndSignRevision(op.employeeId, op.name);
          return;
        }
        this.runContractAction('sign', op.name);
      });
  }

  private saveAndSignRevision(employeeId: string, name: string): void {
    if (
      !this.contractId ||
      !window.confirm(
        'Confirmar alteração e substituir o contrato original, preservando cliente e valor pago?',
      )
    )
      return;
    this.isSaving = true;
    this.rentalContractService
      .update(this.contractId, this.buildCreateRequest(employeeId))
      .subscribe({
        next: (response) => {
          this.mapResponseToContract(response);
          this.runContractAction('sign', name);
        },
        error: (error: Error) => {
          this.isSaving = false;
          this.serverError = error.message;
        },
      });
  }

  finalizarLocacao(): void {
    if (this.contract.situacao === ContractStatus.FINALIZED) return;
    if (!this.contract.cliente) {
      this.serverError = 'Selecione um cliente.';
      return;
    }
    if (this.contract.itens.length === 0) {
      this.serverError = 'Adicione pelo menos um item.';
      return;
    }
    if (!this.contractId) {
      this.serverError = 'Salve a proposta antes de finalizar.';
      return;
    }
    this.operatorService
      .authorize({ title: 'Identificar Usuário — Finalização', requirePin: false })
      .subscribe((op) => {
        if (op) this.runContractAction('finalize', op.name);
      });
  }

  private signContractWithDefaultPrintTemplate(
    contractId: string,
  ): Observable<IRentalContractResponse> {
    return from(this.printTemplateStorage.initialize()).pipe(
      switchMap(() => {
        const template = this.printTemplateStorage.getDefaultByType('RENTAL_CONTRACT');
        if (!template)
          return throwError(() => new Error('Template padrão de locação não encontrado.'));
        const request: IRentalContractSignRequest = { printTemplateId: template.id };
        return this.rentalContractService.sign(contractId, request);
      }),
    );
  }

  private runContractAction(action: 'sign' | 'finalize', employeeName: string): void {
    if (!this.contractId) return;

    this.isSaving = true;
    this.serverError = '';
    this.serverWarnings = [];

    const obs =
      action === 'sign'
        ? this.signContractWithDefaultPrintTemplate(this.contractId)
        : this.rentalContractService.finalize(this.contractId);

    obs.pipe(finalize(this.refreshView(() => (this.isSaving = false)))).subscribe({
      next: (response) => {
        this.mapResponseToContract(response);
        if (response.warnings?.length) {
          this.serverWarnings = response.warnings;
        }
        console.log(`Contract ${action} confirmed by employee ${employeeName}`);
      },
      error: (err: Error) => {
        this.serverError =
          err.message || `Erro ao ${action === 'sign' ? 'assinar' : 'finalizar'} contrato.`;
      },
    });
  }

  duplicateContract(): void {
    if (this.isSaving || this.contractLookupLoading) return;
    this.executeDuplicate();
  }

  /** Gate de PIN do operador para emitir/cancelar nota fiscal (NFS-e embutida). */
  protected readonly authorizeFiscalAction = (action: 'emit' | 'cancel'): Observable<boolean> =>
    this.operatorService
      .authorize({
        title:
          action === 'emit'
            ? 'Identificar Usuário — Emitir NFS-e'
            : 'Autorizar Cancelamento de NFS-e',
        requirePin: true,
      })
      .pipe(map((op) => op !== null));

  private executeDuplicate(): void {
    // Offline duplicate (no backend contract yet)
    const copy = copyUnsavedRentalProposal(
      this.createDraftSnapshot(),
      this.toDateString(new Date()),
    );
    const newDraftId = this.generateDraftId();
    this.persistDraft();
    this.formStorage.saveDraft(this.formType, newDraftId, copy);
    this.tabService.open('/rental/new', 'Nova proposta não salva', 'rental', newDraftId);
  }

  activateStepperMode(): void {
    if (!this.contractLoaded) {
      this.contractLoaded = true;
      this.contractLookupError = '';
    }
  }

  clearProposal(): void {
    this.draftChanged$.next();
    this.autosaveService.reset();
    this.autosaveEmployeeId = null;
    this.pendingPaymentEmployeeId = null;
    this.pendingChargeBackIndex = null;
    this.fiscalDocument = null;
    this.showItemModal = false;
    this.showPaymentModal = false;
    this.contractId = null;
    this.contractPrintTemplateId = null;
    this.contractLoaded = false;
    this.contractLookupLegacyId = '';
    this.contractLookupLoading = false;
    this.contractLookupError = '';

    this.customerFound = false;
    this.customerSearchQuery = '';
    this.customerUuid = null;
    this.selectedCustomerDetails = null;
    this.customerLoading = false;
    this.customerError = '';

    this.showPrintConfirmation.set(false);
    this.showContractPrintModal.set(false);
    this.contractPrintData.set(null);
    this.contract = this.createEmptyContract();
    this.autoFillDates();
    this.itemRentalIds.clear();

    this.total = 0;
    this.totalPaid = 0;
    this.subtotal = 0;
    this.discount = 0;

    this.serverError = '';
    this.serverWarnings = [];

    this.parentContractId = null;
    this.replacedByContractId = null;
    this.revisionAudit.set('');
  }

  // ==================== Autosave ====================

  /** Whether autosave is allowed: contract must exist and be DRAFT. */
  private canAutosave(): boolean {
    return !!this.contractId && this.contract.situacao === ContractStatus.DRAFT;
  }

  /**
   * Trigger an autosave if eligible. Called after every mutation handler
   * that constitutes a persistent change.
   * Uses the employee ID captured during the first manual save.
   */
  private triggerAutosave(): void {
    if (!this.canAutosave()) return;
    if (!this.autosaveEmployeeId) return;

    const employeeId = this.autosaveEmployeeId;
    const contractId = this.contractId!;

    this.autosaveService.schedule(
      () => this.buildCreateRequest(employeeId),
      (request) => this.rentalContractService.update(contractId, request),
    );
  }

  // ==================== API mapping helpers ====================

  private buildCreateRequest(createdByEmployeeId: string): IRentalContractCreateRequest {
    const META_MAP: Record<'acessorio' | 'observacao', 'ACESSORIO' | 'OBSERVACAO'> = {
      acessorio: 'ACESSORIO',
      observacao: 'OBSERVACAO',
    };

    const items: IRentalContractItemRequest[] = this.contract.itens.map((item) => {
      if (!item.attendantEmployeeId && createdByEmployeeId) {
        item.attendantEmployeeId = createdByEmployeeId;
      }
      return {
        rentalItemId: this.itemRentalIds.get(item.codigo) ?? null,
        attendantEmployeeId: item.attendantEmployeeId,
        legacyProductCode: item.codigo,
        description: item.descricao,
        value: item.valor,
        metadata: item.sub.map<IItemMetaRequest>((m) => ({
          type: META_MAP[m.tipo],
          description: m.descricao,
          accessoryId: m.accessoryId,
        })),
      };
    });

    return {
      customerId: this.customerUuid!,
      contractType: this.contract.tipo,
      createdByEmployeeId,
      pickupDate: this.contract.retirada,
      eventDate: this.contract.usa,
      returnDate: this.contract.devolucao,
      notes: this.contract.comunicado || undefined,
      items,
      payments: this.contract.pagamentos.map((p) =>
        this.buildPaymentRequest(p, createdByEmployeeId),
      ),
    };
  }

  private mapResponseToContract(response: IRentalContractResponse): void {
    this.contractId = response.id;
    this.contractPrintTemplateId = response.printTemplateId ?? null;
    this.contractLoaded = true;

    const STATUS_FROM_API: Record<ContractStatusApi, ContractStatus> = {
      0: ContractStatus.DRAFT,
      1: ContractStatus.SIGNED,
      2: ContractStatus.FINALIZED,
      3: ContractStatus.REVISION,
      4: ContractStatus.SUPERSEDED,
      5: ContractStatus.CLOSED,
    };

    const METHOD_FROM_API: Record<PaymentMethodApi, PaymentMethod> = {
      CASH: PaymentMethod.CASH,
      PIX: PaymentMethod.PIX,
      CREDIT_CARD: PaymentMethod.CREDIT_CARD,
      DEBIT_CARD: PaymentMethod.DEBIT_CARD,
      BANK_TRANSFER: PaymentMethod.BANK_TRANSFER,
    };

    const PAYMENT_STATUS_FROM_API: Record<PaymentStatusApi, PaymentStatus> = {
      PENDING: PaymentStatus.PENDING,
      PAID: PaymentStatus.PAID,
      CANCELLED: PaymentStatus.CANCELLED,
      MULTA: PaymentStatus.MULTA,
    };

    if (this.selectedCustomerDetails?.id !== response.customerId) {
      this.selectedCustomerDetails = null;
    }
    this.customerUuid = response.customerId;
    this.customerFound = true;
    this.customerSearchQuery = response.customerDocument;
    this.customerError = '';

    this.contract = {
      ...this.contract,
      tipo: response.contractType,
      legacyId: response.legacyId ?? this.contract.legacyId,
      cliente: response.customerId ?? this.contract.cliente,
      clienteNome: response.customerName,
      clienteCpf: response.customerDocument,
      retirada: response.pickupDate,
      usa: response.eventDate,
      devolucao: response.returnDate,
      devolveu: response.actualReturnDate,
      baixa: !!(response.isReturned ?? response.returned),
      situacao: STATUS_FROM_API[response.status] ?? this.contract.situacao,
      comunicado: response.notes ?? '',
      itens: response.items.map((item) => ({
        codigo: item.legacyProductCode,
        descricao: item.description,
        valor: item.value,
        entregue: item.isDelivered,
        attendantEmployeeId: item.attendantEmployeeId ?? '',
        sub: item.metadata.map((meta) => ({
          tipo: meta.type === 'ACESSORIO' ? 'acessorio' : 'observacao',
          descricao: meta.description,
          accessoryId: meta.accessoryId,
        })),
      })),
      pagamentos: (response.payments ?? []).map((p) => ({
        id: p.id,
        parcela: p.installmentNumber,
        data: p.paymentDate,
        forma: METHOD_FROM_API[p.paymentMethod],
        valor: p.value,
        vezes: p.installments,
        status: PAYMENT_STATUS_FROM_API[p.status] ?? PaymentStatus.PENDING,
        processedByEmployeeId: p.processedByEmployeeId,
      })),
    };

    this.itemRentalIds.clear();
    response.items.forEach((item) => {
      if (item.rentalItemId) {
        this.itemRentalIds.set(item.legacyProductCode, item.rentalItemId);
      }
    });

    this.total = response.totalValue;
    this.totalPaid = response.paidValue;
    this.parentContractId = response.parentContractId ?? null;
    this.replacedByContractId = response.replacedByContractId ?? null;
    this.revisionAudit.set(
      response.revisionConfirmedAt
        ? `Alteração confirmada em ${new Date(response.revisionConfirmedAt).toLocaleString('pt-BR')} por ${response.confirmedByAccountId}`
        : response.revisedByAccountId
          ? `Alteração iniciada por ${response.revisedByAccountId}`
          : '',
    );
    this.recalculate();
    this.updateTabTitle();
    // Reset autosave status after a successful server response
    this.autosaveService.reset();
  }

  private createEmptyContract(): INewRentalContract {
    return {
      tipo: 1,
      legacyId: undefined,
      cliente: '',
      retirada: '',
      usa: '',
      devolucao: '',
      hoje: this.toDateString(new Date()),
      criado_por: '',
      baixa: false,
      situacao: ContractStatus.INITIAL,
      comunicado: '',
      itens: [],
      pagamentos: [],
    };
  }

  private buildPaymentRequest(
    p: IRentalPayment,
    processedByEmployeeId: string,
  ): IRentalPaymentRequest {
    return {
      installmentNumber: p.parcela,
      paymentDate: p.data,
      paymentMethod: this.METHOD_MAP[p.forma],
      value: p.valor,
      installments: p.vezes,
      status: this.STATUS_MAP[p.status],
      processedByEmployeeId:
        p.status === PaymentStatus.PAID
          ? p.processedByEmployeeId || processedByEmployeeId
          : undefined,
    };
  }

  formatCurrency(val: number): string {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDate(s: string): string {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
}
