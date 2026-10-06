import {
  ContractStatusApi,
  ItemMetaTypeApi,
  PaymentMethodApi,
  PaymentStatusApi,
} from './rental-api.types';
import { InvoiceStatusApi } from '../../finance/data/fiscal-document.types';

export interface IPageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/**
 * Resposta do endpoint de listagem paginada (RentalContractSummaryDTO).
 * status é o nome do enum Java (ex: "FINALIZED"), não o código numérico.
 */
export interface IRentalContractSummaryResponse {
  id: string;
  legacyId?: string;
  contractType: number;
  status: string;
  statusDescription: string;
  customerId: string;
  customerName: string;
  parentContractId?: string;
  replacedByContractId?: string;
  eventDate: string;
  pickupDate: string;
  returnDate: string;
  returned: boolean;
  totalValue: number;
  paidValue: number;
  createdAt: string;
}

/**
 * Reserva ativa de um item (ItemReservationDTO) — endpoint
 * GET /api/v1/rental/contracts/byItem/{rentalItemId}.
 * Contratos SIGNED/FINALIZED com eventDate futuro que contêm o item.
 */
export interface IItemReservationResponse {
  contractId: string;
  legacyId?: string;
  customerId: string;
  customerName: string;
  customerLegacyId?: number;
  eventDate: string;
  pickupDate: string;
  returnDate: string;
  status: string;
  statusDescription: string;
}

export interface IItemMetaResponse {
  id: string;
  type: ItemMetaTypeApi;
  description: string;
  accessoryId?: string;
}

export interface IRentalContractItemResponse {
  id: string;
  rentalItemId?: string;
  legacyProductCode: string;
  description: string;
  value: number;
  isDelivered: boolean;
  attendantEmployeeId?: string;
  metadata: IItemMetaResponse[];
}

export interface IRentalPaymentResponse {
  id: string;
  installmentNumber: number;
  paymentDate: string;
  paymentMethod: PaymentMethodApi;
  value: number;
  installments: number;
  processedByEmployeeId?: string;
  status: PaymentStatusApi;
}

export interface IRentalContractResponse {
  id: string;
  legacyId?: string;
  status: ContractStatusApi;
  statusDescription: string;
  printTemplateId?: string | null;
  isReturned: boolean;
  returned?: boolean;
  revisedByAccountId?: string | null;
  confirmedByAccountId?: string | null;
  revisionConfirmedAt?: string | null;
  contractType: number;
  customerId: string;
  customerName: string;
  customerDocument: string;
  createdByEmployeeId?: string;
  returnedByEmployeeId?: string;
  pickupDate: string;
  eventDate: string;
  returnDate: string;
  actualReturnDate?: string;
  notes?: string;
  totalValue: number;
  paidValue: number;
  remainingValue: number;
  // Dados fiscais da NFS-e (preenchidos após emissão)
  invoiceStatus?: InvoiceStatusApi;
  invoiceStatusDescription?: string;
  invoiceId?: string;
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
  items: IRentalContractItemResponse[];
  payments?: IRentalPaymentResponse[];
  warnings?: string[];
  parentContractId?: string;
  replacedByContractId?: string;
  createdAt: string;
}
