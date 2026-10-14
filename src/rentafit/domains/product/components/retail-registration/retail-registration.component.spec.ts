import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
const emptyQueryParams = of({});
import { RetailRegistration } from './retail-registration.component';
import { ProductService } from '../../service/product.service';
import { CategoryService } from '../../service/category.service';
import { Router, ActivatedRoute } from '@angular/router';
import { IRetailItem, ICategory } from '../../data/Product.interface';
import { APP_CONFIG } from '../../../../shared/data/app-config.token';
import { SessionFormStorageService } from '../../../../shared/services/session-form-storage.service';
import { TabService } from '../../../../shared/services/tab.service';

describe('RetailRegistration', () => {
  let productService: { saveRetailItem: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let formStorage: { saveDraft: ReturnType<typeof vi.fn>; loadDraft: ReturnType<typeof vi.fn>; clearDraft: ReturnType<typeof vi.fn> };
  let tabService: { closeActiveIf: ReturnType<typeof vi.fn>; getTabId: ReturnType<typeof vi.fn>; updateTitle: ReturnType<typeof vi.fn>; open: ReturnType<typeof vi.fn> };

  const buildValidForm = (component: RetailRegistration) => {
    component.form.patchValue({
      name: 'Vestido Longo',
      categoryName: 'Vestidos',
      size: 'M',
      color: 'Branco',
      value: 250,
      brand: 'Marca X',
      description: 'Descrição detalhada',
      sku: 'SKU-001'
    });
  };

  const buildSavedItem = (): IRetailItem => ({
    id: 'p-2',
    name: 'Vestido Longo',
    categoryName: 'Vestidos',
    size: 'M',
    color: 'Branco',
    brand: 'Marca X',
    value: 250,
    description: 'Descrição detalhada',
    details: '',
    sku: 'SKU-001'
  });

  beforeEach(async () => {
    Element.prototype.scrollIntoView = () => {};
    productService = { saveRetailItem: vi.fn() };
    router = { navigate: vi.fn() };
    formStorage = { saveDraft: vi.fn(), loadDraft: vi.fn().mockReturnValue(null), clearDraft: vi.fn() };
    tabService = { closeActiveIf: vi.fn(), getTabId: vi.fn(), updateTitle: vi.fn(), open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RetailRegistration],
      providers: [
        { provide: ProductService, useValue: productService },
        { provide: CategoryService, useValue: { getByType: vi.fn().mockReturnValue(of([])) } },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} }, queryParams: emptyQueryParams } },
        { provide: SessionFormStorageService, useValue: formStorage },
        { provide: TabService, useValue: tabService },
        // Stock (child) injeta StockService/AuthService que dependem de HttpClient + APP_CONFIG
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { appName: 'RentAFit Test', apiBaseUrl: '', s3BucketUrl: '' } }
      ]
    }).compileComponents();
  });

  //  Criação do componente 

  it('cria o componente', () => {
    const fixture = TestBed.createComponent(RetailRegistration);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  //  Modal de categorias 

  it('abre e fecha o modal de categorias', () => {
    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isCategoryModalOpen()).toBe(false);
    component.openCategoryModal();
    expect(component.isCategoryModalOpen()).toBe(true);
    component.closeCategoryModal();
    expect(component.isCategoryModalOpen()).toBe(false);
  });

  it('atribui categoryName e fecha o modal ao selecionar categoria', () => {
    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const category: ICategory = { id: 'cat-1', name: 'vestidos', displayName: 'Vestidos', productType: 'RETAIL', active: true };
    component.onCategorySelected(category);

    expect(component.form.get('categoryName')?.value).toBe('Vestidos');
    expect(component.isCategoryModalOpen()).toBe(false);
  });

  it('usa name como fallback quando displayName está ausente', () => {
    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.onCategorySelected({ id: 'cat-2', name: 'acessorios', productType: 'RETAIL', active: true });
    expect(component.form.get('categoryName')?.value).toBe('acessorios');
  });

  //  Helpers de formulário 

  it('retorna NONE para controles não tocados', () => {
    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.getControlStatus('name')).toBe('NONE');
    expect(component.getControlError('name')).toBeNull();
  });

  it('retorna INVALID e mensagem de erro quando o controle é inválido e tocado', () => {
    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const nameControl = component.form.get('name');
    nameControl?.markAsTouched();
    nameControl?.markAsDirty();

    expect(component.getControlStatus('name')).toBe('INVALID');
    expect(component.getControlError('name')).toMatch(/Campo/);
  });

  it('retorna VALID quando o controle é válido e tocado', () => {
    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const nameControl = component.form.get('name');
    nameControl?.setValue('Produto Válido');
    nameControl?.markAsTouched();
    nameControl?.markAsDirty();

    expect(component.getControlStatus('name')).toBe('VALID');
    expect(component.getControlError('name')).toBeNull();
  });

  it('retorna erro de valor mínimo quando value é zero', () => {
    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const valueControl = component.form.get('value');
    valueControl?.setValue(0);
    valueControl?.markAsTouched();
    valueControl?.markAsDirty();

    expect(component.getControlError('value')).toContain('zero');
  });

  //  Save 

  it('não chama o serviço quando o formulário é inválido', () => {
    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    component.save();

    expect(productService.saveRetailItem).not.toHaveBeenCalled();
  });

  it('salva e bloqueia o formulário quando válido', () => {
    productService.saveRetailItem.mockReturnValue(of(buildSavedItem()));

    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    buildValidForm(component);
    component.save();

    expect(productService.saveRetailItem).toHaveBeenCalled();
    expect(component.isReadOnly()).toBe(true);
    expect(component.form.disabled).toBe(true);
  });

  it('exibe modal de resumo apos salvar produto, sem fechar a aba', () => {
    productService.saveRetailItem.mockReturnValue(of(buildSavedItem()));

    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    buildValidForm(component);
    component.save();

    expect(component.savedProduct()).toEqual(buildSavedItem());
    expect(tabService.closeActiveIf).not.toHaveBeenCalled();

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('rentafit-product-created-modal')).not.toBeNull();
  });

  it('X do modal de resumo fecha o modal e mantem a aba', () => {
    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.savedProduct.set(buildSavedItem());
    component.dismissCreatedSummary();

    expect(component.savedProduct()).toBeNull();
    expect(tabService.closeActiveIf).not.toHaveBeenCalled();
  });

  it('OK do modal de resumo fecha o modal e a aba', () => {
    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.savedProduct.set(buildSavedItem());
    component.confirmCreatedSummary();

    expect(component.savedProduct()).toBeNull();
    expect(tabService.closeActiveIf).toHaveBeenCalledWith('/product/retail-registration');
  });

  it('Venda do modal abre Nova Venda com o produto como item (1 unidade)', () => {
    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.savedProduct.set(buildSavedItem());
    component.sellCreatedProduct();

    expect(component.savedProduct()).toBeNull();
    expect(formStorage.saveDraft).toHaveBeenCalledWith(
      'sales-order',
      expect.any(String),
      expect.objectContaining({
        order: expect.objectContaining({
          status: 'DRAFT',
          items: [
            expect.objectContaining({
              retailProductId: 'p-2',
              sku: 'SKU-001',
              unitPrice: 250,
              quantity: 1,
              discountValue: 0,
              itemStatus: 'PENDING',
              needsTailoring: false,
            }),
          ],
          payments: [],
        }),
      })
    );
    const draftId = formStorage.saveDraft.mock.calls.find((c: unknown[]) => c[0] === 'sales-order')?.[1];
    expect(tabService.open).toHaveBeenCalledWith('/sales/new', 'Nova Venda', 'sales', draftId);
  });

  it('armazena erros de validação de respostas 400', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { errors: [{ message: 'Dado inválido' }] }
    });
    productService.saveRetailItem.mockReturnValue(throwError(() => error));

    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    buildValidForm(component);
    component.save();

    expect(component.errorMessage()).toEqual(['Dado inválido']);
  });

  it('armazena mensagem genérica em erros não-400', () => {
    productService.saveRetailItem.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 }))
    );

    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    buildValidForm(component);
    component.save();

    expect(component.errorMessage()).not.toBeNull();
  });

  // Regressão BUG-2026-05-10-2: ProductService não deve converter HttpErrorResponse em Error genérico
  it('exibe mensagens de campo quando service relança HttpErrorResponse 400 diretamente', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { errors: [{ message: 'Size is required' }] }
    });
    productService.saveRetailItem.mockReturnValue(throwError(() => error));

    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    buildValidForm(component);
    component.save();

    expect(component.errorMessage()).toEqual(['Size is required']);
  });

  it('exibe mensagem genérica quando service relança HttpErrorResponse 500 diretamente', () => {
    const error = new HttpErrorResponse({ status: 500 });
    productService.saveRetailItem.mockReturnValue(throwError(() => error));

    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    buildValidForm(component);
    component.save();

    expect(component.errorMessage()).not.toBeNull();
    expect(typeof component.errorMessage()).toBe('string');
  });

  //  Scroll para o primeiro campo inválido 

  it('marca todos os controles como touched ao salvar com formulário inválido', () => {
    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    component.save();

    Object.values(component.form.controls).forEach(ctrl => {
      expect(ctrl.touched).toBe(true);
    });
  });

  it('rola e foca o primeiro campo inválido ao salvar formulário inválido', () => {
    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => {});

    component.save();

    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(focusSpy).toHaveBeenCalled();
    expect(productService.saveRetailItem).not.toHaveBeenCalled();
  });

  it('não rola quando o formulário é válido', () => {
    productService.saveRetailItem.mockReturnValue(of(buildSavedItem()));

    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    buildValidForm(component);
    fixture.detectChanges();

    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    component.save();

    expect(scrollSpy).not.toHaveBeenCalled();
    expect(productService.saveRetailItem).toHaveBeenCalled();
  });

  //  Clear / enable editing / close 

  it('limpa e reseta o formulário', () => {
    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    buildValidForm(component);
    component.form.disable();
    component.isReadOnly.set(true);

    component.clear();

    expect(component.isReadOnly()).toBe(false);
    expect(component.form.get('id')?.disabled).toBe(true);
    expect(component.form.get('createdAt')?.disabled).toBe(true);
  });

  it('habilita edição mantendo campos de sistema desabilitados', () => {
    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.enableEditing();

    expect(component.isReadOnly()).toBe(false);
    expect(component.form.get('id')?.disabled).toBe(true);
    expect(component.form.get('createdAt')?.disabled).toBe(true);
    expect(component.form.get('name')?.enabled).toBe(true);
  });

  it('navega para home ao fechar', () => {
    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.close();

    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('limpa a mensagem de erro', () => {
    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.errorMessage.set('Algum erro');
    component.clearError();

    expect(component.errorMessage()).toBeNull();
  });

  //  DOM 

  it('exibe o modal de erro quando há mensagem de erro', () => {
    const fixture = TestBed.createComponent(RetailRegistration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.errorMessage.set('Erro');
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector('rentafit-modal');
    expect(modal).not.toBeNull();
  });
});
