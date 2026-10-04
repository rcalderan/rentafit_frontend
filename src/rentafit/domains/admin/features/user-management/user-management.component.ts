import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserAdminService } from '../../service/user-admin.service';
import { EmployeeService } from '../../service/employee.service';
import { SettingsService } from '../../service/settings.service';
import { IUserSummary } from '../../data/user-admin.model';
import { UserRole } from '../../../auth/data/user.model';
import { AuthService } from '../../../auth/services/auth.service';
import {
  PIN_TRUST_MINUTES_KEY,
  TerminalOperatorService,
} from '../../../auth/services/terminal-operator.service';

const ROLE_ORDER: UserRole[] = [UserRole.CUSTOMER, UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.ADMIN];
const INITIALS_PATTERN = /^[A-Z]{2,10}$/;

@Component({
  selector: 'rentafit-user-management',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.css'
})
export class UserManagementComponent implements OnInit {
  private readonly adminService = inject(UserAdminService);
  private readonly employeeService = inject(EmployeeService);
  private readonly settingsService = inject(SettingsService);
  private readonly operatorService = inject(TerminalOperatorService);
  private readonly authService = inject(AuthService);

  users = signal<IUserSummary[]>([]);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  updatingId = signal<string | null>(null);

  showPinModal = signal(false);
  pin = signal('');
  pinError = signal<string | null>(null);
  pendingUser = signal<IUserSummary | null>(null);
  pendingRole = signal<string | null>(null);
  pendingInitials = signal<string | null>(null);

  showInitialsModal = signal(false);
  initials = signal('');
  initialsError = signal<string | null>(null);

  trustMinutes = signal(5);
  trustSaving = signal(false);
  trustFeedback = signal<{ ok: boolean; msg: string } | null>(null);

  readonly allRoles: UserRole[] = ROLE_ORDER;
  readonly currentUser = this.authService.getCurrentUser();

  ngOnInit(): void {
    this.load();
    this.settingsService.getNumber(PIN_TRUST_MINUTES_KEY, 5).subscribe(minutes => {
      this.trustMinutes.set(minutes);
    });
  }

  saveTrustWindow(): void {
    const minutes = this.trustMinutes();
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 120) {
      this.trustFeedback.set({ ok: false, msg: 'Informe um valor entre 1 e 120 minutos.' });
      return;
    }
    this.trustSaving.set(true);
    this.trustFeedback.set(null);
    this.operatorService.updateTrustWindow(minutes).subscribe({
      next: () => {
        this.trustSaving.set(false);
        this.trustFeedback.set({ ok: true, msg: 'Janela de confiança atualizada.' });
      },
      error: (err: Error) => {
        this.trustSaving.set(false);
        this.trustFeedback.set({ ok: false, msg: err.message });
      },
    });
  }

  load(): void {
    this.isLoading.set(true);
    this.adminService.listUsers().subscribe({
      next: page => {
        this.users.set(page.content);
        this.isLoading.set(false);
      },
      error: (err: Error) => {
        this.errorMessage.set(err.message);
        this.isLoading.set(false);
      }
    });
  }

  primaryRole(user: IUserSummary): UserRole {
    return user.role ?? UserRole.CUSTOMER;
  }

  /** Returns roles the current user is allowed to assign to another user. */
  allowedRoles(): UserRole[] {
    if (!this.currentUser) return [];
    const myIdx = ROLE_ORDER.indexOf(this.currentUser.role);
    // A user can assign roles up to and including their own level.
    // ADMIN may elevate a lower user to ADMIN; MANAGER may elevate to MANAGER.
    return ROLE_ORDER.filter((_, i) => i <= myIdx);
  }

  canEdit(target: IUserSummary): boolean {
    if (!this.currentUser) return false;
    if (target.id === this.currentUser.id) return false;
    const myIdx = ROLE_ORDER.indexOf(this.currentUser.role);
    const targetIdx = ROLE_ORDER.indexOf(this.primaryRole(target));
    return myIdx > targetIdx;
  }

  /** Triggered when the role <select> changes. Routes to initials modal or PIN modal. */
  requestPin(user: IUserSummary, newRole: string): void {
    if (!newRole) return;
    this.pendingUser.set(user);
    this.pendingRole.set(newRole);
    this.pendingInitials.set(null);

    if (newRole === UserRole.EMPLOYEE || newRole === UserRole.MANAGER) {
      this.checkEmployeeBeforePin(user, newRole);
      return;
    }
    this.openPinModal();
  }

  private checkEmployeeBeforePin(user: IUserSummary, newRole: string): void {
    this.updatingId.set(user.id);
    this.errorMessage.set(null);
    this.employeeService.findByIdOrNull(user.id).subscribe({
      next: employee => {
        this.updatingId.set(null);
        if (employee) {
          this.openPinModal();
        } else {
          this.openInitialsModal(user);
        }
      },
      error: (err: Error) => {
        this.updatingId.set(null);
        this.errorMessage.set(err.message);
        this.clearPending();
      }
    });
    void newRole;
  }

  private openInitialsModal(user: IUserSummary): void {
    this.initials.set(this.suggestInitials(user.name));
    this.initialsError.set(null);
    this.showInitialsModal.set(true);
  }

  closeInitialsModal(): void {
    this.showInitialsModal.set(false);
    this.initials.set('');
    this.initialsError.set(null);
    if (!this.showPinModal()) {
      this.clearPending();
    }
  }

  confirmInitials(): void {
    const value = this.initials().trim().toUpperCase();
    if (!INITIALS_PATTERN.test(value)) {
      this.initialsError.set('Iniciais devem ter de 2 a 10 letras (A-Z).');
      return;
    }
    this.pendingInitials.set(value);
    this.showInitialsModal.set(false);
    this.initialsError.set(null);
    this.openPinModal();
  }

  /** Suggests the first two letters of the user's name, uppercased. */
  private suggestInitials(name: string | undefined | null): string {
    if (!name) return '';
    const letters = name.trim().replace(/[^A-Za-z]/g, '');
    return letters.slice(0, 2).toUpperCase();
  }

  private openPinModal(): void {
    this.pin.set('');
    this.pinError.set(null);
    this.showPinModal.set(true);
  }

  confirmWithPin(): void {
    const value = this.pin().trim();
    if (!/^\d{4,6}$/.test(value)) {
      this.pinError.set('Digite um PIN de 4 a 6 dígitos.');
      return;
    }
    const user = this.pendingUser();
    const role = this.pendingRole();
    const initials = this.pendingInitials();
    this.closePinModal();
    if (user && role) {
      this.changeRole(user, role, initials);
    }
  }

  closePinModal(): void {
    this.showPinModal.set(false);
    this.pin.set('');
    this.pinError.set(null);
    if (!this.showInitialsModal()) {
      this.clearPending();
    }
  }

  private clearPending(): void {
    this.pendingUser.set(null);
    this.pendingRole.set(null);
    this.pendingInitials.set(null);
  }

  changeRole(user: IUserSummary, newRole: string, initials?: string | null): void {
    if (!newRole) return;
    this.updatingId.set(user.id);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.adminService.updateRole(user.id, { role: newRole as UserRole, initials: initials ?? undefined }).subscribe({
      next: () => {
        this.updatingId.set(null);
        this.successMessage.set(`Papel de ${user.name} atualizado com sucesso.`);
        this.load();
      },
      error: (err: Error) => {
        this.updatingId.set(null);
        this.errorMessage.set(err.message);
      }
    });
  }
}
