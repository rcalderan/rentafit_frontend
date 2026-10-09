import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ReturnFacadeService } from './return-facade.service';
import { ReturnApiPort } from '../features/return/data/return-api.port';
import { ReturnSummaryModel } from '../features/return/data/return.model';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const buildSummary = (overrides: Partial<ReturnSummaryModel> = {}): ReturnSummaryModel => ({
  contractId: 'contract-uuid-1',
  legacyId: '20260502-1',
  customerName: 'Maria Silva',
  returnDate: '2026-05-01',
  pendingCount: 2,
  isFullyReturned: false,
  delayDays: 1,
  suggestedFine: 50,
  contractStatus: 'FINALIZED',
  totalValue: 1000,
  items: [
    {
      itemId: 'item-1',
      description: 'Vestido de Noiva',
      isReturned: false,
      accessories: [
        { accessoryId: 'acc-1', description: 'Véu', type: 'ACESSORIO', isReturned: false },
      ],
    },
    {
      itemId: 'item-2',
      description: 'Terno Slim',
      isReturned: false,
      accessories: [],
    },
  ],
  paymentsPreview: [
    { paymentId: 'pay-1', installmentNumber: 1, value: 800, status: 'PAID' },
    { paymentId: 'pay-2', installmentNumber: 2, value: 200, status: 'PENDING' },
  ],
  ...overrides,
});

const buildFullyReturnedSummary = (): ReturnSummaryModel =>
  buildSummary({
    pendingCount: 0,
    isFullyReturned: true,
    delayDays: 0,
    suggestedFine: 0,
    items: [
      { itemId: 'item-1', description: 'Vestido', isReturned: true, returnedAt: '2026-05-02T10:00:00Z', returnedBy: 'João', accessories: [] },
    ],
    paymentsPreview: [{ paymentId: 'pay-1', installmentNumber: 1, value: 1000, status: 'PAID' }],
  });

// ── Fake API ──────────────────────────────────────────────────────────────────

class FakeReturnApi implements ReturnApiPort {
  summaryToReturn: ReturnSummaryModel = buildSummary();

  getReturnSummary = vi.fn(() => of(this.summaryToReturn));
  markItemsReturned = vi.fn(() => of(this.summaryToReturn));
  closeReturn = vi.fn(() => of(this.summaryToReturn));
  withdraw = vi.fn(() => of(undefined));
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ReturnFacadeService', () => {
  let facade: ReturnFacadeService;
  let api: FakeReturnApi;

  beforeEach(() => {
    api = new FakeReturnApi();

    TestBed.configureTestingModule({
      providers: [
        ReturnFacadeService,
        { provide: ReturnApiPort, useValue: api },
      ],
    });

    facade = TestBed.inject(ReturnFacadeService);
  });

  // ── loadContract ────────────────────────────────────────────────────────────

  describe('loadContract', () => {
    it('popula summary e limpa loading após sucesso', () => {
      facade.loadContract('contract-uuid-1');

      expect(api.getReturnSummary).toHaveBeenCalledWith('contract-uuid-1');
      expect(facade.summary()).toEqual(api.summaryToReturn);
      expect(facade.loading()).toBe(false);
      expect(facade.error()).toBeNull();
    });


    it('pré-carrega suggestedFine quando !isFullyReturned e delayDays > 0', () => {
      api.summaryToReturn = buildSummary({ delayDays: 3, suggestedFine: 150, isFullyReturned: false });
      facade.loadContract('c1');

      expect(facade.form().fineAmount).toBe(150);
    });

    it('NÃO pré-carrega suggestedFine quando isFullyReturned = true', () => {
      api.summaryToReturn = buildFullyReturnedSummary();
      facade.loadContract('c1');

      expect(facade.form().fineAmount).toBeNull();
    });

    it('exibe erro e reseta loading quando API falha', () => {
      api.getReturnSummary.mockReturnValueOnce(throwError(() => new Error('Timeout')));
      facade.loadContract('bad-id');

      expect(facade.loading()).toBe(false);
      expect(facade.error()).toBe('Timeout');
      expect(facade.summary()).toBeNull();
    });
  });

  // ── canDirectClose ──────────────────────────────────────────────────────────

