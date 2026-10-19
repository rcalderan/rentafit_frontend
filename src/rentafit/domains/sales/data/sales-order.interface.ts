import { InvoiceStatusApi, SalesItemStatusApi, SalesOrderStatusApi } from './sales-api.types';

type UUID = string;

/** Item de pedido de venda — resposta da API (SalesOrderItemDetailsDTO) */
export interface ISalesOrderItem {
  id?: UUID;
  retailProductId: UUID;
  sku: string;
  description: string;
  unitPrice: number;
  quantity: number;
  discountValue: number;
  totalValue?: number;
  itemStatus: SalesItemStatusApi;
  itemStatusDescription?: string;
  attendantEmployeeId?: UUID;
  needsTailoring: boolean;
  tailoringNotes?: string;
  deliveredAt?: string;
  deliveredByEmployeeId?: UUID;
  /** Setor onde o item foi entregue. */
  deliveredSectorId?: UUID | null;
  warrantyDays?: number;
}

/** Pagamento de venda — resposta da API (SalesPaymentDetailsDTO) */
export interface ISalesPayment {
  id?: UUID;
  installmentNumber: number;
  paymentDate: string;
  paymentMethod: string;
  paymentMethodLabel?: string;
  value: number;
  installments: number;
  processedByEmployeeId?: UUID;
  status: string;
  statusDescription?: string;
  /** Setor do caixa que recebeu a parcela. */
  sectorId?: UUID | null;
}

/** Pedido de venda detalhado — resposta da API (SalesOrderDetailsDTO) */
export interface ISalesOrder {
  id?: UUID;
  legacyId?: string;
  status: SalesOrderStatusApi;
  statusDescription?: string;
  customerId?: UUID;
  customerName?: string;
  customerDocument?: string;
  createdByEmployeeId?: UUID;
  /** Setor de origem do pedido de venda. */
  sectorId?: UUID | null;
  notes?: string;
  discountValue: number;
  invoiceStatus: InvoiceStatusApi;
  invoiceStatusDescription?: string;
  invoiceId?: string;
  // Dados fiscais da NF-e/NFS-e (preenchidos após emissão)
  invoiceNumber?: string;
  invoiceSeries?: string;
  invoiceAccessKey?: string;
  invoiceEmissionDate?: string;
  invoiceProtocol?: string;
  invoiceCancelReason?: string;
  invoiceCancelledAt?: string;
  invoiceCancelProtocol?: string;
  invoiceXmlUrl?: string;
  invoiceDanfeUrl?: string;
  invoiceCustomerEmail?: string;
  invoiceNatureOperation?: string;
  invoicePurpose?: string;
  subtotal?: number;
  totalValue?: number;
  paidValue?: number;
  remainingValue?: number;
  createdAt?: string;
  updatedAt?: string;
  items: ISalesOrderItem[];
  payments: ISalesPayment[];
  warnings?: string[];
}

/** Resumo do pedido para listagem (SalesOrderSummaryDTO) */
export interface ISalesOrderSummary {
  id: UUID;
  legacyId: string;
  status: SalesOrderStatusApi;
  statusDescription: string;
  customerId?: UUID;
  customerName?: string;
  invoiceStatus: InvoiceStatusApi;
  totalValue: number;
  paidValue: number;
  itemCount: number;
  /** Setor de origem do pedido. */
  sectorId?: UUID | null;
  createdAt: string;
}
