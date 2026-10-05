import { of } from 'rxjs';
import { SettingsService } from '../../service/settings.service';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SystemComponent } from './system.component';
import { AuthService } from '../../../auth/services/auth.service';
import { MigrationService } from '../migration/migration.service';
import { APP_CONFIG } from '../../../../shared/data/app-config.token';
import { UserRole } from '../../../auth/data/user.model';

describe('SystemComponent', () => {
  let authService: { hasRole: ReturnType<typeof vi.fn>; hasAnyRole: ReturnType<typeof vi.fn> };
  let migrationService: { createSession: ReturnType<typeof vi.fn> };

  const makeFixture = () => {
    const fixture = TestBed.createComponent(SystemComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(async () => {
    authService = {
      hasRole: vi.fn().mockReturnValue(false),
      hasAnyRole: vi.fn().mockReturnValue(false),
    };
    migrationService = { createSession: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SystemComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: SettingsService, useValue: { getNumber: () => of(2) } },
        { provide: MigrationService, useValue: migrationService },
        { provide: APP_CONFIG, useValue: { apiBaseUrl: '' } },
      ],
    }).compileComponents();
  });

  it('cria o componente', () => {
    expect(makeFixture().componentInstance).toBeTruthy();
  });

  it('renderiza os cards de estatísticas e preços', () => {
    const element: HTMLElement = makeFixture().nativeElement;
    const titles = Array.from(element.querySelectorAll('.section-title')).map((t) =>
      t.textContent?.trim(),
    );
    expect(titles).toEqual(['Estatísticas de Uso', 'Configuração de Preços']);
    expect(element.querySelector('rentafit-ui-variant-selector')).toBeTruthy();
  });

  it('oculta a seção de migração quando o usuário não é admin', () => {
    authService.hasRole.mockReturnValue(false);
    const element: HTMLElement = makeFixture().nativeElement;
    expect(element.querySelector('.migration-section')).toBeNull();
    expect(authService.hasRole).toHaveBeenCalledWith(UserRole.ADMIN);
  });

  it('exibe a seção de migração quando o usuário é admin', () => {
    authService.hasRole.mockReturnValue(true);
    const element: HTMLElement = makeFixture().nativeElement;
    expect(element.querySelector('.migration-section')).not.toBeNull();
    expect(element.querySelector('app-migration')).toBeTruthy();
  });

  it('expõe isAdmin baseado em hasRole(ADMIN)', () => {
    authService.hasRole.mockReturnValue(true);
    expect(makeFixture().componentInstance.isAdmin).toBe(true);
    expect(authService.hasRole).toHaveBeenCalledWith(UserRole.ADMIN);
  });
});
