import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { HomeDashboard } from './dashboard.component';
import { RentalContractService } from '../../rental/service/rental-contract.service';
import { CustomerService } from '../../customer/service/customer.service';
import { ProductService } from '../../product/service/product.service';
import { PendingReturnsService } from '../../rental/features/return/service/pending-returns.service';
import { Router } from '@angular/router';
import { APP_CONFIG } from '../../../shared/data/app-config.token';
import { IRentalItem } from '../../product/data/Product.interface';
import { IItemReservationResponse, IRentalContractSummaryResponse } from '../../rental/data/rental-contract-response.interface';
import { ItemRentalLookupService } from '../../rental/service/item-rental-lookup.service';

const buildRentalItem = (overrides: Partial<IRentalItem> = {}): IRentalItem => ({
  id: 'item-1',
  legacyId: 42,
  name: 'Vestido Teste',
  status: 'AVAILABLE',
  condition: 'Novo',
  value: 300,
  ...overrides,
} as IRentalItem);

const buildContractSummary = (): IRentalContractSummaryResponse => ({
  id: 'contract-1',
  legacyId: '20260101-1',
  customerName: 'João',
  eventDate: '2026-06-01',
  status: 'SIGNED',
} as IRentalContractSummaryResponse);

const buildReservation = (
  overrides: Partial<IItemReservationResponse> = {}
): IItemReservationResponse => ({
  contractId: 'contract-1',
  legacyId: '20260101-1',
  customerId: 'customer-1',
  customerName: 'Maria Silva',
  eventDate: '2026-07-10',
  pickupDate: '2026-07-08',
  returnDate: '2026-07-12',
  status: 'SIGNED',
  statusDescription: 'Assinado',
  ...overrides,
});

