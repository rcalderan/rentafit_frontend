import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { APP_CONFIG, AppConfig } from '../../../shared/data/app-config.token';
import {
  FiscalDocumentType,
  FiscalOrigin,
  ICancelInvoiceRequest,
  IEmailInvoiceRequest,
  IEmitInvoiceRequest,
  IFiscalDocument,
  IFiscalListParams,
  INfeCustomerInfo,
  INfeItem,
  InvoiceStatusApi,
  IPage,
} from '../data/fiscal-document.types';
import { FiscalDocumentService } from './fiscal-document.service';

/** Resposta do backend para emissão de NFS-e (InvoiceEmissionResponseDTO). */
interface INfseEmitResponse {
  accessKey?: string;
  invoiceNumber?: number;
  series: string;
  protocol: string;
  status: string;
  issueDate?: string;
  processingDate: string;
  serviceValue: number;
  authorizedXml?: string;
}

/** Resposta do backend para emissão de NF-e (NfeResponse). */
interface INfeEmitResponse {
  accessKey: string;
  number?: string;
  series?: string;
  protocol?: string;
  receiptNumber?: string;
  cStat?: string;
  xMotivo?: string;
  status: string;
  authorizedXml?: string;
}

/** Resposta do backend para eventos da NF-e (NfeEventResponse). */
interface INfeEventResponse {
  accessKey?: string;
  protocol?: string;
  status: string;
  statusCode?: string;
  statusMessage?: string;
  eventXml?: string;
}

/** Documento fiscal persistido no backend (entidade FiscalDocument). */
interface IBackendFiscalDocument {
  id: string;
  type: string;
  status: string;
  accessKey?: string;
  protocol?: string;
  number?: number;
  series?: string;
  authorizationDate?: string;
  issueDate?: string;
  emissionDate?: string;
  totalValue?: number;
  rejectionReason?: string;
  serviceDescription?: string;
  cancelReason?: string;
  cancelledAt?: string;
  cancelProtocol?: string;
  signedXml?: string;
  authorizedXml?: string;
  customerEmail?: string;
  customerName?: string;
  customerDocument?: string;
  origin?: string;
  originId?: string;
}

/** Página retornada pelo backend para listagens de documentos fiscais. */
interface IBackendFiscalPage {
  content: IBackendFiscalDocument[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/**
 * Serviço HTTP real de emissão de documentos fiscais.
 *
 * - NF-e modelo 55 é emitida pelo microsserviço `costume-rental-nfe` via
 *   prefixo `/nfe-api/*` (roteado pelo Nginx com auth_request).
 * - NFS-e é emitida pelo microsserviço `costume-rental-nfse` via `/nfse-api/*`.
 * - Listagem, detalhe e XML permanecem em `/api/fiscal-documents/*` do Rentafit.
 *
 * O ambiente é controlado por `APP_CONFIG.apiBaseUrl` (vazio em dev => proxy).
 * A aplicação deve ser configurada para apontar para homologação, nunca
 * produção, quando emitir notas reais.
 */
@Injectable({ providedIn: 'root' })
export class FiscalDocumentHttpService extends FiscalDocumentService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);

  emit(request: IEmitInvoiceRequest): Observable<IFiscalDocument> {
    return request.fiscalDocumentType === 'NFE' ? this.emitNfe(request) : this.emitNfse(request);
  }

  /** Persiste/atualiza um documento fiscal já emitido no Rentafit. */
  save(document: IFiscalDocument): Observable<IFiscalDocument> {
    const body = this.toBackendSyncRequest(document);
    return this.http.post<IBackendFiscalDocument>(this.url('/api/fiscal-documents'), body).pipe(
      map((doc) => this.mergeBackendDocument(document, doc)),
      catchError((err: HttpErrorResponse) => throwError(() => this.mapearErroHttp(err))),
    );
  }

