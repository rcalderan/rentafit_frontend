export type PrintSubcomponentType =
  | 'contract-items'
  | 'contract-payments'
  | 'signature'
  | 'common-table';

export type PrintBorderMode = 'none' | 'horizontal' | 'all';
export type PrintBorderStyle = 'solid' | 'dashed' | 'dotted' | 'double';
export type PrintAlignment = 'left' | 'center' | 'right';

export interface PrintSubcomponentStyle {
  fontFamily: string;
  fontSizePt: number;
  textColor: string;
  backgroundColor: string;
  borderMode: PrintBorderMode;
  borderStyle: PrintBorderStyle;
  borderWidthPx: number;
  borderColor: string;
  cellPaddingPx: number;
  alignment: PrintAlignment;
  showHeader: boolean;
  headerBackgroundColor: string;
  headerTextColor: string;
  signatureLineWidthPercent: number;
}

export type PrintSubcomponentStyleMap = Record<PrintSubcomponentType, PrintSubcomponentStyle>;

export const PRINT_SUBCOMPONENTS: Record<PrintSubcomponentType, string> = {
  'contract-items': 'Itens do contrato',
  'contract-payments': 'Formas de pagamento',
  signature: 'Bloco de assinatura',
  'common-table': 'Tabela comum',
};

export const PRINT_COMPONENT_FONT_FAMILIES = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: "'Times New Roman', serif", label: 'Times New Roman' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: "'Courier New', monospace", label: 'Courier New' },
] as const;

export const DEFAULT_PRINT_SUBCOMPONENT_STYLES: PrintSubcomponentStyleMap = {
  'contract-items': {
    fontFamily: 'Arial, sans-serif',
    fontSizePt: 9,
    textColor: '#111111',
    backgroundColor: 'transparent',
    borderMode: 'horizontal',
    borderStyle: 'solid',
    borderWidthPx: 0.6,
    borderColor: '#111111',
    cellPaddingPx: 1,
    alignment: 'left',
    showHeader: true,
    headerBackgroundColor: 'transparent',
    headerTextColor: '#111111',
    signatureLineWidthPercent: 35,
  },
  'contract-payments': {
    fontFamily: 'Arial, sans-serif',
    fontSizePt: 9,
    textColor: '#111111',
    backgroundColor: 'transparent',
    borderMode: 'horizontal',
    borderStyle: 'solid',
    borderWidthPx: 0.6,
    borderColor: '#111111',
    cellPaddingPx: 2,
    alignment: 'left',
    showHeader: false,
    headerBackgroundColor: 'transparent',
    headerTextColor: '#111111',
    signatureLineWidthPercent: 35,
  },
  signature: {
    fontFamily: 'Arial, sans-serif',
    fontSizePt: 10,
    textColor: '#111111',
    backgroundColor: 'transparent',
    borderMode: 'all',
    borderStyle: 'solid',
    borderWidthPx: 1,
    borderColor: '#111111',
    cellPaddingPx: 2,
    alignment: 'right',
    showHeader: false,
    headerBackgroundColor: 'transparent',
    headerTextColor: '#111111',
    signatureLineWidthPercent: 35,
  },
  'common-table': {
    fontFamily: 'Arial, sans-serif',
    fontSizePt: 10,
    textColor: '#111111',
    backgroundColor: 'transparent',
    borderMode: 'none',
    borderStyle: 'solid',
    borderWidthPx: 1,
    borderColor: '#111111',
    cellPaddingPx: 4,
    alignment: 'left',
    showHeader: false,
    headerBackgroundColor: 'transparent',
    headerTextColor: '#111111',
    signatureLineWidthPercent: 35,
  },
};
