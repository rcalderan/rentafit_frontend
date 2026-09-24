export type PageFormat = 'A4' | 'THERMAL_80MM' | 'THERMAL_58MM' | 'CUSTOM';
export type PageOrientation = 'PORTRAIT' | 'LANDSCAPE';

export type TemplateType =
  | 'RENTAL_CONTRACT'
  | 'RENTAL_CANCELLATION'
  | 'FISCAL_RECEIPT_80MM'
  | 'FISCAL_RECEIPT_58MM'
  | 'CUSTOM';

export interface PageDimensions {
  format: PageFormat;
  orientation: PageOrientation;
  widthMm: number;
  heightMm: number | null; // null represents continuous roll
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
}

export interface PrintTemplate {
  id: string;
  name: string;
  description?: string;
  templateType: TemplateType;
  pageFormat: PageFormat;
  orientation: PageOrientation;
  pageWidthMm: number;
  pageHeightMm: number | null;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  contentJson: any;
  contentHtml: string;
  cssStyles?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VariableDefinition {
  key: string;
  tag: string;
  label: string;
  category: 'cliente' | 'empresa' | 'contrato' | 'nfce' | 'sistema';
  sampleValue: string;
}

export interface VariableCategory {
  id: 'cliente' | 'empresa' | 'contrato' | 'nfce' | 'sistema';
  name: string;
  icon: string;
  variables: VariableDefinition[];
}

export const PAGE_FORMAT_PRESETS: Record<PageFormat, { name: string; widthMm: number; heightMm: number | null; defaultMargins: { top: number; bottom: number; left: number; right: number } }> = {
  A4: {
    name: 'Folha A4 (210 x 297 mm)',
    widthMm: 210,
    heightMm: 297,
    defaultMargins: { top: 15, bottom: 15, left: 15, right: 15 },
  },
  THERMAL_80MM: {
    name: 'Bobina Térmica 80 mm (PDV / Bematech / Elgin)',
    widthMm: 80,
    heightMm: null,
    defaultMargins: { top: 4, bottom: 4, left: 4, right: 4 },
  },
  THERMAL_58MM: {
    name: 'Bobina Térmica 58 mm (POS Móvel / Mini)',
    widthMm: 58,
    heightMm: null,
    defaultMargins: { top: 3, bottom: 3, left: 3, right: 3 },
  },
  CUSTOM: {
    name: 'Tamanho Customizado',
    widthMm: 210,
    heightMm: 297,
    defaultMargins: { top: 10, bottom: 10, left: 10, right: 10 },
  },
};