  /** NF-e/NFC-e é síncrona: AUTHORIZED = EMITTED, REJECTED = DENIED. */
  private emitNfe(request: IEmitInvoiceRequest): Observable<IFiscalDocument> {
    const defaults = this.config.fiscalDefaults?.nfe;
    if (!defaults) {
      return throwError(() =>
        this.criarErroAmigavel(0, 'Configuração fiscal de NF-e ausente em APP_CONFIG.'),
      );
    }
    if (!request.items || request.items.length === 0) {
      return throwError(() =>
        this.criarErroAmigavel(0, 'Itens são obrigatórios para emissão do documento fiscal.'),
      );
    }
    const isNfce = request.documentModel === '65';
    if (!isNfce && !request.customer) {
      return throwError(() =>
        this.criarErroAmigavel(0, 'Dados do destinatário são obrigatórios para NF-e (modelo 55).'),
      );
    }
    const documentType: FiscalDocumentType = isNfce ? 'NFCE' : 'NFE';
    const body: Record<string, unknown> = {
      customerId: request.customerId,
      natureOperation: request.natureOperation ?? 'Venda de mercadoria',
      modelo: request.documentModel ?? '55',
      origin: request.origin,
      originId: request.originId,
      customer: request.customer,
      items: request.items.map((item) => ({
        ...item,
        ncm: item.ncm || defaults.ncm,
        cfop: item.cfop || request.cfop || defaults.cfop,
        unit: item.unit || defaults.unit,
      })),
      payment: request.payment,
      printReceipt: request.printReceipt ?? true,
    };
    return this.http.post<INfeEmitResponse>(this.url('/nfe-api/emit'), body).pipe(
      map((res) => this.toFiscalDocumentFromEmission(documentType, res, request)),
      catchError((err: HttpErrorResponse) => throwError(() => this.mapearErroHttp(err))),
    );
  }

  /**
   * NFS-e: endpoint do Portal Nacional. Pode ser 201 (síncrona) ou 202 (assíncrona).
   * Os campos fiscais (cTribNac, NBS, alíquotas, município de prestação) são
   * resolvidos pelo backend a partir do emitente configurado em sistema/cnpj —
   * mesma fonte de verdade da NF-e. O browser envia apenas dados da operação.
   */
  private emitNfse(request: IEmitInvoiceRequest): Observable<IFiscalDocument> {
    return this.http
      .post<INfseEmitResponse>(this.url('/nfse-api/nfse/emit'), this.toNfseEmissionBody(request))
      .pipe(
        map((res) => this.toFiscalDocumentFromEmission('NFSE', res, request)),
        catchError((err: HttpErrorResponse) => throwError(() => this.mapearErroHttp(err))),
      );
  }

  private toNfseEmissionBody(request: IEmitInvoiceRequest): Record<string, unknown> {
    return {
      descricaoServico: request.serviceDescription || undefined,
      vServ: request.value,
      nomeTomador: request.customerName,
      docTomador: request.customerDocument?.replace(/\D/g, ''),
      emailTomador: request.customerEmail,
    };
  }

  checkStatus(current: IFiscalDocument): Observable<IFiscalDocument> {
    if (current.type === 'NFE' && current.accessKey) {
      return this.http.get<INfeEmitResponse>(this.url(`/nfe-api/${current.accessKey}`)).pipe(
        map((res) => this.mergeNfeResponse(current, res)),
        catchError((err: HttpErrorResponse) => throwError(() => this.mapearErroHttp(err))),
      );
    }
    return this.http
      .get<IBackendFiscalDocument>(this.url(`/api/fiscal-documents/${current.id}`))
      .pipe(map((doc) => this.mergeBackendDocument(current, doc)));
  }

  cancel(current: IFiscalDocument, request: ICancelInvoiceRequest): Observable<IFiscalDocument> {
    if (!current.accessKey) {
      return throwError(() => new Error('Chave de acesso não disponível para cancelamento.'));
    }
    if (current.type === 'NFE') {
      if (!current.protocol) {
        return throwError(
          () => new Error('Protocolo de autorização não disponível para cancelamento.'),
        );
      }
      const body = {
        protocol: current.protocol,
        justification: request.reason,
        sequence: request.sequence ?? '1',
      };
      return this.http
        .post<INfeEventResponse>(this.url(`/nfe-api/${current.accessKey}/cancelar`), body)
        .pipe(
          map((res) => this.toFiscalDocumentFromNfeEvent(current, res, request.reason)),
          catchError((err: HttpErrorResponse) => throwError(() => this.mapearErroHttp(err))),
        );
    }
    return throwError(
      () => new Error('Cancelamento de NFS-e ainda não disponível via este serviço.'),
    );
  }

  reemit(_current: IFiscalDocument): Observable<IFiscalDocument> {
    return throwError(() => new Error('Reemissão de nota fiscal ainda não disponível no backend.'));
  }

