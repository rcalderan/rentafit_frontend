import { Component, inject, input, OnChanges, signal, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { StockService } from '../../service/stock.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error';
import { IStockDTO, IStockMovementDTO } from '../../data/Product.interface';

type MovementOp = 'add' | 'remove';

@Component({
  selector: 'rentafit-stock',
  imports: [ReactiveFormsModule, ModalComponent, DatePipe],
  templateUrl: './stock.html',
  styleUrl: './stock.css',
})
export class Stock implements OnChanges {
  /** UUID do produto — obrigatório para carregar e operar o estoque */
  productId = input<string | undefined>();

  private readonly fb = inject(FormBuilder);
  private readonly stockService = inject(StockService);
  private readonly authService = inject(AuthService);
  private readonly destroy$ = new Subject<void>();

  stock = signal<IStockDTO | null>(null);
  movements = signal<IStockMovementDTO[]>([]);
  isLoading = signal(false);
  isSaving = signal(false);
  errorMessage = signal<string | string[] | null>(null);
  successMessage = signal<string | null>(null);
  activeOp = signal<MovementOp>('add');

  movementForm: FormGroup = this.fb.group({
    quantity: [1, [Validators.required, Validators.min(1)]],
    notes: [''],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId']) {
      const id = this.productId();
      if (id) {
        this.load(id);
      } else {
        this.stock.set(null);
        this.movements.set([]);
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setOp(op: MovementOp): void {
    this.activeOp.set(op);
    this.movementForm.reset({ quantity: 1, notes: '' });
    this.successMessage.set(null);
    this.errorMessage.set(null);
  }

  submit(): void {
    if (this.movementForm.invalid) {
      this.movementForm.markAllAsTouched();
      return;
    }
    const id = this.productId();
    if (!id) return;

    const userId = this.authService.getCurrentUser()?.id;
    if (!userId) {
      this.errorMessage.set('Usuário não autenticado.');
      return;
    }

    const { quantity, notes } = this.movementForm.getRawValue() as { quantity: number; notes: string };
    const op$ = this.activeOp() === 'add'
      ? this.stockService.addStock(id, quantity, userId, notes || undefined)
      : this.stockService.removeStock(id, quantity, userId, notes || undefined);

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    op$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isSaving.set(false);
        const label = this.activeOp() === 'add' ? 'adicionada' : 'baixada';
        this.successMessage.set(`Quantidade ${label} com sucesso.`);
        this.movementForm.reset({ quantity: 1, notes: '' });
        this.load(id);
      },
      error: (err: HttpErrorResponse) => {
        this.isSaving.set(false);
        this.handleError(err);
      },
    });
  }

  clearError(): void {
    this.errorMessage.set(null);
  }

  private load(productId: string): void {
    this.isLoading.set(true);
    this.stockService.getStock(productId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (dto) => {
        this.stock.set(dto);
        this.loadMovements(productId);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.handleError(err);
      },
    });
  }

  private loadMovements(productId: string): void {
    this.stockService.getMovements(productId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (list) => {
        this.movements.set(list);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  private handleError(error: HttpErrorResponse): void {
    const fallback =
      error.status === 422
        ? 'Estoque insuficiente para realizar a baixa.'
        : 'Ocorreu um erro ao processar a operação de estoque.';
    this.errorMessage.set(apiErrorMessages(error, fallback));
  }

  protected movementLabel(type: string): string {
    const labels: Record<string, string> = {
      ADD: 'Entrada', REMOVE: 'Saída', RESERVE: 'Reserva', RELEASE: 'Liberação',
    };
    return labels[type] ?? type;
  }

  protected movementClass(type: string): string {
    const classes: Record<string, string> = {
      ADD: 'mv-add', REMOVE: 'mv-remove', RESERVE: 'mv-reserve', RELEASE: 'mv-release',
    };
    return classes[type] ?? '';
  }

  protected stockStatusClass(stock: IStockDTO): string {
    const avail = stock.quantityAvailable ?? 0;
    const min = stock.minStockLevel ?? 0;
    if (avail === 0) return 'status-empty';
    if (min > 0 && avail <= min) return 'status-low';
    return 'status-ok';
  }
}

