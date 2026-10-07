import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { SettingsService } from '../../service/settings.service';
import { AuthService } from '../../../auth/services/auth.service';
import { UserRole } from '../../../auth/data/user.model';

export const RENTAL_WINDOW_KEY = 'rental.conflictWindowDays';

@Component({
  selector: 'rentafit-rental-interval-settings',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section-card">
      <h2>Intervalo entre locações</h2>
      <p>
        Bloqueia a mesma roupa quando as datas de uso diferem em até o intervalo informado,
        inclusive.
      </p>
      <label for="rental-window-days">Dias antes e depois da data de uso</label>
      <input
        id="rental-window-days"
        type="number"
        min="0"
        max="2147483647"
        step="1"
        [formControl]="days"
      />
      <p>Com 2 dias, diferenças de 0, 1 e 2 dias bloqueiam; 3 dias são permitidos.</p>
      @if (canWrite) {
        <button
          type="button"
          class="btn btn-update"
          (click)="save()"
          [disabled]="busy() || days.invalid"
        >
          {{ busy() ? 'Salvando…' : 'Salvar intervalo' }}
        </button>
      }
      @if (feedback()) {
        <p role="status">{{ feedback() }}</p>
      }
    </section>
  `,
})
export class RentalIntervalSettingsComponent implements OnInit {
  private readonly settings = inject(SettingsService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly days = new FormControl(2, {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.min(0),
      Validators.max(2147483647),
      Validators.pattern(/^\d+$/),
    ],
  });
  protected readonly busy = signal(false);
  protected readonly feedback = signal('');
  protected readonly canWrite = this.auth.hasAnyRole([UserRole.ADMIN, UserRole.MANAGER]);

  ngOnInit(): void {
    this.settings
      .getNumber(RENTAL_WINDOW_KEY, 2)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.days.setValue(value);
        if (!this.canWrite) this.days.disable();
      });
  }

  protected save(): void {
    if (!this.canWrite || this.days.invalid || this.busy()) return;
    this.busy.set(true);
    this.feedback.set('');
    this.settings
      .put(RENTAL_WINDOW_KEY, String(this.days.value))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => this.feedback.set('Intervalo salvo.'),
        error: (error: Error) => this.feedback.set(error.message),
      });
  }
}