  describe('canDirectClose', () => {
    beforeEach(() => {
      api.summaryToReturn = buildFullyReturnedSummary();
      facade.loadContract('c1');
    });

    it('retorna true quando tudo devolvido, sem pendências e nome preenchido', () => {
      facade.setReturnerName('João');
      expect(facade.canDirectClose()).toBe(true);
    });

    it('retorna false quando nome está vazio', () => {
      facade.setReturnerName('');
      expect(facade.canDirectClose()).toBe(false);
    });

    it('retorna false quando há parcelas PENDING', () => {
      api.summaryToReturn = buildSummary({
        isFullyReturned: true,
        pendingCount: 0,
        paymentsPreview: [{ paymentId: 'pay-1', installmentNumber: 1, value: 200, status: 'PENDING' }],
      });
      facade.loadContract('c1');
      facade.setReturnerName('João');
      expect(facade.canDirectClose()).toBe(false);
    });

    it('retorna false quando applyFine=true mas fineAmount inválido', () => {
      facade.setReturnerName('João');
      facade.setApplyFine(true);
      facade.setFineAmount(null);
      expect(facade.canDirectClose()).toBe(false);
    });

    it('retorna false quando fineAmount = 0 com applyFine=true', () => {
      facade.setReturnerName('João');
      facade.setApplyFine(true);
      facade.setFineAmount(0);
      expect(facade.canDirectClose()).toBe(false);
    });

    it('retorna true quando applyFine=true e fineAmount > 0', () => {
      facade.setReturnerName('João');
      facade.setApplyFine(true);
      facade.setFineAmount(75);
      expect(facade.canDirectClose()).toBe(true);
    });

    it('retorna false quando !isFullyReturned', () => {
      api.summaryToReturn = buildSummary({ isFullyReturned: false });
      facade.loadContract('c1');
      facade.setReturnerName('João');
      expect(facade.canDirectClose()).toBe(false);
    });
  });

  // ── showConfirmButton ───────────────────────────────────────────────────────

  describe('showConfirmButton', () => {
    it('retorna false sem summary carregado', () => {
      expect(facade.showConfirmButton()).toBe(false);
    });

    it('retorna true quando há seleções parciais (itens pendentes)', () => {
      facade.loadContract('c1');
      facade.toggleItem('item-1', true);
      expect(facade.showConfirmButton()).toBe(true);
    });

    it('retorna true quando há seleção de acessório', () => {
      facade.loadContract('c1');
      facade.toggleAccessory('item-1', 'acc-1', true);
      expect(facade.showConfirmButton()).toBe(true);
    });

    it('retorna true quando isFullyReturned mas há parcelas pendentes', () => {
      api.summaryToReturn = buildSummary({
        isFullyReturned: true,
        paymentsPreview: [{ paymentId: 'pay-1', installmentNumber: 1, value: 200, status: 'PENDING' }],
      });
      facade.loadContract('c1');
      expect(facade.showConfirmButton()).toBe(true);
    });

    it('retorna false quando isFullyReturned e sem parcelas pendentes e sem seleções', () => {
      api.summaryToReturn = buildFullyReturnedSummary();
      facade.loadContract('c1');
      expect(facade.showConfirmButton()).toBe(false);
    });
  });

  // ── unpaidPaymentsCount ─────────────────────────────────────────────────────

  describe('unpaidPaymentsCount', () => {
    it('retorna 0 sem summary', () => {
      expect(facade.unpaidPaymentsCount()).toBe(0);
    });

    it('conta apenas parcelas PENDING', () => {
      api.summaryToReturn = buildSummary({
        paymentsPreview: [
          { paymentId: 'pay-1', installmentNumber: 1, value: 500, status: 'PAID' },
          { paymentId: 'pay-2', installmentNumber: 2, value: 200, status: 'PENDING' },
          { paymentId: 'pay-3', installmentNumber: 3, value: 100, status: 'PENDING' },
        ],
      });
      facade.loadContract('c1');
      expect(facade.unpaidPaymentsCount()).toBe(2);
    });

    it('não conta MULTA como pendente', () => {
      api.summaryToReturn = buildSummary({
        paymentsPreview: [
          { paymentId: 'pay-1', installmentNumber: 1, value: 500, status: 'PAID' },
          { paymentId: 'pay-2', installmentNumber: 2, value: 50, status: 'MULTA' },
        ],
      });
      facade.loadContract('c1');
      expect(facade.unpaidPaymentsCount()).toBe(0);
    });
  });

  // ── delayWarning ────────────────────────────────────────────────────────────

