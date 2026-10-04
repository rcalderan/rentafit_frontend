import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { EmployeeService } from '../../admin/service/employee.service';
import { SettingsService } from '../../admin/service/settings.service';
import { User, UserRole } from '../data/user.model';
import { AuthService, StoredOperatorSession } from './auth.service';
import {
  PIN_TRUST_MINUTES_KEY,
  TerminalOperator,
  TerminalOperatorService,
} from './terminal-operator.service';

const STORAGE_KEY = 'rentafit.terminalOperators';

function makeUser(id: string): User {
  return { id, username: 'u', role: UserRole.EMPLOYEE, active: true, pinConfigured: true, passwordExpired: false };
}

function makeSession(id: string, expiresInSeconds = 3600) {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds }));
  return { accessToken: `header.${payload}.signature`, refreshToken: 'test-refresh', user: makeUser(id), initials: 'MS' };
}

describe('TerminalOperatorService', () => {
  let service: TerminalOperatorService;
  let currentUser$: BehaviorSubject<User | null>;
  let authService: {
    currentUser$: BehaviorSubject<User | null>;
    terminalLogin$: Subject<void>;
    getCurrentUser: ReturnType<typeof vi.fn>;
    captureSession: ReturnType<typeof vi.fn>;
    validateOperatorSession: ReturnType<typeof vi.fn>;
    restoreSession: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };
  let employeeService: { findByIdOrNull: ReturnType<typeof vi.fn> };
  let settingsService: { getNumber: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };

  function setup(user: User | null = null, trustMinutes = 5) {
    sessionStorage.clear();
    currentUser$ = new BehaviorSubject<User | null>(user);
    authService = {
      currentUser$,
      terminalLogin$: new Subject<void>(),
      getCurrentUser: vi.fn(() => currentUser$.value),
      captureSession: vi.fn(() => currentUser$.value ? makeSession(currentUser$.value.id) : null),
      restoreSession: vi.fn(),
      validateOperatorSession: vi.fn((session: StoredOperatorSession) => of(session)),
      logout: vi.fn(),
    };
    employeeService = {
      findByIdOrNull: vi.fn().mockReturnValue(
        of({ id: 'emp-1', name: 'Maria Silva', initials: 'MS' }),
      ),
    };
    settingsService = {
      getNumber: vi.fn().mockReturnValue(of(trustMinutes)),
      put: vi.fn().mockReturnValue(of(void 0)),
    };
    TestBed.configureTestingModule({
      providers: [
        TerminalOperatorService,
        { provide: AuthService, useValue: authService },
        { provide: EmployeeService, useValue: employeeService },
        { provide: SettingsService, useValue: settingsService },
      ],
    });
    service = TestBed.inject(TerminalOperatorService);
  }

  function addOperator(overrides: Partial<TerminalOperator> = {}): TerminalOperator {
    const op: TerminalOperator = {
      employeeId: 'emp-1',
      name: 'Maria Silva',
      initials: 'MS',
      pinTrustedUntil: 0,
      session: makeSession(overrides.employeeId ?? 'emp-1'),
      ...overrides,
    };
    service['operators'].set([op]);
    service['currentOperatorId'].set(op.employeeId);
    return op;
  }

  it('adiciona o usuário logado como operador quando é funcionário', () => {
    setup(makeUser('emp-1'));

    expect(authService.validateOperatorSession).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ id: 'emp-1' }) }));
    expect(service.currentOperator()?.employeeId).toBe('emp-1');
    expect(service.currentOperator()?.pinTrustedUntil).toBeGreaterThan(Date.now());
  });

  it('não adiciona operador quando usuário logado não é funcionário', () => {
    setup(null);
    authService.validateOperatorSession.mockReturnValue(throwError(() => new Error('Usuário não habilitado')));
    currentUser$.next(makeUser('customer-1'));

    expect(service.currentOperator()).toBeNull();
  });

  it('limpa operadores no logout', () => {
    setup(makeUser('emp-1'));
    currentUser$.next(null);

    expect(service.operators()).toEqual([]);
    expect(service.currentOperator()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('carrega a janela de confiança do backend', () => {
    setup(null, 15);

    expect(settingsService.getNumber).toHaveBeenCalledWith(PIN_TRUST_MINUTES_KEY, 5);
    expect(service.trustWindowMinutes()).toBe(15);
  });

  it('authorize sem operador abre modal de login (usuário+senha)', () => {
    setup(null);
    let result: TerminalOperator | null | undefined;
    service.authorize({ title: 'Teste', requirePin: false }).subscribe(v => (result = v));

    expect(result).toBeUndefined();
    const request = service.pendingRequest();
    expect(request?.mode).toBe('login');

    service.resolvePending({ employeeId: 'emp-9', employeeName: 'João', initials: 'JO', session: makeSession('emp-9') });
    expect(result?.employeeId).toBe('emp-9');
    expect(service.currentOperator()?.employeeId).toBe('emp-9');
  });

  it('authorize sem PIN retorna operador corrente sem modal', () => {
    setup(null);
    const op = addOperator();
    let result: TerminalOperator | null | undefined;
    service.authorize({ title: 'Devolução', requirePin: false }).subscribe(v => (result = v));

    expect(result?.employeeId).toBe(op.employeeId);
    expect(service.pendingRequest()).toBeNull();
  });

  it('authorize com PIN dentro da janela retorna direto e renova a janela', () => {
    setup(null, 10);
    const op = addOperator({ pinTrustedUntil: Date.now() + 60_000 });
    let result: TerminalOperator | null | undefined;
    service.authorize({ title: 'Pagamento', requirePin: true }).subscribe(v => (result = v));

    expect(result?.employeeId).toBe(op.employeeId);
    expect(service.pendingRequest()).toBeNull();
    expect(op.pinTrustedUntil).toBeGreaterThan(Date.now() + 9 * 60_000);
  });

  it('authorize com PIN fora da janela pede só o PIN do operador', () => {
    setup(null);
    addOperator({ pinTrustedUntil: 0 });
    let result: TerminalOperator | null | undefined;
    service.authorize({ title: 'Pagamento', requirePin: true }).subscribe(v => (result = v));

    expect(result).toBeUndefined();
    const request = service.pendingRequest();
    expect(request?.mode).toBe('pin');
    expect(request?.employee?.initials).toBe('MS');

    service.resolvePending({ employeeId: 'emp-1', employeeName: 'Maria Silva', initials: 'MS' });
    expect(result?.employeeId).toBe('emp-1');
    expect(service.currentOperator()?.pinTrustedUntil).toBeGreaterThan(Date.now());
  });

  it('cancelamento do modal resolve authorize com null', () => {
    setup(null);
    let result: TerminalOperator | null | undefined;
    service.authorize({ title: 'Teste', requirePin: true }).subscribe(v => (result = v));

    service.cancelPending();
    expect(result).toBeNull();
    expect(service.pendingRequest()).toBeNull();
  });

  it('requestSwitch pede sigla+PIN do operador alvo', () => {
    setup(null);
    addOperator();
    service['operators'].set([
      ...service.operators(),
      { employeeId: 'emp-2', name: 'Ana', initials: 'AN', pinTrustedUntil: 0, session: makeSession('emp-2') },
    ]);

    let result: TerminalOperator | null | undefined;
    service.requestSwitch('emp-2').subscribe(v => (result = v));

    const request = service.pendingRequest();
    expect(request?.mode).toBe('target');
    expect(request?.employee?.employeeId).toBe('emp-2');
    expect(result).toBeUndefined();

    service.resolvePending({ employeeId: 'emp-2', employeeName: 'Ana', initials: 'AN' });
    expect(result?.employeeId).toBe('emp-2');
    expect(service.currentOperator()?.employeeId).toBe('emp-2');
  });

  it('requestSwitch rejeita credenciais de outra pessoa', () => {
    setup(null);
    addOperator();
    service['operators'].set([
      ...service.operators(),
      { employeeId: 'emp-2', name: 'Ana', initials: 'AN', pinTrustedUntil: 0, session: makeSession('emp-2') },
    ]);

    let result: TerminalOperator | null | undefined;
    service.requestSwitch('emp-2').subscribe(v => (result = v));

    service.resolvePending({ employeeId: 'emp-9', employeeName: 'Outro', initials: 'OU' });
    expect(result).toBeNull();
    expect(service.currentOperator()?.employeeId).toBe('emp-1');
  });

  it('requestSwitch ignora alvo inexistente sem abrir modal', () => {
    setup(null);
    addOperator();
    let result: TerminalOperator | null | undefined;
    service.requestSwitch('nao-existe').subscribe(v => (result = v));
    expect(result).toBeNull();
    expect(service.pendingRequest()).toBeNull();
  });

  it('removeOperator desloga só a pessoa e mantém o app aberto', () => {
    setup(null);
    addOperator();
    service['operators'].set([
      ...service.operators(),
      { employeeId: 'emp-2', name: 'Ana', initials: 'AN', pinTrustedUntil: 0, session: makeSession('emp-2') },
    ]);
    currentUser$.next(makeUser('emp-1'));

    service.removeOperator('emp-2');

    expect(service.operators().map(o => o.employeeId)).toEqual(['emp-1']);
    expect(service.currentOperator()?.employeeId).toBe('emp-1');
    expect(authService.logout).not.toHaveBeenCalled();
    expect(authService.restoreSession).not.toHaveBeenCalled();
  });

  it('removeOperator no dono da sessão transfere para outro logado', () => {
    setup(null);
    const sessionA = makeSession('emp-1');
    const sessionB = makeSession('emp-2');
    service['operators'].set([
      { employeeId: 'emp-1', name: 'Maria', initials: 'MS', pinTrustedUntil: 0, session: sessionA },
      { employeeId: 'emp-2', name: 'Ana', initials: 'AN', pinTrustedUntil: 0, session: sessionB },
    ]);
    service['currentOperatorId'].set('emp-1');
    currentUser$.next(makeUser('emp-1'));

    service.removeOperator('emp-1');

    expect(authService.restoreSession).toHaveBeenCalledWith(sessionB);
    expect(service.operators().map(o => o.employeeId)).toEqual(['emp-2']);
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('removeOperator da última pessoa faz logout real', () => {
    setup(null);
    addOperator();
    currentUser$.next(makeUser('emp-1'));

    service.removeOperator('emp-1');

    expect(authService.logout).toHaveBeenCalled();
    expect(service.operators()).toEqual([]);
  });

  it('não adiciona CUSTOMER e preserva o usuário ativo quando candidato é rejeitado', () => {
    setup(makeUser('emp-1'));
    const active = service.currentOperator();
    let result: TerminalOperator | null | undefined;
    service.requestAuthentication().subscribe(value => result = value);
    const session = makeSession('customer-1');
    session.user.role = UserRole.CUSTOMER;

    service.resolvePending({ employeeId: 'customer-1', employeeName: 'Customer', session });

    expect(result).toBeNull();
    expect(service.currentOperator()).toBe(active);
    expect(service.operators()).toHaveLength(1);
    expect(authService.restoreSession).not.toHaveBeenCalled();
  });

  it('rejeita login sem sessão autenticada e não reutiliza o token ativo', () => {
    setup(makeUser('emp-1'));
    service.requestAuthentication().subscribe();

    service.resolvePending({ employeeId: 'emp-2', employeeName: 'Ana' });

    expect(service.currentOperator()?.employeeId).toBe('emp-1');
    expect(service.operators()).toHaveLength(1);
    expect(authService.restoreSession).not.toHaveBeenCalled();
  });

  it('revalidação recusada pelo backend bloqueia troca e mantém operador atual', () => {
    setup(makeUser('emp-1'));
    service.operators.update(operators => [...operators, {
      employeeId: 'emp-2', name: 'Ana', initials: 'AN', pinTrustedUntil: 0, session: makeSession('emp-2'),
    }]);
    let result: TerminalOperator | null | undefined;
    service.requestSwitch('emp-2').subscribe(value => result = value);
    authService.validateOperatorSession.mockReturnValue(throwError(() => new Error('Role revoked')));

    service.resolvePending({ employeeId: 'emp-2', employeeName: 'Ana', initials: 'AN' });

    expect(result).toBeNull();
    expect(service.currentOperator()?.employeeId).toBe('emp-1');
    expect(service.operators().map(operator => operator.employeeId)).toEqual(['emp-1']);
    expect(authService.restoreSession).not.toHaveBeenCalled();
  });

  it('logout não assume automaticamente usuário recusado pelo backend', () => {
    setup(makeUser('emp-1'));
    service.operators.update(operators => [...operators, {
      employeeId: 'emp-2', name: 'Ana', initials: 'AN', pinTrustedUntil: 0, session: makeSession('emp-2'),
    }]);
    authService.validateOperatorSession.mockReturnValue(throwError(() => new Error('Inactive')));

    service.removeOperator('emp-1');

    expect(authService.restoreSession).not.toHaveBeenCalled();
    expect(authService.logout).toHaveBeenCalledOnce();
    expect(service.operators()).toEqual([]);
  });

  it('persiste operadores em sessionStorage', () => {
    setup(null);
    addOperator({ pinTrustedUntil: 12345 });
    service['persist']();

    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY)!);
    expect(stored.currentOperatorId).toBe('emp-1');
    expect(stored.operators[0].employeeId).toBe('emp-1');
  });

  it('descarta tokens vencidos, inválidos e sessões ausentes ao restaurar', () => {
    setup(makeUser('emp-1'));
    const valid = addOperator({ session: makeSession('emp-1') });
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      currentOperatorId: 'emp-2',
      operators: [valid,
        { ...valid, employeeId: 'emp-2', session: makeSession('emp-2', -1) },
        { ...valid, employeeId: 'emp-3', session: { ...makeSession('emp-3'), accessToken: 'invalid' } },
        { ...valid, employeeId: 'emp-4', session: undefined },
      ],
    }));

    service['restore']();

    expect(service.operators().map(op => op.employeeId)).toEqual(['emp-1']);
    expect(service.currentOperator()).toBeNull();
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY)!).operators).toHaveLength(1);
  });

  it('bloqueia troca para token vencido mesmo com PIN ainda confiado', () => {
    setup(null);
    addOperator({ pinTrustedUntil: Date.now() + 600_000, session: makeSession('emp-1', -1) });
    let result: TerminalOperator | null | undefined;

    service.requestSwitch('emp-1').subscribe(value => result = value);

    expect(result).toBeNull();
    expect(service.operators()).toEqual([]);
    expect(service.pendingRequest()).toBeNull();
    expect(authService.restoreSession).not.toHaveBeenCalled();
  });

  it('revalida token que vence durante o modal de troca', () => {
    setup(null);
    addOperator();
    const target = { employeeId: 'emp-2', name: 'Ana', initials: 'AN', pinTrustedUntil: 0, session: makeSession('emp-2') };
    service.operators.update(operators => [...operators, target]);
    let result: TerminalOperator | null | undefined;
    service.requestSwitch('emp-2').subscribe(value => result = value);
    target.session = makeSession('emp-2', -1);

    service.resolvePending({ employeeId: 'emp-2', employeeName: 'Ana' });

    expect(result).toBeNull();
    expect(authService.restoreSession).not.toHaveBeenCalled();
    expect(service.currentOperator()?.employeeId).toBe('emp-1');
  });

  it('não transfere logout para outra sessão já vencida', () => {
    setup(makeUser('emp-1'));
    const active = addOperator();
    service.operators.set([active, {
      ...active, employeeId: 'emp-2', session: makeSession('emp-2', -1),
    }]);

    service.removeOperator('emp-1');

    expect(authService.restoreSession).not.toHaveBeenCalled();
    expect(authService.logout).toHaveBeenCalledOnce();
  });

  it('PIN confiado não permite autorizar operação com token vencido', () => {
    setup(null);
    addOperator({ session: makeSession('emp-1', 0), pinTrustedUntil: Date.now() + 600_000 });

    service.authorize({ title: 'Pagamento', requirePin: true }).subscribe();

    expect(service.pendingRequest()?.mode).toBe('login');
    expect(service.operators()).toEqual([]);
  });

  it('remove sessões vencidas periodicamente com a aplicação aberta', () => {
    vi.useFakeTimers();
    try {
      setup(null);
      addOperator({ session: makeSession('emp-1', 1) });

      vi.advanceTimersByTime(30_000);

      expect(service.operators()).toEqual([]);
      expect(service.currentOperator()).toBeNull();
    } finally {
      TestBed.resetTestingModule();
      vi.useRealTimers();
    }
  });

  it('novo login principal limpa todos os operadores anteriores', () => {
    setup(makeUser('emp-1'));
    addOperator();

    authService.terminalLogin$.next();

    expect(service.operators()).toEqual([]);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('updateTrustWindow grava no backend e atualiza o signal', () => {
    setup(null);
    service.updateTrustWindow(30).subscribe();

    expect(settingsService.put).toHaveBeenCalledWith(PIN_TRUST_MINUTES_KEY, '30');
    expect(service.trustWindowMinutes()).toBe(30);
  });

  it('updateTrustWindow limita a faixa 1-120', () => {
    setup(null);
    service.updateTrustWindow(500).subscribe();
    expect(service.trustWindowMinutes()).toBe(120);
    service.updateTrustWindow(0).subscribe();
    expect(service.trustWindowMinutes()).toBe(1);
  });
});
