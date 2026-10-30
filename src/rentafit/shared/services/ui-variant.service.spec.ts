import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';
import { User, UserRole } from '../../domains/auth/data/user.model';
import { AuthService } from '../../domains/auth/services/auth.service';
import { UiPreferenceStorage } from './ui-preference-storage';
import { UiVariantService } from './ui-variant.service';

class FakeBreakpointObserver {
  readonly state = new BehaviorSubject<BreakpointState>({ matches: false, breakpoints: {} });

  observe() {
    return this.state.asObservable();
  }
}

class FakeUiPreferenceStorage {
  stored: 'simplified' | 'legacy' | 'atelier' = 'simplified';

  read() {
    return this.stored;
  }

  write(variant: 'simplified' | 'legacy' | 'atelier') {
    this.stored = variant;
  }
}

class FakeAuthService {
  readonly currentUserSubject = new BehaviorSubject<User | null>(null);
  readonly currentUser$ = this.currentUserSubject.asObservable();
  readonly updatePreferences = vi.fn().mockReturnValue(of({}));

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }
}

describe('UiVariantService', () => {
  let breakpoints: FakeBreakpointObserver;
  let storage: FakeUiPreferenceStorage;
  let auth: FakeAuthService;
  let service: UiVariantService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UiVariantService,
        { provide: BreakpointObserver, useClass: FakeBreakpointObserver },
        { provide: UiPreferenceStorage, useClass: FakeUiPreferenceStorage },
        { provide: AuthService, useClass: FakeAuthService },
      ],
    });
    breakpoints = TestBed.inject(BreakpointObserver) as unknown as FakeBreakpointObserver;
    storage = TestBed.inject(UiPreferenceStorage) as unknown as FakeUiPreferenceStorage;
    auth = TestBed.inject(AuthService) as unknown as FakeAuthService;
    service = TestBed.inject(UiVariantService);
  });

  it('inicia com a interface Simplificada', () => {
    expect(service.activeVariant()).toBe('simplified');
    expect(document.documentElement.dataset['ui']).toBe('simplified');
  });

  it('persiste e aplica Legacy imediatamente no desktop', () => {
    service.selectVariant('legacy');

    expect(storage.stored).toBe('legacy');
    expect(service.preferredVariant()).toBe('legacy');
    expect(service.activeVariant()).toBe('legacy');
    expect(document.documentElement.dataset['ui']).toBe('legacy');
  });

  it('persiste e aplica Atelier imediatamente no desktop', () => {
    service.selectVariant('atelier');

    expect(storage.stored).toBe('atelier');
    expect(service.preferredVariant()).toBe('atelier');
    expect(service.activeVariant()).toBe('atelier');
    expect(document.documentElement.dataset['ui']).toBe('atelier');
  });

  it('força Simplificada no mobile sem apagar a preferência Legacy', () => {
    service.selectVariant('legacy');
    breakpoints.state.next({ matches: true, breakpoints: {} });

    expect(service.preferredVariant()).toBe('legacy');
    expect(service.activeVariant()).toBe('simplified');
    expect(storage.stored).toBe('legacy');
  });

  it('restaura Legacy ao voltar para desktop', () => {
    service.selectVariant('legacy');
    breakpoints.state.next({ matches: true, breakpoints: {} });
    breakpoints.state.next({ matches: false, breakpoints: {} });

    expect(service.activeVariant()).toBe('legacy');
    expect(document.documentElement.dataset['ui']).toBe('legacy');
  });

  it('sincroniza variante do usuário ao autenticar e envia ao backend ao selecionar', () => {
    auth.currentUserSubject.next({
      id: 'u1',
      username: 'ana',
      role: UserRole.ADMIN,
      active: true,
      uiVariant: 'atelier',
    });

    expect(service.preferredVariant()).toBe('atelier');
    expect(storage.stored).toBe('atelier');

    service.selectVariant('legacy');
    expect(auth.updatePreferences).toHaveBeenCalledWith({ uiVariant: 'legacy' });
  });
});
