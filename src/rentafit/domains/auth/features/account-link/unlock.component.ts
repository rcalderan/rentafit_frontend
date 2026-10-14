import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { readLinkToken } from './read-link-token';

type UnlockState = 'unlocking' | 'done' | 'error';

/** Destino do link de desbloqueio enviado após 5 tentativas de login inválidas. */
@Component({
  selector: 'rentafit-unlock',
  imports: [RouterLink],
  templateUrl: './unlock.component.html',
  styleUrl: './account-link.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnlockComponent {
  private readonly authService = inject(AuthService);

  protected readonly state = signal<UnlockState>('unlocking');
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    const token = readLinkToken(inject(ActivatedRoute), inject(Router));
    if (!token) {
      this.fail('Link de desbloqueio inválido. Abra o link completo recebido por e-mail.');
      return;
    }
    this.authService.unlockAccount(token).pipe(takeUntilDestroyed()).subscribe({
      next: () => this.state.set('done'),
      error: (err: Error) => this.fail(err.message || 'Não foi possível desbloquear a conta.'),
    });
  }

  private fail(message: string): void {
    this.errorMessage.set(message);
    this.state.set('error');
  }
}
