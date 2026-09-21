/**
 * Tipos fiscais compartilhados para emissão de documentos (NF-e modelo 55 e
 * NFS-e). Fonte canônica de `InvoiceStatusApi` — reexportada pelos domínios
 * sales/rental para evitar divergência de definição.
 */

export type FiscalDocumentType = 'NFE' | 'NFCE' | 'NFSE';

export type FiscalOrigin = 'SALES' | 'RENTAL' | 'MANUAL';

export type FiscalDocumentSort =
  | 'issueDate,asc'
  | 'issueDate,desc'
  | 'number,asc'
  | 'number,desc'
  | 'status,asc'
  | 'status,desc'
  | 'totalValue,asc'
  | 'totalValue,desc'
  | 'createdAt,asc'
  | 'createdAt,desc';

export type InvoiceStatusApi =
  | 'NONE' // Nenhuma nota emitida
  | 'PENDING_EMISSION' // Em processamento (aguardando autorizador)
  | 'EMITTED' // Autorizada com sucesso
  | 'CANCELLED' // Cancelada
  | 'DENIED'; // Negada/Rejeitada

export type InvoicePurposeApi = 'NORMAL' | 'COMPLEMENTARY' | 'ADJUSTMENT' | 'RETURN';

export const INVOICE_STATUS_LABELS: Record<InvoiceStatusApi, string> = {
  NONE: 'Nenhuma nota emitida',
  PENDING_EMISSION: 'Em processamento',
  EMITTED: 'Emitida com sucesso',
  CANCELLED: 'Cancelada',
  DENIED: 'Negada',
};

export const INVOICE_PURPOSE_LABELS: Record<InvoicePurposeApi, string> = {
  NORMAL: 'Normal',
  COMPLEMENTARY: 'Complementar',
  ADJUSTMENT: 'Ajuste',
  RETURN: 'Devolução',
};

/** Documento fiscal retornado pelo serviço (mockado nesta fase). */
export interface IFiscalDocument {
  id: string;
  type: FiscalDocumentType;
  status: InvoiceStatusApi;
  number?: string; // Número formatado (ex.: 000.123.456)
  series?: string;
  accessKey?: string; // 44 dígitos (NF-e) / 50 (NFS-e)
  emissionDate?: string;
  sendProtocol?: string; // Protocolo de envio (enquanto PENDING_EMISSION)
  receiptNumber?: string; // Número do recibo de envio (NF-e assíncrona)
  sentAt?: string;
  protocol?: string; // Protocolo de autorização
  value?: number;
  natureOperation?: string;
  purpose?: InvoicePurposeApi;
  serviceDescription?: string;
  cancelReason?: string;
  cancelledAt?: string;
  cancelProtocol?: string;
  xmlUrl?: string;
  danfeUrl?: string;
  cancelXmlUrl?: string;
  customerEmail?: string;
  customerName?: string;
  customerDocument?: string;
  origin?: FiscalOrigin;
  originId?: string;
}

/** Contexto da origem (pedido de venda ou contrato de locação). */
export interface IFiscalContext {
  origin: FiscalOrigin;
  originId?: string;
  isPaid: boolean; // Habilita emissão somente quando pago
  totalValue: number;
  customerId?: string;
  customerName?: string;
  customerDocument?: string;
  customerEmail?: string;
  /** Itens do pedido/contrato para composição da NF-e modelo 55. */
  items?: INfeItem[];
}

/** Dados do destinatário para NF-e modelo 55. */
export interface INfeCustomerInfo {
  name: string;
  document: string;
  ie?: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  cityName: string;
  state: string;
  zipCode: string;
  phone?: string;
}

/** Item de NF-e modelo 55. */
export interface INfeItem {
  productCode: string;
  description: string;
  ncm: string;
  cfop: string;
  unit: string;
  quantity: number;
  unitValue: number;
}

/** Forma de pagamento para NFC-e. */
export interface INfePaymentInfo {
  tPag: string;
  vPag?: number;
  indPag?: string;
  tpIntegra?: string;
  cnpjCredenciadora?: string;
  tBand?: string;
  cAut?: string;
  vTroco?: number;
}

/** Requisição de emissão — espelha InvoiceEmissionRequestDTO/NfeEmissionRequest. */
export interface IEmitInvoiceRequest {
  fiscalDocumentType: FiscalDocumentType;
  origin: FiscalOrigin;
  originId?: string;
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  customerDocument?: string;
  value: number;
  // NF-e (modelo 55) ou NFC-e (modelo 65)
  documentModel?: '55' | '65';
  natureOperation?: string;
  purpose?: InvoicePurposeApi;
  cfop?: string;
  customer?: INfeCustomerInfo;
  items?: INfeItem[];
  payment?: INfePaymentInfo;
  printReceipt?: boolean;
  // NFS-e (serviço)
  serviceCode?: string;
  nbsCode?: string;
  serviceDescription?: string;
  cityCode?: string;
  issRate?: number;
  totalTaxRate?: number;
  // Emitente (matriz/filial) — se omitido, usa a matriz ativa
  issuerCnpj?: string;
}

export interface ICancelInvoiceRequest {
  reason: string;
  sequence?: string;
}

export interface IEmailInvoiceRequest {
  email?: string;
  includeDanfe: boolean;
  includeXml: boolean;
}

/** Página genérica retornada por listagens do backend. */
export interface IPage<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** Parâmetros de listagem de documentos fiscais. */
export interface IFiscalListParams {
  page?: number;
  size?: number;
  sort?: FiscalDocumentSort;
  type?: FiscalDocumentType;
  origin?: FiscalOrigin;
  status?: InvoiceStatusApi;
  customerDocument?: string;
  accessKey?: string;
}
