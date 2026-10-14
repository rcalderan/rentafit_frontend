import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SetupCredentialsComponent } from './setup-credentials.component';
import { AuthService } from '../../services/auth.service';
import { FirstUseFlowService } from '../../services/first-use-flow.service';
import { Router } from '@angular/router';
import { APP_CONFIG } from '../../../../shared/data/app-config.token';

describe('SetupCredentialsComponent', () => {
  let authService: {
    setupCredentials: ReturnType<typeof vi.fn>;
    getCurrentUser: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let firstUseFlowService: { resolveAfterCredentials: ReturnType<typeof vi.fn> };

  const makeComponent = () => TestBed.createComponent(SetupCredentialsComponent).componentInstance;

  beforeEach(async () => {
    authService = {
      setupCredentials: vi.fn(),
      getCurrentUser: vi.fn().mockReturnValue({ role: 'CUSTOMER' }),
    };
    router = { navigate: vi.fn() };
    firstUseFlowService = {
      resolveAfterCredentials: vi.fn().mockReturnValue(of('/account/profile')),
    };

    await TestBed.configureTestingModule({
      imports: [SetupCredentialsComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: FirstUseFlowService, useValue: firstUseFlowService },
        { provide: Router, useValue: router },
        { provide: APP_CONFIG, useValue: { appName: 'Rentafit Test' } },
      ],
    }).compileComponents();
  });

  it('cria o componente', () => {
    const component = makeComponent();
    expect(component).toBeTruthy();
  });

  describe('validações de senha', () => {
    it('reporta erro para senha curta', () => {
      const component = makeComponent();
      component.newPassword = 'Short1!x';
      expect(component.passwordErrors).toContain('Entre 10 e 64 caracteres');
      expect(component.isFormValid).toBe(false);
    });

    it('reporta erro para senha sem maiúscula', () => {
      const component = makeComponent();
      component.newPassword = 'lowercase1!x';
      expect(component.passwordErrors).toContain('Pelo menos 1 letra maiúscula');
    });

    it('reporta erro para senha sem número', () => {
      const component = makeComponent();
      component.newPassword = 'NoDigitPass!x';
      expect(component.passwordErrors).toContain('Pelo menos 1 número');
    });

    it('reporta erro para senha sem caractere especial', () => {
      const component = makeComponent();
      component.newPassword = 'NoSpecial12x';
      expect(component.passwordErrors).toContain('Pelo menos 1 caractere especial (ex.: @ # $ ! %)');
    });

    it('não reporta erros para senha válida', () => {
      const component = makeComponent();
      component.newPassword = 'Vestido#Azul42';
      expect(component.passwordErrors).toEqual([]);
    });
  });

  describe('validações de PIN', () => {
    it('reporta erro para PIN com letras', () => {
      const component = makeComponent();
      component.pin = '12ab';
      expect(component.pinError).toBe('PIN deve ter exatamente 4 dígitos numéricos');
    });

    it('reporta erro para PIN com menos de 4 dígitos', () => {
      const component = makeComponent();
      component.pin = '123';
      expect(component.pinError).toBeTruthy();
    });

    it('reporta erro para PIN com mais de 4 dígitos', () => {
      const component = makeComponent();
      component.pin = '12345';
      expect(component.pinError).toBeTruthy();
    });

    it.each(['0000', '1234', '4321', '1212'])('rejeita PIN fraco %s', pin => {
      const component = makeComponent();
      component.pin = pin;
      expect(component.pinError).toBeTruthy();
    });

    it('aceita PIN válido de 4 dígitos', () => {
      const component = makeComponent();
      component.pin = '4831';
      expect(component.pinError).toBeNull();
    });
  });

  it('detecta mismatch entre senha e confirmação', () => {
    const component = makeComponent();
    component.newPassword = 'Vestido#Azul42';
    component.confirmPassword = 'Different1!xyz';
    expect(component.passwordMismatch).toBe(true);
    expect(component.isFormValid).toBe(false);
  });

  it('formulário válido quando todos os campos estão corretos', () => {
    const component = makeComponent();
    component.newPassword = 'Vestido#Azul42';
    component.confirmPassword = 'Vestido#Azul42';
    component.pin = '4831';
    expect(component.isFormValid).toBe(true);
  });

  describe('submit', () => {
    it('não chama o serviço quando o formulário é inválido', () => {
      const component = makeComponent();
      component.submit();
      expect(authService.setupCredentials).not.toHaveBeenCalled();
      expect(component.errorMessage()).toBe('Corrija os erros antes de continuar.');
    });

    it('navega para dashboard após sucesso', () => {
      authService.setupCredentials.mockReturnValue(of(undefined));

      const component = makeComponent();
      component.newPassword = 'Vestido#Azul42';
      component.confirmPassword = 'Vestido#Azul42';
      component.pin = '4831';
      component.submit();

      expect(authService.setupCredentials).toHaveBeenCalledWith('Vestido#Azul42', '4831');
      expect(router.navigate).toHaveBeenCalledWith(['/account/profile']);
      expect(component.isLoading()).toBe(false);
    });

    it('exibe mensagem de erro em falha do serviço', () => {
      authService.setupCredentials.mockReturnValue(throwError(() => new Error('Erro no servidor')));

      const component = makeComponent();
      component.newPassword = 'Vestido#Azul42';
      component.confirmPassword = 'Vestido#Azul42';
      component.pin = '4831';
      component.submit();

      expect(component.errorMessage()).toBe('Erro no servidor');
      expect(component.isLoading()).toBe(false);
    });
  });
});
