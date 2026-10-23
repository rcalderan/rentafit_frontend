import { TestBed } from '@angular/core/testing';
import { of, throwError, EMPTY } from 'rxjs';
import { vi } from 'vitest';
import { Login } from './login.component';
import { AuthService } from '../../services/auth.service';
import { FirstUseFlowService } from '../../services/first-use-flow.service';
import { Router, ActivatedRoute } from '@angular/router';
import { APP_CONFIG } from '../../../../shared/data/app-config.token';
import { User, UserRole } from '../../data/user.model';
import { resolveHomeRoute } from '../../utils/role-route.util';
import { LoginFailure } from '../../data/login-failure';
import { LAST_ATTEMPT_WARNING } from './login-feedback';

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: 'u-1',
  username: 'admin',
  role: UserRole.ADMIN,
  active: true,
  pinConfigured: true,
  passwordExpired: false,
  ...overrides,
});

const makeAuthService = (isAuth = false, user: User | null = null) => ({
  login: vi.fn(),
  resendVerification: vi.fn().mockReturnValue(of(undefined)),
  isAuthenticated: vi.fn().mockReturnValue(isAuth),
  getCurrentUser: vi.fn().mockReturnValue(user ?? buildUser()),
});

const makeRouter = () => ({
  navigate: vi.fn().mockResolvedValue(true),
  createUrlTree: vi.fn().mockReturnValue({}),
  serializeUrl: vi.fn().mockReturnValue(''),
  events: EMPTY,
});

const makeRoute = (queryParams: Record<string, string> = {}) => ({
  snapshot: { queryParams },
});

function makeFirstUseFlowService(options: { queryParams?: Record<string, string> } = {}) {
  return {
    resolvePostLoginRoute: vi.fn((user: User) => {
      if (!user.pinConfigured) return of('/auth/setup-credentials');
      if (user.passwordExpired) return of('/auth/change-password');
      if (options.queryParams?.['returnUrl']) return of(options.queryParams['returnUrl']);
      return of(resolveHomeRoute(user.role));
    }),
  };
}

