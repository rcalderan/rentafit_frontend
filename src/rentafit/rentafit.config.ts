import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { LocationStrategy } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './rentafit.routes';
import { authInterceptor } from './domains/auth/interceptors/auth.interceptor';
import { loadingInterceptor } from './shared/interceptors/loading.interceptor';
import { terminalSectorInterceptor } from './domains/sector/interceptors/terminal-sector.interceptor';
import { environment } from '../environments/environment';
import { APP_CONFIG } from './shared/data/app-config.token';
import { SilentLocationStrategy } from './shared/strategies/silent-location.strategy';
import { FiscalDocumentService } from './domains/finance/service/fiscal-document.service';
import { FiscalDocumentHttpService } from './domains/finance/service/fiscal-document-http.service';

export const rentafitConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor, terminalSectorInterceptor, loadingInterceptor])
    ),
    { provide: APP_CONFIG, useValue: environment },
    { provide: FiscalDocumentService, useClass: FiscalDocumentHttpService },
    { provide: LocationStrategy, useClass: SilentLocationStrategy },
  ]
};
