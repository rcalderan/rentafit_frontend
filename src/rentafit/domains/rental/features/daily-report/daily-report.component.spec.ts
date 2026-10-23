import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { DailyReportComponent } from './daily-report.component';
import { DailyRentalReportService } from '../../service/daily-rental-report.service';
import { SectorService } from '../../../sector/service/sector.service';
import { IDailyRentalReport } from '../../data/daily-report.interface';

const buildReport = (overrides: Partial<IDailyRentalReport> = {}): IDailyRentalReport => ({
  startDate: '2026-06-28',
  endDate: '2026-06-28',
  generatedAt: '2026-06-27T23:00:00Z',
  contractCount: 1,
  itemCount: 1,
  adjustmentCount: 1,
  groups: [
    {
      clothingType: 'Terno / Smoking',
      itemCount: 1,
      items: [
        {
          contractLegacyId: '20260628-1',
          customerName: 'Ana Lima',
          legacyProductCode: '1042',
          description: 'Terno Slim',
          size: '48',
          color: 'Preto',
          pickupDate: '2026-06-26',
          adjustments: [
            { type: 'OBSERVACAO', typeDescription: 'Observação', description: 'Bainha -3cm' },
          ],
        },
      ],
    },
  ],
  ...overrides,
});

describe('DailyReportComponent', () => {
  let service: { getByPeriod: ReturnType<typeof vi.fn> };

  const makeComponent = () => TestBed.createComponent(DailyReportComponent).componentInstance;

  beforeEach(async () => {
    service = { getByPeriod: vi.fn().mockReturnValue(of(buildReport())) };

    TestBed.configureTestingModule({
      imports: [DailyReportComponent],
      providers: [
        { provide: DailyRentalReportService, useValue: service },
        { provide: SectorService, useValue: { list: () => of([]) } },
      ],
    });

    await TestBed.compileComponents();
  });

  it('carrega o relatório do dia ao iniciar', () => {
    const component = makeComponent();
    component.ngOnInit();

    expect(service.getByPeriod).toHaveBeenCalledTimes(1);
    expect(component['report']()?.groups[0].clothingType).toBe('Terno / Smoking');
  });

  it('marca isEmpty quando não há grupos', () => {
    service.getByPeriod.mockReturnValue(of(buildReport({ groups: [], itemCount: 0, contractCount: 0 })));
    const component = makeComponent();
    component.ngOnInit();

    expect(component['isEmpty']()).toBe(true);
  });

  it('define mensagem de erro e limpa relatório em caso de falha', () => {
    service.getByPeriod.mockReturnValue(throwError(() => new Error('Falha de rede')));
    const component = makeComponent();
    component.ngOnInit();

    expect(component['errorMsg']()).toBe('Falha de rede');
    expect(component['report']()).toBeNull();
  });

  it('não chama o serviço quando a data está vazia', () => {
    const component = makeComponent();
    component['startDate'].set('');
    component['generate']();

    expect(service.getByPeriod).not.toHaveBeenCalled();
    expect(component['errorMsg']()).toContain('Selecione o período');
  });
});
