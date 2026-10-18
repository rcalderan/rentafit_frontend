import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  EmployeeConfirmedEvent,
  EmployeeVerifyComponent,
} from '../../../rental/features/employee-verify/employee-verify.component';
import {
  IDailyMovementSummary,
  IFinancialTransaction,
  IMonthlyBucket,
  IMonthlyMovementResponse,
  IPaymentMethodBreakdown,
  IYearlyMovementResponse,
  MONTH_NAMES_PT,
  MovementSourceFilter,
  MovementViewMode,
} from '../../data/financial-movement.model';
import { FinancialMovementService } from '../../service/financial-movement.service';
import { FinanceCalendarComponent } from './components/finance-calendar/finance-calendar.component';
import { FinanceChartsComponent } from './components/finance-charts/finance-charts.component';
import { FinanceDayDetailComponent } from './components/finance-day-detail/finance-day-detail.component';

/**
 * Painel Financeiro consolidado (Diário, Mensal e Anual) para movimentação de Aluguéis e Vendas.
 * Exige autenticação via Sigla + PIN de um usuário com perfil ADMIN ou MANAGER.
 */
@Component({
  selector: 'rentafit-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    EmployeeVerifyComponent,
    FinanceCalendarComponent,
    FinanceDayDetailComponent,
    FinanceChartsComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private readonly movementService = inject(FinancialMovementService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly allowedRoles = ['ADMIN', 'MANAGER'];
  protected readonly isUnlocked = signal(false);
  protected readonly authorizedOperator = signal<{ name: string; initials: string } | null>(null);

  protected readonly viewMode = signal<MovementViewMode>('MONTHLY');
  protected readonly sourceFilter = signal<MovementSourceFilter>('ALL');

  private readonly now = new Date();
  protected readonly todayIso = this.toIsoDate(
    this.now.getFullYear(),
    this.now.getMonth() + 1,
    this.now.getDate(),
  );

  protected readonly selectedYear = signal(this.now.getFullYear());
  protected readonly selectedMonth = signal(this.now.getMonth() + 1);
  protected readonly selectedDate = signal(this.todayIso);

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly monthlyData = signal<IMonthlyMovementResponse | null>(null);
  protected readonly yearlyData = signal<IYearlyMovementResponse | null>(null);

  protected readonly periodLabel = computed(() => {
    if (this.viewMode() === 'YEARLY') {
      return `Ano ${this.selectedYear()}`;
    }
    const monthName = MONTH_NAMES_PT[this.selectedMonth() - 1] ?? '';
    return `${monthName} / ${this.selectedYear()}`;
  });

  protected readonly activeTotals = computed(() => {
    const active = this.viewMode() === 'MONTHLY' ? this.monthlyData() : this.yearlyData();
    return {
      paidTotal: active?.paidTotal ?? 0,
      fineTotal: active?.fineTotal ?? 0,
      refundedTotal: active?.refundedTotal ?? 0,
      netRealizedTotal: active?.netRealizedTotal ?? 0,
      pendingTotal: active?.pendingTotal ?? 0,
      projectedTotal: (active?.netRealizedTotal ?? 0) + (active?.pendingTotal ?? 0),
      rentalNetTotal: active?.rentalNetTotal ?? 0,
      saleNetTotal: active?.saleNetTotal ?? 0,
    };
  });

  protected readonly activeByPaymentMethod = computed<IPaymentMethodBreakdown[]>(() => {
    const active = this.viewMode() === 'MONTHLY' ? this.monthlyData() : this.yearlyData();
    return active?.byPaymentMethod ?? [];
  });

  protected readonly selectedDaySummary = computed<IDailyMovementSummary | null>(() => {
    const days = this.monthlyData()?.days ?? [];
    return days.find((d) => d.date === this.selectedDate()) ?? null;
  });

  protected readonly selectedDayTransactions = computed<IFinancialTransaction[]>(() => {
    const txs = this.monthlyData()?.transactions ?? [];
    return txs.filter((tx) => tx.paymentDate === this.selectedDate());
  });

  /**
   * Confirma o acesso mediante Sigla e PIN de ADMIN/MANAGER e carrega os dados financeiros.
   *
   * Exemplo: `dashboard.onAccessConfirmed(event)`
   */
  onAccessConfirmed(event: EmployeeConfirmedEvent): void {
    this.authorizedOperator.set({
      name: event.employeeName,
      initials: event.initials ?? 'OK',
    });
    this.isUnlocked.set(true);
    this.reload();
  }

  /**
   * Cancela a verificação de Sigla e PIN e retorna ao dashboard inicial.
   *
   * Exemplo: `dashboard.onAccessCancelled()`
   */
  onAccessCancelled(): void {
    this.router.navigate(['/home/dashboard']);
  }

  protected setViewMode(mode: MovementViewMode): void {
    if (this.viewMode() === mode) return;
    this.viewMode.set(mode);
    this.reload();
  }

  protected setSourceFilter(source: MovementSourceFilter): void {
    if (this.sourceFilter() === source) return;
    this.sourceFilter.set(source);
    this.reload();
  }

  protected navigatePeriod(delta: number): void {
    if (this.viewMode() === 'YEARLY') {
      this.selectedYear.update((y) => y + delta);
      this.reload();
      return;
    }
    const target = new Date(this.selectedYear(), this.selectedMonth() - 1 + delta, 1);
    const nextYear = target.getFullYear();
    const nextMonth = target.getMonth() + 1;
    this.selectedYear.set(nextYear);
    this.selectedMonth.set(nextMonth);
    this.selectedDate.set(this.toIsoDate(nextYear, nextMonth, 1));
    this.reload();
  }

  protected onDaySelected(dateStr: string): void {
    this.selectedDate.set(dateStr);
  }

  protected openMonthFromYearly(bucket: IMonthlyBucket): void {
    const year = this.selectedYear();
    this.selectedMonth.set(bucket.month);
    this.selectedDate.set(this.toIsoDate(year, bucket.month, 1));
    this.viewMode.set('MONTHLY');
    this.reload();
  }

  protected openTransaction(tx: IFinancialTransaction): void {
    if (tx.source === 'RENTAL') {
      this.router.navigate(['/rental/new'], { queryParams: { id: tx.referenceId } });
      return;
    }
    this.router.navigate(['/sales/management'], { queryParams: { id: tx.referenceId } });
  }

  protected monthName(month: number): string {
    return MONTH_NAMES_PT[month - 1] ?? String(month);
  }

  protected reload(): void {
    if (!this.isUnlocked()) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);

    if (this.viewMode() === 'YEARLY') {
      this.loadYearly();
      return;
    }
    this.loadMonthly();
  }

  private loadMonthly(): void {
    this.movementService
      .getMonthlyMovement(this.selectedYear(), this.selectedMonth(), this.sourceFilter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.monthlyData.set(response);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Não foi possível carregar a movimentação mensal.');
          this.isLoading.set(false);
        },
      });
  }

  private loadYearly(): void {
    this.movementService
      .getYearlyMovement(this.selectedYear(), this.sourceFilter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.yearlyData.set(response);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Não foi possível carregar a movimentação anual.');
          this.isLoading.set(false);
        },
      });
  }

  private toIsoDate(year: number, month: number, day: number): string {
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }
}
