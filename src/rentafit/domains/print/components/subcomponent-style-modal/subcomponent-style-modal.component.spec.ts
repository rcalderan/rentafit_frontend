import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PRINT_SUBCOMPONENT_STYLES, PrintSubcomponentStyle } from '../../data/print-subcomponent-style.model';
import { SubcomponentStyleModalComponent } from './subcomponent-style-modal.component';

describe('SubcomponentStyleModalComponent', () => {
  let fixture: ComponentFixture<SubcomponentStyleModalComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SubcomponentStyleModalComponent] });
    fixture = TestBed.createComponent(SubcomponentStyleModalComponent);
    fixture.componentRef.setInput('componentType', 'common-table');
    fixture.componentRef.setInput('initialStyle', DEFAULT_PRINT_SUBCOMPONENT_STYLES['common-table']);
    fixture.detectChanges();
  });

  it('edits component styles without changing the repeated component configuration', () => {
    let saved: PrintSubcomponentStyle | undefined;
    fixture.componentInstance.save.subscribe((style) => (saved = style));
    const root = fixture.nativeElement as HTMLElement;
    const checkboxes = root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const size = root.querySelector<HTMLInputElement>('input[type="number"]');
    const selects = root.querySelectorAll<HTMLSelectElement>('select');

    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(false);
    checkboxes[1].click();
    size!.value = '12';
    size!.dispatchEvent(new Event('input', { bubbles: true }));
    selects[2].value = 'horizontal';
    selects[2].dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('.style-apply')!.click();

    expect(saved).toMatchObject({
      fontSizePt: 12,
      borderMode: 'horizontal',
      showHeader: true,
      backgroundColor: 'transparent',
    });
  });
});