  describe('delayWarning', () => {
    it('retorna null quando sem atraso', () => {
      api.summaryToReturn = buildSummary({ delayDays: 0 });
      facade.loadContract('c1');
      expect(facade.delayWarning()).toBeNull();
    });

    it('retorna mensagem singular para 1 dia', () => {
      api.summaryToReturn = buildSummary({ delayDays: 1 });
      facade.loadContract('c1');
      expect(facade.delayWarning()).toBe('1 dia de atraso');
    });

    it('retorna mensagem plural para múltiplos dias', () => {
      api.summaryToReturn = buildSummary({ delayDays: 4 });
      facade.loadContract('c1');
      expect(facade.delayWarning()).toBe('4 dias de atraso');
    });
  });

  // ── hasChanges ──────────────────────────────────────────────────────────────

  describe('hasChanges', () => {
    beforeEach(() => facade.loadContract('c1'));

    it('retorna false sem seleções', () => {
      expect(facade.hasChanges()).toBe(false);
    });

    it('retorna true ao selecionar item', () => {
      facade.toggleItem('item-1', true);
      expect(facade.hasChanges()).toBe(true);
    });

    it('retorna false ao desselecionar item', () => {
      facade.toggleItem('item-1', true);
      facade.toggleItem('item-1', false);
      expect(facade.hasChanges()).toBe(false);
    });

    it('retorna true ao selecionar acessório sem selecionar item pai', () => {
      facade.toggleAccessory('item-1', 'acc-1', true);
      expect(facade.hasChanges()).toBe(true);
    });
  });

  // ── saveMarkings ────────────────────────────────────────────────────────────

  describe('saveMarkings', () => {
    beforeEach(() => facade.loadContract('c1'));

    it('retorna false sem seleções', () => {
      let result: boolean | undefined;
      facade.saveMarkings().subscribe(r => { result = r; });
      expect(result).toBe(false);
      expect(api.markItemsReturned).not.toHaveBeenCalled();
    });

    it('envia entries de itens selecionados', () => {
      facade.setReturnerName('João');
      facade.toggleItem('item-1', true);

      facade.saveMarkings('employee-uuid').subscribe();

      expect(api.markItemsReturned).toHaveBeenCalledWith(
        'contract-uuid-1',
        expect.objectContaining({
          returnerName: 'João',
          entries: expect.arrayContaining([
            expect.objectContaining({ itemId: 'item-1' }),
          ]),
        })
      );
    });

    it('envia entries de acessórios com accessoryId', () => {
      facade.setReturnerName('Maria');
      facade.toggleAccessory('item-1', 'acc-1', true);

      facade.saveMarkings('emp-1').subscribe();

      const [, req] = (api.markItemsReturned.mock.calls.at(-1) as unknown) as [any, any];
      const accEntry = req.entries.find((e: any) => e.accessoryId === 'acc-1');
      expect(accEntry).toBeDefined();
      expect(accEntry.itemId).toBe('item-1');
    });

    it('limpa seleções após salvar com sucesso', () => {
      facade.toggleItem('item-1', true);
      facade.saveMarkings().subscribe();

      expect(facade.form().selectedItems.size).toBe(0);
      expect(facade.form().selectedAccessories.size).toBe(0);
    });

    it('propaga erro e retorna false quando API falha', () => {
      api.markItemsReturned.mockReturnValueOnce(throwError(() => new Error('Servidor indisponível')));
      facade.toggleItem('item-1', true);

      let result: boolean | undefined;
      facade.saveMarkings().subscribe(r => { result = r; });

      expect(result).toBe(false);
      expect(facade.error()).toBe('Servidor indisponível');
    });
  });

  // ── closeContract ───────────────────────────────────────────────────────────

