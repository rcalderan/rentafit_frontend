import { Component, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { FirstUseFlowService } from '../../services/first-use-flow.service';
import { APP_CONFIG } from '../../../../shared/data/app-config.token';
import { passwordViolations } from '../../validators/credential-rules';

@Component({
  selector: 'rentafit-change-password',
  imports: [FormsModule, CommonModule],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.css'
})
export class ChangePasswordComponent {

  private readonly config = inject(APP_CONFIG);
  title = signal(this.config.appName);

  newPassword = '';
  confirmPassword = '';
  errorMessage = signal<string | null>(null);
  isLoading = signal(false);

  constructor(
    private readonly authService: AuthService,
    private readonly firstUseFlowService: FirstUseFlowService,
    private readonly router: Router
  ) {}

  get passwordErrors(): string[] {
    return passwordViolations(this.newPassword);
  }

  get passwordMismatch(): boolean {
    return this.confirmPassword.length > 0 && this.newPassword !== this.confirmPassword;
  }

  get isFormValid(): boolean {
    return !!this.newPassword && this.passwordErrors.length === 0
      && this.newPassword === this.confirmPassword;
  }

  submit(): void {
    if (!this.isFormValid) {
      this.errorMessage.set('Corrija os erros antes de continuar.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.changePassword(this.newPassword).subscribe({
      next: () => {
        this.isLoading.set(false);
        const user = this.authService.getCurrentUser();
        if (!user) {
          this.router.navigate(['/auth/login']);
          return;
        }
        this.firstUseFlowService.resolveAfterCredentials(user).subscribe({
          next: (route) => this.router.navigate([route]),
          error: (err: Error) => this.errorMessage.set(err.message || 'Erro ao resolver próxima etapa.')
        });
      },
      error: (err: Error) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.message || 'Erro ao alterar senha.');
      }
    });
  }
}
