import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeService } from '../../../admin/service/employee.service';
import { AuthService } from '../../../auth/services/auth.service';
import {
  IMonthlyMovementResponse,
  IYearlyMovementResponse,
  MovementSourceFilter,
} from '../../data/financial-movement.model';
import {
  ChartCanvasRendererService,
  IChartInstanceHandle,
} from '../../service/chart-canvas-renderer.service';
import { FinancialMovementService } from '../../service/financial-movement.service';
import { Dashboard } from './dashboard';

class FakeFinancialMovementService {
  lastMonthlyArgs: { year: number; month: number; source: MovementSourceFilter } | null = null;
  lastYearlyArgs: { year: number; source: MovementSourceFilter } | null = null;

  monthlyResponse: IMonthlyMovementResponse = {
    year: 2026,
    month: 10,
    paidTotal: 1500,
    fineTotal: 80,
    refundedTotal: 200,
    netRealizedTotal: 1380,
    pendingTotal: 600,
    rentalNetTotal: 1080,
    saleNetTotal: 300,
    rentalPendingTotal: 500,
    salePendingTotal: 100,
    byPaymentMethod: [
      {
        paymentMethod: 'PIX',
        paidAmount: 1000,
        fineAmount: 80,
        refundedAmount: 0,
        netRealizedAmount: 1080,
        pendingAmount: 200,
        transactionCount: 2,
      },
      {
        paymentMethod: 'CASH',
        paidAmount: 500,
        fineAmount: 0,
        refundedAmount: 200,
        netRealizedAmount: 300,
        pendingAmount: 400,
        transactionCount: 2,
      },
    ],
    days: [
      {
        date: '2026-10-17',
        paidAmount: 1500,
        fineAmount: 80,
        refundedAmount: 200,
        netRealizedAmount: 1380,
        pendingAmount: 600,
        rentalNetAmount: 1080,
        saleNetAmount: 300,
        rentalPendingAmount: 500,
        salePendingAmount: 100,
        transactionCount: 3,
      },
    ],
    transactions: [
      {
        paymentId: 'pay-1',
        source: 'RENTAL',
        referenceId: 'contract-1',
        referenceCode: '1042',
        customerName: 'Maria Silva',
        installmentNumber: 1,
        installments: 2,
        paymentDate: '2026-10-17',
        paymentMethod: 'PIX',
        status: 'PAID',
        value: 1000,
        signedValue: 1000,
      },
      {
        paymentId: 'pay-2',
        source: 'RENTAL',
        referenceId: 'contract-1',
        referenceCode: '1042',
        customerName: 'Maria Silva',
        installmentNumber: 2,
        installments: 1,
        paymentDate: '2026-10-17',
        paymentMethod: 'PIX',
        status: 'MULTA',
        value: 80,
        signedValue: 80,
      },
      {
        paymentId: 'pay-3',
        source: 'SALE',
        referenceId: 'sale-1',
        referenceCode: 'V-261017-1',
        customerName: 'João Pereira',
        installmentNumber: 1,
        installments: 1,
        paymentDate: '2026-10-17',
        paymentMethod: 'CASH',
        status: 'REFUNDED',
        value: 200,
        signedValue: -200,
      },
    ],
  };

  yearlyResponse: IYearlyMovementResponse = {
    year: 2026,
    availableYears: [2026, 2025],
    paidTotal: 15000,
    fineTotal: 250,
    refundedTotal: 500,
    netRealizedTotal: 14750,
    pendingTotal: 3200,
    rentalNetTotal: 11750,
    saleNetTotal: 3000,
    rentalPendingTotal: 2500,
    salePendingTotal: 700,
    byPaymentMethod: [],
    months: [
      {
        month: 10,
        paidAmount: 1500,
        fineAmount: 80,
        refundedAmount: 200,
        netRealizedAmount: 1380,
        pendingAmount: 600,
        rentalNetAmount: 1080,
        saleNetAmount: 300,
        rentalPendingAmount: 500,
        salePendingAmount: 100,
        transactionCount: 3,
      },
    ],
  };

  getMonthlyMovement(
    year: number,
    month: number,
    source: MovementSourceFilter,
  ): Observable<IMonthlyMovementResponse> {
    this.lastMonthlyArgs = { year, month, source };
    return of(this.monthlyResponse);
  }

  getYearlyMovement(
    year: number,
    source: MovementSourceFilter,
  ): Observable<IYearlyMovementResponse> {
    this.lastYearlyArgs = { year, source };
    return of(this.yearlyResponse);
  }
}

