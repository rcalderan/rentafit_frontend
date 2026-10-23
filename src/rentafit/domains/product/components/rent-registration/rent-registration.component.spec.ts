import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
const emptyQueryParams = of({});
import { Registration } from './rent-registration.component';
import { ProductService } from '../../service/product.service';
import { CategoryService } from '../../service/category.service';
import { Router, ActivatedRoute } from '@angular/router';
import { IRentalItem, ICategory } from '../../data/Product.interface';
import { SessionFormStorageService } from '../../../../shared/services/session-form-storage.service';
import { TabService } from '../../../../shared/services/tab.service';

describe('Registration', () => {
  let productService: { saveRentalItem: ReturnType<typeof vi.fn>; getRentalItemByLegacyId: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let formStorage: { saveDraft: ReturnType<typeof vi.fn>; loadDraft: ReturnType<typeof vi.fn>; clearDraft: ReturnType<typeof vi.fn> };
  let tabService: { closeActiveIf: ReturnType<typeof vi.fn>; getTabId: ReturnType<typeof vi.fn>; updateTitle: ReturnType<typeof vi.fn>; open: ReturnType<typeof vi.fn> };

  const buildValidForm = (component: Registration) => {
    component.form.patchValue({
      name: 'Terno Azul',
      categoryId: 'cat-1',
      categoryName: 'Vestidos',
      condition: 'NEW',
      size: 'M',
      color: 'Azul',
      value: 120,
      description: 'Desc',
      notes: 'Notas'
    });
  };

  beforeEach(async () => {
    Element.prototype.scrollIntoView = () => {};
    productService = {
      saveRentalItem: vi.fn(),
      getRentalItemByLegacyId: vi.fn()
    };
    router = { navigate: vi.fn() };
    formStorage = { saveDraft: vi.fn(), loadDraft: vi.fn().mockReturnValue(null), clearDraft: vi.fn() };
    tabService = { closeActiveIf: vi.fn(), getTabId: vi.fn(), updateTitle: vi.fn(), open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Registration],
      providers: [
        { provide: ProductService, useValue: productService },
        { provide: CategoryService, useValue: { getByType: vi.fn().mockReturnValue(of([])) } },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} }, queryParams: emptyQueryParams } },
        { provide: SessionFormStorageService, useValue: formStorage },
        { provide: TabService, useValue: tabService }
      ]
    }).compileComponents();
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(Registration);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  //  Category modal 

  it('opens and closes the category modal', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isCategoryModalOpen()).toBe(false);
    component.openCategoryModal();
    expect(component.isCategoryModalOpen()).toBe(true);
    component.closeCategoryModal();
    expect(component.isCategoryModalOpen()).toBe(false);
  });

  it('sets categoryName and closes modal on category selected', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.openCategoryModal();
    const category: ICategory = { id: 'cat-1', name: 'vestidos', displayName: 'Vestidos', productType: 'RENTAL', active: true };
    component.onCategorySelected(category);

    expect(component.form.get('categoryName')?.value).toBe('Vestidos');
    expect(component.isCategoryModalOpen()).toBe(false);
  });

  it('uses name as fallback when displayName is absent', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.onCategorySelected({ id: 'cat-2', name: 'acessorios', productType: 'RENTAL', active: true });
    expect(component.form.get('categoryName')?.value).toBe('acessorios');
  });

  it('renders category modal in the DOM when open', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.isCategoryModalOpen.set(true);
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector('rentafit-category-modal');
    expect(modal).not.toBeNull();
  });

  //  Legacy ID search 

  it('does not search by legacy id when field is empty', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.form.get('legacyId')?.setValue('');
    component.searchByLegacyId();
    expect(productService.getRentalItemByLegacyId).not.toHaveBeenCalled();
  });

  it('searches by legacy id, patches the form and marks as read-only', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const product: IRentalItem = {
      legacyId: 'L-1001', name: 'Vestido', status: 'AVAILABLE',
      value: 10, categoryName: 'Vestidos', size: 'M', color: 'Azul',
      brand: '', description: '', notes: '', condition: 'NEW'
    };

    productService.getRentalItemByLegacyId.mockReturnValue(of(product));
    component.form.get('legacyId')?.setValue('L-1001');
    component.searchByLegacyId();

    expect(productService.getRentalItemByLegacyId).toHaveBeenCalledWith('L-1001');
    expect(component.form.get('categoryName')?.value).toBe('Vestidos');
    expect(component.isReadOnly()).toBe(true);
    expect(component.form.get('name')?.disabled).toBe(true);
  });

  it('ignores 404 errors when searching by legacy id', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    productService.getRentalItemByLegacyId.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404 }))
    );
    component.form.get('legacyId')?.setValue('L-404');
    component.searchByLegacyId();

    expect(component.errorMessage()).toBeNull();
  });

  it('stores error message on non-404 search error', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    productService.getRentalItemByLegacyId.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 }))
    );
    component.form.get('legacyId')?.setValue('L-500');
    component.searchByLegacyId();

    expect(component.errorMessage()).not.toBeNull();
  });

  //  Form helpers 

  it('returns proper control status and error', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const nameControl = component.form.get('name');
    expect(component.getControlStatus('name')).toBe('NONE');

    nameControl?.markAsTouched();
    nameControl?.markAsDirty();
    expect(component.getControlStatus('name')).toBe('INVALID');
    expect(component.getControlError('name')).toMatch(/Campo/);

    const valueControl = component.form.get('value');
    valueControl?.setValue(0);
    valueControl?.markAsTouched();
    valueControl?.markAsDirty();
    expect(component.getControlError('value')).toContain('zero');
  });

  it('returns status class based on status value', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.form.get('status')?.setValue('AVAILABLE');
    expect(component.getStatusClass()).toBe('green');

    component.form.get('status')?.setValue('RENTED');
    expect(component.getStatusClass()).toBe('green');

    component.form.get('status')?.setValue('DAMAGED');
    expect(component.getStatusClass()).toBe('red');
  });

  it('detects when the form is empty', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.form.patchValue({ legacyId: '', name: '', categoryName: '' });
    expect(component.isFormEmpty()).toBe(true);

    component.form.patchValue({ name: 'Alguma coisa' });
    expect(component.isFormEmpty()).toBe(false);

    component.form.patchValue({ name: '', categoryName: 'Vestidos' });
    expect(component.isFormEmpty()).toBe(false);
  });

  //  Save 

  it('does not save when form is invalid', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.form.get('name')?.setValue('');
    component.save();
    expect(productService.saveRentalItem).not.toHaveBeenCalled();
  });

  it('saves and locks the form when valid', () => {
    const saved: IRentalItem = {
      id: 'p-1', legacyId: 'L-1001', name: 'Terno Azul', status: 'AVAILABLE',
      value: 120, categoryName: 'Vestidos', size: 'M', color: 'Azul',
      brand: '', description: '', notes: '', condition: 'NEW'
    };
    productService.saveRentalItem.mockReturnValue(of(saved));

    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    buildValidForm(component);
    component.save();

    expect(productService.saveRentalItem).toHaveBeenCalled();
    expect(component.isReadOnly()).toBe(true);
    expect(component.form.disabled).toBe(true);
    expect(component.form.get('id')?.value).toBe('p-1');
  });

  it('does not save when categoryId is empty even if categoryName is set', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.form.patchValue({
      name: 'Terno Azul',
      categoryName: 'Vestidos',
      condition: 'NEW',
      size: 'M',
      color: 'Azul',
      value: 120,
    });
    component.save();

    expect(productService.saveRentalItem).not.toHaveBeenCalled();
  });

  it('exibe modal de resumo apos salvar produto, sem fechar a aba', () => {
    const saved: IRentalItem = {
      id: 'p-1', legacyId: 'L-1001', name: 'Terno Azul', status: 'AVAILABLE',
      value: 120, categoryName: 'Vestidos', size: 'M', color: 'Azul',
      brand: '', description: '', notes: '', condition: 'NEW'
    };
    productService.saveRentalItem.mockReturnValue(of(saved));

    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    buildValidForm(component);
    component.save();

    expect(component.savedProduct()).toEqual(saved);
    expect(tabService.closeActiveIf).not.toHaveBeenCalled();

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('rentafit-product-created-modal')).not.toBeNull();
  });

  it('X do modal de resumo fecha o modal e mantem a aba', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.savedProduct.set({ id: 'p-1' } as IRentalItem);
    component.dismissCreatedSummary();

    expect(component.savedProduct()).toBeNull();
    expect(tabService.closeActiveIf).not.toHaveBeenCalled();
  });

  it('OK do modal de resumo fecha o modal e a aba', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.savedProduct.set({ id: 'p-1' } as IRentalItem);
    component.confirmCreatedSummary();

    expect(component.savedProduct()).toBeNull();
    expect(tabService.closeActiveIf).toHaveBeenCalledWith('/product/registration');
  });

  it('Locacao do modal abre Nova Locação com o produto como item do rascunho', () => {
    const saved: IRentalItem = {
      id: 'uuid-1', legacyId: '5583', name: 'Costume turco', status: 'AVAILABLE',
      value: 6000, categoryName: 'Rigor', size: '48', color: 'PRETO',
      brand: 'TURCO', description: 'Desc', notes: 'Notas', condition: 'NEW'
    };

    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.savedProduct.set(saved);
    component.rentCreatedProduct();

    expect(component.savedProduct()).toBeNull();
    expect(formStorage.saveDraft).toHaveBeenCalledWith(
      'rental-contract',
      expect.any(String),
      expect.objectContaining({
        contractLoaded: true,
        itemRentalIds: [['5583', 'uuid-1']],
        contract: expect.objectContaining({
          itens: [
            expect.objectContaining({
              codigo: '5583',
              descricao: 'Costume turco',
              valor: 6000,
              entregue: false,
              sub: [{ tipo: 'observacao', descricao: 'TAM: 48 | COR: PRETO' }],
            }),
          ],
        }),
      })
    );
    const draftId = formStorage.saveDraft.mock.calls.find((c: unknown[]) => c[0] === 'rental-contract')?.[1];
    expect(tabService.open).toHaveBeenCalledWith('/rental/new', 'Nova Locação', 'rental', draftId);
  });

  it('stores validation errors from 400 responses', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { errors: [{ message: 'Invalid payload' }] }
    });
    productService.saveRentalItem.mockReturnValue(throwError(() => error));

    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    buildValidForm(component);
    component.save();

    expect(component.errorMessage()).toEqual(['Invalid payload']);
  });

  it('stores fallback message on non-400 save error', () => {
    productService.saveRentalItem.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 }))
    );

    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    buildValidForm(component);
    component.save();

    expect(component.errorMessage()).not.toBeNull();
  });

  //  Scroll para o primeiro campo inválido 

  it('marca todos os controles como touched ao salvar com formulário inválido', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    component.save();

    Object.values(component.form.controls).forEach(ctrl => {
      expect(ctrl.touched).toBe(true);
    });
  });

  it('rola e foca o primeiro campo inválido ao salvar formulário inválido', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => {});

    component.save();

    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(focusSpy).toHaveBeenCalled();
    expect(productService.saveRentalItem).not.toHaveBeenCalled();
  });

  it('não rola quando o formulário é válido', () => {
    const saved: IRentalItem = {
      id: 'p-1', legacyId: 'L-1001', name: 'Terno Azul', status: 'AVAILABLE',
      value: 120, categoryName: 'Vestidos', size: 'M', color: 'Azul',
      brand: '', description: '', notes: '', condition: 'NEW'
    };
    productService.saveRentalItem.mockReturnValue(of(saved));

    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    buildValidForm(component);
    fixture.detectChanges();

    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    component.save();

    expect(scrollSpy).not.toHaveBeenCalled();
    expect(productService.saveRentalItem).toHaveBeenCalled();
  });

  //  Clear / enable editing / close 

  it('clears and resets the form', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    buildValidForm(component);
    component.form.disable();
    component.isReadOnly.set(true);

    component.clear();

    expect(component.isReadOnly()).toBe(false);
    expect(component.form.get('id')?.disabled).toBe(true);
    expect(component.form.get('status')?.disabled).toBe(true);
    expect(component.form.get('legacyId')?.enabled).toBe(true);
  });

  it('enables editing while keeping system fields disabled', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.enableEditing();

    expect(component.isReadOnly()).toBe(false);
    expect(component.form.get('id')?.disabled).toBe(true);
    expect(component.form.get('legacyId')?.disabled).toBe(true);
    expect(component.form.get('status')?.disabled).toBe(true);
  });

  it('navigates home when closing', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.close();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('clears the error message', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.errorMessage.set('Algum erro');
    component.clearError();
    expect(component.errorMessage()).toBeNull();
  });

  //  DOM 

  it('renders search icon and edit button based on read-only state', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const searchIcon = fixture.nativeElement.querySelector('.search-icon');
    expect(searchIcon).not.toBeNull();

    component.isReadOnly.set(true);
    fixture.detectChanges();

    const editButton = fixture.nativeElement.querySelector('.edit-btn');
    expect(editButton).not.toBeNull();
  });

  it('shows status badge when form has values', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.form.patchValue({ name: 'Produto', categoryName: 'Vestidos' });
    component.form.get('status')?.setValue('AVAILABLE');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.status-badge');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('AVAILABLE');
  });

  it('shows validation messages and icons', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const nameControl = component.form.get('name');
    const valueControl = component.form.get('value');

    nameControl?.setValue('');
    nameControl?.markAsDirty();
    nameControl?.markAsTouched();
    valueControl?.setValue(0);
    valueControl?.markAsDirty();
    valueControl?.markAsTouched();
    fixture.detectChanges();

    const fieldErrors = fixture.nativeElement.querySelectorAll('.field-error');
    const invalidIcons = fixture.nativeElement.querySelectorAll('.invalid-icon.show');
    expect(fieldErrors.length).toBeGreaterThan(0);
    expect(invalidIcons.length).toBeGreaterThan(0);

    nameControl?.setValue('Produto XPTO');
    valueControl?.setValue(100);
    nameControl?.markAsDirty();
    nameControl?.markAsTouched();
    valueControl?.markAsDirty();
    valueControl?.markAsTouched();
    fixture.detectChanges();

    const validIcons = fixture.nativeElement.querySelectorAll('.valid-icon.show');
    expect(validIcons.length).toBeGreaterThan(0);
  });

  it('renders modal when there is an error message', () => {
    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.errorMessage.set('Error');
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector('rentafit-modal');
    expect(modal).not.toBeNull();
  });

  // BUG-2026-05-10-2 REGRESSION — ProductService deve relançar HttpErrorResponse original

  it('BUG-2026-05-10-2: exibe mensagens de campo quando service relança HttpErrorResponse 400 diretamente', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { errors: [{ message: 'Name is required' }] }
    });
    productService.saveRentalItem.mockReturnValue(throwError(() => error));

    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    buildValidForm(component);
    component.save();

    expect(component.errorMessage()).toEqual(['Name is required']);
  });

  it('BUG-2026-05-10-2: NÃO exibe falha silenciosa — errorMessage nunca fica null após erro 400', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { errors: [{ message: 'Size is required' }] }
    });
    productService.saveRentalItem.mockReturnValue(throwError(() => error));

    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    buildValidForm(component);
    component.save();

    expect(component.errorMessage()).not.toBeNull();
  });

  it('BUG-2026-05-10-2: exibe mensagem genérica quando service relança HttpErrorResponse 500 diretamente', () => {
    productService.saveRentalItem.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 }))
    );

    const fixture = TestBed.createComponent(Registration);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    buildValidForm(component);
    component.save();

    expect(component.errorMessage()).toBe('Ocorreu um erro ao salvar os dados do produto.');
  });
});
