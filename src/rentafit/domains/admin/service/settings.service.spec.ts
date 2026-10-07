import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { lastValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../../shared/data/app-config.token';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: APP_CONFIG, useValue: { apiBaseUrl: '' } }],
    });
    service = TestBed.inject(SettingsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lê o valor de uma chave existente', () => {
    service.get('operator.pinTrustMinutes').subscribe(value => expect(value).toBe('10'));

    const request = httpMock.expectOne('/api/v1/settings/operator.pinTrustMinutes');
    expect(request.request.method).toBe('GET');
    request.flush({ key: 'operator.pinTrustMinutes', value: '10' });
  });

  it('retorna null quando a chave não existe (404)', async () => {
    const result = lastValueFrom(service.get('missing.key'));

    const request = httpMock.expectOne('/api/v1/settings/missing.key');
    request.flush({ message: 'not found' }, { status: 404, statusText: 'Not Found' });

    await expect(result).resolves.toBeNull();
  });

  it('getNumber faz parse e usa fallback em valor inválido', () => {
    service.getNumber('operator.pinTrustMinutes', 5).subscribe(value => expect(value).toBe(15));
    httpMock.expectOne('/api/v1/settings/operator.pinTrustMinutes')
      .flush({ key: 'operator.pinTrustMinutes', value: '15' });
  });

  it('getNumber retorna fallback quando leitura falha', async () => {
    const result = lastValueFrom(service.getNumber('operator.pinTrustMinutes', 5));

    httpMock.expectOne('/api/v1/settings/operator.pinTrustMinutes')
      .flush({ message: 'down' }, { status: 500, statusText: 'Server Error' });

    await expect(result).resolves.toBe(5);
  });

  it('grava o valor via PUT', () => {
    service.put('operator.pinTrustMinutes', '10').subscribe();

    const request = httpMock.expectOne('/api/v1/settings/operator.pinTrustMinutes');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ value: '10' });
    request.flush(null);
  });

  it('propaga mensagem de erro ao falhar a gravação', async () => {
    const result = lastValueFrom(service.put('operator.pinTrustMinutes', '10'));

    const request = httpMock.expectOne('/api/v1/settings/operator.pinTrustMinutes');
    request.flush({ message: 'forbidden' }, { status: 500, statusText: 'Server Error' });

    await expect(result).rejects.toThrow('Erro interno no servidor. Tente novamente mais tarde.');
  });
});
