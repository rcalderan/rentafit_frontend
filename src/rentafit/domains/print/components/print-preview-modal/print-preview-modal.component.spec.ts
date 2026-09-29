import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrintTemplate, TemplateType } from '../../data/print-template.model';
import { DEFAULT_RENTAL_CONTRACT_TEMPLATE } from '../../data/default-templates';
import { PrintTemplateStorageService } from '../../services/print-template-storage.service';
import { PrintPreviewModalComponent } from './print-preview-modal.component';

class FakePrintTemplateStorage {
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

  afterEach(() => fixture.destroy());

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
});
