/** Espelha SectorDTO do backend (br.com.rentafit.sector.dto.SectorDTO). */
export interface Sector {
  id: string;
  issuerCnpj: string;
  branchName?: string | null;
  name: string;
  code: string;
  active: boolean;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Espelha CreateSectorRequestDTO. */
export interface CreateSectorRequest {
  issuerCnpj: string;
  branchName?: string | null;
  name: string;
  code: string;
  isDefault?: boolean;
}

/** Espelha UpdateSectorRequestDTO — campos nulos são preservados no backend. */
export interface UpdateSectorRequest {
  branchName?: string | null;
  name?: string;
  code?: string;
  active?: boolean;
}
