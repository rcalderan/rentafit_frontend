import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IProductBase } from '../../data/Product.interface';

/**
 * Resumo exibido quando o cadastro de produto (rental ou retail) é concluído.
 * `dismissed` (X ou backdrop) mantém a aba aberta; `confirmed` (OK) e `action`
 * (ex.: "Locação", "Venda") fecham o modal e deixam a navegação a cargo do pai.
 */
@Component({
  selector: 'rentafit-product-created-modal',
  imports: [],
  templateUrl: './product-created-modal.component.html',
  styleUrl: './product-created-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCreatedModalComponent {
  readonly product = input.required<IProductBase>();
  /** Código do produto: legacyId (rental) ou sku (retail). */
  readonly code = input<string | number>('');
  /** Observações: notes (rental) ou details (retail). */
  readonly notes = input<string>('');
  /** Rótulo do botão de ação principal (ex.: "Locação", "Venda"). */
  readonly actionLabel = input.required<string>();

  readonly dismissed = output<void>();
  readonly confirmed = output<void>();
  readonly action = output<void>();

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }
}
