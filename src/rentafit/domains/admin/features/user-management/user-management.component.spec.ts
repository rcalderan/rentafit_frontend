import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { UserManagementComponent } from './user-management.component';
import { UserAdminService } from '../../service/user-admin.service';
import { EmployeeService } from '../../service/employee.service';
import { SettingsService } from '../../service/settings.service';
import { AuthService } from '../../../auth/services/auth.service';
import {
  PIN_TRUST_MINUTES_KEY,
  TerminalOperatorService,
} from '../../../auth/services/terminal-operator.service';
import { APP_CONFIG } from '../../../../shared/data/app-config.token';
import { User, UserRole } from '../../../auth/data/user.model';
import { IUserSummary } from '../../data/user-admin.model';

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: 'u-current',
  username: 'current',
  role: UserRole.ADMIN,
  active: true,
  pinConfigured: true,
  passwordExpired: false,
  ...overrides,
} as User);

const buildSummary = (overrides: Partial<IUserSummary> = {}): IUserSummary => ({
  id: 'u-target',
  username: 'target',
  name: 'Target',
  role: UserRole.CUSTOMER,
  active: true,
  ...overrides,
});

const emptyPage = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  number: 0,
  size: 20,
};

describe('UserManagementComponent', () => {
  let adminService: {
    listUsers: ReturnType<typeof vi.fn>;
    updateRole: ReturnType<typeof vi.fn>;
  };
  let authService: {
    getCurrentUser: ReturnType<typeof vi.fn>;
  };
  let employeeService: {
    findByIdOrNull: ReturnType<typeof vi.fn>;
  };
  let settingsService: {
    getNumber: ReturnType<typeof vi.fn>;
  };
  let operatorService: {
    updateTrustWindow: ReturnType<typeof vi.fn>;
  };

  const makeComponent = () => {
    const fixture = TestBed.createComponent(UserManagementComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  beforeEach(async () => {
    adminService = {
      listUsers: vi.fn().mockReturnValue(of(emptyPage)),
      updateRole: vi.fn().mockReturnValue(of(undefined)),
    };
    authService = {
      getCurrentUser: vi.fn().mockReturnValue(buildUser()),
    };
    employeeService = {
      findByIdOrNull: vi.fn().mockReturnValue(of({ id: 'u-target', name: 'Target', initials: 'TT' })),
    };
    settingsService = {
      getNumber: vi.fn().mockReturnValue(of(10)),
    };
    operatorService = {
      updateTrustWindow: vi.fn().mockReturnValue(of(void 0)),
    };

    await TestBed.configureTestingModule({
      imports: [UserManagementComponent],
      providers: [
        { provide: UserAdminService, useValue: adminService },
        { provide: EmployeeService, useValue: employeeService },
        { provide: SettingsService, useValue: settingsService },
        { provide: TerminalOperatorService, useValue: operatorService },
        { provide: AuthService, useValue: authService },
        { provide: APP_CONFIG, useValue: { apiBaseUrl: '' } },
      ],
    }).compileComponents();
  });

  it('cria o componente', () => {
    const component = makeComponent();
    expect(component).toBeTruthy();
  });

  describe('primaryRole', () => {
    it('retorna o papel salvo no backend', () => {
      const component = makeComponent();
      expect(component.primaryRole(buildSummary({ role: UserRole.EMPLOYEE }))).toBe(UserRole.EMPLOYEE);
      expect(component.primaryRole(buildSummary({ role: UserRole.ADMIN }))).toBe(UserRole.ADMIN);
      expect(component.primaryRole(buildSummary({ role: UserRole.MANAGER }))).toBe(UserRole.MANAGER);
    });

    it('retorna CUSTOMER quando o papel está ausente', () => {
      const component = makeComponent();
      const user = { ...buildSummary(), role: undefined as unknown as UserRole };
      expect(component.primaryRole(user)).toBe(UserRole.CUSTOMER);
    });
  });

  describe('allowedRoles', () => {
    it('ADMIN pode atribuir CUSTOMER, EMPLOYEE, MANAGER e ADMIN', () => {
      authService.getCurrentUser.mockReturnValue(buildUser({ role: UserRole.ADMIN }));
      const component = makeComponent();
      expect(component.allowedRoles()).toEqual([
        UserRole.CUSTOMER,
        UserRole.EMPLOYEE,
        UserRole.MANAGER,
        UserRole.ADMIN,
      ]);
    });

    it('MANAGER pode atribuir CUSTOMER, EMPLOYEE e MANAGER, mas não ADMIN', () => {
      authService.getCurrentUser.mockReturnValue(buildUser({ role: UserRole.MANAGER }));
      const component = makeComponent();
      expect(component.allowedRoles()).toEqual([
        UserRole.CUSTOMER,
        UserRole.EMPLOYEE,
        UserRole.MANAGER,
      ]);
    });

    it('EMPLOYEE pode atribuir CUSTOMER e EMPLOYEE', () => {
      authService.getCurrentUser.mockReturnValue(buildUser({ role: UserRole.EMPLOYEE }));
      const component = makeComponent();
      expect(component.allowedRoles()).toEqual([UserRole.CUSTOMER, UserRole.EMPLOYEE]);
    });

    it('CUSTOMER só pode atribuir CUSTOMER', () => {
      authService.getCurrentUser.mockReturnValue(buildUser({ role: UserRole.CUSTOMER }));
      const component = makeComponent();
      expect(component.allowedRoles()).toEqual([UserRole.CUSTOMER]);
    });

    it('retorna lista vazia quando não há usuário logado', () => {
      authService.getCurrentUser.mockReturnValue(null);
      const component = makeComponent();
      expect(component.allowedRoles()).toEqual([]);
    });
  });

  describe('canEdit', () => {
    beforeEach(() => {
      authService.getCurrentUser.mockReturnValue(buildUser({ id: 'u-admin', role: UserRole.ADMIN }));
    });

    it('ADMIN pode editar MANAGER, EMPLOYEE e CUSTOMER', () => {
      const component = makeComponent();
      expect(component.canEdit(buildSummary({ id: 'u-manager', role: UserRole.MANAGER }))).toBe(true);
      expect(component.canEdit(buildSummary({ id: 'u-employee', role: UserRole.EMPLOYEE }))).toBe(true);
      expect(component.canEdit(buildSummary({ id: 'u-customer', role: UserRole.CUSTOMER }))).toBe(true);
    });

    it('ADMIN não edita outro ADMIN', () => {
      const component = makeComponent();
      expect(component.canEdit(buildSummary({ id: 'u-other-admin', role: UserRole.ADMIN }))).toBe(false);
    });

    it('nenhum usuário pode editar a si mesmo', () => {
      const component = makeComponent();
      expect(component.canEdit(buildSummary({ id: 'u-admin', role: UserRole.MANAGER }))).toBe(false);
    });

    it('MANAGER pode editar EMPLOYEE e CUSTOMER, mas não MANAGER nem ADMIN', () => {
      authService.getCurrentUser.mockReturnValue(buildUser({ id: 'u-manager', role: UserRole.MANAGER }));
      const component = makeComponent();
      expect(component.canEdit(buildSummary({ id: 'u-employee', role: UserRole.EMPLOYEE }))).toBe(true);
      expect(component.canEdit(buildSummary({ id: 'u-customer', role: UserRole.CUSTOMER }))).toBe(true);
      expect(component.canEdit(buildSummary({ id: 'u-other-manager', role: UserRole.MANAGER }))).toBe(false);
      expect(component.canEdit(buildSummary({ id: 'u-admin', role: UserRole.ADMIN }))).toBe(false);
    });

    it('CUSTOMER não edita ninguém', () => {
      authService.getCurrentUser.mockReturnValue(buildUser({ id: 'u-customer', role: UserRole.CUSTOMER }));
      const component = makeComponent();
      expect(component.canEdit(buildSummary({ id: 'u-other-customer', role: UserRole.CUSTOMER }))).toBe(false);
    });
  });

  describe('changeRole', () => {
    it('chama updateRole com o userId e o novo papel', () => {
      const component = makeComponent();
      const user = buildSummary({ id: 'u-target' });
      component.changeRole(user, UserRole.EMPLOYEE);
      expect(adminService.updateRole).toHaveBeenCalledWith('u-target', { role: UserRole.EMPLOYEE });
    });

    it('não chama updateRole quando o papel é vazio', () => {
      const component = makeComponent();
      const user = buildSummary({ id: 'u-target' });
      component.changeRole(user, '');
      expect(adminService.updateRole).not.toHaveBeenCalled();
    });

    it('recarrega a lista após atualização bem-sucedida', () => {
      const component = makeComponent();
      component.changeRole(buildSummary({ id: 'u-target', name: 'Target' }), UserRole.MANAGER);
      expect(adminService.listUsers).toHaveBeenCalledTimes(2); // ngOnInit + após sucesso
    });
  });

  describe('saveTrustWindow', () => {
    it('carrega a janela de confiança na inicialização', () => {
      const component = makeComponent();
      expect(settingsService.getNumber).toHaveBeenCalledWith(PIN_TRUST_MINUTES_KEY, 5);
      expect(component.trustMinutes()).toBe(10);
    });

    it('grava a janela via TerminalOperatorService', () => {
      const component = makeComponent();
      component.trustMinutes.set(20);
      component.saveTrustWindow();
      expect(operatorService.updateTrustWindow).toHaveBeenCalledWith(20);
      expect(component.trustFeedback()?.ok).toBe(true);
    });

    it('rejeita valor fora da faixa 1-120', () => {
      const component = makeComponent();
      component.trustMinutes.set(0);
      component.saveTrustWindow();
      expect(operatorService.updateTrustWindow).not.toHaveBeenCalled();
      expect(component.trustFeedback()?.ok).toBe(false);
    });
  });

  describe('requestPin + confirmWithPin', () => {
    it('abre o modal e guarda o usuário/papel selecionados', () => {
      const component = makeComponent();
      const user = buildSummary({ id: 'u-target', name: 'Target' });
      component.requestPin(user, UserRole.EMPLOYEE);
      expect(component.showPinModal()).toBe(true);
      expect(component.pendingUser()?.id).toBe('u-target');
      expect(component.pendingRole()).toBe(UserRole.EMPLOYEE);
    });

    it('não faz nada quando o papel do requestPin é vazio', () => {
      const component = makeComponent();
      component.requestPin(buildSummary(), '');
      expect(component.showPinModal()).toBe(false);
    });

    it('confirmWithPin com PIN inválido mantém o modal aberto e não chama updateRole', () => {
      const component = makeComponent();
      const user = buildSummary({ id: 'u-target' });
      component.requestPin(user, UserRole.EMPLOYEE);
      component.pin.set('123');
      component.confirmWithPin();
      expect(component.pinError()).toBe('Digite um PIN de 4 a 6 dígitos.');
      expect(adminService.updateRole).not.toHaveBeenCalled();
    });

    it('confirmWithPin com PIN válido fecha o modal e chama updateRole', () => {
      const component = makeComponent();
      const user = buildSummary({ id: 'u-target' });
      component.requestPin(user, UserRole.EMPLOYEE);
      component.pin.set('1234');
      component.confirmWithPin();
      expect(component.showPinModal()).toBe(false);
      expect(adminService.updateRole).toHaveBeenCalledWith('u-target', { role: UserRole.EMPLOYEE });
    });

    it('closePinModal limpa o estado do modal', () => {
      const component = makeComponent();
      component.requestPin(buildSummary(), UserRole.EMPLOYEE);
      component.closePinModal();
      expect(component.showPinModal()).toBe(false);
      expect(component.pendingUser()).toBeNull();
      expect(component.pendingRole()).toBeNull();
      expect(component.pin()).toBe('');
    });
  });
});