  sendEmail(_id: string, _request: IEmailInvoiceRequest): Observable<boolean> {
    return throwError(
      () => new Error('Envio de e-mail de nota fiscal ainda não disponível no backend.'),
    );
  }

  downloadXml(documentId: string): Observable<Blob> {
    return this.http.get(this.url(`/api/fiscal-documents/${documentId}/xml`), {
      responseType: 'blob',
    });
  }

  downloadDanfe(_documentId: string): Observable<Blob> {
    return throwError(() => new Error('DANF-e local ainda não está disponível no backend.'));
  }

  /**
   * Lista documentos fiscais paginados e filtrados no backend.
   * O backend espera status no formato original (PENDING, AUTHORIZED, etc.).
   */
  list(params: IFiscalListParams): Observable<IPage<IFiscalDocument>> {
    const httpParams = this.buildListParams(params);
    return this.http
      .get<IBackendFiscalPage>(this.url('/api/fiscal-documents'), { params: httpParams })
      .pipe(map((page) => this.toFiscalPage(page)));
  }

  private buildListParams(params: IFiscalListParams): HttpParams {
    let httpParams = new HttpParams()
      .set('page', (params.page ?? 0).toString())
      .set('size', (params.size ?? 20).toString());

    httpParams = this.setParamIfPresent(httpParams, 'sort', params.sort);
    httpParams = this.setParamIfPresent(httpParams, 'type', params.type);
    httpParams = this.setParamIfPresent(httpParams, 'origin', params.origin);
    httpParams = this.setParamIfPresent(
      httpParams,
      'status',
      params.status ? this.toBackendStatus(params.status) : null,
    );
    httpParams = this.setParamIfPresent(httpParams, 'customerDocument', params.customerDocument);
    httpParams = this.setParamIfPresent(httpParams, 'accessKey', params.accessKey);
    return httpParams;
  }

  private setParamIfPresent(
    params: HttpParams,
    key: string,
    value: string | null | undefined,
  ): HttpParams {
    return value ? params.set(key, value) : params;
  }

  private toFiscalPage(page: IBackendFiscalPage): IPage<IFiscalDocument> {
    return {
      content: page.content.map((doc) => this.toFiscalDocument(doc)),
      number: page.number,
      size: page.size,
      totalElements: page.totalElements,
      totalPages: page.totalPages,
    };
  }

  /** Busca um documento fiscal pelo id interno do backend. */
  findById(id: string): Observable<IFiscalDocument> {
    return this.http
      .get<IBackendFiscalDocument>(this.url(`/api/fiscal-documents/${id}`))
      .pipe(map((doc) => this.toFiscalDocument(doc)));
  }

  private url(path: string): string {
    const base = this.config.apiBaseUrl.replace(/\/$/, '');
    return `${base}${path}`;
  }

  /**
   * Converte uma resposta HTTP de erro em um Error amigável para o usuário.
   * HTTP 500 só é usado para falhas técnicas inesperadas; rejeições fiscais
   * esperadas (400/422) devolvem mensagem legível com o motivo da SEFAZ.
   * Quando o backend incluir `data`, o XML gerado é anexado ao erro para
   * permitir diagnóstico/download no frontend.
   */
  private mapearErroHttp(error: HttpErrorResponse): Error {
    if (error.error instanceof ErrorEvent) {
      return this.criarErroAmigavel(
        0,
        'Falha de conectividade. Verifique a internet e tente novamente.',
      );
    }

    const status = error.status;
    const body = error.error;
    let backendMessage: string;
    let xml: string | undefined;

    if (body && typeof body === 'object') {
      backendMessage =
        (typeof body.statusMessage === 'string' ? body.statusMessage : undefined) ??
        (typeof body.error === 'string' ? body.error : undefined) ??
        (typeof body.message === 'string' ? body.message : undefined) ??
        error.message;
      xml = typeof body.data === 'string' ? body.data : undefined;
    } else if (typeof body === 'string') {
      backendMessage = body;
    } else {
      backendMessage = error.message;
    }

    if (status === 400 || status === 422) {
      const motivo = backendMessage || 'Requisição rejeitada pela SEFAZ/Sistema fiscal.';
      return this.criarErroAmigavel(status, this.mensagemComOrientacaoIm(motivo), xml);
    }

    if (status === 401 || status === 403) {
      return this.criarErroAmigavel(
        status,
        'Autenticação ou certificado digital inválido. Verifique as credenciais fiscais.',
      );
    }

    if (status === 404) {
      return this.criarErroAmigavel(
        status,
        'Endpoint fiscal não encontrado. Verifique a configuração da API.',
      );
    }

    if (status === 408 || status === 0) {
      return this.criarErroAmigavel(
        status,
        'Tempo de resposta excedido. A SEFAZ pode estar indisponível.',
      );
    }

    if (status >= 502 && status <= 504) {
      return this.criarErroAmigavel(
        status,
        'Serviço fiscal indisponível no momento. Tente novamente mais tarde.',
      );
    }

    // Falha técnica não esperada: 500 ou outro status desconhecido.
    const mensagem = backendMessage || `Falha técnica inesperada (HTTP ${status}).`;
    return this.criarErroAmigavel(status, mensagem, xml);
  }

