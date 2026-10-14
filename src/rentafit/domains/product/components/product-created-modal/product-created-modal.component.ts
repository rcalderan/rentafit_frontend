import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IRentalItem } from '../../data/Product.interface';

/**
 * Resumo exibido quando o POST/PUT de `/api/v1/products/rental` conclui o cadastro.
 * `dismissed` (X ou backdrop) mantém a aba aberta; `confirmed` (OK) e `rent`
 * (Locação) fecham o modal e deixam a navegação a cargo do componente pai.
 */
@Component({
  selector: 'rentafit-product-created-modal',
  imports: [],
  templateUrl: './product-created-modal.component.html',
  styleUrl: './product-created-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCreatedModalComponent {
  readonly product = input.required<IRentalItem>();

  readonly dismissed = output<void>();
  readonly confirmed = output<void>();
  readonly rent = output<void>();

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }
}
