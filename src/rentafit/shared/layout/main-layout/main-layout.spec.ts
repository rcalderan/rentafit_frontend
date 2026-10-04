import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { MainLayout } from './main-layout';
import { AuthService } from '../../../domains/auth/services/auth.service';
import { TerminalOperatorService } from '../../../domains/auth/services/terminal-operator.service';
import { UiVariantService } from '../../services/ui-variant.service';
import { TabService } from '../../services/tab.service';
import { TabGroup } from '../../data/tab.model';

class MockUiVariantService {
  readonly isMobile = signal(false);
  readonly activeVariant = signal<'simplified' | 'legacy' | 'atelier'>('simplified');
}

class MockAuthService {
  hasRole() {
    return true;
  }
  hasAnyRole(roles: string[]) {
    return true;
  }
  logout() {}
}

class MockTabService {
  readonly tabs = signal([]);
  readonly activeTabId = signal<string | null>(null);
  open = vi.fn((path: string, title: string, _group: TabGroup) => path);
  activate = vi.fn();
  close = vi.fn();
}

class MockTerminalOperatorService {
  readonly operators = signal([]);
  readonly currentOperatorId = signal<string | null>(null);
  readonly currentOperator = signal(null);
  readonly pendingRequest = signal(null);
  requestSwitch = vi.fn().mockReturnValue(of(null));
  requestAuthentication = vi.fn().mockReturnValue(of(null));
  removeOperator = vi.fn();
  pruneExpiredOperators = vi.fn();
  resolvePending = vi.fn();
  cancelPending = vi.fn();
}

const mockActivatedRoute = {
  firstChild: null,
  snapshot: { data: {} },
};

describe('MainLayout', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<MainLayout>>;
  let component: MainLayout;
  let routerEvents$: Subject<any>;
  let uiVariant: MockUiVariantService;

  beforeEach(async () => {
    routerEvents$ = new Subject();

    TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [
        provideRouter([]),
        { provide: UiVariantService, useClass: MockUiVariantService },
        { provide: AuthService, useClass: MockAuthService },
        { provide: TerminalOperatorService, useClass: MockTerminalOperatorService },
        { provide: TabService, useClass: MockTabService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        {
          provide: Router,
          useValue: {
            events: routerEvents$.asObservable(),
            navigate: vi.fn(),
            url: '/home/dashboard',
            createUrlTree: vi.fn(() => ({})),
            serializeUrl: vi.fn(() => ''),
            isActive: vi.fn(() => false),
          },
        },
      ],
    });

    // Simplifica o template para evitar problemas com UserRole no teste
    TestBed.overrideComponent(MainLayout, {
      set: {
        template: `
          <div class="layout-container">
            <aside class="sidebar">
              <nav class="nav-menu">
                <a routerLink="/home/dashboard">Home</a>
                <button (click)="toggleProductSubmenu()">Products</button>
                <button (click)="logout()">Logout</button>
              </nav>
            </aside>
            <main class="main-content">
              <router-outlet></router-outlet>
            </main>
          </div>
        `,
      },
    });

    await TestBed.compileComponents();

    fixture = TestBed.createComponent(MainLayout);
    component = fixture.componentInstance;
    uiVariant = TestBed.inject(UiVariantService) as unknown as MockUiVariantService;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('closes all submenus when a submenu link is clicked', () => {
    fixture.detectChanges();
    (component as any).toggleProductSubmenu();
    expect(component['isProductSubmenuOpen']()).toBe(true);

    (component as any).closeAllSubmenus();

    expect(component['isCustomerSubmenuOpen']()).toBe(false);
    expect(component['isProductSubmenuOpen']()).toBe(false);
    expect(component['isRentalSubmenuOpen']()).toBe(false);
    expect(component['isSalesSubmenuOpen']()).toBe(false);
    expect(component['isReportsSubmenuOpen']()).toBe(false);
    expect(component['isAdminSubmenuOpen']()).toBe(false);
  });

  it('closes mobile sidebar on NavigationEnd', () => {
    fixture.detectChanges();
    uiVariant.isMobile.set(true);
    component['isSidebarVisible'].set(true);

    routerEvents$.next(new NavigationEnd(1, '/rental/new', '/rental/new'));

    expect(component['isSidebarVisible']()).toBe(false);
  });

  it('toggles product submenu on button click', () => {
    fixture.detectChanges();
    expect(component['isProductSubmenuOpen']()).toBe(false);

    (component as any).toggleProductSubmenu();
    expect(component['isProductSubmenuOpen']()).toBe(true);

    (component as any).toggleProductSubmenu();
    expect(component['isProductSubmenuOpen']()).toBe(false);
  });

  it('toggles admin submenu on button click', () => {
    fixture.detectChanges();
    expect(component['isAdminSubmenuOpen']()).toBe(false);

    (component as any).toggleAdminSubmenu();
    expect(component['isAdminSubmenuOpen']()).toBe(true);

    (component as any).toggleAdminSubmenu();
    expect(component['isAdminSubmenuOpen']()).toBe(false);
  });

  it('opens a tab through the menu and closes submenus', () => {
    fixture.detectChanges();
    const tabService = TestBed.inject(TabService) as unknown as MockTabService;

    (component as any).openTab('/customer/registration', 'Clientes', 'customer');

    expect(tabService.open).toHaveBeenCalledWith('/customer/registration', 'Clientes', 'customer');
    expect(component['isCustomerSubmenuOpen']()).toBe(false);
  });
});
