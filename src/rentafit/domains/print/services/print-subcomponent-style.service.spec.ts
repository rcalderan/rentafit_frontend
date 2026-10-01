import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PRINT_SUBCOMPONENT_STYLES } from '../data/print-subcomponent-style.model';
import { PrintSubcomponentStyleService } from './print-subcomponent-style.service';

describe('PrintSubcomponentStyleService', () => {
  let service: PrintSubcomponentStyleService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PrintSubcomponentStyleService);
  });

  it('defaults subcomponents to the legacy contract styles', () => {
    const styles = service.read('');

    expect(styles['contract-items']).toMatchObject({ showHeader: true, borderMode: 'horizontal' });
    expect(styles['contract-payments']).toMatchObject({ showHeader: false, borderMode: 'horizontal' });
    expect(styles.signature).toMatchObject({ alignment: 'right', signatureLineWidthPercent: 35 });
    expect(styles['common-table']).toMatchObject({
      showHeader: false,
      backgroundColor: 'transparent',
      borderMode: 'none',
    });
  });

  it('serializes style changes and compiles scoped rules for every subcomponent', () => {
    const styles = service.read('');
    styles['contract-items'] = { ...styles['contract-items'], fontSizePt: 8 };
    const serialized = service.write(styles);
    const compiled = service.compile(serialized, service.scopeToken('template-42'));

    expect(service.read(serialized)['contract-items'].fontSizePt).toBe(8);
    expect(compiled).toContain('[data-print-style-scope="print-');
    expect(compiled).toContain('table[data-print-component="contract-items"]');
    expect(compiled).toContain('[data-print-component="signature"]');
    expect(compiled).toContain('font-size: 8pt !important');
    expect(compiled).toContain('tr:has(> th[data-print-table-header="true"])');
  });

  it('rejects invalid css-facing values loaded from persisted style data', () => {
    const invalid = JSON.stringify({
      version: 1,
      styles: {
        'common-table': {
          fontFamily: 'url(https://attacker.test)',
          fontSizePt: 1000,
          textColor: 'red;position:fixed',
          backgroundColor: 'url(javascript:alert(1))',
        },
      },
    });
    const style = service.read(invalid)['common-table'];

    expect(style.fontFamily).toBe(DEFAULT_PRINT_SUBCOMPONENT_STYLES['common-table'].fontFamily);
    expect(style.fontSizePt).toBe(48);
    expect(style.textColor).toBe('#111111');
    expect(style.backgroundColor).toBe('transparent');
  });
});
