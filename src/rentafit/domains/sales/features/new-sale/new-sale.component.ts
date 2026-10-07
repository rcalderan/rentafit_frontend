import { CommonModule } from '@angular/common';
import { Component, effect, inject, OnDestroy, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { distinctUntilChanged, finalize, map, switchMap, takeUntil } from 'rxjs/operators';
import { SalesOrderService } from '../../service/sales-order.service';
import { CustomerService, ICustomerPageResponse } from '../../../customer/service/customer.service';
import { ProductService } from '../../../product/service/product.service';
import { ISalesOrder, ISalesOrderItem, ISalesPayment } from '../../data/sales-order.interface';
import {
  ISalesOrderCreateRequest,
  ISalesOrderUpdateRequest,
  ISalesOrderItemRequest,
  ISalesPaymentRequest,
  ICancelSalesOrderRequest,
} from '../../data/sales-order-request.interface';
import { SalesOrderStatus, SALES_ORDER_STATUS_LABELS } from '../../data/sales-order-status.enum';
import { SalesItemStatus, SALES_ITEM_STATUS_LABELS } from '../../data/sales-item-status.enum';
import { PaymentMethodApi, PaymentStatusApi, SalesOrderStatusApi } from '../../data/sales-api.types';
import { IRetailItem } from '../../../product/data/Product.interface';
import { TerminalOperatorService } from '../../../auth/services/terminal-operator.service';
import { NfeEmissionComponent } from '../../../finance/features/nfe-emission/nfe-emission.component';
import { IFiscalContext, IFiscalDocument } from '../../../finance/data/fiscal-document.types';
import { SessionFormStorageService } from '../../../../shared/services/session-form-storage.service';
import { TabService } from '../../../../shared/services/tab.service';

/** Métodos de pagamento e seus labels (reutilizados do rental) */
const PAYMENT_METHOD_LABELS: Record<PaymentMethodApi, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão de Crédito',
  DEBIT_CARD: 'Cartão de Débito',
  BANK_TRANSFER: 'Transferência',
};

