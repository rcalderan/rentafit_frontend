export type MovementSourceFilter = 'ALL' | 'RENTAL' | 'SALE';
export type MovementViewMode = 'MONTHLY' | 'YEARLY';
export type MovementPaymentMethod =
  | 'CASH'
  | 'PIX'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'BANK_TRANSFER';
export type MovementPaymentStatus = 'PAID' | 'PENDING' | 'MULTA' | 'REFUNDED';

export interface IFinancialTransaction {
  paymentId: string;
  source: 'RENTAL' | 'SALE';
  referenceId: string;
  referenceCode: string;
  customerName: string;
  installmentNumber: number;
  installments: number;
  paymentDate: string;
  paymentMethod: MovementPaymentMethod;
  status: MovementPaymentStatus;
  value: number;
  signedValue: number;
  /** Setor do caixa que recebeu a parcela (null = legado pré-V44). */
  sectorId?: string | null;
  sectorName?: string | null;
  sectorCode?: string | null;
  /** CNPJ da Matriz/Filial dona do setor. */
  issuerCnpj?: string | null;
}

export interface IPaymentMethodBreakdown {
  paymentMethod: MovementPaymentMethod;
  paidAmount: number;
  fineAmount: number;
  refundedAmount: number;
  netRealizedAmount: number;
  pendingAmount: number;
  transactionCount: number;
}

export interface IDailyMovementSummary {
  date: string;
  paidAmount: number;
  fineAmount: number;
  refundedAmount: number;
  netRealizedAmount: number;
  pendingAmount: number;
  rentalNetAmount: number;
  saleNetAmount: number;
  rentalPendingAmount: number;
  salePendingAmount: number;
  transactionCount: number;
}

/** Consolidado por setor de caixa (sectorId nulo = lançamentos legados). */
export interface ISectorMovementBreakdown {
  sectorId: string | null;
  sectorName: string | null;
  sectorCode: string | null;
  issuerCnpj: string | null;
  paidAmount: number;
  fineAmount: number;
  refundedAmount: number;
  netRealizedAmount: number;
  pendingAmount: number;
  transactionCount: number;
}

export interface IMonthlyBucket {
  month: number;
  paidAmount: number;
  fineAmount: number;
  refundedAmount: number;
  netRealizedAmount: number;
  pendingAmount: number;
  rentalNetAmount: number;
  saleNetAmount: number;
  rentalPendingAmount: number;
  salePendingAmount: number;
  transactionCount: number;
}

export interface IMonthlyMovementResponse {
  year: number;
  month: number;
  paidTotal: number;
  fineTotal: number;
  refundedTotal: number;
  netRealizedTotal: number;
  pendingTotal: number;
  rentalNetTotal: number;
  saleNetTotal: number;
  rentalPendingTotal: number;
  salePendingTotal: number;
  byPaymentMethod: IPaymentMethodBreakdown[];
  bySector?: ISectorMovementBreakdown[];
  days: IDailyMovementSummary[];
  transactions: IFinancialTransaction[];
}

export interface IYearlyMovementResponse {
  year: number;
  availableYears: number[];
  paidTotal: number;
  fineTotal: number;
  refundedTotal: number;
  netRealizedTotal: number;
  pendingTotal: number;
  rentalNetTotal: number;
  saleNetTotal: number;
  rentalPendingTotal: number;
  salePendingTotal: number;
  byPaymentMethod: IPaymentMethodBreakdown[];
  bySector?: ISectorMovementBreakdown[];
  months: IMonthlyBucket[];
}

export interface ICalendarCell {
  key: string;
  day: number | null;
  dateStr: string | null;
  isToday: boolean;
  isSelected: boolean;
  summary: IDailyMovementSummary | null;
}

export const PAYMENT_METHOD_LABELS: Record<MovementPaymentMethod, string> = {
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão de Crédito',
  DEBIT_CARD: 'Cartão de Débito',
  CASH: 'Dinheiro',
  BANK_TRANSFER: 'Transferência',
};

export const PAYMENT_STATUS_LABELS: Record<MovementPaymentStatus, string> = {
  PAID: 'Pago',
  PENDING: 'Pendente',
  MULTA: 'Multa',
  REFUNDED: 'Estorno',
};

export const MONTH_NAMES_PT: readonly string[] = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export const MONTH_SHORT_NAMES_PT: readonly string[] = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];
