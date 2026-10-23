import { Component, signal, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { User } from '../../data/user.model';
import { APP_CONFIG } from '../../../../shared/data/app-config.token';
import { FirstUseFlowService } from '../../services/first-use-flow.service';
import { resolveHomeRoute } from '../../utils/role-route.util';
import { describeLoginFailure } from './login-feedback';

@Component({
  selector: 'rentafit-login',
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class Login implements OnInit {
  
  private readonly config = inject(APP_CONFIG);
  title = signal(this.config.appName);
  
  username = '';
  password = '';
  resendEmail = '';
  errorMessage = signal<string | null>(null);
  warningMessage = signal<string | null>(null);
  isLoading = signal(false);
  readonly showPassword = signal(false);
  readonly offerResendVerification = signal(false);
  readonly resendStatus = signal<'idle' | 'sending' | 'sent'>('idle');

  constructor(
    private authService: AuthService,
    private firstUseFlowService: FirstUseFlowService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      const user = this.authService.getCurrentUser();
      const returnUrl = this.route.snapshot.queryParams['returnUrl'];
      this.router.navigate([returnUrl || resolveHomeRoute(user?.role)]);
    }
  }

  login() {
    if (!this.username || !this.password) {
      this.errorMessage.set('Por favor, preencha todos os campos');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.warningMessage.set(null);

    this.authService.login(this.username, this.password).subscribe({
      next: (user) => this.handleLoginSuccess(user),
      error: (error: unknown) => this.handleLoginFailure(error)
    });
  }

  resendVerification(): void {
    const email = this.resendEmail.trim();
    if (!email) {
      this.errorMessage.set('Informe o e-mail usado no cadastro para reenviar o link.');
      return;
    }
    this.resendStatus.set('sending');
    this.authService.resendVerification(email).subscribe({
      next: () => this.resendStatus.set('sent'),
      error: (error: Error) => {
        this.resendStatus.set('idle');
        this.errorMessage.set(error.message);
      }
    });
  }

  private handleLoginFailure(error: unknown): void {
    this.isLoading.set(false);
    const feedback = describeLoginFailure(error);
    this.errorMessage.set(feedback.error);
    this.warningMessage.set(feedback.warning);
    this.offerResendVerification.set(feedback.offerResendVerification);
    this.resendStatus.set('idle');
  }

  private handleLoginSuccess(user: User): void {
    this.firstUseFlowService.resolvePostLoginRoute(user).subscribe({
      next: (destination) => this.navigateTo(destination, user),
      error: (error) => {
        this.isLoading.set(false);
        console.error('Erro ao resolver fluxo pós-login:', error);
      }
    });
  }

  private navigateTo(destination: string, user: User): void {
    this.router.navigate([destination]).then(
      (success) => {
        if (!success) {
          console.warn('Acesso negado, redirecionando...');
          this.router.navigate([resolveHomeRoute(user.role)]);
        }
        this.isLoading.set(false);
      },
      (error) => {
        this.isLoading.set(false);
        console.error('Erro ao redirecionar após login:', error);
      }
    );
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }
}