@Component({
  selector: 'rentafit-new-sale',
  standalone: true,
  imports: [CommonModule, FormsModule, NfeEmissionComponent],
  templateUrl: './new-sale.component.html',
  styleUrl: './new-sale.component.css',
})
export class NewSale implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly salesService = inject(SalesOrderService);
  private readonly operatorService = inject(TerminalOperatorService);
  private readonly customerService = inject(CustomerService);
  private readonly productService = inject(ProductService);
  private readonly formStorage = inject(SessionFormStorageService);
  private readonly tabService = inject(TabService);
  private readonly formType = 'sales-order';
  private draftId = this.generateDraftId();
  private draftInterval: ReturnType<typeof setInterval> | null = null;
  private destroy$ = new Subject<void>();

  // ─── State ──────────────────────────────────────────────────────────────────

  protected readonly order = signal<ISalesOrder | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly errorMsg = signal<string | null>(null);
  protected readonly successMsg = signal<string | null>(null);

  // Customer search
  protected customerSearch = '';
  protected readonly customerResults = signal<Array<{ id: string; name: string; document: string }>>([]);
  protected readonly selectedCustomer = signal<{ id: string; name: string; document: string } | null>(null);

  // Items
  protected readonly showItemModal = signal(false);
  protected readonly retailProducts = signal<IRetailItem[]>([]);
  protected productSearch = '';
  protected readonly filteredProducts = signal<IRetailItem[]>([]);
  protected selectedProduct: IRetailItem | null = null;
  protected itemQuantity = 1;
  protected itemDiscount = 0;
  protected itemNeedsTailoring = false;
  protected itemTailoringNotes = '';

  // Payments
  protected readonly showPaymentModal = signal(false);
  protected paymentInstallment = 1;
  protected paymentDate = '';
  protected paymentMethod: PaymentMethodApi = 'PIX';
  protected paymentValue = 0;
  protected paymentInstallments = 1;
  protected paymentStatus: PaymentStatusApi = 'PENDING';

  // Notes & discount
  protected orderNotes = '';
  protected orderDiscount = 0;

  // Cancel
  protected readonly showCancelModal = signal(false);
  protected cancelReason = '';

  // Operator identification (TerminalOperatorService + janela de PIN)
  private pendingPaymentEmployeeId: string | null = null;

  // Inline modal errors
  protected itemModalError = '';
  protected paymentModalError = '';

  // ─── Computed ───────────────────────────────────────────────────────────────

  protected readonly isDraft = computed(() => {
    const o = this.order();
    return !o || o.status === 'DRAFT';
  });

  private readonly titleEffect = effect(() => {
    const order = this.order();
    this.updateTabTitle(order);
  });

  protected readonly canConfirm = computed(() => {
    const o = this.order();
    return !!o?.id && o.status === 'DRAFT' && (o.items?.length ?? 0) > 0;
  });

  protected readonly canCancel = computed(() => {
    const o = this.order();
    return !!o?.id && (o.status === 'DRAFT' || o.status === 'CONFIRMED');
  });

  protected readonly subtotal = computed(() => {
    const o = this.order();
    if (!o?.items) return 0;
    return o.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  });

  /** Soma apenas dos descontos por item — exibido na linha "Desconto nos itens" */
  protected readonly itemDiscountsTotal = computed(() => {
    const o = this.order();
    return o?.items?.reduce((sum, item) => sum + (item.discountValue ?? 0), 0) ?? 0;
  });

  /** Soma dos descontos por item + desconto geral do pedido */
  protected readonly totalDiscountValue = computed(() => {
    const o = this.order();
    return this.itemDiscountsTotal() + (o?.discountValue ?? 0);
  });

  protected readonly totalValue = computed(() => {
    return Math.max(0, this.subtotal() - this.totalDiscountValue());
  });

  protected readonly paidValue = computed(() => {
    const o = this.order();
    if (!o?.payments) return 0;
    return o.payments
      .filter(p => p.status === 'PAID')
      .reduce((sum, p) => sum + p.value, 0);
  });

  protected readonly remainingValue = computed(() => {
    return Math.max(0, this.totalValue() - this.paidValue());
  });

  // ─── NF-e (documento fiscal) ─────────────────────────────────────────────────

  /** Contexto repassado ao componente de emissão de NF-e. */
  protected readonly fiscalContext = computed<IFiscalContext>(() => {
    const o = this.order();
    return {
      origin: 'SALES',
      originId: o?.id,
      isPaid: o?.status === 'PAID' || o?.status === 'COMPLETED',
      totalValue: o?.totalValue ?? this.totalValue(),
      customerId: o?.customerId ?? this.selectedCustomer()?.id,
      customerName: o?.customerName ?? this.selectedCustomer()?.name,
      customerDocument: o?.customerDocument ?? this.selectedCustomer()?.document,
      customerEmail: o?.invoiceCustomerEmail,
      items: o?.items.map((item) => ({
        productCode: item.sku,
        description: item.description,
        ncm: '',
        cfop: '',
        unit: 'UN',
        quantity: item.quantity,
        unitValue: item.unitPrice,
      })),
    };
  });

  /**
   * Documento fiscal pré-existente (reidrata o componente ao carregar o pedido).
   *
   * Backend `PENDING_EMISSION` significa "aguardando emissão manual" (auto-emit
   * desabilitado), e não "enviada ao autorizador". O frontend trata
   * `PENDING_EMISSION` como "Em processamento / Verificar Status", então
   * mapeamos para `null` (= `NONE`) para exibir o botão "Emitir NF-e".
   */
  protected readonly initialFiscalDocument = computed<IFiscalDocument | null>(() => {
    const o = this.order();
    if (!o || !o.invoiceStatus || o.invoiceStatus === 'NONE' || o.invoiceStatus === 'PENDING_EMISSION') return null;
    return {
      id: o.invoiceId ?? '',
      type: 'NFE',
      status: o.invoiceStatus,
      number: o.invoiceNumber,
      series: o.invoiceSeries,
      accessKey: o.invoiceAccessKey,
      emissionDate: o.invoiceEmissionDate,
      protocol: o.invoiceProtocol,
      value: o.totalValue,
      natureOperation: o.invoiceNatureOperation,
      cancelReason: o.invoiceCancelReason,
      cancelledAt: o.invoiceCancelledAt,
      cancelProtocol: o.invoiceCancelProtocol,
      xmlUrl: o.invoiceXmlUrl,
      danfeUrl: o.invoiceDanfeUrl,
      customerEmail: o.invoiceCustomerEmail,
      customerName: o.customerName,
      customerDocument: o.customerDocument,
    };
  });

  /** Persiste localmente as mudanças de estado fiscal emitidas pelo componente. */
  protected onInvoiceChanged(doc: IFiscalDocument): void {
    const o = this.order();
    if (!o) return;
    this.order.set({
      ...o,
      invoiceStatus: doc.status,
      invoiceId: doc.id,
      invoiceNumber: doc.number,
      invoiceSeries: doc.series,
      invoiceAccessKey: doc.accessKey,
      invoiceEmissionDate: doc.emissionDate,
      invoiceProtocol: doc.protocol,
      invoiceNatureOperation: doc.natureOperation,
      invoiceCancelReason: doc.cancelReason,
      invoiceCancelledAt: doc.cancelledAt,
      invoiceCancelProtocol: doc.cancelProtocol,
      invoiceXmlUrl: doc.xmlUrl,
      invoiceDanfeUrl: doc.danfeUrl,
      invoiceCustomerEmail: doc.customerEmail,
    });
  }

  // ─── Enums for template ─────────────────────────────────────────────────────

  protected readonly statusLabels = SALES_ORDER_STATUS_LABELS;
  protected readonly itemStatusLabels = SALES_ITEM_STATUS_LABELS;
  protected readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  protected readonly paymentMethods = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethodApi[];

  // ─── Init ───────────────────────────────────────────────────────────────────

  ngOnDestroy(): void {
    if (this.draftInterval) {
      clearInterval(this.draftInterval);
      this.draftInterval = null;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.route.queryParams
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged((a, b) => a['draftId'] === b['draftId'])
      )
      .subscribe(params => {
        const newDraftId = params['draftId'];
        if (newDraftId && newDraftId !== this.draftId) {
          this.draftId = newDraftId;
          this.resetOrderState();
          this.restoreDraft();
          this.updateTabTitle();
        }
      });

    const orderId = this.route.snapshot.queryParamMap.get('id');
    if (orderId) {
      this.loadOrder(orderId);
    } else {
      this.restoreDraft();
    }
    this.loadRetailProducts();

    this.draftInterval = setInterval(() => this.persistDraft(), 3000);
  }

  private resetOrderState(): void {
    this.order.set(null);
    this.selectedCustomer.set(null);
    this.customerSearch = '';
    this.orderNotes = '';
    this.orderDiscount = 0;
  }

  private generateDraftId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private createDraftSnapshot(): object {
    return {
      order: this.order(),
      selectedCustomer: this.selectedCustomer(),
      customerSearch: this.customerSearch,
      orderNotes: this.orderNotes,
      orderDiscount: this.orderDiscount,
      itemQuantity: this.itemQuantity,
      itemDiscount: this.itemDiscount,
      itemNeedsTailoring: this.itemNeedsTailoring,
      itemTailoringNotes: this.itemTailoringNotes,
      paymentMethod: this.paymentMethod,
      paymentValue: this.paymentValue,
      paymentDate: this.paymentDate,
      paymentInstallment: this.paymentInstallment,
      paymentInstallments: this.paymentInstallments,
      paymentStatus: this.paymentStatus,
    };
  }

  private applyDraftSnapshot(draft: any): void {
    if (!draft || typeof draft !== 'object') return;
    if (draft.order !== undefined) this.order.set(draft.order);
    if (draft.selectedCustomer !== undefined) this.selectedCustomer.set(draft.selectedCustomer);
    if (draft.customerSearch !== undefined) this.customerSearch = draft.customerSearch;
    if (draft.orderNotes !== undefined) this.orderNotes = draft.orderNotes;
    if (draft.orderDiscount !== undefined) this.orderDiscount = draft.orderDiscount;
    if (draft.itemQuantity !== undefined) this.itemQuantity = draft.itemQuantity;
    if (draft.itemDiscount !== undefined) this.itemDiscount = draft.itemDiscount;
    if (draft.itemNeedsTailoring !== undefined) this.itemNeedsTailoring = draft.itemNeedsTailoring;
    if (draft.itemTailoringNotes !== undefined) this.itemTailoringNotes = draft.itemTailoringNotes;
    if (draft.paymentMethod !== undefined) this.paymentMethod = draft.paymentMethod;
    if (draft.paymentValue !== undefined) this.paymentValue = draft.paymentValue;
    if (draft.paymentDate !== undefined) this.paymentDate = draft.paymentDate;
    if (draft.paymentInstallment !== undefined) this.paymentInstallment = draft.paymentInstallment;
    if (draft.paymentInstallments !== undefined) this.paymentInstallments = draft.paymentInstallments;
    if (draft.paymentStatus !== undefined) this.paymentStatus = draft.paymentStatus;
  }

  private persistDraft(): void {
    this.formStorage.saveDraft(this.formType, this.draftId, this.createDraftSnapshot());
  }

  private restoreDraft(): void {
    const draft = this.formStorage.loadDraft<object>(this.formType, this.draftId);
    if (draft) {
      this.applyDraftSnapshot(draft);
    }
  }

  private updateTabTitle(order?: ISalesOrder | null): void {
    const label = order?.legacyId ? `Venda ${order.legacyId}` : 'Nova Venda';
    const tabId = this.tabService.getTabId('/sales/new', this.draftId);
    this.tabService.updateTitle(tabId, label);
  }

  private loadOrder(id: string): void {
    this.isLoading.set(true);
    this.salesService.getById(id).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (order) => {
        this.order.set(order);
        this.orderNotes = order.notes ?? '';
        this.orderDiscount = order.discountValue ?? 0;
        if (order.customerId) {
          this.selectedCustomer.set({
            id: order.customerId,
            name: order.customerName ?? '',
            document: order.customerDocument ?? '',
          });
        }
        this.updateTabTitle();
      },
      error: (err) => this.errorMsg.set(err.message),
    });
  }

  private loadRetailProducts(): void {
    this.productService.listRetailItems({ page: 0, size: 200 }).subscribe({
      next: (page: { content: IRetailItem[] }) => {
        this.retailProducts.set(page.content);
        this.filteredProducts.set(page.content);
      },
      error: (err: Error) => console.error('Failed to load retail products:', err),
    });
  }

  // ─── Customer ───────────────────────────────────────────────────────────────

  protected searchCustomer(): void {
    if (this.customerSearch.length < 2) {
      this.customerResults.set([]);
      return;
    }
    this.customerService.listCustomers({ name: this.customerSearch, size: 10 }).subscribe({
      next: (page: ICustomerPageResponse) => {
        this.customerResults.set(
          page.content.map(c => ({ id: c.id!, name: c.name, document: c.document ?? '' }))
        );
      },
      error: () => this.customerResults.set([]),
    });
  }

  protected selectCustomer(customer: { id: string; name: string; document: string }): void {
    this.selectedCustomer.set(customer);
    this.customerResults.set([]);
    this.customerSearch = '';
  }

  protected clearCustomer(): void {
    this.selectedCustomer.set(null);
  }

  // ─── Item Modal ─────────────────────────────────────────────────────────────

  protected openItemModal(): void {
    this.selectedProduct = null;
    this.itemQuantity = 1;
    this.itemDiscount = 0;
    this.itemNeedsTailoring = false;
    this.itemTailoringNotes = '';
    this.itemModalError = '';
    this.productSearch = '';
    this.filteredProducts.set(this.retailProducts());
    this.showItemModal.set(true);
  }

  protected filterProducts(): void {
    const query = this.productSearch.toLowerCase();
    this.filteredProducts.set(
      this.retailProducts().filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.sku ?? '').toLowerCase().includes(query)
      )
    );
  }

  protected selectProduct(product: IRetailItem): void {
    this.selectedProduct = product;
  }

  protected confirmAddItem(): void {
    if (!this.selectedProduct) return;

    if (this.itemQuantity <= 0) {
      this.itemModalError = 'Quantidade deve ser maior que zero.';
      return;
    }
    const maxDiscount = this.selectedProduct.value * this.itemQuantity;
    if (this.itemDiscount < 0 || this.itemDiscount > maxDiscount) {
      this.itemModalError = `Desconto deve ser entre R$0 e ${this.formatCurrency(maxDiscount)}.`;
      return;
    }
    this.itemModalError = '';

    const current = this.order();
    const newItem: ISalesOrderItem = {
      retailProductId: this.selectedProduct.id!,
      sku: this.selectedProduct.sku ?? '',
      description: `${this.selectedProduct.name} — ${this.selectedProduct.size} ${this.selectedProduct.color}`,
      unitPrice: this.selectedProduct.value,
      quantity: this.itemQuantity,
      discountValue: this.itemDiscount,
      itemStatus: 'PENDING',
      needsTailoring: this.itemNeedsTailoring,
      tailoringNotes: this.itemTailoringNotes || undefined,
    };

    if (current) {
      this.order.set({ ...current, items: [...current.items, newItem] });
    } else {
      this.order.set({
        status: 'DRAFT',
        discountValue: this.orderDiscount,
        invoiceStatus: 'NONE',
        items: [newItem],
        payments: [],
      });
    }
    this.showItemModal.set(false);
  }

  protected removeItem(index: number): void {
    const current = this.order();
    if (!current || !this.isDraft()) return;
    const items = [...current.items];
    items.splice(index, 1);
    this.order.set({ ...current, items });
  }

  // ─── Payment Modal ──────────────────────────────────────────────────────────

  protected openPaymentModal(): void {
    const o = this.order();
    this.paymentInstallment = (o?.payments?.length ?? 0) + 1;
    this.paymentDate = new Date().toISOString().slice(0, 10);
    this.paymentMethod = 'PIX';
    this.paymentValue = this.remainingValue();
    this.paymentInstallments = 1;
    this.paymentStatus = 'PENDING';
    this.paymentModalError = '';
    this.showPaymentModal.set(true);
  }

  protected confirmAddPayment(): void {
    if (this.paymentValue <= 0) {
      this.paymentModalError = 'Valor deve ser maior que zero.';
      return;
    }
    if (!this.paymentDate) {
      this.paymentModalError = 'Informe a data do pagamento.';
      return;
    }
    if (this.paymentInstallment < 1 || this.paymentInstallment > 24) {
      this.paymentModalError = 'Número da parcela deve ser entre 1 e 24.';
      return;
    }
    this.paymentModalError = '';
    const current = this.order();
    if (!current) return;

    // Atribui o pagamento ao operador em comando (sem modal quando já identificado)
    if (this.pendingPaymentEmployeeId === null) {
      this.operatorService
        .authorize({ title: 'Identificar Usuário — Pagamento', requirePin: false })
        .subscribe(op => {
          if (!op) return;
          this.pendingPaymentEmployeeId = op.employeeId;
          this.confirmAddPayment();
        });
      return;
    }

    const employeeId = this.pendingPaymentEmployeeId;
    this.pendingPaymentEmployeeId = null;

    // Em CONFIRMED/PAID: persiste direto via endpoint dedicado (não aceita PUT)
    if (current.id && current.status !== 'DRAFT') {
      const request: ISalesPaymentRequest = {
        installmentNumber: this.paymentInstallment,
        paymentDate: this.paymentDate,
        paymentMethod: this.paymentMethod,
        value: this.paymentValue,
        installments: this.paymentInstallments,
        status: this.paymentStatus,
        processedByEmployeeId: employeeId,
      };
      this.isSaving.set(true);
      this.salesService.addPayment(current.id, request).pipe(
        finalize(() => this.isSaving.set(false))
      ).subscribe({
        next: (updated) => {
          this.order.set(updated);
          this.showPaymentModal.set(false);
          this.showSuccess('Pagamento adicionado');
        },
        error: (err) => this.errorMsg.set(err.message),
      });
      return;
    }

    // Em DRAFT: acumula no signal local (será persistido no save/confirm)
    const newPayment: ISalesPayment = {
      installmentNumber: this.paymentInstallment,
      paymentDate: this.paymentDate,
      paymentMethod: this.paymentMethod,
      value: this.paymentValue,
      installments: this.paymentInstallments,
      status: this.paymentStatus,
      processedByEmployeeId: employeeId,
    };
    this.order.set({ ...current, payments: [...current.payments, newPayment] });
    this.showPaymentModal.set(false);
  }

  protected removePayment(index: number): void {
    const current = this.order();
    if (!current) return;
    const payments = [...current.payments];
    payments.splice(index, 1);
    this.order.set({ ...current, payments });
    this.save();
  }

  // ─── Save (Create/Update) ──────────────────────────────────────────────────

  protected save(): void {
    const o = this.order();
    if (!o) {
      this.errorMsg.set('Adicione pelo menos um item antes de criar o pedido.');
      return;
    }
    if ((o.items?.length ?? 0) === 0) {
      this.errorMsg.set('Adicione pelo menos um item antes de criar o pedido.');
      return;
    }
    if (this.orderDiscount < 0) {
      this.errorMsg.set('Desconto geral não pode ser negativo.');
      return;
    }

    const items: ISalesOrderItemRequest[] = o.items.map(i => ({
      retailProductId: i.retailProductId,
      quantity: i.quantity,
      discountValue: i.discountValue,
      needsTailoring: i.needsTailoring,
      tailoringNotes: i.tailoringNotes,
    }));

    const payments: ISalesPaymentRequest[] = o.payments.map(p => ({
      installmentNumber: p.installmentNumber,
      paymentDate: p.paymentDate,
      paymentMethod: p.paymentMethod as PaymentMethodApi,
      value: p.value,
      installments: p.installments,
      status: p.status as PaymentStatusApi,
      processedByEmployeeId: p.processedByEmployeeId,
    }));

    this.isSaving.set(true);
    this.errorMsg.set(null);

    if (o.id) {
      const request: ISalesOrderUpdateRequest = {
        customerId: this.selectedCustomer()?.id,
        notes: this.orderNotes,
        discountValue: this.orderDiscount,
        items,
        payments,
      };
      this.salesService.update(o.id, request).pipe(
        finalize(() => this.isSaving.set(false))
      ).subscribe({
        next: (updated) => {
          this.order.set(updated);
          this.formStorage.clearDraft(this.formType, this.draftId);
          this.showSuccess('Pedido atualizado');
        },
        error: (err) => this.errorMsg.set(err.message),
      });
    } else {
      const request: ISalesOrderCreateRequest = {
        customerId: this.selectedCustomer()?.id,
        notes: this.orderNotes,
        discountValue: this.orderDiscount,
        items,
        payments,
      };
      this.salesService.create(request).pipe(
        finalize(() => this.isSaving.set(false))
      ).subscribe({
        next: (created) => {
          this.order.set(created);
          this.formStorage.clearDraft(this.formType, this.draftId);
          this.router.navigate(['/sales/new'], {
            queryParams: { id: created.id },
          });
          this.showSuccess('Pedido criado: ' + created.legacyId);
        },
        error: (err) => this.errorMsg.set(err.message),
      });
    }
  }

  // ─── Workflow Actions ───────────────────────────────────────────────────────

  protected confirm(): void {
    const o = this.order();
    if (!o?.id) return;

    // BUG-2026-05-05-2: exige PIN antes de confirmar
    this.operatorService
      .authorize({ title: 'Identificar Usuário — Confirmação', requirePin: true })
      .subscribe(op => {
        if (op) this.executeConfirm();
      });
  }

  private executeConfirm(): void {
    const o = this.order();
    if (!o?.id) return;

    this.isSaving.set(true);
    this.errorMsg.set(null);

    // BUG-2026-05-05-1: persiste o estado local (incluindo parcelas) via save antes de confirmar
    this.buildSaveRequest(o).pipe(
      switchMap((saved) => this.salesService.confirm(saved.id!)),
      finalize(() => this.isSaving.set(false))
    ).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.showSuccess('Pedido confirmado');
      },
      error: (err) => this.errorMsg.set(err.message),
    });
  }

  /** Constrói e envia o save (create ou update) e retorna o pedido persistido. */
  private buildSaveRequest(o: ISalesOrder): Observable<ISalesOrder> {
    const items: ISalesOrderItemRequest[] = o.items.map(i => ({
      retailProductId: i.retailProductId,
      quantity: i.quantity,
      discountValue: i.discountValue,
      needsTailoring: i.needsTailoring,
      tailoringNotes: i.tailoringNotes,
    }));
    const payments: ISalesPaymentRequest[] = o.payments.map(p => ({
      installmentNumber: p.installmentNumber,
      paymentDate: p.paymentDate,
      paymentMethod: p.paymentMethod as PaymentMethodApi,
      value: p.value,
      installments: p.installments,
      status: p.status as PaymentStatusApi,
      processedByEmployeeId: p.processedByEmployeeId,
    }));

    if (o.id) {
      const request: ISalesOrderUpdateRequest = {
        customerId: this.selectedCustomer()?.id,
        notes: this.orderNotes,
        discountValue: this.orderDiscount,
        items,
        payments,
      };
      return this.salesService.update(o.id, request);
    }

    const request: ISalesOrderCreateRequest = {
      customerId: this.selectedCustomer()?.id,
      notes: this.orderNotes,
      discountValue: this.orderDiscount,
      items,
      payments,
    };
    return this.salesService.create(request);
  }

  protected openCancelModal(): void {
    this.cancelReason = '';
    this.showCancelModal.set(true);
  }

  protected confirmCancel(): void {
    const o = this.order();
    if (!o?.id || !this.cancelReason) return;
    this.isSaving.set(true);
    const request: ICancelSalesOrderRequest = { reason: this.cancelReason };
    this.salesService.cancel(o.id, request).pipe(
      finalize(() => this.isSaving.set(false))
    ).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.showCancelModal.set(false);
        this.showSuccess('Pedido cancelado');
      },
      error: (err) => this.errorMsg.set(err.message),
    });
  }

  protected markItemReady(itemId: string): void {
    this.operatorService
      .authorize({ title: 'Identificar Usuário — Pronto para Entrega', requirePin: false })
      .subscribe(op => {
        if (op) this.executeMarkItemReady(itemId);
      });
  }

  private executeMarkItemReady(itemId: string): void {
    const o = this.order();
    if (!o?.id) return;
    this.salesService.markItemReady(o.id, itemId).subscribe({
      next: (updated) => this.order.set(updated),
      error: (err) => this.errorMsg.set(err.message),
    });
  }

  protected deliverItem(itemId: string): void {
    this.operatorService
      .authorize({ title: 'Identificar Usuário — Entrega', requirePin: false })
      .subscribe(op => {
        if (op) this.executeDeliverItem(itemId, op.employeeId);
      });
  }

  private executeDeliverItem(itemId: string, employeeId: string): void {
    const o = this.order();
    if (!o?.id) return;
    this.salesService.deliverItem(o.id, itemId, employeeId).subscribe({
      next: (updated) => this.order.set(updated),
      error: (err) => this.errorMsg.set(err.message),
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /** Gate de PIN do operador para emitir/cancelar nota fiscal (NF-e embutida). */
  protected readonly authorizeFiscalAction = (action: 'emit' | 'cancel'): Observable<boolean> =>
    this.operatorService
      .authorize({
        title: action === 'emit' ? 'Identificar Usuário — Emitir NF-e' : 'Autorizar Cancelamento de NF-e',
        requirePin: true,
      })
      .pipe(map(op => op !== null));

  protected paymentMethodLabel(method: string): string {
    return (PAYMENT_METHOD_LABELS as Record<string, string>)[method] ?? method;
  }

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  protected goBack(): void {
    this.router.navigate(['/sales/management']);
  }

  private showSuccess(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 3000);
  }
}
