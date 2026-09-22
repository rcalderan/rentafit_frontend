import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FiscalEmissionBase } from '../fiscal-shared/fiscal-emission.base';
import { InvoiceCancelModalComponent } from '../fiscal-shared/invoice-cancel-modal.component';
import { InvoiceEmailModalComponent } from '../fiscal-shared/invoice-email-modal.component';
import { FiscalDocumentType, IEmitInvoiceRequest } from '../../data/fiscal-document.types';
import { IssuerSetupService } from '../../../auth/services/issuer-setup.service';
import { IssuerInfo } from '../../../auth/data/issuer.model';

/**
 * Emissão de NFS-e (serviço) para contratos de locação. Estende a base fiscal
 * compartilhada. Os campos fiscais (cTribNac, NBS, alíquotas, município) vêm
 * do emitente configurado em sistema/cnpj — mesma fonte de verdade da NF-e.
 */
@Component({
  selector: 'rentafit-nfse-emission',
  imports: [FormsModule, InvoiceCancelModalComponent, InvoiceEmailModalComponent],
  templateUrl: './nfse-emission.component.html',
  styleUrl: './nfse-emission.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NfseEmissionComponent extends FiscalEmissionBase implements OnInit {
  readonly fiscalType: FiscalDocumentType = 'NFSE';
  protected override readonly requiresCustomerDocument = true;

  private readonly issuerSetupService = inject(IssuerSetupService);

  /** Emitente ativo carregado do backend (sistema/cnpj). */
  protected readonly issuer = signal<IssuerInfo | null>(null);

  /** Descrição do serviço: padrão do emitente, editável por emissão. */
  protected readonly serviceDescription = signal('');

  /** Valores fiscais resolvidos do emitente (read-only no formulário). */
  protected readonly fiscalFields = signal({
    serviceCode: '',
    nbsCode: '',
    cityCode: '',
    issRate: 0,
    totalTaxRate: 0,
  });

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadIssuer();
  }

  private loadIssuer(): void {
    const defaults = this.config.fiscalDefaults?.nfse;
    this.issuerSetupService.getCurrentIssuer().subscribe({
      next: (issuer: IssuerInfo | null) => {
        this.issuer.set(issuer);
        this.fiscalFields.set({
          serviceCode: issuer?.nfseServiceCode ?? defaults?.serviceCode ?? '',
          nbsCode: issuer?.nfseNbsCode ?? defaults?.nbsCode ?? '',
          cityCode: issuer?.municipioCodigo ?? '',
          issRate: issuer?.nfseIssRate ?? defaults?.isqnRate ?? 0,
          totalTaxRate: issuer?.nfseTotalTaxRate ?? defaults?.totalTaxRate ?? 0,
        });
        this.serviceDescription.set(
          issuer?.nfseServiceDescription ?? defaults?.serviceDescription ?? '',
        );
      },
      error: () => {
        // Fallback para APP_CONFIG quando o emitente não estiver configurado.
        this.fiscalFields.set({
          serviceCode: defaults?.serviceCode ?? '',
          nbsCode: defaults?.nbsCode ?? '',
          cityCode: '',
          issRate: defaults?.isqnRate ?? 0,
          totalTaxRate: defaults?.totalTaxRate ?? 0,
        });
        this.serviceDescription.set(defaults?.serviceDescription ?? '');
      },
    });
  }

  protected buildEmitRequest(): IEmitInvoiceRequest {
    const ctx = this.context();
    return {
      fiscalDocumentType: 'NFSE',
      origin: 'RENTAL',
      originId: ctx.originId,
      customerId: ctx.customerId,
      customerEmail: ctx.customerEmail,
      customerName: ctx.customerName,
      customerDocument: ctx.customerDocument,
      value: ctx.totalValue,
      serviceDescription: this.serviceDescription(),
    };
  }
}
