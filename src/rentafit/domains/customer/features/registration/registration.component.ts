import { Component, ElementRef, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Subject } from 'rxjs';
import { switchMap, tap, takeUntil, catchError, finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ICustomer } from '../../data/Customer.interface';
import { CustomerService } from '../../service/customer.service';
import { AddressService } from '../../service/address.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { HttpErrorResponse } from '@angular/common/http';
import { SessionFormStorageService } from '../../../../shared/services/session-form-storage.service';
import { TabService } from '../../../../shared/services/tab.service';

export function cpfCnpjValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value?.replace(/[^\d]+/g, '');
  if (!value) return null;

  if (value.length !== 11 && value.length !== 14) {
    return { invalidFormat: 'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos' };
  }

  if (isAllDigitsSame(value)) return { invalidFormat: 'CPF/CNPJ inválido' };

  const isValid = value.length === 11 ? isValidCpf(value) : isValidCnpj(value);
  return isValid ? null : { invalidFormat: 'CPF/CNPJ inválido' };
}

function isAllDigitsSame(s: string): boolean {
  return s.split('').every(c => c === s[0]);
}

function isValidCpf(cpf: string): boolean {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf[i], 10) * (10 - i);
  }
  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf[i], 10) * (11 - i);
  }
  remainder = sum % 11;
  const secondDigit = remainder < 2 ? 0 : 11 - remainder;

  return parseInt(cpf[9], 10) === firstDigit && parseInt(cpf[10], 10) === secondDigit;
}

function isValidCnpj(cnpj: string): boolean {
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpj[i], 10) * weights1[i];
  }
  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;

  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpj[i], 10) * weights2[i];
  }
  remainder = sum % 11;
  const secondDigit = remainder < 2 ? 0 : 11 - remainder;

  return parseInt(cnpj[12], 10) === firstDigit && parseInt(cnpj[13], 10) === secondDigit;
}

