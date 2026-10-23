import { Injectable, Signal, signal, computed, inject } from '@angular/core';
import { Observable, catchError, finalize, of, switchMap, tap } from 'rxjs';
import { ReturnApiPort } from '../features/return/data/return-api.port';
import {
  CloseReturnRequestModel,
  MarkReturnEntryModel,
  MarkReturnRequestModel,
  ReturnFormState,
  ReturnSummaryModel,
  WithdrawRequestModel,
} from '../features/return/data/return.model';

interface ReturnState {
  summary: ReturnSummaryModel | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  closing: boolean;
  form: ReturnFormState;
}

@Injectable()
export class ReturnFacadeService {
  private readonly api: ReturnApiPort = inject(ReturnApiPort);

  private readonly state = signal<ReturnState>({
    summary: null,
    loading: false,
    error: null,
    saving: false,
    closing: false,
    form: {
      returnerName: '',
      selectedItems: new Set<string>(),
      selectedAccessories: new Map<string, Set<string>>(),
      applyFine: false,
      fineAmount: null,
    },
  });

  readonly summary: Signal<ReturnSummaryModel | null> = computed(() => this.state().summary);
  readonly loading: Signal<boolean> = computed(() => this.state().loading);
  readonly error: Signal<string | null> = computed(() => this.state().error);
  readonly saving: Signal<boolean> = computed(() => this.state().saving);
  readonly closing: Signal<boolean> = computed(() => this.state().closing);
  readonly form: Signal<ReturnFormState> = computed(() => this.state().form);

  readonly unpaidPaymentsCount: Signal<number> = computed(() => {
    const s = this.state().summary;
    if (!s) return 0;
    return s.paymentsPreview.filter(p => p.status === 'PENDING').length;
  });

  readonly hasChanges: Signal<boolean> = computed(() => {
    const form = this.state().form;
    return form.selectedItems.size > 0 || form.selectedAccessories.size > 0;
  });

  /**
   * Fecha direto: todos devolvidos, sem parcelas pendentes e nome preenchido.
   * Não exige etapa intermediária de "Confirmar Devolução".
   */
  readonly canDirectClose: Signal<boolean> = computed(() => {
    const s = this.state().summary;
    const form = this.state().form;
    if (!s || !s.isFullyReturned) return false;
    if (!form.returnerName.trim()) return false;
    if (this.unpaidPaymentsCount() > 0) return false;
    if (form.applyFine && (form.fineAmount === null || form.fineAmount <= 0)) return false;
    return true;
  });

  /**
   * @deprecated Use canDirectClose. Mantido para compatibilidade com template legado.
   */
  readonly canClose = this.canDirectClose;

  /**
   * Exibe botão "Confirmar Devolução": há seleções parciais OU devolução completa
   * mas ainda existem parcelas pendentes (precisa confirmar antes de fechar).
   */
  readonly showConfirmButton: Signal<boolean> = computed(() => {
    const s = this.state().summary;
    if (!s) return false;
    const hasSelections = this.hasChanges();
    const fullyReturnedWithPending = s.isFullyReturned && this.unpaidPaymentsCount() > 0;
    return hasSelections || fullyReturnedWithPending;
  });

  readonly delayWarning: Signal<string | null> = computed(() => {
    const s = this.state().summary;
    if (!s || s.delayDays <= 0) return null;
    return `${s.delayDays} dia${s.delayDays > 1 ? 's' : ''} de atraso`;
  });

  loadContract(contractId: string): void {
    this.state.update(st => ({ ...st, loading: true, error: null }));

    this.api
      .getReturnSummary(contractId)
      .pipe(
        tap(summary => {
          this.state.update(st => ({
            ...st,
            summary,
            loading: false,
            form: {
              returnerName: summary.returnerName || '',
              selectedItems: new Set<string>(),
              selectedAccessories: new Map<string, Set<string>>(),
              applyFine: false,
              fineAmount: (!summary.isFullyReturned && summary.suggestedFine > 0) ? summary.suggestedFine : null,
            },
          }));
        }),
        catchError(err => {
          this.state.update(st => ({
            ...st,
            loading: false,
            error: err instanceof Error ? err.message : 'Erro ao carregar contrato.',
          }));
          return of(null);
        })
      )
      .subscribe();
  }

  setReturnerName(name: string): void {
    this.state.update(st => ({
      ...st,
      form: { ...st.form, returnerName: name },
    }));
  }

