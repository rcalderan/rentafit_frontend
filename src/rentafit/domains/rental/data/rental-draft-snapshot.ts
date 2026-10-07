import { INewRentalContract } from './rental-contract.interface';
import { IFiscalDocument } from '../../finance/data/fiscal-document.types';

export interface RentalDraftSnapshot {
  contract: INewRentalContract;
  customerUuid: string | null;
  customerFound: boolean;
  customerSearchQuery: string;
  contractLookupLegacyId: string;
  contractId: string | null;
  contractLoaded: boolean;
  contractPrintTemplateId: string | null;
  parentContractId: string | null;
  replacedByContractId: string | null;
  autosaveEmployeeId: string | null;
  itemRentalIds: Array<[string, string]>;
  fiscalDocument: IFiscalDocument | null;
  revisionAudit?: string;
}
