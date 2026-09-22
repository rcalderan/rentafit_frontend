import { Directive, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';
import { APP_CONFIG } from '../../../../shared/data/app-config.token';
import { FiscalDocumentService } from '../../service/fiscal-document.service';
import {
  FiscalDocumentType,
  ICancelInvoiceRequest,
  IEmailInvoiceRequest,
  IEmitInvoiceRequest,
  IFiscalContext,
  IFiscalDocument,
  INVOICE_STATUS_LABELS,
  InvoiceStatusApi,
} from '../../data/fiscal-document.types';

/**
 * Base compartilhada pelos componentes de emissão fiscal (`nfe-emission` e
 * `nfse-emission`). Concentra estado e fluxo comuns; cada componente concreto
 * define o `fiscalType` e monta a requisição específica via `buildEmitRequest`.
 *
 * Decorada com `@Directive()` para que os inputs/outputs por função sejam
 * herdados corretamente pelos `@Component` filhos (padrão Angular de herança).
 */
@Directive()
export abstract class FiscalEmissionBase implements OnInit {
  protected readonly fiscalService = inject(FiscalDocumentService);
  protected readonly config = inject(APP_CONFIG);

  /** Tipo do documento — definido pelo componente concreto. */
  abstract readonly fiscalType: FiscalDocumentType;

  /** Monta a requisição de emissão com os campos específicos do tipo. */
  protected abstract buildEmitRequest(): IEmitInvoiceRequest;

  readonly context = input.required<IFiscalContext>();
  /** Documento já existente (ex.: vindo do pedido/contrato persistido). */
  readonly initialDocument = input<IFiscalDocument | null>(null);

  /** Emitido sempre que o documento muda, para o pai persistir o estado. */
  readonly changed = output<IFiscalDocument>();

  protected readonly document = signal<IFiscalDocument | null>(null);
  protected readonly isProcessing = signal(false);
  protected readonly errorMsg = signal<string | null>(null);
  protected readonly successMsg = signal<string | null>(null);
  protected readonly errorXml = signal<string | null>(null);
  protected readonly showCancelModal = signal(false);
  protected readonly showEmailModal = signal(false);

  protected readonly status = computed<InvoiceStatusApi>(() => this.document()?.status ?? 'NONE');

  /** Cliente possui documento (CPF/CNPJ) válido para emissão. */
  protected readonly hasCustomerDocument = computed(
    () => (this.context().customerDocument ?? '').trim().length > 0,
  );
  protected readonly requiresCustomerDocument: boolean = false;

  /** Emissão liberada: pedido pago e sem nota ativa. */
  protected readonly canEmit = computed(
    () =>
      this.context().isPaid &&
      (!this.requiresCustomerDocument || this.hasCustomerDocument()) &&
      this.status() === 'NONE',
  );

  ngOnInit(): void {
    this.document.set(this.initialDocument());
  }

  protected emit(): void {
    if (!this.context().isPaid) {
      this.errorMsg.set('O pedido precisa estar pago para emitir a nota fiscal.');
      return;
    }
    try {
      const request = this.buildEmitRequest();
      this.errorMsg.set(null);
      this.errorXml.set(null);
      this.run(this.fiscalService.emit(request), 'Emissão iniciada — aguardando autorizador.');
    } catch (err: any) {
      this.errorMsg.set(err?.message ?? 'Erro ao preparar a emissão da nota fiscal.');
      this.errorXml.set(err?.xml ?? null);
    }
  }

  protected checkStatus(): void {
    const current = this.document();
    if (!current) return;
    this.run(this.fiscalService.checkStatus(current), 'Nota autorizada com sucesso.');
  }

  protected confirmCancel(reason: string): void {
    const current = this.document();
    if (!current) return;
    const request: ICancelInvoiceRequest = { reason };
    this.showCancelModal.set(false);
    this.run(this.fiscalService.cancel(current, request), 'Nota cancelada.');
  }

  protected reemit(): void {
    const current = this.document();
    if (!current) return;
    this.run(this.fiscalService.reemit(current), 'Reemissão iniciada — aguardando autorizador.');
  }

  protected confirmEmail(request: IEmailInvoiceRequest): void {
    const current = this.document();
    if (!current) return;
    this.showEmailModal.set(false);
    this.isProcessing.set(true);
    this.errorMsg.set(null);
    this.fiscalService
      .sendEmail(current.id, request)
      .pipe(finalize(() => this.isProcessing.set(false)))
      .subscribe({
        next: () => this.flashSuccess('E-mail enviado.'),
        error: (err: Error) => this.errorMsg.set(err.message),
      });
  }

  protected downloadXml(): void {
    const xml = this.errorXml() ?? this.document()?.xmlUrl;
    if (!xml) return;
    this.triggerXmlDownload(xml, `${this.fiscalType.toLowerCase()}-${Date.now()}.xml`);
  }

  protected downloadDanfe(): void {
    if (!this.document()?.danfeUrl) return;
    this.flashSuccess('Download do DANFE iniciado (mock).');
  }

  private triggerXmlDownload(xml: string, filename: string): void {
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.flashSuccess('Download do XML iniciado.');
  }

  protected statusLabel(status: InvoiceStatusApi): string {
    return INVOICE_STATUS_LABELS[status];
  }

  protected formatCurrency(value: number | undefined): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      value ?? 0,
    );
  }

  protected formatDateTime(iso: string | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-BR');
  }

  /** Executa uma operação fiscal padrão (loading + atualização + change). */
  private run(source: ReturnType<FiscalDocumentService['emit']>, okMsg: string): void {
    this.isProcessing.set(true);
    this.errorMsg.set(null);
    this.errorXml.set(null);
    source
      .pipe(
        switchMap((doc: IFiscalDocument) => this.persistIfNeeded(doc)),
        finalize(() => this.isProcessing.set(false)),
      )
      .subscribe({
        next: (doc: IFiscalDocument) => {
          this.document.set(doc);
          this.errorXml.set(null);
          this.changed.emit(doc);
          this.flashSuccess(okMsg);
        },
        error: (err: Error) => {
          this.errorMsg.set(err.message);
          this.errorXml.set((err as any).xml ?? null);
        },
      });
  }

  /** Persiste o documento fiscal emitido no Rentafit. */
  private persistIfNeeded(doc: IFiscalDocument): Observable<IFiscalDocument> {
    if (doc.status === 'NONE' || !doc.accessKey) {
      return of(doc);
    }
    return this.fiscalService.save(doc).pipe(
      catchError((err: Error) => {
        const wrapped = new Error(`Emissão ok, mas falha ao salvar no Rentafit: ${err.message}`);
        return throwError(() => wrapped);
      }),
    );
  }

  private flashSuccess(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 3000);
  }
}
