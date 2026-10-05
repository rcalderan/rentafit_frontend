import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import {
  RentalIntervalSettingsComponent,
  RENTAL_WINDOW_KEY,
} from './rental-interval-settings.component';
import { SettingsService } from '../../service/settings.service';
import { AuthService } from '../../../auth/services/auth.service';

class FakeSettings {
  readonly writes: Array<{ key: string; value: string }> = [];
  fail = false;
  getNumber(): Observable<number> {
    return of(2);
  }
  put(key: string, value: string): Observable<void> {
    this.writes.push({ key, value });
    return this.fail ? throwError(() => new Error('Gravação recusada')) : of(undefined);
  }
}
class FakeAuthorization {
  hasAnyRole(): boolean {
    return true;
  }
}

describe('RentalIntervalSettingsComponent', () => {
  let settings: FakeSettings;
  beforeEach(() => {
    settings = new FakeSettings();
    TestBed.configureTestingModule({
      providers: [
        { provide: SettingsService, useValue: settings },
        { provide: AuthService, useClass: FakeAuthorization },
      ],
    });
  });
  it('carrega o default e salva o intervalo inteiro', () => {
    const fixture = TestBed.createComponent(RentalIntervalSettingsComponent);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.value).toBe('2');
    input.value = '3';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    expect(settings.writes).toEqual([{ key: RENTAL_WINDOW_KEY, value: '3' }]);
  });
  it('rejeita frações e mostra falha sem sucesso falso', () => {
    const fixture = TestBed.createComponent(RentalIntervalSettingsComponent);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.value = '1.5';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
    input.value = '0';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    settings.fail = true;
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Gravação recusada');
    expect(fixture.nativeElement.textContent).not.toContain('Intervalo salvo.');
  });
});
