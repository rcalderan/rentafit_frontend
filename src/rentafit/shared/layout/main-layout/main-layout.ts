import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../domains/auth/services/auth.service';
import { UserRole } from '../../../domains/auth/data/user.model';
import {
  TerminalOperator,
  TerminalOperatorService,
} from '../../../domains/auth/services/terminal-operator.service';
import {
  EmployeeConfirmedEvent,
  EmployeeVerifyComponent,
} from '../../../domains/rental/features/employee-verify/employee-verify.component';
import { UiVariantService } from '../../services/ui-variant.service';
import { TabService } from '../../services/tab.service';
import { TabGroup } from '../../data/tab.model';

@Component({
  selector: 'rentafit-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, EmployeeVerifyComponent],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css'
})
export class MainLayout {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  protected readonly authService = inject(AuthService);
  protected readonly operatorService = inject(TerminalOperatorService);
  protected readonly uiVariant = inject(UiVariantService);
  protected readonly tabService = inject(TabService);

  protected readonly isMobile = this.uiVariant.isMobile;
  protected readonly isSidebarVisible = signal(!this.isMobile());
  protected readonly isCustomerSubmenuOpen = signal(false);
  protected readonly isProductSubmenuOpen = signal(false);
  protected readonly isRentalSubmenuOpen = signal(false);
  protected readonly isSalesSubmenuOpen = signal(false);
  protected readonly isReportsSubmenuOpen = signal(false);
  protected readonly isAdminSubmenuOpen = signal(false);
  protected readonly showFab = signal(true);
  protected readonly pageTitle = signal('Dashboard');

  // Expose tab state for the template.
  protected readonly tabs = this.tabService.tabs;
  protected readonly activeTabId = this.tabService.activeTabId;

  // Operador em comando do terminal.
  protected readonly operators = this.operatorService.operators;
  protected readonly currentOperator = this.operatorService.currentOperator;
  protected readonly operatorRequest = this.operatorService.pendingRequest;
  protected readonly operatorsOpen = signal(false);

  // Expõe UserRole para uso no template
  protected readonly UserRole = UserRole;

  constructor() {
    // BUG-2026-05-04-4: atualiza título do header e estado do FAB a cada navegação
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event) => {
      const url = (event as NavigationEnd).url;
      this.showFab.set(!url.includes('/rental/return/'));

      // Percorre a árvore de rotas ativadas para encontrar o title mais específico
      let child = this.activatedRoute.firstChild;
      while (child?.firstChild) { child = child.firstChild; }
      const title = child?.snapshot.data?.['title'] as string | undefined;
      this.pageTitle.set(title ?? 'Dashboard');

      if (this.isMobile()) {
        this.isSidebarVisible.set(false);
      }
    });
  }

  protected toggleSidebar(): void {
    this.isSidebarVisible.update(visible => !visible);
  }

  public closeAllSubmenus(): void {
    this.isCustomerSubmenuOpen.set(false);
    this.isProductSubmenuOpen.set(false);
    this.isRentalSubmenuOpen.set(false);
    this.isSalesSubmenuOpen.set(false);
    this.isReportsSubmenuOpen.set(false);
    this.isAdminSubmenuOpen.set(false);
  }

  protected toggleCustomerSubmenu(): void {
    const nextState = !this.isCustomerSubmenuOpen();
    this.closeAllSubmenus();
    this.isCustomerSubmenuOpen.set(nextState);
  }

  protected toggleProductSubmenu(): void {
    const nextState = !this.isProductSubmenuOpen();
    this.closeAllSubmenus();
    this.isProductSubmenuOpen.set(nextState);
  }

  protected toggleRentalSubmenu(): void {
    const nextState = !this.isRentalSubmenuOpen();
    this.closeAllSubmenus();
    this.isRentalSubmenuOpen.set(nextState);
  }

  protected toggleSalesSubmenu(): void {
    const nextState = !this.isSalesSubmenuOpen();
    this.closeAllSubmenus();
    this.isSalesSubmenuOpen.set(nextState);
  }

  protected toggleReportsSubmenu(): void {
    const nextState = !this.isReportsSubmenuOpen();
    this.closeAllSubmenus();
    this.isReportsSubmenuOpen.set(nextState);
  }

  protected toggleAdminSubmenu(): void {
    const nextState = !this.isAdminSubmenuOpen();
    this.closeAllSubmenus();
    this.isAdminSubmenuOpen.set(nextState);
  }

  /** Open a new tab for the given route and close mobile submenus. */
  protected openTab(path: string, title: string, group: TabGroup): void {
    this.closeAllSubmenus();
    this.tabService.open(path, title, group);
  }

  /** Activate an existing tab. */
  protected activateTab(tabId: string): void {
    this.tabService.activate(tabId);
  }

  /** Close a tab without triggering navigation side effects. */
  protected closeTab(event: MouseEvent, tabId: string): void {
    event.stopPropagation();
    this.tabService.close(tabId);
  }

  protected logout(): void {
    this.authService.logout();
  }

  protected toggleOperators(): void {
    this.operatorService.pruneExpiredOperators();
    this.operatorsOpen.update(open => !open);
  }

  protected switchOperator(operator: TerminalOperator): void {
    this.operatorsOpen.set(false);
    this.operatorService.requestSwitch(operator.employeeId).subscribe();
  }

  protected removeOperator(event: MouseEvent, employeeId: string): void {
    event.stopPropagation();
    this.operatorService.removeOperator(employeeId);
  }

  protected authenticateOperator(): void {
    this.operatorsOpen.set(false);
    this.operatorService.requestAuthentication().subscribe();
  }

  protected onOperatorConfirmed(event: EmployeeConfirmedEvent): void {
    this.operatorService.resolvePending(event);
  }

  protected onOperatorCancelled(): void {
    this.operatorService.cancelPending();
  }

  protected hasRole(role: UserRole): boolean {
    return this.authService.hasRole(role);
  }

  protected hasAnyRole(roles: UserRole[]): boolean {
    return this.authService.hasAnyRole(roles);
  }
}
