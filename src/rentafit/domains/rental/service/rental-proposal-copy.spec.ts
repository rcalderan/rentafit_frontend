import { ContractStatus } from '../data/contract-status.enum';
import { RentalDraftSnapshot } from '../data/rental-draft-snapshot';
import { PaymentMethod } from '../data/payment-method.enum';
import { PaymentStatus } from '../data/payment-status.enum';
import { copyUnsavedRentalProposal } from './rental-proposal-copy';

function savedRental(): RentalDraftSnapshot {
  return {
    contract: {
      tipo: 1,
      legacyId: 'old',
      cliente: 'customer',
      clienteNome: 'Ana',
      retirada: '2026-10-01',
      usa: '2026-10-05',
      devolucao: '2026-10-06',
      hoje: '2026-09-01',
      criado_por: 'employee',
      baixa: true,
      situacao: ContractStatus.FINALIZED,
      comunicado: 'Ajuste',
      itens: [
        {
          codigo: '42',
          descricao: 'Vestido',
          valor: 100,
          attendantEmployeeId: 'employee',
          entregue: true,
          sub: [{ tipo: 'acessorio', descricao: 'Véu', accessoryId: 'veil-id' }],
        },
      ],
      pagamentos: [
        {
          id: 'paid-id',
          parcela: 1,
          forma: PaymentMethod.PIX,
          valor: 100,
          vezes: 1,
          data: '2026-09-01',
          status: PaymentStatus.PAID,
        },
      ],
    },
    customerUuid: 'customer-id',
    customerFound: true,
    customerSearchQuery: '42',
    contractLookupLegacyId: 'old',
    contractId: 'original-id',
    contractLoaded: true,
    contractPrintTemplateId: 'template',
    parentContractId: 'parent',
    replacedByContractId: 'child',
    autosaveEmployeeId: 'employee',
    itemRentalIds: [['42', 'item-id']],
    fiscalDocument: null,
  };
}

describe('copyUnsavedRentalProposal', () => {
  it('copies customer, dates and UUIDs without paid values or backend identity', () => {
    const source = savedRental();
    const copy = copyUnsavedRentalProposal(source, '2026-10-04');
    expect(copy.contractId).toBeNull();
    expect(copy.contract.legacyId).toBeUndefined();
    expect(copy.contract.situacao).toBe(ContractStatus.INITIAL);
    expect(copy.contract.pagamentos).toEqual([]);
    expect(copy.contract.itens[0].entregue).toBe(false);
    expect(copy.customerUuid).toBe(source.customerUuid);
    expect(copy.contract.usa).toBe(source.contract.usa);
    expect(copy.itemRentalIds).toEqual([['42', 'item-id']]);
    expect(copy.contract.itens[0].sub[0].accessoryId).toBe('veil-id');
    expect(copy.autosaveEmployeeId).toBeNull();
    expect(copy.parentContractId).toBeNull();
    expect(copy.contractPrintTemplateId).toBeNull();
  });
  it('deep-copies nested values without modifying the original', () => {
    const source = savedRental();
    const copy = copyUnsavedRentalProposal(source, '2026-10-04');
    copy.contract.itens[0].sub[0].descricao = 'Outro véu';
    copy.itemRentalIds[0][1] = 'another-item';
    expect(source.contract.itens[0].sub[0].descricao).toBe('Véu');
    expect(source.contract.pagamentos).toHaveLength(1);
    expect(source.contractId).toBe('original-id');
    expect(source.itemRentalIds[0][1]).toBe('item-id');
  });
});
