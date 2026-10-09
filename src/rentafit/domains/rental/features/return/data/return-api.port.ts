import { Observable } from 'rxjs';
import {
  CloseReturnRequestModel,
  MarkReturnRequestModel,
  ReturnSummaryModel,
  WithdrawRequestModel,
} from './return.model';

export abstract class ReturnApiPort {
  abstract getReturnSummary(contractId: string): Observable<ReturnSummaryModel>;

  abstract markItemsReturned(
    contractId: string,
    request: MarkReturnRequestModel
  ): Observable<ReturnSummaryModel>;

  abstract closeReturn(
    contractId: string,
    request: CloseReturnRequestModel
  ): Observable<ReturnSummaryModel>;

  /** Desistência (SIGNED|FINALIZED → CANCELLED). Resposta é o contrato detalhado. */
  abstract withdraw(contractId: string, request: WithdrawRequestModel): Observable<void>;
}
