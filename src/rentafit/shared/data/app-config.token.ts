import { InjectionToken } from '@angular/core';

export interface AppConfig {
  /** Base URL of the ECS backend (e.g. https://api.meuapp.com).
   *  Empty string in development — relative paths are proxied by ng serve. */
  appName: string;
  apiBaseUrl: string;
  /** Base URL of the S3 bucket used for NF-se uploads. */
  s3BucketUrl: string;
  /** Defaults fiscais para emissão quando o front não os coleta. */
  fiscalDefaults?: {
    nfse?: {
      serviceCode?: string;
      nbsCode: string;
      serviceDescription: string;
      totalTaxRate?: number;
      ibsRate: number;
      cbsRate: number;
      isqnRate: number;
    };
    nfe?: {
      ncm: string;
      cfop: string;
      unit: string;
    };
  };
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');