describe('HomeDashboard', () => {
  let rentalContractService: {
    getByLegacyId: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  let customerService: {
    listCustomers: ReturnType<typeof vi.fn>;
    getCustomerByDocument: ReturnType<typeof vi.fn>;
  };
  let productService: {
    getRentalItemByLegacyId: ReturnType<typeof vi.fn>;
  };
  let pendingReturnsService: {
    getPendingReturns: ReturnType<typeof vi.fn>;
  };
  let itemRentalLookupService: {
    findActiveContractsByItemLegacyId: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  const makeComponent = () => TestBed.createComponent(HomeDashboard).componentInstance;

  beforeEach(async () => {
    rentalContractService = {
      getByLegacyId: vi.fn(),
      list: vi.fn().mockReturnValue(of({ content: [], totalPages: 0, totalElements: 0, number: 0 })),
    };
    customerService = {
      listCustomers: vi.fn(),
      getCustomerByDocument: vi.fn(),
    };
    productService = {
      getRentalItemByLegacyId: vi.fn(),
    };
    pendingReturnsService = {
      getPendingReturns: vi.fn().mockReturnValue(of([])),
    };
    itemRentalLookupService = {
      findActiveContractsByItemLegacyId: vi.fn(),
    };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [HomeDashboard],
      providers: [
        { provide: RentalContractService, useValue: rentalContractService },
        { provide: CustomerService, useValue: customerService },
        { provide: ProductService, useValue: productService },
        { provide: PendingReturnsService, useValue: pendingReturnsService },
        { provide: ItemRentalLookupService, useValue: itemRentalLookupService },
        { provide: Router, useValue: router },
        { provide: APP_CONFIG, useValue: { apiBaseUrl: '' } },
      ],
    }).compileComponents();
  });

  // ── resolveHttpError ──────────────────────────────────────────────────────

  describe('resolveHttpError', () => {
    it('retorna notFoundMsg quando HttpErrorResponse tem status 404', () => {
      const component = makeComponent();
      const err = new HttpErrorResponse({ status: 404, url: 'http://internal/api/resource' });
      expect(component.resolveHttpError(err, 404, 'Recurso não encontrado.')).toBe('Recurso não encontrado.');
    });

    it('retorna fallbackMsg quando HttpErrorResponse tem status diferente de 404', () => {
      const component = makeComponent();
      const err = new HttpErrorResponse({ status: 500, url: 'http://internal/api/resource' });
      expect(component.resolveHttpError(err, 404, 'Não encontrado.', 'Erro interno.')).toBe('Erro interno.');
    });

    it('retorna fallbackMsg padrão quando HttpErrorResponse e sem fallbackMsg customizado', () => {
      const component = makeComponent();
      const err = new HttpErrorResponse({ status: 503 });
      expect(component.resolveHttpError(err, 404, 'Não encontrado.')).toBe('Ocorreu um erro. Tente novamente.');
    });

    it('retorna fallbackMsg quando err não é HttpErrorResponse', () => {
      const component = makeComponent();
      expect(component.resolveHttpError(new Error('Falha'), 404, 'Não encontrado.', 'Erro genérico.')).toBe('Erro genérico.');
    });

    it('nunca expõe URL interna ou código HTTP na mensagem retornada', () => {
      const component = makeComponent();
      const err = new HttpErrorResponse({ status: 404, url: 'http://internal/api/v1/products/rental/byLegacy/Vestido' });
      const msg = component.resolveHttpError(err, 404, 'Roupa não encontrada.');
      expect(msg).not.toContain('http');
      expect(msg).not.toContain('404');
      expect(msg).not.toContain('internal');
    });

    it('retorna notFoundMsg quando notFoundStatus é null — nunca usa 404 como fallback', () => {
      const component = makeComponent();
      const err = new HttpErrorResponse({ status: 404 });
      // notFoundStatus=null → nunca retorna notFoundMsg, vai para fallbackMsg
      expect(component.resolveHttpError(err, null, 'NUNCA', 'Fallback esperado.')).toBe('Fallback esperado.');
    });
  });

  // ── BUG-2026-05-10-6 REGRESSION ──────────────────────────────────────────

  describe('BUG-2026-05-10-6 REGRESSION — busca por Roupa', () => {
    it('exibe mensagem amigável "Roupa não encontrada." quando API retorna 404', async () => {
      const component = makeComponent();
      const httpErr = new HttpErrorResponse({
        status: 404,
        url: 'http://localhost:4200/api/v1/products/rental/byLegacy/Vestido',
        statusText: 'Not Found',
      });
      productService.getRentalItemByLegacyId.mockReturnValue(throwError(() => httpErr));

      component.searchType.set('product');
      component.searchQuery.set('Vestido');
      component.search();

      expect(component.searchError()).toBe('Roupa não encontrada.');
    });

    it('NÃO expõe URL ou código HTTP na mensagem exibida ao usuário', async () => {
      const component = makeComponent();
      const httpErr = new HttpErrorResponse({
        status: 404,
        url: 'http://localhost:4200/api/v1/products/rental/byLegacy/Vestido',
        statusText: 'Not Found',
      });
      productService.getRentalItemByLegacyId.mockReturnValue(throwError(() => httpErr));

      component.searchType.set('product');
      component.searchQuery.set('Vestido');
      component.search();

      const msg = component.searchError() ?? '';
      expect(msg).not.toContain('Http failure response');
      expect(msg).not.toContain('localhost:4200');
      expect(msg).not.toContain('404');
    });

    it('exibe mensagem de fallback quando API retorna erro 500', () => {
      const component = makeComponent();
      productService.getRentalItemByLegacyId.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 }))
      );

      component.searchType.set('product');
      component.searchQuery.set('123');
      component.search();

      expect(component.searchError()).toBe('Ocorreu um erro. Tente novamente.');
    });

    it('navega para /product/registration quando item é encontrado', () => {
      const item = buildRentalItem();
      productService.getRentalItemByLegacyId.mockReturnValue(of(item));

      const component = makeComponent();
      component.searchType.set('product');
      component.searchQuery.set('42');
      component.search();

      expect(router.navigate).toHaveBeenCalledWith(
        ['/product/registration'],
        { queryParams: { id: item.id, legacyId: item.legacyId } }
      );
    });
  });

  // ── Busca por Contrato ────────────────────────────────────────────────────

  describe('busca por Contrato', () => {
    it('exibe "Contrato não encontrado." para erro 404', () => {
      const component = makeComponent();
      rentalContractService.getByLegacyId.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 404 }))
      );

      component.searchType.set('contract');
      component.searchQuery.set('20260101-99');
      component.search();

      expect(component.searchError()).toBe('Contrato não encontrado.');
      expect(component.searchError()).not.toContain('Http failure response');
    });

    it('navega para /rental/new quando contrato é encontrado', () => {
      const contract = buildContractSummary();
      rentalContractService.getByLegacyId.mockReturnValue(of(contract));

      const component = makeComponent();
      component.searchType.set('contract');
      component.searchQuery.set('20260101-1');
      component.search();

      expect(router.navigate).toHaveBeenCalledWith(['/rental/new'], { queryParams: { id: contract.id } });
    });

    it('modo padrão "Nº do contrato" não aciona a busca por roupa', () => {
      rentalContractService.getByLegacyId.mockReturnValue(of(buildContractSummary()));

      const component = makeComponent();
      component.searchType.set('contract');
      component.searchQuery.set('20260101-1');
      component.search();

      expect(itemRentalLookupService.findActiveContractsByItemLegacyId).not.toHaveBeenCalled();
    });
  });

  // ── Busca por Contrato — código da roupa ─────────────────────────────────

  describe('busca por Contrato — código da roupa', () => {
    const searchByItemCode = (component: HomeDashboard, code = '42') => {
      component.searchType.set('contract');
      component.setContractSearchMode('itemCode');
      component.searchQuery.set(code);
      component.search();
    };

    it('troca o placeholder no modo "Código da roupa"', () => {
      const component = makeComponent();
      component.searchType.set('contract');

      component.setContractSearchMode('itemCode');
      expect(component.searchPlaceholder()).toBe('Código legado da roupa');

      component.setContractSearchMode('contractNumber');
      expect(component.searchPlaceholder()).toBe('Nº do contrato (legacyId)');
    });

    it('abre o modal com os contratos quando há locações ativas', () => {
      const reservations = [buildReservation()];
      itemRentalLookupService.findActiveContractsByItemLegacyId.mockReturnValue(of(reservations));

      const component = makeComponent();
      searchByItemCode(component);

      expect(itemRentalLookupService.findActiveContractsByItemLegacyId).toHaveBeenCalledWith('42');
      expect(component.itemRentals()).toEqual(reservations);
      expect(component.itemRentalsApplied()).toBe(true);
      expect(component.showItemRentalsModal()).toBe(true);
      expect(component.appliedItemCode()).toBe('42');
    });

    it('não abre o modal quando a roupa não tem locação ativa', () => {
      itemRentalLookupService.findActiveContractsByItemLegacyId.mockReturnValue(of([]));

      const component = makeComponent();
      searchByItemCode(component);

      expect(component.showItemRentalsModal()).toBe(false);
      expect(component.itemRentalsApplied()).toBe(true);
      expect(component.itemRentals()).toEqual([]);
      expect(component.searchError()).toBeNull();
    });

    it('exibe "Roupa não encontrada." quando a API retorna 404', () => {
      itemRentalLookupService.findActiveContractsByItemLegacyId.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 404 }))
      );

      const component = makeComponent();
      searchByItemCode(component, '99');

      expect(component.searchError()).toBe('Roupa não encontrada.');
      expect(component.showItemRentalsModal()).toBe(false);
    });

    it('exibe fallback genérico para erro que não é 404', () => {
      itemRentalLookupService.findActiveContractsByItemLegacyId.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 }))
      );

      const component = makeComponent();
      searchByItemCode(component);

      expect(component.searchError()).toBe('Ocorreu um erro. Tente novamente.');
    });

    it('closeItemRentalsModal fecha o modal mantendo os resultados', () => {
      itemRentalLookupService.findActiveContractsByItemLegacyId.mockReturnValue(
        of([buildReservation()])
      );

      const component = makeComponent();
      searchByItemCode(component);
      component.closeItemRentalsModal();

      expect(component.showItemRentalsModal()).toBe(false);
      expect(component.itemRentals()).toHaveLength(1);
    });

    it('mudar de modo ou de aba limpa o estado da busca por roupa', () => {
      itemRentalLookupService.findActiveContractsByItemLegacyId.mockReturnValue(
        of([buildReservation()])
      );

      const component = makeComponent();
      searchByItemCode(component);
      component.setContractSearchMode('contractNumber');

      expect(component.itemRentals()).toEqual([]);
      expect(component.showItemRentalsModal()).toBe(false);
      expect(component.itemRentalsApplied()).toBe(false);
    });
  });

  // ── Busca por Cliente (CPF/CNPJ) ─────────────────────────────────────────

  describe('busca por Cliente — CPF/CNPJ', () => {
    it('exibe "Cliente não encontrado" amigável para 404', () => {
      customerService.getCustomerByDocument.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 404 }))
      );

      const component = makeComponent();
      component.searchType.set('customer');
      component.searchQuery.set('12345678901');
      component.search();

      expect(component.searchError()).toBe('Cliente não encontrado para o CPF/CNPJ informado.');
      expect(component.searchError()).not.toContain('Http failure response');
    });
  });
});
