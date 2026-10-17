import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ProductService } from '../../product/service/product.service';
import { IItemReservationResponse } from '../data/rental-contract-response.interface';
import { RentalContractService } from './rental-contract.service';

/**
 * Lista os contratos com locação ativa (SIGNED/FINALIZED, eventDate >= hoje)
 * da roupa identificada pelo legacyId. O operador digita o código legado, mas
 * o endpoint byItem exige o UUID do RentalItem — daí o encadeamento.
 */
@Injectable({ providedIn: 'root' })
export class ItemRentalLookupService {
  private readonly productService = inject(ProductService);
  private readonly rentalContractService = inject(RentalContractService);

  findActiveContractsByItemLegacyId(legacyId: string): Observable<IItemReservationResponse[]> {
    return this.productService.getRentalItemByLegacyId(legacyId).pipe(
      switchMap((item) => {
        if (!item.id) {
          throw new Error(`RentalItem sem id (esperado UUID) para legacyId="${legacyId}"`);
        }
        return this.rentalContractService.getItemReservations(item.id);
      }),
    );
  }
}
