import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CancellationModalComponent } from './cancellation-modal.component';
import { CustomerService } from '../../../../../customer/service/customer.service';
import { ReturnSummaryModel } from '../../data/return.model';

const buildSummary = (overrides: Partial<ReturnSummaryModel> = {}): ReturnSummaryModel => ({
  contractId: 'contract-1',
  legacyId: '20261006-1',
  customerName: 'Maria Silva',
  customerId: 'customer-1',
  contractStatus: 'FINALIZED',
  returnDate: '2026-10-10',
  totalValue: 1000,
  pendingCount: 1,
  isFullyReturned: false,
  delayDays: 0,
  suggestedFine: 0,
  items: [],
  paymentsPreview: [
    { paymentId: 'pay-1', installmentNumber: 1, value: 300, status: 'PAID' },
    { paymentId: 'pay-2', installmentNumber: 2, value: 150, status: 'PENDING' },
  ],
  ...overrides,
});

type ModalInternals = {
  printTerm(): void;
  onPrintClosed(): void;
  onConfirm(): void;
  onApplyRefundToggle(event: Event): void;
  onRefundAmountInput(event: Event): void;
  canConfirm(): boolean;
};

const checkEvent = (checked: boolean) => ({ target: { checked } }) as unknown as Event;
const inputEvent = (value: string) => ({ target: { value } }) as unknown as Event;

const internals = (c: CancellationModalComponent): ModalInternals =>
  c as unknown as ModalInternals;

describe('CancellationModalComponent', () => {
  let fixture: ComponentFixture<CancellationModalComponent>;
  let component: CancellationModalComponent;
  let customerService: { getCustomerById: ReturnType<typeof vi.fn> };

  const summary = signal(buildSummary());
  const busy = signal(false);

  beforeEach(async () => {
    customerService = { getCustomerById: vi.fn().mockReturnValue(of(null)) };

    await TestBed.configureTestingModule({
      imports: [CancellationModalComponent],
      providers: [{ provide: CustomerService, useValue: customerService }],
    }).compileComponents();

    fixture = TestBed.createComponent(CancellationModalComponent, {
      bindings: [],
    });
    component = fixture.componentInstance;
    fixture.componentRef.setInput('summary', summary());
    fixture.componentRef.setInput('busy', busy());
    fixture.detectChanges();
  });

  it('soma apenas parcelas PAID como teto do reembolso', () => {
    const paidTotal = (component as unknown as { paidTotal(): number }).paidTotal();
    expect(paidTotal).toBe(300);
  });

  it('confirmar sem imprimir não emite evento', () => {
    const spy = vi.fn();
    component.confirmed.subscribe(spy);

    internals(component).onConfirm();

    expect(spy).not.toHaveBeenCalled();
  });

  it('após imprimir, confirmação emite payload sem reembolso por padrão', () => {
    const spy = vi.fn();
    component.confirmed.subscribe(spy);

    internals(component).printTerm();
    internals(component).onPrintClosed();
    internals(component).onConfirm();

    expect(spy).toHaveBeenCalledWith({
      refundAmount: undefined,
      applyFine: false,
      fineAmount: undefined,
    });
  });

  it('valor de reembolso informado entra no payload', () => {
    const spy = vi.fn();
    component.confirmed.subscribe(spy);

    internals(component).onApplyRefundToggle(checkEvent(true));
    internals(component).onRefundAmountInput(inputEvent('120.50'));
    internals(component).printTerm();
    internals(component).onPrintClosed();
    internals(component).onConfirm();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ refundAmount: 120.5 })
    );
  });

  it('toggle de reembolso sugere o total pago como valor inicial', () => {
    internals(component).onApplyRefundToggle(checkEvent(true));

    expect(
      (component as unknown as { refundAmount(): number | null }).refundAmount()
    ).toBe(300);
  });

  it.each([['-10'], ['0'], ['300.01'], ['abc']])(
    'reembolso inválido (%s) bloqueia a confirmação',
    raw => {
      const spy = vi.fn();
      component.confirmed.subscribe(spy);

      internals(component).onApplyRefundToggle(checkEvent(true));
      internals(component).onRefundAmountInput(inputEvent(raw));
      internals(component).printTerm();
      internals(component).onPrintClosed();
      internals(component).onConfirm();

      expect(spy).not.toHaveBeenCalled();
    },
  );

  it('aplica multa rescisória quando applyFine está ativo', () => {
    const spy = vi.fn();
    component.confirmed.subscribe(spy);

    (component as unknown as { applyFine: ReturnType<typeof signal<boolean>> }).applyFine.set(true);
    (component as unknown as { fineAmount: ReturnType<typeof signal<number | null>> }).fineAmount.set(300);
    internals(component).printTerm();
    internals(component).onPrintClosed();
    internals(component).onConfirm();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ applyFine: true, fineAmount: 300 })
    );
  });

  it('busy=true bloqueia a confirmação mesmo após impressão', () => {
    const spy = vi.fn();
    component.confirmed.subscribe(spy);

    internals(component).printTerm();
    internals(component).onPrintClosed();
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();

    internals(component).onConfirm();
    expect(spy).not.toHaveBeenCalled();
  });

  it('cancel emite evento de cancelamento', () => {
    const spy = vi.fn();
    component.cancelled.subscribe(spy);

    (component as unknown as { onCancel(): void }).onCancel();

    expect(spy).toHaveBeenCalledOnce();
  });

  it('busca cliente por customerId para o termo', () => {
    expect(customerService.getCustomerById).toHaveBeenCalledWith('customer-1');
  });

  it('tolera falha ao carregar cliente (usa dados do summary)', () => {
    customerService.getCustomerById.mockReturnValue(throwError(() => new Error('404')));

    const f2 = TestBed.createComponent(CancellationModalComponent);
    f2.componentRef.setInput('summary', buildSummary());
    f2.detectChanges();

    const printData = (f2.componentInstance as unknown as {
      printData(): { cliente: { nome: string } };
    }).printData();
    expect(printData.cliente.nome).toBe('Maria Silva');
  });
});
