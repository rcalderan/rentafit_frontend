import { Component, ElementRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { CategoryModalComponent } from '../categories/category-modal.component';
import { ProductCreatedModalComponent } from '../product-created-modal/product-created-modal.component';
import { buildRentalDraftWithItem, RENTAL_CONTRACT_FORM_TYPE } from '../../../rental/service/rental-item-draft';
import {
  IRentalItem,
  IRentalHistoryItem,
  ICategory,
  ProductCondition,
  ProductStatus
} from '../../data/Product.interface';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../service/product.service';
import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessages } from '../../../../shared/utils/api-error';
import { SessionFormStorageService } from '../../../../shared/services/session-form-storage.service';
import { TabService } from '../../../../shared/services/tab.service';

@Component({
  selector: 'rentafit-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent, CategoryModalComponent, ProductCreatedModalComponent],
  templateUrl: './rent-registration.component.html',
  styleUrl: './rent-registration.component.css',
})
export class Registration implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private service = inject(ProductService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroy$ = new Subject<void>();
  private el = inject(ElementRef);
  private formStorage = inject(SessionFormStorageService);
  private tabService = inject(TabService);
  private readonly formType = 'rental-product';
  private draftId = this.generateDraftId();

  form: FormGroup;
  isReadOnly = signal(false);
  isCategoryModalOpen = signal(false);
  errorMessage = signal<string[] | string | null>(null);
  /** Resposta do POST/PUT de rental exibida no modal de resumo; null = fechado. */
  savedProduct = signal<IRentalItem | null>(null);

  conditionOptions: { value: ProductCondition; label: string }[] = [
    { value: 'NEW', label: 'Novo' },
    { value: 'EXCELLENT', label: 'Excelente' },
    { value: 'GOOD', label: 'Bom' },
    { value: 'FAIR', label: 'Regular' },
    { value: 'POOR', label: 'Ruim' },
  ];

  rentalHistory = signal<IRentalHistoryItem[]>([
    { legacyId: 'L-1001', name: 'VESTIDO NOIVA RENDA', date: '12/01/2026' },
    { legacyId: 'L-1009', name: 'PALETÓ SLIM PRETO', date: '28/01/2026' },
    { legacyId: 'L-1032', name: 'VESTIDO MARSALA', date: '03/02/2026' }
  ]);

  constructor() {
    this.form = this.fb.group({
      id: [{ value: '', disabled: true }],
      legacyId: [''],
      status: [{ value: 'AVAILABLE', disabled: true }],
      value: [null, [Validators.required, Validators.min(0.01)]],
      name: ['', [Validators.required, Validators.minLength(3)]],
      condition: ['', Validators.required],
      description: [''],
      categoryId: ['', Validators.required],
      categoryName: ['', Validators.required],
      brand: [''],
      size: ['', Validators.required],
      color: ['', Validators.required],
      rentalCount: [{ value: 0, disabled: true }],
      lastRentalDate: [{ value: '', disabled: true }],
      createdAt: [{ value: '', disabled: true }],
      updatedAt: [{ value: '', disabled: true }],
      notes: ['']
    });

  }

  ngOnInit(): void {
    this.route.queryParams
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged((a, b) => a['draftId'] === b['draftId'])
      )
      .subscribe(params => {
        const newDraftId = params['draftId'];
        if (newDraftId && newDraftId !== this.draftId) {
          this.draftId = newDraftId;
          this.form.reset();
          const initialData: Partial<IRentalItem> = {
            name: '', categoryId: '', categoryName: '', size: '', color: '', brand: '',
            value: 0, description: '', status: 'AVAILABLE', notes: '',
            condition: 'NEW', lastRentalDate: null, rentalCount: 0,
            createdAt: '', updatedAt: ''
          };
          this.form.patchValue(initialData);
          this.restoreDraft();
        }
      });

    // Inicializa campos vazios para evitar undefined
    const initialData: Partial<IRentalItem> = {
      name: '', categoryId: '', categoryName: '', size: '', color: '', brand: '',
      value: 0, description: '', status: 'AVAILABLE', notes: '',
      condition: 'NEW', lastRentalDate: null, rentalCount: 0,
      createdAt: '', updatedAt: ''
    };
    this.form.patchValue(initialData);
    this.restoreDraft();

    this.form.valueChanges
      .pipe(debounceTime(800), takeUntil(this.destroy$))
      .subscribe(() => this.persistDraft());
  }

  private generateDraftId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private persistDraft(): void {
    this.formStorage.saveDraft(this.formType, this.draftId, this.form.getRawValue());
  }

  private restoreDraft(): void {
    const draft = this.formStorage.loadDraft<Partial<IRentalItem>>(this.formType, this.draftId);
    if (draft) {
      this.form.patchValue(draft);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openCategoryModal(): void {
    this.isCategoryModalOpen.set(true);
  }

  closeCategoryModal(): void {
    this.isCategoryModalOpen.set(false);
  }

  onCategorySelected(category: ICategory): void {
    this.form.patchValue({
      categoryId: category.id ?? '',
      categoryName: category.displayName || category.name,
    });
    this.isCategoryModalOpen.set(false);
  }

  searchByLegacyId(): void {
    const legacyId = this.form.get('legacyId')?.value;
    if (!legacyId) return;

    this.service.getRentalItemByLegacyId(legacyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (product) => {
          this.form.patchValue(product);
          this.isReadOnly.set(true);
          this.form.get('legacyId')?.disable();
          this.form.disable();
        },
        error: (error) => {
          if (error.status === 404) {
            // Produto não encontrado, fluxo de novo cadastro
            console.log('Produto não encontrado, iniciando novo cadastro');
          } else {
            this.handleError(error);
          }
        }
      });
  }

  getControlStatus(controlName: string): 'VALID' | 'INVALID' | 'PENDING' | 'NONE' {
    const control = this.form.get(controlName);
    if (!control || (!control.dirty && !control.touched)) return 'NONE';
    return control.valid ? 'VALID' : 'INVALID';
  }

  getControlError(controlName: string): string | null {
    const control = this.form.get(controlName);
    if (!control || !control.errors || (!control.dirty && !control.touched)) return null;

    if (control.errors['required']) return 'Campo obrigatório';
    if (control.errors['minlength']) return `Mínimo de ${control.errors['minlength'].requiredLength} caracteres`;
    if (control.errors['min']) return 'Valor deve ser maior que zero';

    return 'Campo inválido';
  }

  getStatusClass(): string {
    const status = (this.form.get('status')?.value || '').toUpperCase();
    if (['AVAILABLE', 'RENTED'].includes(status)) {
      return 'green';
    }
    return 'red';
  }

  isFormEmpty(): boolean {
    const legacyId = (this.form.get('legacyId')?.value || '').toString().trim();
    const name = (this.form.get('name')?.value || '').toString().trim();
    const categoryName = (this.form.get('categoryName')?.value || '').toString().trim();

    return !legacyId && !name && !categoryName;
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.scrollToFirstInvalid();
      return;
    }

    const rentalItem: IRentalItem = this.form.getRawValue();
    this.service.saveRentalItem(rentalItem).pipe(takeUntil(this.destroy$)).subscribe({
      next: (saved) => {
        this.formStorage.clearDraft(this.formType, this.draftId);
        this.form.patchValue(saved);
        this.isReadOnly.set(true);
        this.form.disable();
        this.savedProduct.set(saved);
      },
      error: (error) => this.handleError(error)
    });
  }

  clear(): void {
    const initialData: Partial<IRentalItem> = {
      name: '', categoryId: '', categoryName: '', size: '', color: '', brand: '',
      value: 0, description: '', status: 'AVAILABLE', notes: '',
      condition: 'NEW', lastRentalDate: null, rentalCount: 0,
      createdAt: undefined, updatedAt: undefined, legacyId: ''
    };
    this.form.reset(initialData);
    this.form.enable();
    this.isReadOnly.set(false);

    // Campos de sistema sempre desabilitados
    this.form.get('id')?.disable();
    this.form.get('status')?.disable();
    this.form.get('lastRentalDate')?.disable();
    this.form.get('rentalCount')?.disable();
    this.form.get('createdAt')?.disable();
    this.form.get('updatedAt')?.disable();

    // LegacyId habilitado para busca de novo item
    this.form.get('legacyId')?.enable();
  }

  enableEditing(): void {
    this.isReadOnly.set(false);
    this.form.enable();
    this.form.get('id')?.disable();
    this.form.get('legacyId')?.disable(); // Legacy ID sempre desabilitado na edição
    this.form.get('status')?.disable();
    this.form.get('lastRentalDate')?.disable();
    this.form.get('rentalCount')?.disable();
    this.form.get('createdAt')?.disable();
    this.form.get('updatedAt')?.disable();
  }

  close(): void {
    this.router.navigate(['/']);
  }

  clearError(): void {
    this.errorMessage.set(null);
  }

  /** X/backdrop do modal de resumo: fecha o modal e mantém a aba aberta. */
  dismissCreatedSummary(): void {
    this.savedProduct.set(null);
  }

  /** OK do modal de resumo: fecha o modal e a aba de cadastro. */
  confirmCreatedSummary(): void {
    this.savedProduct.set(null);
    this.tabService.closeActiveIf('/product/registration');
  }

  /** Locação: abre Nova Locação com o produto salvo já incluído como item. */
  rentCreatedProduct(): void {
    const product = this.savedProduct();
    if (!product) return;
    const draftId = this.generateDraftId();
    this.formStorage.saveDraft(RENTAL_CONTRACT_FORM_TYPE, draftId, buildRentalDraftWithItem(product));
    this.savedProduct.set(null);
    this.tabService.open('/rental/new', 'Nova Locação', 'rental', draftId);
  }

  private scrollToFirstInvalid(): void {
    const el: HTMLElement | null = this.el.nativeElement.querySelector(
      'input.ng-invalid, textarea.ng-invalid, select.ng-invalid'
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
    }
  }

  private handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400 && !error.error) {
        this.errorMessage.set('Erros de validação ocorreram. Verifique os dados informados.');
        return;
      }
      this.errorMessage.set(
        apiErrorMessages(
          error,
          error.status === 400
            ? 'Erros de validação ocorreram. Verifique os dados informados.'
            : 'Ocorreu um erro ao salvar os dados do produto.'
        )
      );
      return;
    }
    console.error('Erro ao salvar produto:', error);
    this.errorMessage.set(
      error instanceof Error && error.message.trim()
        ? error.message
        : 'Ocorreu um erro ao salvar os dados do produto.'
    );
  }
}
