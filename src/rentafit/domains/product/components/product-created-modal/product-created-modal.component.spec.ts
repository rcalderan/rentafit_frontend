import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ProductCreatedModalComponent } from './product-created-modal.component';
import { IRentalItem } from '../../data/Product.interface';

describe('ProductCreatedModalComponent', () => {
  const product: IRentalItem = {
    id: 'f35db10f-413d-4cd2-92f9-09892c8a5dc5',
    legacyId: '5583',
    name: 'Costume turco',
    categoryName: 'Rigor',
    size: '48',
    color: 'PRETO',
    brand: 'TURCO',
    value: 6000,
    description: 'Costume turco preto top de linha',
    status: 'AVAILABLE',
    notes: 'TESTEEE',
    condition: 'NEW',
  };

  function render() {
    const fixture = TestBed.createComponent(ProductCreatedModalComponent);
    fixture.componentRef.setInput('product', product);
    fixture.componentRef.setInput('code', '5583');
    fixture.componentRef.setInput('notes', 'TESTEEE');
    fixture.componentRef.setInput('actionLabel', 'Locação');
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCreatedModalComponent],
    }).compileComponents();
  });

  it('exibe o resumo do produto criado', () => {
    const fixture = render();
    const text: string = fixture.nativeElement.textContent;

    expect(text).toContain('5583');
    expect(text).toContain('Costume turco');
    expect(text).toContain('Rigor');
    expect(text).toContain('PRETO');
    expect(text).toContain('Costume turco preto top de linha');
    expect(text).toContain('TESTEEE');
    expect(text).toContain('6.000,00');
  });

  it('rotula o botão de ação com actionLabel', () => {
    const fixture = render();
    const actionBtn: HTMLElement = fixture.nativeElement.querySelector('.btn-primary');

    expect(actionBtn.textContent).toContain('Locação');
  });

  it('emite dismissed no botão X e no backdrop', () => {
    const fixture = render();
    const dismissed = vi.fn();
    fixture.componentInstance.dismissed.subscribe(dismissed);

    fixture.nativeElement.querySelector('.modal-close').click();
    fixture.nativeElement.querySelector('.modal-backdrop').click();

    expect(dismissed).toHaveBeenCalledTimes(2);
  });

  it('emite confirmed no botão OK', () => {
    const fixture = render();
    const confirmed = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);

    fixture.nativeElement.querySelector('.btn-confirm').click();

    expect(confirmed).toHaveBeenCalledTimes(1);
  });

  it('emite action no botão principal', () => {
    const fixture = render();
    const action = vi.fn();
    fixture.componentInstance.action.subscribe(action);

    fixture.nativeElement.querySelector('.btn-primary').click();

    expect(action).toHaveBeenCalledTimes(1);
  });
});
