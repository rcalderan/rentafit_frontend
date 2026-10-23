import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnChanges,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import {
  IDailyMovementSummary,
  IMonthlyBucket,
  IPaymentMethodBreakdown,
  MONTH_SHORT_NAMES_PT,
  MovementViewMode,
  PAYMENT_METHOD_LABELS,
} from '../../../../data/financial-movement.model';
import {
  ChartCanvasRendererService,
  IChartInstanceHandle,
} from '../../../../service/chart-canvas-renderer.service';

/**
 * Gráficos analíticos de movimentação financeira (Barras de evolução diária/mensal
 * e Rosca de distribuição por forma de pagamento).
 */
@Component({
  selector: 'rentafit-finance-charts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './finance-charts.component.html',
  styleUrl: './finance-charts.component.css',
})
export class FinanceChartsComponent implements AfterViewInit, OnChanges, OnDestroy {
  readonly viewMode = input.required<MovementViewMode>();
  readonly days = input<IDailyMovementSummary[]>([]);
  readonly months = input<IMonthlyBucket[]>([]);
  readonly byPaymentMethod = input<IPaymentMethodBreakdown[]>([]);

  protected readonly barCanvas = viewChild<ElementRef<HTMLCanvasElement>>('barCanvas');
  protected readonly doughnutCanvas = viewChild<ElementRef<HTMLCanvasElement>>('doughnutCanvas');

  private readonly chartRenderer = inject(ChartCanvasRendererService);
  private barHandle: IChartInstanceHandle | null = null;
  private doughnutHandle: IChartInstanceHandle | null = null;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.refreshCharts();
  }

  ngOnChanges(): void {
    if (!this.viewReady) {
      return;
    }
    this.refreshCharts();
  }

  ngOnDestroy(): void {
    this.destroyHandles();
  }

  private refreshCharts(): void {
    this.destroyHandles();
    this.barHandle = this.chartRenderer.render(
      this.barCanvas()?.nativeElement,
      this.buildBarConfig(),
    );
    this.doughnutHandle = this.chartRenderer.render(
      this.doughnutCanvas()?.nativeElement,
      this.buildDoughnutConfig(),
    );
  }

  private destroyHandles(): void {
    this.barHandle?.destroy();
    this.doughnutHandle?.destroy();
    this.barHandle = null;
    this.doughnutHandle = null;
  }

  private buildBarConfig(): ChartConfiguration {
    if (this.viewMode() === 'YEARLY') {
      return this.buildYearlyBarConfig(this.months());
    }
    return this.buildMonthlyBarConfig(this.days());
  }

  private buildMonthlyBarConfig(days: IDailyMovementSummary[]): ChartConfiguration {
    const labels = days.map((d) => d.date.slice(8, 10));
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Aluguel (Líquido)',
            data: days.map((d) => d.rentalNetAmount),
            backgroundColor: '#4f46e5',
          },
          {
            label: 'Venda (Líquido)',
            data: days.map((d) => d.saleNetAmount),
            backgroundColor: '#db2777',
          },
          {
            label: 'Previsto (A Receber)',
            data: days.map((d) => d.pendingAmount),
            backgroundColor: '#38bdf8',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    };
  }

  private buildYearlyBarConfig(months: IMonthlyBucket[]): ChartConfiguration {
    const labels = months.map((m) => MONTH_SHORT_NAMES_PT[m.month - 1] ?? String(m.month));
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Aluguel (Líquido)',
            data: months.map((m) => m.rentalNetAmount),
            backgroundColor: '#4f46e5',
          },
          {
            label: 'Venda (Líquido)',
            data: months.map((m) => m.saleNetAmount),
            backgroundColor: '#db2777',
          },
          {
            label: 'Previsto (A Receber)',
            data: months.map((m) => m.pendingAmount),
            backgroundColor: '#38bdf8',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    };
  }

  private buildDoughnutConfig(): ChartConfiguration {
    const items = this.byPaymentMethod();
    const labels = items.map((i) => PAYMENT_METHOD_LABELS[i.paymentMethod] ?? i.paymentMethod);
    const values = items.map((i) => Math.max(0, i.netRealizedAmount + i.pendingAmount));
    return {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#6366f1', '#ec4899'],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    };
  }
}
