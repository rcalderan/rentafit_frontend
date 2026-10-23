import { Component, signal, inject, OnDestroy } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, Subject } from 'rxjs';
import { catchError, finalize, switchMap, takeUntil, tap } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { AddressService } from '../../../customer/service/address.service';
import { SignUpRequest } from '../../data/user.model';
import { normalizeUsername, usernameValidator, USERNAME_MAX, USERNAME_MIN } from '../../validators/credential-rules';

function cpfCnpjValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value?.replace(/[^\d]+/g, '');
  if (!value) return null;
  if (value.length !== 11 && value.length !== 14) {
    return { invalidFormat: 'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos' };
  }
  if (value.split('').every((c: string) => c === value[0])) return { invalidFormat: 'CPF/CNPJ inválido' };
  const isValid = value.length === 11 ? isValidCpf(value) : isValidCnpj(value);
  return isValid ? null : { invalidFormat: 'CPF/CNPJ inválido' };
}

function isValidCpf(cpf: string): boolean {
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let r = sum % 11;
  const d1 = r < 2 ? 0 : 11 - r;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  r = sum % 11;
  const d2 = r < 2 ? 0 : 11 - r;
  return parseInt(cpf[9], 10) === d1 && parseInt(cpf[10], 10) === d2;
}

function isValidCnpj(cnpj: string): boolean {
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = w1.reduce((acc, w, i) => acc + parseInt(cnpj[i], 10) * w, 0);
  let r = sum % 11;
  const d1 = r < 2 ? 0 : 11 - r;
  sum = w2.reduce((acc, w, i) => acc + parseInt(cnpj[i], 10) * w, 0);
  r = sum % 11;
  const d2 = r < 2 ? 0 : 11 - r;
  return parseInt(cnpj[12], 10) === d1 && parseInt(cnpj[13], 10) === d2;
}

@Component({
  selector: 'rentafit-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly addressService = inject(AddressService);

  private readonly phonePattern = /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/;
  private readonly maxPhones = 5;
  private readonly destroy$ = new Subject<void>();
  private readonly zipCode$ = new Subject<string>();

  isLoading = signal(false);
  isSearchingZip = signal(false);
  errorMessage = signal<string | null>(null);
  /** E-mail mascarado devolvido pelo backend após o cadastro; exibe a tela "confirme seu e-mail". */
  readonly registeredEmail = signal<string | null>(null);
  readonly resendStatus = signal<'idle' | 'sending' | 'sent'>('idle');

  readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(255)]],
    username: ['', [Validators.required, Validators.minLength(USERNAME_MIN), Validators.maxLength(USERNAME_MAX), usernameValidator]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    document: ['', [Validators.required, cpfCnpjValidator]],
    phones: this.fb.array([this.buildPhoneControl()]),
    address: this.fb.group({
      zipCode: ['', [Validators.required, Validators.pattern(/^\d{5}-?\d{3}$/)]],
      street: ['', Validators.required],
      neighborhood: [''],
      city: ['', Validators.required],
      state: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(2), Validators.pattern(/^[A-Z]{2}$/)]]
    }),
    number: ['', Validators.maxLength(20)],
    complement: ['', Validators.maxLength(100)]
  });

  readonly addressLookup$ = this.zipCode$.pipe(
    tap(() => {
      this.isSearchingZip.set(true);
      this.form.get('address.zipCode')?.disable();
    }),
    switchMap(zip => this.addressService.searchByZipCode(zip).pipe(
      tap(addr => this.form.get('address')?.patchValue(addr)),
      catchError(err => {
        this.errorMessage.set(err.message);
        return EMPTY;
      }),
      finalize(() => {
        this.isSearchingZip.set(false);
        this.form.get('address.zipCode')?.enable();
      })
    )),
    takeUntil(this.destroy$)
  );

  constructor() {
    this.addressLookup$.subscribe();
  }

  get phones(): FormArray {
    return this.form.get('phones') as FormArray;
  }

  canAddPhone(): boolean { return this.phones.length < this.maxPhones; }
  canRemovePhone(): boolean { return this.phones.length > 1; }

  addPhone(): void {
    if (this.canAddPhone()) this.phones.push(this.buildPhoneControl());
  }

  removePhone(i: number): void {
    if (this.canRemovePhone()) this.phones.removeAt(i);
  }

  getPhoneControl(i: number): FormControl {
    return this.phones.at(i) as FormControl;
  }

  lookupZip(event: KeyboardEvent, zip: string): void {
    if (event.key !== 'Enter' || !zip?.trim()) return;
    this.errorMessage.set(null);
    this.zipCode$.next(zip.trim());
  }

  fieldStatus(name: string, group?: string): 'VALID' | 'INVALID' | 'NONE' {
    const ctrl = group ? this.form.get(group)?.get(name) : this.form.get(name);
    if (!ctrl || (!ctrl.dirty && !ctrl.touched)) return 'NONE';
    return ctrl.valid ? 'VALID' : 'INVALID';
  }

  fieldError(name: string, group?: string): string | null {
    const ctrl = group ? this.form.get(group)?.get(name) : this.form.get(name);
    if (!ctrl?.errors || (!ctrl.dirty && !ctrl.touched)) return null;
    if (ctrl.errors['required']) return 'Campo obrigatório';
    if (ctrl.errors['minlength']) return `Mínimo ${ctrl.errors['minlength'].requiredLength} caracteres`;
    if (ctrl.errors['maxlength']) return `Máximo ${ctrl.errors['maxlength'].requiredLength} caracteres`;
    if (ctrl.errors['email']) return 'E-mail inválido';
    if (ctrl.errors['pattern']) return 'Formato inválido';
    if (ctrl.errors['invalidFormat']) return ctrl.errors['invalidFormat'];
    return 'Campo inválido';
  }

  phoneStatus(i: number): 'VALID' | 'INVALID' | 'NONE' {
    const ctrl = this.getPhoneControl(i);
    if (!ctrl || (!ctrl.dirty && !ctrl.touched)) return 'NONE';
    return ctrl.valid ? 'VALID' : 'INVALID';
  }

  phoneError(i: number): string | null {
    const ctrl = this.getPhoneControl(i);
    if (!ctrl?.errors || (!ctrl.dirty && !ctrl.touched)) return null;
    if (ctrl.errors['invalidPhone']) return 'Informe o telefone no formato (11) 99999-9999';
    return 'Telefone inválido';
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const v = this.form.getRawValue();
    const payload: SignUpRequest = {
      name: v.name,
      username: normalizeUsername(v.username),
      email: v.email,
      document: v.document,
      phones: v.phones,
      address: v.address,
      number: v.number || undefined,
      complement: v.complement || undefined
    };

    this.authService.signUp(payload).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.registeredEmail.set(response.maskedEmail);
      },
      error: (err: Error) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.message || 'Erro ao criar conta.');
      }
    });
  }

  resendVerification(): void {
    this.resendStatus.set('sending');
    this.authService.resendVerification(this.form.getRawValue().email).subscribe({
      next: () => this.resendStatus.set('sent'),
      error: (err: Error) => {
        this.resendStatus.set('idle');
        this.errorMessage.set(err.message);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildPhoneControl(): FormControl {
    return this.fb.control('', (ctrl: AbstractControl) => {
      const v = (ctrl.value ?? '').toString().trim();
      if (!v) return null;
      return this.phonePattern.test(v) ? null : { invalidPhone: true };
    });
  }
}