class FakeChartCanvasRendererService {
  render(): IChartInstanceHandle | null {
    return { destroy: () => undefined };
  }
}

class FakeEmployeeService {
  checkInitials(initials: string, pin: string) {
    if (initials === 'EMP' && pin === '1234') {
      return of({ id: 'emp-1', initials: 'EMP', name: 'Atendente', role: 'EMPLOYEE' });
    }
    return of({ id: 'mgr-1', initials: 'RI', name: 'Richard Calderan', role: 'ADMIN' });
  }
}

class FakeAuthService {}

describe('Finance Dashboard', () => {
  let fixture: ComponentFixture<Dashboard>;
  let component: Dashboard;
  let movementService: FakeFinancialMovementService;
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    movementService = new FakeFinancialMovementService();
    routerSpy = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        { provide: FinancialMovementService, useValue: movementService },
        { provide: ChartCanvasRendererService, useClass: FakeChartCanvasRendererService },
        { provide: EmployeeService, useClass: FakeEmployeeService },
        { provide: AuthService, useClass: FakeAuthService },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('inicia bloqueado exigindo Sigla e PIN de ADMIN ou MANAGER', () => {
    const verifyEl = fixture.nativeElement.querySelector('rentafit-employee-verify');
    expect(verifyEl).toBeTruthy();
    expect(movementService.lastMonthlyArgs).toBeNull();
  });

  it('redireciona para /home/dashboard ao cancelar o modal de Sigla e PIN', () => {
    component.onAccessCancelled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/home/dashboard']);
  });

  it('bloqueia funcionário com role EMPLOYEE quando allowedRoles exige ADMIN ou MANAGER', () => {
    const verifyDebug = fixture.debugElement.children[0]?.children[0];
    const verifyComp = verifyDebug?.componentInstance as {
      initials: string | null;
      pin: string;
      error: string;
      confirm(): void;
    };
    verifyComp.initials = 'EMP';
    verifyComp.pin = '1234';
    verifyComp.confirm();
    fixture.detectChanges();

    expect(verifyComp.error).toContain('Acesso permitido apenas para Gerente ou Administrador');
    expect(movementService.lastMonthlyArgs).toBeNull();
  });

  it('desbloqueia após confirmação de Sigla + PIN e exibe KPIs com multas e estornos', () => {
    component.onAccessConfirmed({
      employeeId: 'mgr-1',
      employeeName: 'Richard Calderan',
      initials: 'RI',
      role: 'ADMIN',
    });
    component['onDaySelected']('2026-10-17');
    fixture.detectChanges();

    expect(movementService.lastMonthlyArgs).not.toBeNull();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Movimentação Financeira');
    expect(text).toContain('Richard Calderan');
    expect(text).toContain('Maria Silva');
    expect(text).toContain('Multa');
    expect(text).toContain('Estorno');
  });

  it('alterna para visão Anual e permite clicar num mês para abrir o calendário mensal', () => {
    component.onAccessConfirmed({
      employeeId: 'mgr-1',
      employeeName: 'Richard Calderan',
      initials: 'RI',
      role: 'MANAGER',
    });
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.seg-btn'),
    ) as HTMLButtonElement[];
    const yearlyBtn = buttons.find((b) => b.textContent?.includes('Anual'));
    yearlyBtn?.click();
    fixture.detectChanges();

    expect(movementService.lastYearlyArgs).not.toBeNull();

    const monthBucketBtn = fixture.nativeElement.querySelector(
      '.month-bucket-btn',
    ) as HTMLButtonElement | null;
    expect(monthBucketBtn).toBeTruthy();
    monthBucketBtn?.click();
    fixture.detectChanges();

    expect(movementService.lastMonthlyArgs?.month).toBe(10);
  });

  it('navega para o contrato de locação ao clicar numa transação de origem RENTAL', () => {
    component.onAccessConfirmed({
      employeeId: 'mgr-1',
      employeeName: 'Richard Calderan',
      initials: 'RI',
      role: 'ADMIN',
    });
    component['onDaySelected']('2026-10-17');
    fixture.detectChanges();

    const firstRow = fixture.nativeElement.querySelector('.tx-row') as HTMLElement | null;
    expect(firstRow).toBeTruthy();
    firstRow?.click();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/rental/new'], {
      queryParams: { id: 'contract-1' },
    });
  });
});
