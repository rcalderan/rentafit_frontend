import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrintTemplate, TemplateType } from '../../data/print-template.model';
import { DEFAULT_RENTAL_CONTRACT_TEMPLATE } from '../../data/default-templates';
import { PrintTemplateStorageService } from '../../services/print-template-storage.service';
import { PrintPreviewModalComponent } from './print-preview-modal.component';

class FakePrintTemplateStorage {
  initialize(): Promise<void> {
    return Promise.resolve();
  }

  getById(id: string): PrintTemplate | undefined {
    return id === DEFAULT_RENTAL_CONTRACT_TEMPLATE.id ? DEFAULT_RENTAL_CONTRACT_TEMPLATE : undefined;
  }

  getDefaultByType(type: TemplateType): PrintTemplate | undefined {
    return type === 'RENTAL_CONTRACT' ? DEFAULT_RENTAL_CONTRACT_TEMPLATE : undefined;
  }
}

describe('PrintPreviewModalComponent template overlay', () => {
  let fixture: ComponentFixture<PrintPreviewModalComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PrintPreviewModalComponent],
      providers: [{ provide: PrintTemplateStorageService, useClass: FakePrintTemplateStorage }],
    });
    fixture = TestBed.createComponent(PrintPreviewModalComponent);
    fixture.componentRef.setInput('templateId', DEFAULT_RENTAL_CONTRACT_TEMPLATE.id);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
  });

  it('elevates only instances explicitly opened from the template list', () => {
    const backdrop = fixture.nativeElement.querySelector('.modal-backdrop') as HTMLElement;
    const dialog = fixture.nativeElement.querySelector('.modal-dialog') as HTMLElement;

    expect(backdrop.classList.contains('template-print-overlay')).toBe(false);
    expect(dialog.classList.contains('template-print-overlay')).toBe(false);

    fixture.componentRef.setInput('aboveSystemMenu', true);
    fixture.detectChanges();

    expect(backdrop.classList.contains('template-print-overlay')).toBe(true);
    expect(dialog.classList.contains('template-print-overlay')).toBe(true);
  });

  it('keeps isolated contract content mounted until printing finishes', async () => {
    fixture.destroy();
    fixture = TestBed.createComponent(PrintPreviewModalComponent);
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const closeSpy = vi.fn();
    fixture.componentRef.setInput('templateId', DEFAULT_RENTAL_CONTRACT_TEMPLATE.id);
    fixture.componentRef.setInput('printImmediately', true);
    fixture.componentRef.setInput('isolatePrint', true);
    fixture.componentInstance.close.subscribe(closeSpy);
    fixture.detectChanges();
    await vi.waitFor(() => expect(printSpy).toHaveBeenCalledOnce());

    const dialog = fixture.nativeElement.querySelector('.modal-dialog') as HTMLElement;
    const printStyles = [...document.head.querySelectorAll('style')]
      .map((style) => style.textContent ?? '')
      .join('\n');
    expect(dialog.classList.contains('contract-print-target')).toBe(true);
    expect(document.documentElement.classList.contains('rental-contract-print-active')).toBe(true);
    expect(closeSpy).not.toHaveBeenCalled();
    expect(printStyles).toContain('display: none !important');
    expect(printStyles).toContain('@page { size: 210mm 297mm; margin: 0; }');

    window.dispatchEvent(new Event('afterprint'));

    expect(closeSpy).toHaveBeenCalledOnce();
    expect(document.documentElement.classList.contains('rental-contract-print-active')).toBe(false);
  });
});
