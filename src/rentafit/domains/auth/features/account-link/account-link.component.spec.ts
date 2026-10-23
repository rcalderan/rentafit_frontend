import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { EMPTY, of, throwError } from 'rxjs';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { FirstUseFlowService } from '../../services/first-use-flow.service';
import { User, UserRole } from '../../data/user.model';
import { VerifyEmailComponent } from './verify-email.component';
import { UnlockComponent } from './unlock.component';

const VALID_TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789_-AB';
const user: User = { id: 'u1', username: 'joao.silva', role: UserRole.CUSTOMER, active: true, pinConfigured: false };

function setup(token: string | null) {
  const authService = {
    verifyEmail: vi.fn().mockReturnValue(of(user)),
    unlockAccount: vi.fn().mockReturnValue(of(undefined)),
  };
  const router = {
    navigate: vi.fn().mockResolvedValue(true),
    createUrlTree: vi.fn().mockReturnValue({}),
    serializeUrl: vi.fn().mockReturnValue(''),
    events: EMPTY,
  };
  const firstUseFlow = { resolvePostLoginRoute: vi.fn().mockReturnValue(of('/auth/setup-credentials')) };
  const route = { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } };

  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: authService },
      { provide: FirstUseFlowService, useValue: firstUseFlow },
      { provide: Router, useValue: router },
      { provide: ActivatedRoute, useValue: route },
    ],
  });
  return { authService, router };
}

describe('VerifyEmailComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('confirma o e-mail, remove o token da URL e segue para o setup de credenciais', () => {
    const { authService, router } = setup(VALID_TOKEN);

    TestBed.createComponent(VerifyEmailComponent);

    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: {}, replaceUrl: true }));
    expect(authService.verifyEmail).toHaveBeenCalledWith(VALID_TOKEN);
    expect(router.navigate).toHaveBeenCalledWith(['/auth/setup-credentials']);
  });

  it('sem token válido mostra erro e não chama o backend', () => {
    const { authService } = setup('curto');

    const fixture = TestBed.createComponent(VerifyEmailComponent);
    fixture.detectChanges();

    expect(authService.verifyEmail).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.error-message').textContent).toContain('inválido');
  });

  it('link expirado mostra a mensagem do backend', () => {
    const { authService } = setup(VALID_TOKEN);
    authService.verifyEmail.mockReturnValue(throwError(() => new Error('Link de ativação inválido, expirado')));

    const fixture = TestBed.createComponent(VerifyEmailComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.error-message').textContent).toContain('expirado');
  });
});

describe('UnlockComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('desbloqueia e mostra sucesso', () => {
    const { authService } = setup(VALID_TOKEN);

    const fixture = TestBed.createComponent(UnlockComponent);
    fixture.detectChanges();

    expect(authService.unlockAccount).toHaveBeenCalledWith(VALID_TOKEN);
    expect(fixture.nativeElement.querySelector('.success-message').textContent).toContain('desbloqueada');
  });

  it('falha do backend mostra erro', () => {
    const { authService } = setup(VALID_TOKEN);
    authService.unlockAccount.mockReturnValue(throwError(() => new Error('Link de desbloqueio inválido')));

    const fixture = TestBed.createComponent(UnlockComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.error-message').textContent).toContain('desbloqueio');
  });

  it('sem token mostra erro sem chamar o backend', () => {
    const { authService } = setup(null);

    const fixture = TestBed.createComponent(UnlockComponent);
    fixture.detectChanges();

    expect(authService.unlockAccount).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.error-message')).toBeTruthy();
  });
});
