import { ContractStatus } from '../data/contract-status.enum';
import { RentalDraftSnapshot } from '../data/rental-draft-snapshot';

export function copyUnsavedRentalProposal(
  source: RentalDraftSnapshot,
  today: string,
): RentalDraftSnapshot {
  const copy: RentalDraftSnapshot = structuredClone(source);
  copy.contract = {
    ...copy.contract,
    _id: undefined,
    legacyId: undefined,
    situacao: ContractStatus.INITIAL,
    pagamentos: [],
    baixa: false,
    baixa_por: undefined,
    devolveu: undefined,
    criado_por: '',
    hoje: today,
    itens: copy.contract.itens.map((item) => ({ ...item, entregue: false })),
  };
  return {
    ...copy,
    contractId: null,
    contractPrintTemplateId: null,
    contractLoaded: true,
    parentContractId: null,
    replacedByContractId: null,
    autosaveEmployeeId: null,
    fiscalDocument: null,
    contractLookupLegacyId: '',
    revisionAudit: '',
  };
}
