import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DailyRentalReportService } from '../../service/daily-rental-report.service';
import { IDailyRentalReport } from '../../data/daily-report.interface';
import { Sector } from '../../../sector/data/sector.model';
import { SectorService } from '../../../sector/service/sector.service';

@Component({
  selector: 'rentafit-daily-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './daily-report.component.html',
  styleUrl: './daily-report.component.css',
})
export class DailyReportComponent implements OnInit {
  private readonly reportService = inject(DailyRentalReportService);
  private readonly sectorService = inject(SectorService);

  protected readonly startDate = signal<string>(DailyReportComponent.today());
  protected readonly endDate = signal<string>(DailyReportComponent.today());
  protected readonly sectors = signal<Sector[]>([]);
  /** '' = todos os setores (inclui legados sem setor). */
  protected readonly sectorId = signal<string>('');
  protected readonly report = signal<IDailyRentalReport | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMsg = signal<string | null>(null);

  protected readonly isPeriod = computed(() => this.startDate() !== this.endDate());

  protected readonly isEmpty = computed(() => {
    const current = this.report();
    return current != null && current.groups.length === 0;
  });

  ngOnInit(): void {
    this.sectorService.list(true).subscribe({
      next: (list) => this.sectors.set(list),
      error: () => this.sectors.set([]),
    });
    this.generate();
  }

  protected generate(): void {
    const start = this.startDate();
    const end = this.endDate();
    if (!start || !end) {
      this.errorMsg.set('Selecione o período para gerar o relatório.');
      return;
    }
    if (end < start) {
      this.errorMsg.set('A data final não pode ser anterior à data inicial.');
      return;
    }
    this.isLoading.set(true);
    this.errorMsg.set(null);
    this.reportService.getByPeriod(start, end, this.sectorId() || null).subscribe({
      next: (data) => {
        this.report.set(data);
        this.isLoading.set(false);
      },
      error: (err: Error) => {
        this.errorMsg.set(err.message);
        this.report.set(null);
        this.isLoading.set(false);
      },
    });
  }

  protected print(): void {
    window.print();
  }

  protected formatDate(value: string): string {
    if (!value) return '';
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
  }

  protected formatLongDate(value: string): string {
    if (!value) return '';
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  protected periodLabel(start: string, end: string): string {
    if (start === end) return this.formatLongDate(start);
    return `${this.formatDate(start)} a ${this.formatDate(end)}`;
  }

  private static today(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }
}
