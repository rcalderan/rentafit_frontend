import { CommonModule } from '@angular/common';
import { Component, DestroyRef, effect, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TerminalOperatorService } from '../../../auth/services/terminal-operator.service';
import { ReturnFacadeService } from '../../service/return-facade.service';
import { RentalContractService } from '../../service/rental-contract.service';
import { ReturnApiPort } from './data/return-api.port';
import { ReturnApiHttpService } from './service/return-api-http.service';
import { ReturnItemModel, ReturnAccessoryModel } from './data/return.model';
import { CancellationModalComponent, CancellationConfirmPayload } from './components/cancellation-modal/cancellation-modal.component';
import { TabService } from '../../../../shared/services/tab.service';

@Component({
  selector: 'rentafit-return',
  standalone: true,
  imports: [CommonModule, FormsModule, CancellationModalComponent],
  templateUrl: './return.component.html',
  styleUrl: './return.component.css',
  providers: [
    ReturnFacadeService,
    { provide: ReturnApiPort, useClass: ReturnApiHttpService },
  ],
})
export class ReturnComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly facade = inject(ReturnFacadeService);
  private readonly operatorService = inject(TerminalOperatorService);
  private readonly contractService = inject(RentalContractService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tabService = inject(TabService);

  readonly summary = this.facade.summary;

  private readonly titleEffect = effect(() => {
    const s = this.summary();
    const label = s?.legacyId ? `Devolução ${s.legacyId}` : 'Devolução';
    this.tabService.updateActiveTitle(label);
  });
  readonly loading = this.facade.loading;
  readonly error = this.facade.error;
  readonly saving = this.facade.saving;
  readonly closing = this.facade.closing;
  readonly form = this.facade.form;
  readonly canClose = this.facade.canDirectClose;
  readonly hasChanges = this.facade.hasChanges;
  readonly delayWarning = this.facade.delayWarning;
  readonly unpaidPaymentsCount = this.facade.unpaidPaymentsCount;
  readonly showConfirmButton = this.facade.showConfirmButton;

  readonly closeSuccess = signal(false);
  readonly withdrawSuccess = signal(false);
  readonly showCancellation = signal(false);

  // Modo lookup: rota /rental/return sem contractId
  readonly lookupMode = signal(false);
  readonly lookupQuery = signal('');
  readonly lookupLoading = signal(false);
  readonly lookupError = signal<string | null>(null);

  /** Desistência disponível para SIGNED e FINALIZED (antes da data de devolução). */
  readonly canWithdraw = computed(() => {
    const s = this.summary();
    return !!s && (s.contractStatus === 'SIGNED' || s.contractStatus === 'FINALIZED');
  });

  /** SIGNED: contrato ainda não saiu — devolução granular não se aplica. */
  readonly isSignedOnly = computed(() => this.summary()?.contractStatus === 'SIGNED');

  /** CLOSED/CANCELLED: tela abre somente para consulta — formulários travados. */
  readonly isTerminal = computed(() => {
    const s = this.summary()?.contractStatus;
    return s === 'CLOSED' || s === 'CANCELLED';
  });

  readonly terminalBanner = computed(() => {
    const s = this.summary()?.contractStatus;
    if (s === 'CLOSED') return 'Contrato concluído — devolução já encerrada.';
    if (s === 'CANCELLED') return 'Contrato cancelado por desistência.';
    return null;
  });

  readonly canConfirmReturn = computed(() => {
    const returnerName = this.form().returnerName?.trim();
    const fineOk = !this.form().applyFine || this.isValidFineAmount();
    return this.showConfirmButton() && !!returnerName && returnerName.length > 0 && fineOk;
  });

  readonly allItemsSelected = computed(() => {
    const summary = this.summary();
    if (!summary) return false;
    return summary.items.every(item => {
      const itemSelected = this.form().selectedItems.has(item.itemId);
      const allAccessoriesSelected = item.accessories.length === 0 || 
        item.accessories.every(acc => this.form().selectedAccessories.get(item.itemId)?.has(acc.accessoryId));
      return itemSelected && allAccessoriesSelected;
    });
  });

  readonly paymentStatusLabels: Record<string, string> = {
    PENDING: 'Pendente',
    PAID: 'Pago',
    CANCELLED: 'Cancelado',
    MULTA: 'Multa',
    REFUNDED: 'Reembolsado',
  };

  readonly paymentStatusClasses: Record<string, string> = {
    PENDING: 'status-pending',
    PAID: 'status-paid',
    CANCELLED: 'status-cancelled',
    MULTA: 'status-multa',
    REFUNDED: 'status-refunded',
  };

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const contractId = params.get('contractId');
        if (!contractId) {
          this.lookupMode.set(true);
          this.tabService.updateActiveTitle('Devolução');
          return;
        }
        this.lookupMode.set(false);
        this.withdrawSuccess.set(false);
        this.closeSuccess.set(false);
        this.facade.loadContract(contractId);
      });
  }

  onLookupInput(event: Event): void {
    this.lookupQuery.set((event.target as HTMLInputElement).value);
  }

  onLookupSubmit(): void {
    const query = this.lookupQuery().trim();
    if (!query || this.lookupLoading()) return;
    this.lookupLoading.set(true);
    this.lookupError.set(null);
    this.contractService.getByLegacyId(query).subscribe({
      next: contract => {
        this.lookupLoading.set(false);
        if (!contract.id) {
          this.lookupError.set('Contrato sem identificador — verifique o cadastro.');
          return;
        }
        this.router.navigate(['/rental/return', contract.id]);
      },
      error: err => {
        this.lookupLoading.set(false);
        this.lookupError.set(err instanceof Error ? err.message : 'Contrato não encontrado.');
      },
    });
  }

  onReturnerNameChange(value: string): void {
    this.facade.setReturnerName(value);
  }

  isItemSelected(itemId: string): boolean {
    return this.form().selectedItems.has(itemId);
  }

  isAccessorySelected(itemId: string, accessoryId: string): boolean {
    const itemSet = this.form().selectedAccessories.get(itemId);
    return itemSet?.has(accessoryId) ?? false;
  }

  onItemToggle(item: ReturnItemModel, checked: boolean): void {
    this.facade.toggleItem(item.itemId, checked);
  }

  onAccessoryToggle(itemId: string, accessory: ReturnAccessoryModel, checked: boolean): void {
    this.facade.toggleAccessory(itemId, accessory.accessoryId, checked);
  }

  onApplyFineToggle(checked: boolean): void {
    this.facade.setApplyFine(checked);
  }

  onFineAmountChange(value: string): void {
    const num = parseFloat(value);
    this.facade.setFineAmount(isNaN(num) ? null : num);
  }

  isValidFineAmount(): boolean {
    const amount = this.form().fineAmount;
    return amount !== null && amount > 0;
  }

  getFineAmount(): number {
    return this.form().fineAmount ?? 0;
  }

  onConfirmReturn(): void {
    if (!this.canConfirmReturn()) return;
    this.operatorService
      .authorize({ title: 'Confirmar Devolução', requirePin: false })
      .subscribe(op => {
        if (!op) return;
        this.facade.saveMarkings(op.employeeId).subscribe(success => {
          if (success) {
            this.facade.clearError();
          }
        });
      });
  }

  onSaveMarkings(): void {
    this.facade.saveMarkings().subscribe(success => {
      if (success) {
        this.facade.clearError();
      }
    });
  }

  onCloseContract(): void {
    if (!this.canClose()) return;
    this.operatorService
      .authorize({ title: 'Autorizar Fechamento de Contrato', requirePin: false })
      .subscribe(op => {
        if (!op) return;
        this.facade.closeContract(op.employeeId).subscribe(success => {
          if (success) {
            this.closeSuccess.set(true);
            setTimeout(() => {
              this.router.navigate(['/rental/management']);
            }, 2000);
          }
        });
      });
  }

  openCancellation(): void {
    if (!this.canWithdraw()) return;
    this.showCancellation.set(true);
  }

  onCancellationCancelled(): void {
    this.showCancellation.set(false);
  }

  /**
   * Chamado pelo modal após o Termo de Desistência ter sido impresso e o
   * operador confirmar que o cliente assinou — exige PIN (ação sensível).
   */
  onCancellationConfirmed(payload: CancellationConfirmPayload): void {
    this.operatorService
      .authorize({ title: 'Confirmar Desistência — Assinatura Coletada', requirePin: true })
      .subscribe(op => {
        if (!op) return;
        this.facade
          .withdraw({ employeeId: op.employeeId, ...payload })
          .subscribe(success => {
            if (!success) return;
            this.showCancellation.set(false);
            this.withdrawSuccess.set(true);
            setTimeout(() => {
              this.router.navigate(['/rental/management']);
            }, 2000);
          });
      });
  }

  onRetryLoad(): void {
    const contractId = this.route.snapshot.paramMap.get('contractId');
    if (contractId) {
      this.facade.loadContract(contractId);
    }
  }

  onCancel(): void {
    this.router.navigate(['/rental/management']);
  }

  onContractIdClick(): void {
    const s = this.summary();
    if (s) {
      this.router.navigate(['/rental/new'], { queryParams: { id: s.contractId } });
    }
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  }

  formatDateTime(dateStr: string | undefined): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('pt-BR');
  }
}
