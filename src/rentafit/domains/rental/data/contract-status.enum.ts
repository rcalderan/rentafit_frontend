export enum ContractStatus {
  INITIAL = -1,    // Status inicial para contratos importados sem status definido
  DRAFT = 0,      // Proposta
  SIGNED = 1,     // Assinado
  FINALIZED = 2,  // Contrato fechado
  REVISION = 3,   // Revisão (nova proposta gerada a partir de um contrato assinado)
  SUPERSEDED = 4, // Substituído (contrato original invalidado pela revisão assinada)
  CLOSED = 5,     // Concluído (devolução granular finalizada)
  CANCELLED = 6,  // Desistência (encerrado antes da data com termo assinado)
}