  /**
   * Orienta o usuário a ajustar a opção "Enviar IM na NFS-e" em Sistema → CNPJ
   * quando a Receita rejeita por causa da Inscrição Municipal do prestador.
   * E0120 (IM não deve ser informada) → desmarque; IM obrigatória → marque.
   */
  private mensagemComOrientacaoIm(motivo: string): string {
    const isRejeicaoIm =
      /E0120|IM do prestador|inscri[cç][aã]o municipal do prestador/i.test(motivo);
    if (!isRejeicaoIm) {
      return motivo;
    }
    const imRejeitada = /n[aã]o deve ser informad/i.test(motivo);
    const acao = imRejeitada ? 'desmarque' : 'marque';
    return `${motivo} — Em Sistema → CNPJ, ${acao} a opção "Enviar IM na NFS-e" ao lado da Inscrição Municipal e tente novamente.`;
  }

  private criarErroAmigavel(status: number, message: string, xml?: string): Error {
    const erro = new Error(message);
    (erro as any).status = status;
    if (xml) {
      (erro as any).xml = xml;
    }
    return erro;
  }

  private toFiscalDocumentFromEmission(
    type: FiscalDocumentType,
    response: INfeEmitResponse | INfseEmitResponse,
    request: IEmitInvoiceRequest,
  ): IFiscalDocument {
    if (type === 'NFE' || type === 'NFCE') {
      const nfe = response as INfeEmitResponse;
      return {
        id: `NFE-${nfe.accessKey.slice(0, 12)}`,
        type,
        status: this.mapStatus(nfe.status),
        number: nfe.number,
        series: nfe.series,
        accessKey: nfe.accessKey,
        protocol: nfe.protocol,
        receiptNumber: nfe.receiptNumber,
        value: request.value,
        natureOperation: request.natureOperation,
        purpose: request.purpose,
        customerName: request.customerName ?? request.customer?.name,
        customerEmail: request.customerEmail,
        customerDocument: request.customerDocument ?? request.customer?.document,
        origin: request.origin,
        originId: request.originId,
        emissionDate: new Date().toISOString(),
        xmlUrl: nfe.authorizedXml,
      };
    }

    const nfse = response as INfseEmitResponse;
    return {
      id: `NFSE-${nfse.accessKey ?? nfse.protocol}`,
      type: 'NFSE',
      status: this.mapStatus(nfse.status),
      accessKey: nfse.accessKey,
      number: nfse.invoiceNumber?.toString(),
      series: nfse.series,
      protocol: nfse.protocol,
      sendProtocol: nfse.status === 'PENDING' ? nfse.protocol : undefined,
      value: request.value,
      serviceDescription: request.serviceDescription,
      customerName: request.customerName,
      customerEmail: request.customerEmail,
      customerDocument: request.customerDocument,
      origin: request.origin,
      originId: request.originId,
      emissionDate: nfse.issueDate ?? nfse.processingDate,
      sentAt: nfse.processingDate,
      xmlUrl: nfse.authorizedXml,
    };
  }

  private mergeNfeResponse(current: IFiscalDocument, response: INfeEmitResponse): IFiscalDocument {
    return {
      ...current,
      status: this.mapStatus(response.status),
      number: response.number ?? current.number,
      series: response.series ?? current.series,
      accessKey: response.accessKey ?? current.accessKey,
      protocol: response.protocol ?? current.protocol,
      receiptNumber: response.receiptNumber ?? current.receiptNumber,
      xmlUrl: response.authorizedXml ?? current.xmlUrl,
    };
  }

