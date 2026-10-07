import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { APP_CONFIG } from '../../../shared/data/app-config.token';
import { AuthService, isOperationalUser } from './auth.service';
import { UserRole } from '../data/user.model';
import { CryptoService } from './crypto.service';
import { authInterceptor } from '../interceptors/auth.interceptor';

class FakeLoginRouter {
  readonly navigate = vi.fn();
}

class FakeLoginCrypto {}

const OPERATOR_STORAGE_KEY = 'rentafit.terminalOperators';
const candidateProfile = {
  user: { id: 'operator-1', username: 'operator', roles: ['EMPLOYEE'], active: true,
    pinConfigured: true, passwordExpired: false },
  initials: 'OP',
};
const candidateTokens = { accessToken: 'candidate-access', refreshToken: 'candidate-refresh', tokenType: 'Bearer' };

describe('AuthService terminal login', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: '' } },
        { provide: Router, useClass: FakeLoginRouter },
        { provide: CryptoService, useClass: FakeLoginCrypto },
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    sessionStorage.setItem(OPERATOR_STORAGE_KEY, 'previous-operators');
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  function completeLogin(): void {
    const request = http.expectOne('/api/auth/login');
    expect(request.request.body).toEqual({ username: 'admin', password: 'test-password' });
    request.flush({ accessToken: 'test-access', refreshToken: 'test-refresh', tokenType: 'Bearer' });
    http.expectOne('/api/auth/me').flush({
      id: 'admin-1', username: 'admin', roles: ['ADMIN'], active: true,
    });
  }

  function keepCurrentSession(): void {
    auth.restoreSession({ accessToken: 'current-access', refreshToken: 'current-refresh',
      user: { id: 'admin-1', username: 'admin', role: UserRole.ADMIN, active: true } });
  }

  function expectCurrentSessionUnchanged(): void {
    expect(auth.getCurrentUser()?.id).toBe('admin-1');
    expect(localStorage.getItem('accessToken')).toBe('current-access');
    expect(localStorage.getItem('refreshToken')).toBe('current-refresh');
    expect(sessionStorage.getItem(OPERATOR_STORAGE_KEY)).toBe('previous-operators');
  }

  it('limpa a lista antiga antes de publicar o usuário do login principal', async () => {
    const reset = vi.fn();
    auth.terminalLogin$.subscribe(reset);
    auth.currentUser$.subscribe(user => {
      if (user) expect(sessionStorage.getItem(OPERATOR_STORAGE_KEY)).toBeNull();
    });
    const result = lastValueFrom(auth.login('admin', 'test-password'));
    completeLogin();
    await expect(result).resolves.toMatchObject({ id: 'admin-1' });
    expect(reset).toHaveBeenCalledOnce();
  });

  it('preserva a lista e a sessão no login adicional pelo avatar', async () => {
    keepCurrentSession();
    const reset = vi.fn();
    auth.terminalLogin$.subscribe(reset);
    const result = lastValueFrom(auth.login('operator', 'test-password', true));
    http.expectOne('/api/auth/operator-login').flush({ ...candidateTokens, profile: candidateProfile });
    await expect(result).resolves.toMatchObject({ id: 'operator-1' });
    expectCurrentSessionUnchanged();
    expect(reset).not.toHaveBeenCalled();
  });

  it('login adicional CUSTOMER é rejeitado sem substituir tokens da sessão atual', async () => {
    keepCurrentSession();
    const result = lastValueFrom(auth.login('customer', 'test-password', true));
    http.expectOne('/api/auth/operator-login').flush({ ...candidateTokens,
      profile: { ...candidateProfile, user: { ...candidateProfile.user, roles: ['CUSTOMER'] } } });
    await expect(result).rejects.toThrow('Usuário não habilitado');
    expectCurrentSessionUnchanged();
  });

  it.each(['EMPLOYEE', 'MANAGER', 'ADMIN'])('aceita %s no login de operador sem publicar a sessão', async role => {
    keepCurrentSession();
    const result = lastValueFrom(auth.loginOperator('operator', 'test-password'));
    const request = http.expectOne('/api/auth/operator-login');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ ...candidateTokens, profile: { ...candidateProfile,
      user: { ...candidateProfile.user, roles: [role] } } });
    await expect(result).resolves.toMatchObject({ user: { role }, initials: 'OP' });
    expectCurrentSessionUnchanged();
  });

  it.each([false, true])('rejeita credenciais incompletas ou conta inativa (%s)', async active => {
    keepCurrentSession();
    const result = lastValueFrom(auth.loginOperator('operator', 'test-password'));
    http.expectOne('/api/auth/operator-login').flush({ ...candidateTokens,
      profile: { ...candidateProfile, user: { ...candidateProfile.user, active, pinConfigured: false } } });
    await expect(result).rejects.toThrow();
    expectCurrentSessionUnchanged();
  });

  it('falha HTTP no login adicional não renova nem encerra a sessão atual', async () => {
    keepCurrentSession();
    const result = lastValueFrom(auth.loginOperator('operator', 'wrong-password'));
    http.expectOne('/api/auth/operator-login').flush({}, { status: 401, statusText: 'Unauthorized' });
    await expect(result).rejects.toThrow('Credenciais inválidas');
    http.expectNone('/api/auth/refresh');
    expectCurrentSessionUnchanged();
  });

  it('revalida usando somente o token do usuário alvo', async () => {
    keepCurrentSession();
    const session = { ...candidateTokens, user: { id: 'operator-1', username: 'operator',
      role: UserRole.EMPLOYEE, active: true } };
    const result = lastValueFrom(auth.validateOperatorSession(session));
    const request = http.expectOne('/api/auth/operator-profile');
    expect(request.request.headers.get('Authorization')).toBe('Bearer candidate-access');
    request.flush(candidateProfile);
    await expect(result).resolves.toMatchObject({ user: { id: 'operator-1' }, initials: 'OP' });
    expectCurrentSessionUnchanged();
  });

  it('explica a retirada do ADMIN provisório sem afetar a sessão definitiva', async () => {
    keepCurrentSession();
    const session = { ...candidateTokens, user: { id: '0194269a-0000-7000-8000-000000000001',
      username: 'admin', role: UserRole.ADMIN, active: true } };
    const result = lastValueFrom(auth.validateOperatorSession(session));
    http.expectOne('/api/auth/operator-profile').flush({}, { status: 403, statusText: 'Forbidden' });
    await expect(result).rejects.toThrow('administrador definitivo');
    expectCurrentSessionUnchanged();
  });

  it('revalidação rejeitada não usa refresh do usuário ativo', async () => {
    keepCurrentSession();
    const session = { ...candidateTokens, user: { id: 'operator-1', username: 'operator',
      role: UserRole.EMPLOYEE, active: true } };
    const result = lastValueFrom(auth.validateOperatorSession(session));
    http.expectOne('/api/auth/operator-profile').flush({}, { status: 401, statusText: 'Unauthorized' });
    await expect(result).rejects.toThrow();
    http.expectNone('/api/auth/refresh');
    expectCurrentSessionUnchanged();
  });

  it('revalidação rejeita perfil de outro usuário', async () => {
    keepCurrentSession();
    const result = lastValueFrom(auth.validateOperatorSession({ ...candidateTokens,
      user: { id: 'other-1', username: 'other', role: UserRole.EMPLOYEE, active: true } }));
    http.expectOne('/api/auth/operator-profile').flush(candidateProfile);
    await expect(result).rejects.toThrow('não pertence');
    expectCurrentSessionUnchanged();
  });

  it('login rejeitado não limpa os operadores existentes', async () => {
    const result = lastValueFrom(auth.login('admin', 'test-password'));
    http.expectOne('/api/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
    await expect(result).rejects.toThrow();
    expect(sessionStorage.getItem(OPERATOR_STORAGE_KEY)).toBe('previous-operators');
  });

  it('considera o maior papel quando a resposta contém múltiplos papéis', async () => {
    const result = lastValueFrom(auth.loginOperator('operator', 'test-password'));
    http.expectOne('/api/auth/operator-login').flush({ ...candidateTokens,
      profile: { ...candidateProfile, user: { ...candidateProfile.user, roles: ['CUSTOMER', 'ADMIN'] } } });
    await expect(result).resolves.toMatchObject({ user: { role: UserRole.ADMIN } });
  });

  it('descarta campos inesperados do perfil em vez de armazená-los na sessão', async () => {
    const result = lastValueFrom(auth.loginOperator('operator', 'test-password'));
    http.expectOne('/api/auth/operator-login').flush({ ...candidateTokens,
      profile: { ...candidateProfile, user: { ...candidateProfile.user, password: 'unexpected-test-field' } } });
    const session = await result;
    expect(session.user).not.toHaveProperty('password');
  });

  it('identifica papéis operacionais somente em contas ativas', () => {
    expect(isOperationalUser({ id: '1', username: 'u', role: UserRole.EMPLOYEE, active: true })).toBe(true);
    expect(isOperationalUser({ id: '1', username: 'u', role: UserRole.ADMIN, active: false })).toBe(false);
    expect(isOperationalUser({ id: '1', username: 'u', role: UserRole.CUSTOMER, active: true })).toBe(false);
  });
});