@Component({
  selector: 'rentafit-registration',
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './registration.component.html',
  styleUrl: './registration.component.css',
})
export class RegistrationComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private service = inject(CustomerService);
  private addressService = inject(AddressService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private formStorage = inject(SessionFormStorageService);
  private tabService = inject(TabService);
  private readonly maxPhones = 5;
  private readonly phonePattern = /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/;
  private readonly formType = 'customer';
  private draftId = this.generateDraftId();
  private readonly phoneValidator = (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').toString().trim();
    if (!value) return null;
    return this.phonePattern.test(value) ? null : { invalidPhone: true };
  };

  private destroy$ = new Subject<void>();
  private zipCodeSubject$ = new Subject<string>();
  private el = inject(ElementRef);

  //currentIndex = signal(0);
  private customer: ICustomer;
  form: FormGroup;
  isReadOnly = signal(false);
  isSearchingAddress = signal(false);
  errorMessage = signal<string[] | string | null>(null);
  successMessage = signal<string | null>(null);

  address$ = this.zipCodeSubject$.pipe(
    tap(() => {
      this.isSearchingAddress.set(true);
      this.form.get('address.zipCode')?.disable();
    }),
    switchMap(zipCode => this.addressService.searchByZipCode(zipCode).pipe(
      tap(address => {
        console.log('Endereço encontrado:', address);
        this.form.patchValue({ address });
      }),
      catchError(error => {
        this.errorMessage.set(error.message);
        return EMPTY;
      }),
      finalize(() => {
        this.isSearchingAddress.set(false);
        // Só reabilita se não estiver em modo leitura
        if (!this.isReadOnly()) {
          this.form.get('address.zipCode')?.enable();
        }
      })
    )),
    takeUntil(this.destroy$)
  );

  constructor() {
    this.form = this.fb.group({
      id: [{ value: '', disabled: true }],
      legacyId: [''],
      name: ['', [Validators.required, Validators.minLength(3)]],
      document: ['', [Validators.required, cpfCnpjValidator]],
      isAuthenticated: [{ value: false, disabled: true }],
      address: this.fb.group({
        street: ['', Validators.required],
        neighborhood: ['', Validators.required],
        city: ['', Validators.required],
        state: ['', [Validators.required, Validators.maxLength(2), Validators.minLength(2)]],
        zipCode: ['', [Validators.required, Validators.pattern(/^\d{5}-?\d{3}$/)]]
      }),
      phones: this.fb.array([this.buildPhoneControl()]),
      // Opcional no balcão; só o cadastro online (auth/register) exige e-mail.
      email: ['', [Validators.email, Validators.maxLength(255)]],
      number: ['', Validators.required],
      complement: [''],
      notes: ['']
    });
    this.customer = this.form.getRawValue();

    this.form.valueChanges
      .pipe(debounceTime(800), takeUntil(this.destroy$))
      .subscribe(() => {
        this.persistDraft();
        this.updateTabTitle(this.form.getRawValue().name);
      });
  }

  private updateTabTitle(name: string | null | undefined): void {
    const displayName = this.buildDisplayName(name);
    const title = displayName || 'Clientes';
    const tabId = this.tabService.getTabId('/customer/registration', this.draftId);
    this.tabService.updateTitle(tabId, title);
  }

  private buildDisplayName(name: string | null | undefined): string | null {
    if (!name) return null;
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1]}`;
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
    const draft = this.formStorage.loadDraft<ICustomer>(this.formType, this.draftId);
    if (!draft) return;

    this.setPhones(draft.phones ?? []);
    this.form.patchValue({
      id: draft.id ?? '',
      legacyId: draft.legacyId ?? '',
      name: draft.name ?? '',
      document: draft.document ?? '',
      isAuthenticated: draft.isAuthenticated ?? false,
      address: {
        street: draft.address?.street ?? '',
        neighborhood: draft.address?.neighborhood ?? '',
        city: draft.address?.city ?? '',
        state: draft.address?.state ?? '',
        zipCode: draft.address?.zipCode ?? '',
      },
      email: draft.email ?? '',
      number: draft.number ?? '',
      complement: draft.complement ?? '',
      notes: draft.notes ?? '',
    });
  }

  getControlStatus(controlName: string, groupName?: string): 'VALID' | 'INVALID' | 'PENDING' | 'NONE' {
    const control = groupName ? this.form.get(groupName)?.get(controlName) : this.form.get(controlName);
    if (!control || (!control.dirty && !control.touched)) return 'NONE';
    return control.valid ? 'VALID' : 'INVALID';
  }

  getControlError(controlName: string, groupName?: string): string | null {
    const control = groupName ? this.form.get(groupName)?.get(controlName) : this.form.get(controlName);
    if (!control || !control.errors || (!control.dirty && !control.touched)) return null;

    if (control.errors['required']) return 'Campo obrigatório';
    if (control.errors['minlength']) return `Mínimo de ${control.errors['minlength'].requiredLength} caracteres`;
    if (control.errors['email']) return 'E-mail inválido';
    if (control.errors['pattern']) return 'Formato inválido';
    if (control.errors['invalidFormat']) return control.errors['invalidFormat'];

    return 'Campo inválido';
  }

  getPhoneControl(index: number): FormControl {
    return this.phonesArray.at(index) as FormControl;
  }

  getPhoneStatus(index: number): 'VALID' | 'INVALID' | 'NONE' {
    const control = this.getPhoneControl(index);
    if (!control || (!control.dirty && !control.touched)) return 'NONE';
    return control.valid ? 'VALID' : 'INVALID';
  }

  getPhoneError(index: number): string | null {
    const control = this.getPhoneControl(index);
    if (!control || !control.errors || (!control.dirty && !control.touched)) return null;
    if (control.errors['invalidPhone']) return 'Informe o telefone no formato (11) 99999-9999';
    return 'Telefone inválido';
  }

  private loadCustomerForm(customer: ICustomer) {
    this.customer = customer;
    this.setPhones(customer.phones);
    this.form.patchValue({ ...customer });
    this.isReadOnly.set(true);
    this.form.disable();
  }

  get phonesArray(): FormArray {
    return this.form.get('phones') as FormArray;
  }

  phoneCount(): number {
    return this.phonesArray.length;
  }

  canAddPhone(): boolean {
    return this.phoneCount() < this.maxPhones;
  }

  canRemovePhone(): boolean {
    return this.phoneCount() > 1;
  }

  addPhone(): void {
    if (this.isReadOnly() || !this.canAddPhone()) return;
    this.phonesArray.push(this.buildPhoneControl());
  }

  removePhone(index: number): void {
    if (this.isReadOnly() || !this.canRemovePhone()) return;
    this.phonesArray.removeAt(index);
  }

  private buildPhoneControl(value: string = ''): FormControl {
    return this.fb.control(value, this.phoneValidator);
  }

  private setPhones(phones?: string[] | null): void {
    this.phonesArray.clear();
    const values = (phones ?? []).map(phone => phone?.trim()).filter(Boolean) as string[];
    if (values.length === 0) {
      this.phonesArray.push(this.buildPhoneControl());
      return;
    }
    values.slice(0, this.maxPhones).forEach(value => this.phonesArray.push(this.buildPhoneControl(value)));
  }

  findByLegacyId(event: KeyboardEvent, document: string) {
    if (event.key !== 'Enter') return;
    this.service.getCustomerByLegacyId(Number(document)).subscribe({
      next: (customer: ICustomer) => {
        console.log('Cliente encontrado:', customer);
        this.loadCustomerForm(customer);
        // Permite que o campo legacyId continue habilitado para novas buscas se necessário
        // Ou habilitamos apenas o botão editar
      },
      error: (error: any) => {
        console.error('Erro ao buscar cliente:', error);
        this.errorMessage.set('Não foi possível encontrar o cliente com este código.');
        this.clear();
      }

    });
  }

  findAddressByZipCode(event: KeyboardEvent, zipCode: string) {
    if (event.key !== 'Enter') return;

    if (!zipCode || zipCode.trim().length === 0) {
      console.warn('CEP vazio');
      return;
    }

    // Dispara o observable reactivo
    this.zipCodeSubject$.next(zipCode);
  }

  findByDocument(event: KeyboardEvent, document: string) {
    if (event.key !== 'Enter') return;
    this.service.getCustomerByDocument(document).subscribe({
      next: (customer: ICustomer) => {
        console.log('Cliente encontrado:', customer);
        this.loadCustomerForm(customer);
      },
      error: (error: any) => {
        console.error('Erro ao buscar cliente:', error);
        this.errorMessage.set('Não foi possível encontrar o cliente com este CPF.');
      }

    });
  }

  ngOnInit(): void {
    this.initCustomer();
    this.setPhones(this.customer.phones);
    this.restoreDraft();

    this.route.queryParams
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged((a, b) => a['draftId'] === b['draftId'])
      )
      .subscribe(params => {
        const newDraftId = params['draftId'];
        if (newDraftId && newDraftId !== this.draftId) {
          this.draftId = newDraftId;
          this.initCustomer();
          this.setPhones(this.customer.phones);
          this.restoreDraft();
          this.updateTabTitle(this.form.getRawValue().name);
        }
      });

    const legacyIdParam = this.route.snapshot.queryParams['legacyId'];
    const idParam = this.route.snapshot.queryParams['id'];

    if (legacyIdParam) {
      const legacyId = Number(legacyIdParam);
      if (!Number.isNaN(legacyId)) {
        this.service.getCustomerByLegacyId(legacyId).subscribe({
          next: (customer: ICustomer) => this.loadCustomerForm(customer),
          error: () => this.errorMessage.set('Não foi possível carregar cliente pelo legacyId informado.'),
        });
      }
    } else if (idParam) {
      this.service.getCustomerById(idParam).subscribe({
        next: (customer: ICustomer) => this.loadCustomerForm(customer),
        error: () => this.errorMessage.set('Não foi possível carregar cliente pelo id informado.'),
      });
    }

    // Subscrever ao observable de endereço para capturar erros
    this.address$.subscribe({
      error: (error: Error) => {
        console.error('Erro ao buscar endereço:', error.message);
        this.errorMessage.set('Erro ao buscar endereço para este CEP.');
      }
    });
  }

  private initCustomer(): void {
    this.customer = {
      name: "",
      document: "",
      email: "",
      isAuthenticated: false,
      notes: "",
      address: {
        zipCode: "",
        street: "",
        neighborhood: "",
        city: "",
        state: ""
      },
      number: "",
      complement: "",
      phones: [],
    };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.scrollToFirstInvalid();
      return;
    }

    const v = this.form.getRawValue();
    // Vazio vira null: people.email é UNIQUE e dois clientes com "" colidiriam.
    const customer: ICustomer = { ...v, email: v.email?.trim() || null };
    this.service.saveCustomer(customer).subscribe(
      {
        next: (customer: ICustomer) => {
          console.log('Cliente Salvo:', customer);
          this.formStorage.clearDraft(this.formType, this.draftId);
          this.tabService.closeActiveIf('/customer/registration');
          this.loadCustomerForm(customer);
          this.successMessage.set('Cliente salvo com sucesso!');
        },
        error: (error) => this.handleError(error)
      });
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

  private handleError(error: any) {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) {
        this.errorMessage.set(
          error.error
            ? error.error.errors?.map((err: any) => err.message || err)
            : 'Erros de validação ocorreram. Verifique os dados informados.');
        return;
      }
    }
    console.error('Erro ao salvar cliente:', error);
    this.errorMessage.set('Ocorreu um erro ao salvar os dados do cliente.');
  }

  clearError() {
    this.errorMessage.set(null);
  }

  clearSuccess() {
    this.successMessage.set(null);
  }

  clear() {
    this.form.reset();
    this.form.enable();
    this.isReadOnly.set(false);
    this.setPhones([]);
  }

  close() {
    this.form.reset();
    this.form.enable();
    this.isReadOnly.set(false);
    this.setPhones([]);
    this.router.navigate(['/']);
  }

  enableEditing() {
    this.isReadOnly.set(false);
    this.form.enable();
    this.form.get('id')?.disable();
    this.form.get('legacyId')?.disable();
    this.form.get('isAuthenticated')?.disable();
  }
}
