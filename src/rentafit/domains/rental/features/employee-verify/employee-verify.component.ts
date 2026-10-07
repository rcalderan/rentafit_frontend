import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, inject, Input, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { EmployeeService } from '../../../admin/service/employee.service';
import { AuthService, StoredOperatorSession } from '../../../auth/services/auth.service';

export interface EmployeeConfirmedEvent {
  employeeId: string;
  employeeName: string;
  initials?: string;
  session?: StoredOperatorSession;
}

export interface EmployeePinOnly {
  employeeId?: string;
  name: string;
  initials: string;
}

/**
 * 'login'  = usuário+senha — login real que autentica alguém no terminal;
 * 'pin'    = operador fixo + apenas PIN (ação sensível do operador corrente);
 * 'target' = operador fixo exibido + sigla+PIN que devem ser DELE (troca).
 */
export type EmployeeVerifyMode = 'login' | 'pin' | 'target';

@Component({
  selector: 'rentafit-employee-verify',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-verify.component.html',
  styleUrl: './employee-verify.component.css',
})
export class EmployeeVerifyComponent implements AfterViewInit {
  @Input() title = 'Identificar Usuário';
  @Input() mode: EmployeeVerifyMode = 'pin';
  /** Operador fixo nos modos 'pin'/'target'. */
  @Input() employee: EmployeePinOnly | null = null;

  @Output() confirmed = new EventEmitter<EmployeeConfirmedEvent>();
  @Output() cancelled = new EventEmitter<void>();

  @ViewChild('initialsInput') initialsInput?: ElementRef<HTMLInputElement>;
  @ViewChild('pinInput') pinInput?: ElementRef<HTMLInputElement>;
  @ViewChild('usernameInput') usernameInput?: ElementRef<HTMLInputElement>;

  private readonly employeeService = inject(EmployeeService);
  private readonly authService = inject(AuthService);

  username = '';
  password = '';
  initials: string | null = null;
  pin = '';
  isLoading = false;
  error = '';
  /** No modo 'pin' o usuário pode desistir e autenticar outra pessoa (login). */
  switchedToLogin = false;

  get effectiveMode(): EmployeeVerifyMode {
    return this.switchedToLogin ? 'login' : this.mode;
  }

  get isLogin(): boolean {
    return this.effectiveMode === 'login';
  }

  get isPinOnly(): boolean {
    return this.effectiveMode === 'pin';
  }

  get isTarget(): boolean {
    return this.effectiveMode === 'target';
  }

  get showOperatorChip(): boolean {
    return !this.isLogin && this.employee != null;
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.reset();
      this.focusFirstField();
    }, 0);
  }

  /** Sai do modo PIN-only e abre o login de outra pessoa (usuário+senha). */
  switchEmployee(): void {
    this.switchedToLogin = true;
    this.reset();
    setTimeout(() => this.usernameInput?.nativeElement.focus(), 0);
  }

  confirm(): void {
    this.error = '';
    if (this.isLogin) {
      this.confirmLogin();
      return;
    }
    if (this.isTarget && !this.initials?.trim()) {
      this.error = 'Informe a sigla do usuário.';
      return;
    }
    if (!this.pin) {
      this.error = 'Informe o PIN.';
      return;
    }

    this.isLoading = true;
    const initials = this.isPinOnly
      ? this.employee!.initials
      : this.initials!.trim().toUpperCase();

    this.employeeService
      .checkInitials(initials, this.pin)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (employee) => {
          if (this.isTarget && this.employee?.employeeId && employee.id !== this.employee.employeeId) {
            this.error = 'Credenciais não pertencem ao usuário selecionado.';
            return;
          }
          this.emit(employee);
        },
        error: (err: unknown) => {
          this.error = err instanceof Error ? err.message : 'Credenciais inválidas.';
        },
      });
  }

  cancel(): void {
    this.reset();
    this.cancelled.emit();
  }

  private confirmLogin(): void {
    if (!this.username.trim() || !this.password) {
      this.error = 'Informe usuário e senha.';
      return;
    }
    this.isLoading = true;
    this.authService
      .loginOperator(this.username.trim(), this.password)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: session => {
          this.confirmed.emit({
            employeeId: session.user.id,
            employeeName: session.user.name ?? session.user.username,
            initials: session.initials,
            session,
          });
          this.reset();
        },
        error: (err: unknown) => {
          this.error = err instanceof Error ? err.message : 'Credenciais inválidas.';
        },
      });
  }

  private emit(employee: { id: string; name?: string; initials?: string }): void {
    this.confirmed.emit({
      employeeId: employee.id,
      employeeName: employee.name ?? '',
      initials: employee.initials,
    });
    this.reset();
  }

  private focusFirstField(): void {
    if (this.isLogin) {
      this.usernameInput?.nativeElement.focus();
    } else if (this.isPinOnly) {
      this.pinInput?.nativeElement.focus();
    } else {
      this.initialsInput?.nativeElement.focus();
    }
  }

  private reset(): void {
    this.username = '';
    this.password = '';
    this.initials = null;
    this.pin = '';
    this.error = '';
  }
}
