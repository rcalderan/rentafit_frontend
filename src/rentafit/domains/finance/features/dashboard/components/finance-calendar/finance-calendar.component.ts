import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  ICalendarCell,
  IDailyMovementSummary,
  MONTH_NAMES_PT,
} from '../../../../data/financial-movement.model';

/**
 * Calendário mensal interativo que exibe em cada dia o valor movimentado (Realizado e Previsto)
 * e permite selecionar um dia para consultar o extrato detalhado.
 */
@Component({
  selector: 'rentafit-finance-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe],
  templateUrl: './finance-calendar.component.html',
  styleUrl: './finance-calendar.component.css',
})
export class FinanceCalendarComponent {
  readonly year = input.required<number>();
  readonly month = input.required<number>();
  readonly days = input.required<IDailyMovementSummary[]>();
  readonly selectedDate = input.required<string>();
  readonly todayDate = input<string>('');

  readonly daySelected = output<string>();

  protected readonly weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

  protected readonly monthTitle = computed(() => {
    const m = this.month();
    const name = MONTH_NAMES_PT[m - 1] ?? '';
    return `${name} de ${this.year()}`;
  });

  protected readonly calendarCells = computed<ICalendarCell[]>(() => {
    const year = this.year();
    const month = this.month();
    const summariesByDate = new Map(this.days().map((d) => [d.date, d]));
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const totalDays = new Date(year, month, 0).getDate();
    const cells: ICalendarCell[] = [];

    for (let pad = 0; pad < firstWeekday; pad++) {
      cells.push(this.createEmptyCell(`pad-start-${pad}`));
    }

    for (let day = 1; day <= totalDays; day++) {
      const dateStr = this.formatIsoDate(year, month, day);
      cells.push({
        key: dateStr,
        day,
        dateStr,
        isToday: dateStr === this.todayDate(),
        isSelected: dateStr === this.selectedDate(),
        summary: summariesByDate.get(dateStr) ?? null,
      });
    }

    return cells;
  });

  /**
   * Seleciona um dia do calendário e emite a data ISO (YYYY-MM-DD).
   *
   * Exemplo: `component.selectCell(cell)`
   */
  protected selectCell(cell: ICalendarCell): void {
    if (!cell.dateStr) {
      return;
    }
    this.daySelected.emit(cell.dateStr);
  }

  private createEmptyCell(key: string): ICalendarCell {
    return {
      key,
      day: null,
      dateStr: null,
      isToday: false,
      isSelected: false,
      summary: null,
    };
  }

  private formatIsoDate(year: number, month: number, day: number): string {
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }
}