  toggleItem(itemId: string, checked: boolean): void {
    this.state.update(st => {
      const newSelected = new Set(st.form.selectedItems);
      if (checked) {
        newSelected.add(itemId);
      } else {
        newSelected.delete(itemId);
      }
      return {
        ...st,
        form: { ...st.form, selectedItems: newSelected },
      };
    });
  }

  toggleAccessory(itemId: string, accessoryId: string, checked: boolean): void {
    this.state.update(st => {
      const newMap = new Map(st.form.selectedAccessories);
      const itemSet = new Set(newMap.get(itemId) || []);

      if (checked) {
        itemSet.add(accessoryId);
      } else {
        itemSet.delete(accessoryId);
      }

      if (itemSet.size > 0) {
        newMap.set(itemId, itemSet);
      } else {
        newMap.delete(itemId);
      }

      return {
        ...st,
        form: { ...st.form, selectedAccessories: newMap },
      };
    });
  }

  setApplyFine(apply: boolean): void {
    this.state.update(st => ({
      ...st,
      form: { ...st.form, applyFine: apply },
    }));
  }

  setFineAmount(amount: number | null): void {
    this.state.update(st => ({
      ...st,
      form: { ...st.form, fineAmount: amount },
    }));
  }

  saveMarkings(employeeId?: string): Observable<boolean> {
    const s = this.state();
    if (!s.summary || (!s.form.selectedItems.size && !s.form.selectedAccessories.size)) {
      return of(false);
    }

    const entries: MarkReturnEntryModel[] = [];
    const now = new Date().toISOString();

    for (const itemId of s.form.selectedItems) {
      entries.push({ itemId, returnedAt: now });
    }

    for (const [itemId, accessoryIds] of s.form.selectedAccessories.entries()) {
      for (const accessoryId of accessoryIds) {
        entries.push({ itemId, accessoryId, returnedAt: now });
      }
    }

    const request: MarkReturnRequestModel = {
      returnerName: s.form.returnerName,
      employeeId: employeeId ?? '',
      entries,
    };

    this.state.update(st => ({ ...st, saving: true, error: null }));

    return this.api.markItemsReturned(s.summary!.contractId, request).pipe(
      tap(summary => {
        this.state.update(st => ({
          ...st,
          summary,
          saving: false,
          form: {
            ...st.form,
            selectedItems: new Set<string>(),
            selectedAccessories: new Map<string, Set<string>>(),
          },
        }));
      }),
      switchMap(() => of(true)),
      catchError(err => {
        this.state.update(st => ({
          ...st,
          saving: false,
          error: err instanceof Error ? err.message : 'Erro ao salvar marcações.',
        }));
        return of(false);
      })
    );
  }

  closeContract(employeeId: string): Observable<boolean> {
    const s = this.state();
    if (!s.summary || !this.canClose()) {
      return of(false);
    }

    const request: CloseReturnRequestModel = {
      employeeId,
      applyFine: s.form.applyFine,
      fineAmount: s.form.applyFine ? s.form.fineAmount || undefined : undefined,
    };

    this.state.update(st => ({ ...st, closing: true, error: null }));

    return this.api.closeReturn(s.summary!.contractId, request).pipe(
      tap(summary => {
        this.state.update(st => ({
          ...st,
          summary,
          closing: false,
        }));
      }),
      switchMap(() => of(true)),
      catchError(err => {
        this.state.update(st => ({
          ...st,
          closing: false,
          error: err instanceof Error ? err.message : 'Erro ao fechar contrato.',
        }));
        return of(false);
      })
    );
  }

  /**
   * Desistência: chamado só após o Termo ser impresso e o operador confirmar
   * a assinatura do cliente via PIN (gate no componente).
   */
  withdraw(request: Omit<WithdrawRequestModel, 'employeeId'> & { employeeId: string }): Observable<boolean> {
    const s = this.state();
    if (!s.summary) {
      return of(false);
    }

    this.state.update(st => ({ ...st, closing: true, error: null }));

    return this.api.withdraw(s.summary.contractId, request).pipe(
      tap(() => {
        this.state.update(st => ({ ...st, closing: false }));
      }),
      switchMap(() => of(true)),
      catchError(err => {
        this.state.update(st => ({
          ...st,
          closing: false,
          error: err instanceof Error ? err.message : 'Erro ao registrar desistência.',
        }));
        return of(false);
      })
    );
  }

  clearError(): void {
    this.state.update(st => ({ ...st, error: null }));
  }
}
