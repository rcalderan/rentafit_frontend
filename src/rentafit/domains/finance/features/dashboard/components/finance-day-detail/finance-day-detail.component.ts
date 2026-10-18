import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { formatDateBr } from '../../../../../../shared/utils/date-format';
import {
  IDailyMovementSummary,
  IFinancialTransaction,
  IPaymentMethodBreakdown,
  MovementPaymentMethod,
  MovementPaymentStatus,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../../../../data/financial-movement.model';

const ORDERED_METHODS: readonly MovementPaymentMethod[] = [
  'PIX',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'CASH',
  'BANK_TRANSFER',
];

/**
 * Painel de detalhe do dia selecionado no calendário, exibindo o resumo por forma de pagamento
 * e o extrato clicável de parcelas de aluguel e venda.
 */
@Component({
  selector: 'rentafit-finance-day-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe],
  templateUrl: './finance-day-detail.component.html',
  styleUrl: './finance-day-detail.component.css',
})
export class FinanceDayDetailComponent {
  readonly selectedDate = input.required<string>();
  readonly summary = input<IDailyMovementSummary | null>(null);
  readonly transactions = input.required<IFinancialTransaction[]>();

  readonly transactionSelected = output<IFinancialTransaction>();

  protected readonly formattedSelectedDate = computed(() => formatDateBr(this.selectedDate()));

  protected readonly dayMethodBreakdown = computed<IPaymentMethodBreakdown[]>(() => {
    const txs = this.transactions();
    return ORDERED_METHODS.map((method) => this.computeMethodBreakdown(method, txs));
  });

  protected methodLabel(method: MovementPaymentMethod): string {
    return PAYMENT_METHOD_LABELS[method] ?? method;
  }

  protected statusLabel(status: MovementPaymentStatus): string {
    return PAYMENT_STATUS_LABELS[status] ?? status;
  }

  protected selectTransaction(tx: IFinancialTransaction): void {
    this.transactionSelected.emit(tx);
  }

  private computeMethodBreakdown(
    method: MovementPaymentMethod,
    txs: IFinancialTransaction[],
  ): IPaymentMethodBreakdown {
    let paidAmount = 0;
    let fineAmount = 0;
    let refundedAmount = 0;
    let pendingAmount = 0;
    let transactionCount = 0;

    for (const tx of txs) {
      if (tx.paymentMethod !== method) continue;
      transactionCount++;
      if (tx.status === 'PAID') paidAmount += tx.value;
      if (tx.status === 'MULTA') fineAmount += tx.value;
      if (tx.status === 'REFUNDED') refundedAmount += tx.value;
      if (tx.status === 'PENDING') pendingAmount += tx.value;
    }

    return {
      paymentMethod: method,
      paidAmount,
      fineAmount,
      refundedAmount,
      netRealizedAmount: paidAmount + fineAmount - refundedAmount,
      pendingAmount,
      transactionCount,
    };
  }
}
