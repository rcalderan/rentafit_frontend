import { IRentalItem } from '../../product/data/Product.interface';
import { ContractStatus } from '../data/contract-status.enum';
import { IRentalContractItem } from '../data/rental-contract-item.interface';
import { RentalDraftSnapshot } from '../data/rental-draft-snapshot';

/** formType dos rascunhos de proposta de locação — deve bater com NewRental.formType. */
export const RENTAL_CONTRACT_FORM_TYPE = 'rental-contract';

/**
 * Monta o snapshot de uma proposta de locação nova já contendo o produto
 * recém-cadastrado. O chamador persiste via SessionFormStorageService sob um
 * draftId próprio e abre a aba `/rental/new` com esse draftId — o NewRental
 * restaura o rascunho em `contractLoaded = true` (formulário da proposta,
 * sem a tela de busca de contrato).
 */
export function buildRentalDraftWithItem(
  product: IRentalItem,
  today: string = isoToday(),
): RentalDraftSnapshot {
  const codigo = String(product.legacyId ?? '');
  const meta = [
    product.size ? `TAM: ${product.size}` : null,
    product.color ? `COR: ${product.color}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const item: IRentalContractItem = {
    codigo,
    descricao: product.name,
    valor: product.value,
    entregue: false,
    // Preenchido em buildCreateRequest com o employeeId do operador no salvar.
    attendantEmployeeId: '',
    sub: meta ? [{ tipo: 'observacao', descricao: meta }] : [],
  };

  return {
    contract: {
      tipo: 1,
      cliente: '',
      retirada: '',
      usa: '',
      devolucao: '',
      hoje: today,
      criado_por: '',
      baixa: false,
      situacao: ContractStatus.INITIAL,
      comunicado: '',
      itens: [item],
      pagamentos: [],
    },
    customerUuid: null,
    customerFound: false,
    customerSearchQuery: '',
    contractLookupLegacyId: '',
    contractId: null,
    contractLoaded: true,
    contractPrintTemplateId: null,
    parentContractId: null,
    replacedByContractId: null,
    autosaveEmployeeId: null,
    itemRentalIds: product.id ? [[codigo, product.id]] : [],
    fiscalDocument: null,
    revisionAudit: '',
  };
}

/** Data local no formato ISO `yyyy-mm-dd` (mesmo formato de NewRental.toDateString). */
function isoToday(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}
