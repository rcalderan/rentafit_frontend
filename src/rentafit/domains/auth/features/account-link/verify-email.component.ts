import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { FirstUseFlowService } from '../../services/first-use-flow.service';
import { readLinkToken } from './read-link-token';

/** Destino do link de ativação: confirma o e-mail, inicia a sessão e segue para o setup de senha/PIN. */
@Component({
  selector: 'rentafit-verify-email',
  imports: [RouterLink],
  templateUrl: './verify-email.component.html',
  styleUrl: './account-link.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailComponent {
  private readonly authService = inject(AuthService);
  private readonly firstUseFlowService = inject(FirstUseFlowService);
  private readonly router = inject(Router);

  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    const token = readLinkToken(inject(ActivatedRoute), this.router);
    if (!token) {
      this.errorMessage.set('Link de confirmação inválido. Abra o link completo recebido por e-mail.');
      return;
    }
    this.authService.verifyEmail(token).pipe(
      switchMap(user => this.firstUseFlowService.resolvePostLoginRoute(user)),
      takeUntilDestroyed(),
    ).subscribe({
      next: route => this.router.navigate([route]),
      error: (err: Error) => this.errorMessage.set(err.message || 'Não foi possível confirmar o e-mail.'),
    });
  }
}
