import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IItemReservationResponse } from '../../../rental/data/rental-contract-response.interface';
import { formatDateBr } from '../../../../shared/utils/date-format';

/**
 * Modal com os contratos que têm locação ativa de uma roupa.
 * Mesma tabela de "Últimos Contratos": Nº | Nome | Data do evento | Abrir.
 */
@Component({
  selector: 'rentafit-item-rentals-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './item-rentals-modal.component.html',
  styleUrl: './item-rentals-modal.component.css',
})
export class ItemRentalsModalComponent {
  readonly rentals = input.required<IItemReservationResponse[]>();
  readonly itemLabel = input.required<string>();
  readonly closed = output<void>();

  protected readonly formatDate = formatDateBr;
}
