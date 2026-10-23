import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { WritableSignal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NewSale } from './new-sale.component';
import { SalesOrderService } from '../../service/sales-order.service';
import { CustomerService } from '../../../customer/service/customer.service';
import { ProductService } from '../../../product/service/product.service';
import { TerminalOperatorService } from '../../../auth/services/terminal-operator.service';
import { SessionFormStorageService } from '../../../../shared/services/session-form-storage.service';
import { TabService } from '../../../../shared/services/tab.service';
import { APP_CONFIG } from '../../../../shared/data/app-config.token';
import { IRetailItem } from '../../../product/data/Product.interface';
import { ISalesOrder } from '../../data/sales-order.interface';

type TestableNewSale = {
  openItemModal(): void;
  selectProduct(p: IRetailItem): void;
  confirmAddItem(): void;
  save(): void;
  selectedProduct: IRetailItem | null;
  selectedOutOfStock: boolean;
  order: WritableSignal<ISalesOrder | null>;
};

describe('NewSale', () => {
  const asTestable = (component: NewSale): TestableNewSale =>
    component as unknown as TestableNewSale;

  const buildProduct = (quantityAvailable?: number): IRetailItem => ({
    id: 'p-1',
    name: 'Vestido Longo',
    size: 'M',
    color: 'Branco',
    brand: 'Marca X',
    value: 250,
    description: '',
    sku: 'SKU-001',
    stock: quantityAvailable === undefined ? undefined : { quantityAvailable },
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewSale],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } }, queryParams: of({}) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: SalesOrderService,
          useValue: {
            getById: vi.fn(),
            create: vi.fn().mockReturnValue(of({ id: 'order-1', legacyId: 42, status: 'DRAFT', items: [], payments: [] })),
          },
        },
        { provide: CustomerService, useValue: { listCustomers: vi.fn().mockReturnValue(of({ content: [] })) } },
        { provide: ProductService, useValue: { listRetailItems: vi.fn().mockReturnValue(of({ content: [] })) } },
        { provide: TerminalOperatorService, useValue: { authorize: vi.fn(), currentOperator: vi.fn() } },
        { provide: SessionFormStorageService, useValue: { saveDraft: vi.fn(), loadDraft: vi.fn().mockReturnValue(null), clearDraft: vi.fn() } },
        { provide: TabService, useValue: { getTabId: vi.fn(), updateTitle: vi.fn() } },
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { appName: 'RentAFit Test', apiBaseUrl: '', s3BucketUrl: '' } },
      ],
    }).compileComponents();
  });

  function render(): { fixture: ReturnType<typeof TestBed.createComponent<NewSale>>; component: TestableNewSale } {
    const fixture = TestBed.createComponent(NewSale);
    const component = asTestable(fixture.componentInstance);
    fixture.detectChanges();
    component.openItemModal();
    fixture.detectChanges();
    return { fixture, component };
  }

  it('habilita Adicionar para produto com estoque', () => {
    const { fixture, component } = render();

    component.selectProduct(buildProduct(3));
    fixture.detectChanges();

    const modal: HTMLElement = fixture.nativeElement.querySelector('.modal');
    const addButton = modal.querySelector<HTMLButtonElement>('.modal-actions .btn-primary')!;

    expect(component.selectedOutOfStock).toBe(false);
    expect(addButton.disabled).toBe(false);
    expect(modal.querySelector('.modal-warning')).toBeNull();
  });

  it('desabilita Adicionar e exibe "Sem estoque" quando estoque é zero', () => {
    const { fixture, component } = render();

    component.selectProduct(buildProduct(0));
    fixture.detectChanges();

    const modal: HTMLElement = fixture.nativeElement.querySelector('.modal');
    const addButton = modal.querySelector<HTMLButtonElement>('.modal-actions .btn-primary')!;
    const warning = modal.querySelector<HTMLElement>('.modal-warning')!;

    expect(component.selectedOutOfStock).toBe(true);
    expect(addButton.disabled).toBe(true);
    expect(warning).not.toBeNull();
    expect(warning.textContent).toContain('Sem estoque');
  });

  it('trata produto sem registro de estoque como sem estoque', () => {
    const { fixture, component } = render();

    component.selectProduct(buildProduct());
    fixture.detectChanges();

    const modal: HTMLElement = fixture.nativeElement.querySelector('.modal');
    expect(component.selectedOutOfStock).toBe(true);
    expect(modal.querySelector<HTMLButtonElement>('.modal-actions .btn-primary')!.disabled).toBe(true);
    expect(modal.querySelector('.modal-warning')!.textContent).toContain('Sem estoque');
  });

  it('confirmAddItem não adiciona item quando o produto está sem estoque', () => {
    const { component } = render();

    component.selectProduct(buildProduct(0));
    component.confirmAddItem();

    expect(component.order()).toBeNull();
  });

  it('confirmAddItem adiciona item quando há estoque', () => {
    const { component } = render();

    component.selectProduct(buildProduct(3));
    component.confirmAddItem();

    expect(component.order()?.items).toHaveLength(1);
  });

  it('após criar o pedido navega mantendo o draftId para exibir a proposta na mesma aba', () => {
    const { component } = render();
    const router = TestBed.inject(Router);

    component.selectProduct(buildProduct(3));
    component.confirmAddItem();
    component.save();

    expect(router.navigate).toHaveBeenCalledWith(
      ['/sales/new'],
      { queryParams: { id: 'order-1', draftId: expect.any(String) } }
    );
    expect(component.order()?.id).toBe('order-1');
  });
});
