import { Component, OnInit, ChangeDetectionStrategy, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { PrintPreviewModalComponent } from '../../../../../print/components/print-preview-modal/print-preview-modal.component';
import { InterpolationContext } from '../../../../../print/services/template-interpolation.service';
import { CustomerService } from '../../../../../customer/service/customer.service';
import { ICustomer } from '../../../../../customer/data/Customer.interface';
import { PaymentPreviewModel, ReturnSummaryModel } from '../../data/return.model';

export interface CancellationConfirmPayload {
  /** Valor a devolver ao cliente — qualquer valor entre 0,01 e o total pago. */
  refundAmount?: number;
  applyFine: boolean;
  fineAmount?: number;
}

/**
 * Modal de Desistência: seleção de reembolso de parcelas PAID + multa
 * rescisória opcional (30% sugerido, Cláusula 6a) + gate de assinatura.
 *
 * Fluxo obrigatório: Imprimir Termo → cliente assina → operador confirma.
 * O evento `confirmed` só é emitido depois que o termo foi impresso; a
 * autorização por PIN e a chamada ao backend ficam no componente pai.
 */
@Component({
  selector: 'rentafit-cancellation-modal',
  imports: [FormsModule, PrintPreviewModalComponent],
  templateUrl: './cancellation-modal.component.html',
  styleUrl: './cancellation-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CancellationModalComponent implements OnInit {
  readonly summary = input.required<ReturnSummaryModel>();
  readonly busy = input<boolean>(false);

  readonly cancelled = output<void>();
  readonly confirmed = output<CancellationConfirmPayload>();

  private readonly customerService = inject(CustomerService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly customer = signal<ICustomer | null>(null);
  protected readonly applyRefund = signal(false);
  protected readonly refundAmount = signal<number | null>(null);
  protected readonly applyFine = signal(false);
  protected readonly fineAmount = signal<number | null>(null);
  protected readonly printed = signal(false);
  protected readonly showPrint = signal(false);

  protected readonly paidPayments = computed<PaymentPreviewModel[]>(
    () => this.summary().paymentsPreview.filter(p => p.status === 'PAID'),
  );

  /** Soma das parcelas PAID — teto do valor que pode ser devolvido. */
  protected readonly paidTotal = computed<number>(() =>
    this.paidPayments().reduce((sum, p) => sum + p.value, 0),
  );

  protected readonly refundAmountValid = computed<boolean>(() => {
    const value = this.refundAmount();
    return value !== null && value > 0 && value <= this.paidTotal();
  });

  /** Multa rescisória sugerida: 30% do valor total do contrato (Cláusula 6a). */
  protected readonly suggestedFine = computed<number>(
    () => Math.round(this.summary().totalValue * 0.3 * 100) / 100,
  );

  protected readonly canConfirm = computed<boolean>(
    () => this.printed() && !this.busy()
      && (!this.applyRefund() || this.refundAmountValid())
      && (!this.applyFine() || (this.fineAmount() !== null && this.fineAmount()! > 0)),
  );

  ngOnInit(): void {
    const customerId = this.summary().customerId;
    if (!customerId) return;
    this.customerService.getCustomerById(customerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: c => this.customer.set(c),
        error: () => this.customer.set(null),
      });
  }

  protected onApplyRefundToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.applyRefund.set(checked);
    if (checked && this.refundAmount() === null) {
      this.refundAmount.set(this.paidTotal());
    }
  }

  protected onRefundAmountInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const value = raw === '' ? null : Number(raw);
    this.refundAmount.set(value !== null && Number.isNaN(value) ? null : value);
  }

  protected onApplyFineToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.applyFine.set(checked);
    if (checked && this.fineAmount() === null) {
      this.fineAmount.set(this.suggestedFine());
    }
  }

  protected onFineAmountInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const value = raw === '' ? null : Number(raw);
    this.fineAmount.set(value !== null && Number.isNaN(value) ? null : value);
  }

  protected printTerm(): void {
    this.showPrint.set(true);
  }

  protected onPrintClosed(): void {
    this.showPrint.set(false);
    this.printed.set(true);
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }

  protected onConfirm(): void {
    if (!this.canConfirm()) return;
    this.confirmed.emit({
      refundAmount: this.applyRefund() ? (this.refundAmount() ?? undefined) : undefined,
      applyFine: this.applyFine(),
      fineAmount: this.applyFine() ? (this.fineAmount() ?? undefined) : undefined,
    });
  }

  protected readonly printData = computed<Partial<InterpolationContext>>(() => {
    const s = this.summary();
    const c = this.customer();
    const address = [c?.address?.street, c?.number, c?.complement]
      .filter(Boolean)
      .join(', ');
    return {
      cliente: {
        codigo: c?.legacyId ?? '',
        nome: c?.name || s.customerName,
        documento: c?.document ?? '',
        rg: '',
        endereco: address,
        bairro: c?.address?.neighborhood ?? '',
        cidade: c?.address?.city ?? '',
        uf: c?.address?.state ?? '',
        cep: c?.address?.zipCode ?? '',
        telefone: (c?.phones ?? []).join(' / '),
        email: c?.email ?? '',
      },
      contrato: {
        numero: s.legacyId,
        dataRetirada: this.formatDate(s.pickupDate),
        dataUso: this.formatDate(s.eventDate),
        dataDevolucao: this.formatDate(s.returnDate),
        dataEmissao: this.formatDate(s.pickupDate),
        valorTotal: this.formatCurrency(s.totalValue),
        atendente: '',
        observacoes: '',
      },
      itensContrato: s.items.map(i => ({
        codigo: i.itemId.slice(0, 8),
        descricao: i.description,
        valor: 0,
      })),
    };
  });

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  protected formatDate(iso?: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return y && m && d ? `${d}/${m}/${y}` : iso;
  }
}
