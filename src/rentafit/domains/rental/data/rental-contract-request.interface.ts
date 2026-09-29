import { ItemMetaTypeApi, PaymentMethodApi, PaymentStatusApi } from './rental-api.types';

export interface IItemMetaRequest {
  type: ItemMetaTypeApi;
  description: string;
  accessoryId?: string | null;
}

export interface IRentalContractItemRequest {
  rentalItemId?: string | null;
  attendantEmployeeId: string;
  legacyProductCode: string;
  description: string;
  value: number;
  metadata: IItemMetaRequest[];
}

export interface IRentalContractCreateRequest {
  customerId: string;
  contractType: number;
  createdByEmployeeId: string;
  pickupDate: string;
  eventDate: string;
  returnDate: string;
  notes?: string;
  items: IRentalContractItemRequest[];
  payments: IRentalPaymentRequest[];
}

export type IRentalContractUpdateRequest = IRentalContractCreateRequest;

export interface IRentalContractSignRequest {
  printTemplateId: string;
}

export interface IProcessReturnRequest {
  actualReturnDate: string;
  returnedByEmployeeId: string;
}

export interface IRentalPaymentRequest {
  installmentNumber: number;
  paymentDate: string;
  paymentMethod: PaymentMethodApi;
  value: number;
  installments: number;
  processedByEmployeeId?: string;
  status: PaymentStatusApi;
}
