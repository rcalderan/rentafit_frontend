import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TerminalSectorService } from '../service/terminal-sector.service';
import { terminalSectorInterceptor } from './terminal-sector.interceptor';

describe('terminalSectorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let terminalSector: TerminalSectorService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([terminalSectorInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    terminalSector = TestBed.inject(TerminalSectorService);
  });

  it('envia X-Terminal-Sector-Id quando o terminal tem setor', () => {
    terminalSector.assign({
      id: 'sec-x',
      issuerCnpj: '12345678000190',
      name: 'Retirada',
      code: 'RET',
      active: true,
      isDefault: true,
    });

    http.get('/api/v1/sectors').subscribe();

    const request = httpMock.expectOne('/api/v1/sectors');
    expect(request.request.headers.get('X-Terminal-Sector-Id')).toBe('sec-x');
    request.flush([]);
  });

  it('não envia o header quando o terminal está sem setor', () => {
    http.get('/api/v1/sectors').subscribe();

    const request = httpMock.expectOne('/api/v1/sectors');
    expect(request.request.headers.has('X-Terminal-Sector-Id')).toBe(false);
    request.flush([]);
  });
});
