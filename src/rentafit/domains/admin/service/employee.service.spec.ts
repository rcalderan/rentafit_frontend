import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { lastValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../../shared/data/app-config.token';
import { IActiveAttendant } from '../data/employee.interface';
import { EmployeeService } from './employee.service';

describe('EmployeeService', () => {
  let service: EmployeeService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: APP_CONFIG, useValue: { apiBaseUrl: '' } }],
    });
    service = TestBed.inject(EmployeeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lista atendentes ativos no endpoint dedicado', () => {
    const attendants: IActiveAttendant[] = [
      { id: 'employee-1', name: 'Ana', role: 'EMPLOYEE' },
      { id: 'manager-1', name: 'Bruno', role: 'MANAGER' },
      { id: 'admin-1', name: 'Carla', role: 'ADMIN' },
    ];

    service.listActiveAttendants().subscribe((result) => expect(result).toEqual(attendants));

    const request = httpMock.expectOne('/api/v1/employees/attendants');
    expect(request.request.method).toBe('GET');
    request.flush(attendants);
  });

  it('propaga mensagem de erro do backend ao falhar a listagem', async () => {
    const result = lastValueFrom(service.listActiveAttendants());
    const request = httpMock.expectOne('/api/v1/employees/attendants');

    request.flush({ message: 'Falha na lista' }, { status: 500, statusText: 'Server Error' });

    await expect(result).rejects.toThrow('Falha na lista');
  });

  it('usa mensagem amigável de 500 quando backend não envia message útil', async () => {
    const result = lastValueFrom(service.listActiveAttendants());
    const request = httpMock.expectOne('/api/v1/employees/attendants');

    request.flush({ message: 'An unexpected error occurred' }, { status: 500, statusText: 'Server Error' });

    await expect(result).rejects.toThrow('Erro interno no servidor. Tente novamente mais tarde.');
  });
});
