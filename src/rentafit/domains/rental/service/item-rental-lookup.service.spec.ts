import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ItemRentalLookupService } from './item-rental-lookup.service';
import { ProductService } from '../../product/service/product.service';
import { RentalContractService } from './rental-contract.service';
import { IRentalItem } from '../../product/data/Product.interface';
import { IItemReservationResponse } from '../data/rental-contract-response.interface';

const buildReservation = (): IItemReservationResponse => ({
  contractId: 'contract-1',
  legacyId: '20260101-1',
  customerId: 'customer-1',
  customerName: 'Maria Silva',
  eventDate: '2026-07-10',
  pickupDate: '2026-07-08',
  returnDate: '2026-07-12',
  status: 'SIGNED',
  statusDescription: 'Assinado',
});

describe('ItemRentalLookupService', () => {
  let service: ItemRentalLookupService;
  let productService: { getRentalItemByLegacyId: ReturnType<typeof vi.fn> };
  let rentalContractService: { getItemReservations: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    productService = { getRentalItemByLegacyId: vi.fn() };
    rentalContractService = { getItemReservations: vi.fn() };

    await TestBed.configureTestingModule({
      providers: [
        ItemRentalLookupService,
        { provide: ProductService, useValue: productService },
        { provide: RentalContractService, useValue: rentalContractService },
      ],
    }).compileComponents();

    service = TestBed.inject(ItemRentalLookupService);
  });

  it('resolve o legacyId para UUID e retorna as reservas do item', async () => {
    const item = { id: 'item-uuid-1', legacyId: 42 } as unknown as IRentalItem;
    const reservations = [buildReservation()];
    productService.getRentalItemByLegacyId.mockReturnValue(of(item));
    rentalContractService.getItemReservations.mockReturnValue(of(reservations));

    const result = await firstValueFrom(service.findActiveContractsByItemLegacyId('42'));

    expect(productService.getRentalItemByLegacyId).toHaveBeenCalledWith('42');
    expect(rentalContractService.getItemReservations).toHaveBeenCalledWith('item-uuid-1', undefined, true);
    expect(result).toEqual(reservations);
  });

  it('propaga o 404 da busca da roupa sem mascarar', async () => {
    productService.getRentalItemByLegacyId.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404 }))
    );

    await expect(firstValueFrom(service.findActiveContractsByItemLegacyId('99')))
      .rejects.toBeInstanceOf(HttpErrorResponse);
    expect(rentalContractService.getItemReservations).not.toHaveBeenCalled();
  });

  it('propaga erro da busca de reservas', async () => {
    productService.getRentalItemByLegacyId.mockReturnValue(of({ id: 'item-uuid-1' } as IRentalItem));
    rentalContractService.getItemReservations.mockReturnValue(
      throwError(() => new Error('Falha na API'))
    );

    await expect(firstValueFrom(service.findActiveContractsByItemLegacyId('42')))
      .rejects.toThrow('Falha na API');
  });

  it('falha com mensagem descritiva quando o item não tem id', async () => {
    productService.getRentalItemByLegacyId.mockReturnValue(of({ id: undefined } as IRentalItem));

    await expect(firstValueFrom(service.findActiveContractsByItemLegacyId('42')))
      .rejects.toThrow('RentalItem sem id (esperado UUID) para legacyId="42"');
  });
});
