export interface PaymentPreviewModel {
  paymentId: string;
  installmentNumber: number;
  value: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'MULTA' | 'REFUNDED';
  paymentDate?: string;
}

export interface ReturnAccessoryModel {
  accessoryId: string;
  description: string;
  type: 'ACESSORIO';
  isReturned: boolean;
  returnedAt?: string;
  returnedBy?: string;
}

export interface ReturnItemModel {
  itemId: string;
  description: string;
  isReturned: boolean;
  returnedAt?: string;
  returnedBy?: string;
  accessories: ReturnAccessoryModel[];
}

export interface ReturnSummaryModel {
  contractId: string;
  legacyId: string;
  customerName: string;
  customerId?: string;
  contractStatus: string;
  pickupDate?: string;
  eventDate?: string;
  returnDate: string;
  actualReturnDate?: string;
  totalValue: number;
  pendingCount: number;
  isFullyReturned: boolean;
  delayDays: number;
  suggestedFine: number;
  returnerName?: string;
  items: ReturnItemModel[];
  paymentsPreview: PaymentPreviewModel[];
}

export interface MarkReturnEntryModel {
  itemId: string;
  accessoryId?: string;
  returnedAt: string;
}

export interface MarkReturnRequestModel {
  returnerName: string;
  employeeId: string;
  entries: MarkReturnEntryModel[];
}

export interface CloseReturnRequestModel {
  employeeId: string;
  applyFine: boolean;
  fineAmount?: number;
}

export interface WithdrawRequestModel {
  employeeId: string;
  /** Valor a devolver ao cliente (0 < x <= total pago). Ausente = sem devolução. */
  refundAmount?: number;
  applyFine: boolean;
  fineAmount?: number;
}

export interface ReturnFormState {
  returnerName: string;
  selectedItems: Set<string>;
  selectedAccessories: Map<string, Set<string>>;
  applyFine: boolean;
  fineAmount: number | null;
}
