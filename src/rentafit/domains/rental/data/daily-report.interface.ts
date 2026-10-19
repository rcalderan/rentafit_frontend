import { ItemMetaTypeApi } from './rental-api.types';

/** Espelha os DTOs de relatório do backend (br.com.rentafit.rental.dto.report). */

export interface IReportAdjustment {
  type: ItemMetaTypeApi;
  typeDescription: string;
  description: string;
}

export interface IReportItem {
  contractLegacyId: string;
  customerName: string;
  legacyProductCode: string;
  description: string;
  size?: string;
  color?: string;
  pickupDate: string;
  adjustments: IReportAdjustment[];
  /** Setor do contrato (retirada) — null em registros legados pré-V44. */
  sectorId?: string | null;
  sectorName?: string | null;
  sectorCode?: string | null;
}

export interface IClothingTypeGroup {
  clothingType: string;
  itemCount: number;
  items: IReportItem[];
}

export interface IDailyRentalReport {
  startDate: string;
  endDate: string;
  generatedAt: string;
  contractCount: number;
  itemCount: number;
  adjustmentCount: number;
  groups: IClothingTypeGroup[];
}