async function setupTestBed(options: {
  isAuthenticated?: boolean;
  currentUser?: User | null;
  queryParams?: Record<string, string>;
} = {}) {
  const authService = makeAuthService(
    options.isAuthenticated ?? false,
    options.currentUser ?? buildUser()
  );
  const router = makeRouter();
  const route = makeRoute(options.queryParams ?? {});
  const firstUseFlowService = makeFirstUseFlowService(options);

  await TestBed.configureTestingModule({
    imports: [Login],
    providers: [
      { provide: AuthService, useValue: authService },
      { provide: FirstUseFlowService, useValue: firstUseFlowService },
      { provide: Router, useValue: router },
      { provide: ActivatedRoute, useValue: route },
      { provide: APP_CONFIG, useValue: { appName: 'Rentafit Test' } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(Login);
  return { fixture, component: fixture.componentInstance, authService, router };
}

describe('Login', () => {

  beforeEach(() => TestBed.resetTestingModule());

  it('cria o componente', async () => {
    const { fixture } = await setupTestBed();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('redireciona para /home/dashboard no ngOnInit quando ADMIN já autenticado', async () => {
    const { fixture, router } = await setupTestBed({
      isAuthenticated: true,
      currentUser: buildUser({ role: UserRole.ADMIN }),
    });
    fixture.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/home/dashboard']);
  });

  it('redireciona para /account/profile no ngOnInit quando CUSTOMER já autenticado', async () => {
    const { fixture, router } = await setupTestBed({
      isAuthenticated: true,
      currentUser: buildUser({ role: UserRole.CUSTOMER }),
    });
    fixture.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/account/profile']);
  });

  it('redireciona para /rental/management no ngOnInit quando EMPLOYEE já autenticado', async () => {
    const { fixture, router } = await setupTestBed({
      isAuthenticated: true,
      currentUser: buildUser({ role: UserRole.EMPLOYEE }),
    });
    fixture.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/rental/management']);
  });

  it('redireciona para /home/dashboard no ngOnInit quando MANAGER já autenticado', async () => {
    const { fixture, router } = await setupTestBed({
      isAuthenticated: true,
      currentUser: buildUser({ role: UserRole.MANAGER }),
    });
    fixture.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/home/dashboard']);
  });

  it('redireciona para returnUrl no ngOnInit quando autenticado', async () => {
    const { fixture, router } = await setupTestBed({
      isAuthenticated: true,
      currentUser: buildUser({ role: UserRole.ADMIN }),
      queryParams: { returnUrl: '/customer/search' },
    });
    fixture.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/customer/search']);
  });

  it('exibe erro quando campos estão vazios', async () => {
    const { fixture, component, authService } = await setupTestBed();
    fixture.detectChanges();

    component.login();
    expect(component.errorMessage()).toBe('Por favor, preencha todos os campos');
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('redireciona para setup-credentials quando pinConfigured é false', async () => {
    const { fixture, component, authService, router } = await setupTestBed();
    authService.login.mockReturnValue(of(buildUser({ pinConfigured: false })));
    fixture.detectChanges();

    component.username = 'admin';
    component.password = 'admin123';
    component.login();

    expect(authService.login).toHaveBeenCalledWith('admin', 'admin123');
    expect(router.navigate).toHaveBeenCalledWith(['/auth/setup-credentials']);
  });

  it('redireciona para change-password quando passwordExpired é true', async () => {
    const { fixture, component, authService, router } = await setupTestBed();
    authService.login.mockReturnValue(of(buildUser({ passwordExpired: true })));
    fixture.detectChanges();

    component.username = 'admin';
    component.password = 'admin123';
    component.login();

    expect(router.navigate).toHaveBeenCalledWith(['/auth/change-password']);
  });

  it('redireciona para /home/dashboard quando ADMIN faz login normal', async () => {
    const { fixture, component, authService, router } = await setupTestBed();
    authService.login.mockReturnValue(of(buildUser({ role: UserRole.ADMIN })));
    fixture.detectChanges();

    component.username = 'admin';
    component.password = 'admin123';
    component.login();

    expect(router.navigate).toHaveBeenCalledWith(['/home/dashboard']);
  });

  it('redireciona para /account/profile quando CUSTOMER faz login normal', async () => {
    const { fixture, component, authService, router } = await setupTestBed();
    authService.login.mockReturnValue(of(buildUser({ role: UserRole.CUSTOMER })));
    fixture.detectChanges();

    component.username = 'cliente';
    component.password = 'senha123';
    component.login();

    expect(router.navigate).toHaveBeenCalledWith(['/account/profile']);
  });

  it('redireciona para returnUrl quando login é normal e returnUrl existe', async () => {
    const { fixture, component, authService, router } = await setupTestBed({
      queryParams: { returnUrl: '/rental/management' },
    });
    authService.login.mockReturnValue(of(buildUser({ role: UserRole.ADMIN })));
    fixture.detectChanges();

    component.username = 'admin';
    component.password = 'admin123';
    component.login();

    expect(router.navigate).toHaveBeenCalledWith(['/rental/management']);
  });

  it('exibe mensagem de erro em falha de login', async () => {
    const { fixture, component, authService } = await setupTestBed();
    authService.login.mockReturnValue(throwError(() => new Error('Credenciais inválidas')));
    fixture.detectChanges();

    component.username = 'admin';
    component.password = 'wrong';
    component.login();

    expect(component.errorMessage()).toBe('Credenciais inválidas');
    expect(component.isLoading()).toBe(false);
  });

  it('na 4ª senha errada exibe aviso de bloqueio iminente', async () => {
    const { fixture, component, authService } = await setupTestBed();
    authService.login.mockReturnValue(throwError(() => new LoginFailure('INVALID_CREDENTIALS', 'x', 1)));
    fixture.detectChanges();

    component.username = 'joao.silva';
    component.password = 'errada';
    component.login();
    fixture.detectChanges();

    expect(component.warningMessage()).toBe(LAST_ATTEMPT_WARNING);
    expect(fixture.nativeElement.querySelector('.warning-message')?.textContent).toContain('bloqueará');
  });

  it('e-mail não verificado oferece reenvio e chama o serviço', async () => {
    const { fixture, component, authService } = await setupTestBed();
    authService.login.mockReturnValue(throwError(() => new LoginFailure('EMAIL_NOT_VERIFIED', 'x')));
    fixture.detectChanges();

    component.username = 'joao.silva';
    component.password = 'qualquer';
    component.login();
    component.resendEmail = ' ana@ex.com ';
    component.resendVerification();

    expect(component.offerResendVerification()).toBe(true);
    expect(authService.resendVerification).toHaveBeenCalledWith('ana@ex.com');
    expect(component.resendStatus()).toBe('sent');
  });

  it('reenvio sem e-mail exibe erro e não chama o serviço', async () => {
    const { component, authService } = await setupTestBed();

    component.resendVerification();

    expect(authService.resendVerification).not.toHaveBeenCalled();
    expect(component.errorMessage()).toContain('e-mail');
  });
});
