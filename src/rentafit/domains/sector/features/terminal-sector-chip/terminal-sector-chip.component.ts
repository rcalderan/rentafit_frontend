import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Sector } from '../../data/sector.model';
import { SectorService } from '../../service/sector.service';
import { TerminalSectorService } from '../../service/terminal-sector.service';

/**
 * Badge do top-bar com o setor vinculado a ESTE terminal (contexto da máquina,
 * não do usuário autenticado). O operador pode trocar o vínculo pelo menu —
 * troca de usuário logado nunca altera o setor do terminal.
 */
@Component({
  selector: 'rentafit-terminal-sector-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'sector-context',
    '(document:pointerdown)': 'onOutsidePointer($event)',
    '(document:keydown.escape)': 'close()',
  },
  templateUrl: './terminal-sector-chip.component.html',
  styleUrl: './terminal-sector-chip.component.css',
})
export class TerminalSectorChipComponent {
  protected readonly terminalSector = inject(TerminalSectorService);
  private readonly sectorService = inject(SectorService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly availableSectors = signal<Sector[]>([]);
  protected readonly pickerOpen = signal(false);

  constructor() {
    this.sectorService
      .list(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sectors) => {
          this.availableSectors.set(sectors);
          this.terminalSector.resolveFrom(sectors);
        },
        error: () => this.availableSectors.set([]),
      });
  }

  protected toggle(): void {
    this.pickerOpen.update((open) => !open);
  }

  /** Vincula este terminal ao setor escolhido; as próximas operações saem nele. */
  protected pick(sector: Sector): void {
    this.terminalSector.assign(sector);
    this.pickerOpen.set(false);
  }

  protected close(): void {
    this.pickerOpen.set(false);
  }

  protected onOutsidePointer(event: Event): void {
    const target = event.target;
    if (target instanceof Element && !target.closest('.sector-context')) {
      this.pickerOpen.set(false);
    }
  }
}