  describe('closeContract', () => {
    beforeEach(() => {
      api.summaryToReturn = buildFullyReturnedSummary();
      facade.loadContract('c1');
      facade.setReturnerName('João');
    });

    it('fecha contrato com sucesso e retorna true', () => {
      let result: boolean | undefined;
      facade.closeContract('employee-uuid').subscribe(r => { result = r; });

      expect(result).toBe(true);
      expect(api.closeReturn).toHaveBeenCalledWith(
        'contract-uuid-1',
        expect.objectContaining({ employeeId: 'employee-uuid', applyFine: false })
      );
    });

    it('envia fineAmount quando applyFine=true', () => {
      facade.setApplyFine(true);
      facade.setFineAmount(75);

      facade.closeContract('emp-1').subscribe();

      const [, req] = (api.closeReturn.mock.calls.at(-1) as unknown) as [any, any];
      expect(req.applyFine).toBe(true);
      expect(req.fineAmount).toBe(75);
    });

    it('não envia fineAmount quando applyFine=false', () => {
      facade.setApplyFine(false);
      facade.setFineAmount(100);

      facade.closeContract('emp-1').subscribe();

      const [, req] = (api.closeReturn.mock.calls.at(-1) as unknown) as [any, any];
      expect(req.fineAmount).toBeUndefined();
    });

    it('retorna false quando canDirectClose é false (nome vazio)', () => {
      facade.setReturnerName('');

      let result: boolean | undefined;
      facade.closeContract('emp-1').subscribe(r => { result = r; });

      expect(result).toBe(false);
      expect(api.closeReturn).not.toHaveBeenCalled();
    });

    it('propaga erro e retorna false quando API falha', () => {
      api.closeReturn.mockReturnValueOnce(throwError(() => new Error('Falha ao fechar')));

      let result: boolean | undefined;
      facade.closeContract('emp-1').subscribe(r => { result = r; });

      expect(result).toBe(false);
      expect(facade.error()).toBe('Falha ao fechar');
      expect(facade.closing()).toBe(false);
    });
  });

  // ── withdraw (desistência) ──────────────────────────────────────────────────

  describe('withdraw', () => {
    it('chama a API e retorna true em caso de sucesso', () => {
      facade.loadContract('c1');
      let result: boolean | undefined;
      facade
        .withdraw({ employeeId: 'emp-1', refundPaymentIds: ['pay-1'], applyFine: true, fineAmount: 300 })
        .subscribe(r => { result = r; });

      expect(result).toBe(true);
      expect(api.withdraw).toHaveBeenCalledWith(
        'contract-uuid-1',
        expect.objectContaining({
          employeeId: 'emp-1',
          refundPaymentIds: ['pay-1'],
          applyFine: true,
          fineAmount: 300,
        })
      );
      expect(facade.closing()).toBe(false);
    });

    it('retorna false sem summary e não chama a API', () => {
      let result: boolean | undefined;
      facade.withdraw({ employeeId: 'e', refundPaymentIds: [], applyFine: false })
        .subscribe(r => { result = r; });

      expect(result).toBe(false);
      expect(api.withdraw).not.toHaveBeenCalled();
    });

    it('propaga erro e retorna false quando API falha', () => {
      facade.loadContract('c1');
      api.withdraw.mockReturnValueOnce(throwError(() => new Error('Desistência falhou')));

      let result: boolean | undefined;
      facade.withdraw({ employeeId: 'emp-1', refundPaymentIds: [], applyFine: false })
        .subscribe(r => { result = r; });

      expect(result).toBe(false);
      expect(facade.error()).toBe('Desistência falhou');
      expect(facade.closing()).toBe(false);
    });
  });

  // ── setReturnerName / form state ────────────────────────────────────────────

  describe('form state mutations', () => {
    it('atualiza returnerName no form', () => {
      facade.setReturnerName('Fulano de Tal');
      expect(facade.form().returnerName).toBe('Fulano de Tal');
    });

    it('toggleItem true adiciona ao selectedItems', () => {
      facade.loadContract('c1');
      facade.toggleItem('item-x', true);
      expect(facade.form().selectedItems.has('item-x')).toBe(true);
    });

    it('toggleItem false remove do selectedItems', () => {
      facade.loadContract('c1');
      facade.toggleItem('item-x', true);
      facade.toggleItem('item-x', false);
      expect(facade.form().selectedItems.has('item-x')).toBe(false);
    });

    it('toggleAccessory adiciona e depois remove corretamente', () => {
      facade.loadContract('c1');
      facade.toggleAccessory('item-x', 'acc-z', true);
      expect(facade.form().selectedAccessories.get('item-x')?.has('acc-z')).toBe(true);

      facade.toggleAccessory('item-x', 'acc-z', false);
      expect(facade.form().selectedAccessories.has('item-x')).toBe(false);
    });

    it('clearError zera o erro do estado', () => {
      api.getReturnSummary.mockReturnValueOnce(throwError(() => new Error('Erro qualquer')));
      facade.loadContract('c1');
      expect(facade.error()).toBeTruthy();

      facade.clearError();
      expect(facade.error()).toBeNull();
    });
  });
});
