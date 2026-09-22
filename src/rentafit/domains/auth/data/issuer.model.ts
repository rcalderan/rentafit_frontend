export interface IssuerInfo {
  cnpj: string;
  rootCnpj: string;
  branchOrder: string;
  digitoControle: string;
  matriz: boolean;
  razaoSocial: string;
  nomeFantasia?: string;
  ie?: string;
  im?: string;
  crt: string;
  fone?: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipioCodigo: string;
  municipioNome: string;
  uf: string;
  cep: string;
  paisCodigo: string;
  paisNome: string;
  certificateConfigured: boolean;
  /** Campos fiscais NFS-e (mesma fonte de verdade da NF-e). */
  nfseServiceCode?: string;
  nfseNbsCode?: string;
  nfseServiceDescription?: string;
  nfseIssRate?: number;
  nfseTotalTaxRate?: number;
  /** true = envia a IM do prestador na NFS-e (exige cadastro no CNC do município). */
  nfseSendIm?: boolean;
}

export interface IssuerSetupRequest {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  ie?: string;
  im?: string;
  crt: string;
  fone?: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipioCodigo: string;
  municipioNome: string;
  uf: string;
  cep: string;
  paisCodigo: string;
  paisNome: string;
  nfseServiceCode?: string;
  nfseNbsCode?: string;
  nfseServiceDescription?: string;
  nfseIssRate?: number;
  nfseTotalTaxRate?: number;
  nfseSendIm?: boolean;
}

export interface IssuerBranchSetupRequest {
  cnpj: string;
  nomeFantasia?: string;
  ie?: string;
  im?: string;
  fone?: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipioCodigo: string;
  municipioNome: string;
  uf: string;
  cep: string;
  certificatePath?: string;
  certificatePassword?: string;
}