  private toFiscalDocumentFromNfeEvent(
    current: IFiscalDocument,
    response: INfeEventResponse,
    cancelReason?: string,
  ): IFiscalDocument {
    const isConfirmedCancel = response.protocol != null;
    return {
      ...current,
      status: this.mapStatus(response.status),
      accessKey: response.accessKey ?? current.accessKey,
      protocol: response.protocol ?? current.protocol,
      cancelProtocol: response.protocol ?? current.cancelProtocol,
      cancelReason: isConfirmedCancel
        ? (cancelReason ?? current.cancelReason)
        : (response.statusMessage ?? current.cancelReason),
      cancelledAt: new Date().toISOString(),
      xmlUrl: response.eventXml ?? current.xmlUrl,
    };
  }

  private toBackendSyncRequest(document: IFiscalDocument): Record<string, unknown> {
    return {
      type: document.type,
      origin: document.origin,
      originId: document.originId,
      accessKey: document.accessKey,
      number: document.number ? Number(document.number.replace(/\D/g, '')) : undefined,
      series: document.series,
      protocol: document.protocol,
      status: this.toBackendStatus(document.status ?? 'PENDING_EMISSION'),
      totalValue: document.value,
      customerName: document.customerName,
      customerDocument: document.customerDocument,
      customerEmail: document.customerEmail,
      issueDate: document.emissionDate,
      authorizedXml: document.xmlUrl,
      serviceDescription: document.serviceDescription,
      cancelReason: document.cancelReason,
      cancelledAt: document.cancelledAt,
      cancelProtocol: document.cancelProtocol,
    };
  }

  private mergeBackendDocument(
    current: IFiscalDocument,
    doc: IBackendFiscalDocument,
  ): IFiscalDocument {
    return {
      ...current,
      id: doc.id ?? current.id,
      status: this.mapStatus(doc.status),
      accessKey: doc.accessKey ?? current.accessKey,
      protocol: doc.protocol ?? current.protocol,
      number: doc.number?.toString() ?? current.number,
      series: doc.series ?? current.series,
      emissionDate:
        doc.authorizationDate ?? doc.issueDate ?? doc.emissionDate ?? current.emissionDate,
      xmlUrl: doc.authorizedXml ?? doc.signedXml ?? current.xmlUrl,
      customerName: doc.customerName ?? current.customerName,
      customerEmail: doc.customerEmail ?? current.customerEmail,
    };
  }

  private toFiscalDocument(doc: IBackendFiscalDocument): IFiscalDocument {
    return {
      id: doc.id,
      type: doc.type as FiscalDocumentType,
      status: this.mapStatus(doc.status),
      number: doc.number?.toString(),
      series: doc.series,
      accessKey: doc.accessKey,
      emissionDate: doc.authorizationDate ?? doc.issueDate ?? doc.emissionDate,
      protocol: doc.protocol,
      value: doc.totalValue,
      serviceDescription: doc.serviceDescription,
      cancelReason: doc.cancelReason,
      cancelledAt: doc.cancelledAt,
      cancelProtocol: doc.cancelProtocol,
      customerEmail: doc.customerEmail,
      customerName: doc.customerName,
      customerDocument: doc.customerDocument,
      origin: doc.origin as FiscalOrigin,
      originId: doc.originId,
    };
  }

  private toBackendStatus(status: InvoiceStatusApi): string {
    switch (status) {
      case 'PENDING_EMISSION':
        return 'PENDING';
      case 'EMITTED':
        return 'AUTHORIZED';
      case 'DENIED':
        return 'REJECTED';
      case 'CANCELLED':
        return 'CANCELLED';
      default:
        return 'PENDING';
    }
  }

  private mapStatus(backendStatus: string): InvoiceStatusApi {
    switch (backendStatus?.toUpperCase()) {
      case 'AUTHORIZED':
      case 'EMITTED':
      case 'AUTORIZADA':
        return 'EMITTED';
      case 'PENDING':
      case 'SIGNED':
      case 'TRANSMITTED':
      case 'PENDING_EMISSION':
      case 'PROCESSING':
      case 'EM PROCESSAMENTO':
        return 'PENDING_EMISSION';
      case 'REJECTED':
      case 'DENIED':
      case 'REJEITADA':
      case 'NEGADA':
        return 'DENIED';
      case 'CANCELLED':
      case 'CANCELADA':
        return 'CANCELLED';
      default:
        return 'PENDING_EMISSION';
    }
  }
}
