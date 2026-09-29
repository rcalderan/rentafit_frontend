import { Injectable } from '@angular/core';
import {
  DEFAULT_PRINT_SUBCOMPONENT_STYLES,
  PRINT_COMPONENT_FONT_FAMILIES,
  PrintAlignment,
  PrintBorderMode,
  PrintBorderStyle,
  PrintSubcomponentStyle,
  PrintSubcomponentStyleMap,
  PrintSubcomponentType,
} from '../data/print-subcomponent-style.model';

interface SerializedSubcomponentStyles {
  version: 1;
  styles: Partial<PrintSubcomponentStyleMap>;
}

const COLOR_PATTERN = /^(transparent|#[\da-f]{3}(?:[\da-f]{3})?)$/i;
const BORDER_MODES = new Set<PrintBorderMode>(['none', 'horizontal', 'all']);
const BORDER_STYLES = new Set<PrintBorderStyle>(['solid', 'dashed', 'dotted', 'double']);
const ALIGNMENTS = new Set<PrintAlignment>(['left', 'center', 'right']);
const FONT_FAMILIES = new Set<string>(PRINT_COMPONENT_FONT_FAMILIES.map((font) => font.value));

@Injectable({ providedIn: 'root' })
export class PrintSubcomponentStyleService {
  read(serialized: string | null | undefined): PrintSubcomponentStyleMap {
    const base = this.copyDefaults();
    if (!serialized) return base;
    try {
      const parsed: unknown = JSON.parse(serialized);
      if (!this.isSerializedStyles(parsed)) return base;
      for (const type of Object.keys(base) as PrintSubcomponentType[]) {
        base[type] = this.normalize({ ...base[type], ...parsed.styles[type] });
      }
    } catch {
      return base;
    }
    return base;
  }

  write(styles: PrintSubcomponentStyleMap): string {
    return JSON.stringify({ version: 1, styles } satisfies SerializedSubcomponentStyles);
  }

  scopeToken(templateId: string): string {
    let hash = 2166136261;
    for (let index = 0; index < templateId.length; index++) {
      hash = Math.imul(hash ^ templateId.charCodeAt(index), 16777619);
    }
    return `print-${(hash >>> 0).toString(36)}`;
  }

  compile(serialized: string | null | undefined, scopeToken: string): string {
    const scope = `[data-print-style-scope="${scopeToken}"]`;
    const styles = this.read(serialized);
    return (Object.keys(styles) as PrintSubcomponentType[])
      .map((type) => this.compileType(scope, type, styles[type]))
      .join('\n');
  }

  private compileType(
    scope: string,
    type: PrintSubcomponentType,
    style: PrintSubcomponentStyle,
  ): string {
    if (type === 'signature') return this.compileSignature(scope, style);
    return this.compileTable(scope, type, style);
  }

  private compileTable(
    scope: string,
    type: Exclude<PrintSubcomponentType, 'signature'>,
    style: PrintSubcomponentStyle,
  ): string {
    const table = `${scope} table[data-print-component="${type}"]`;
    const cells = `${table} td, ${table} th`;
    const border = `${style.borderWidthPx}px ${style.borderStyle} ${style.borderColor}`;
    const tableBorder = style.borderMode === 'none'
      ? 'border: none !important;'
      : style.borderMode === 'horizontal'
        ? `border-top: ${border} !important; border-bottom: ${border} !important;`
        : `border: ${border} !important;`;
    const cellBorder = style.borderMode === 'all' ? `border: ${border} !important;` : 'border: none !important;';
    const rowBorder = style.borderMode === 'horizontal' ? `border-top: ${border} !important;` : '';
    const headerDisplay = style.showHeader ? 'table-header-group' : 'none';
    return `${table} { font-family: ${style.fontFamily} !important; font-size: ${style.fontSizePt}pt !important; color: ${style.textColor} !important; background-color: ${style.backgroundColor} !important; text-align: ${style.alignment} !important; border-collapse: collapse !important; ${tableBorder} margin-left: ${style.alignment === 'center' ? 'auto' : '0'} !important; margin-right: ${style.alignment === 'center' || style.alignment === 'left' ? 'auto' : '0'} !important; }
${cells} { font-family: ${style.fontFamily} !important; font-size: ${style.fontSizePt}pt !important; color: ${style.textColor} !important; background-color: ${style.backgroundColor} !important; padding: ${style.cellPaddingPx}px !important; ${cellBorder} border-left: ${style.borderMode === 'all' ? `${border} !important` : 'none !important'}; border-right: ${style.borderMode === 'all' ? `${border} !important` : 'none !important'}; }
${table} tr + tr > td, ${table} tr + tr > th { ${rowBorder} }
${table} thead { display: ${headerDisplay} !important; }
${table} tr:has(> th[data-print-table-header="true"]) { display: ${style.showHeader ? 'table-row' : 'none'} !important; }
${table} thead th, ${table} th[data-print-table-header="true"] { background-color: ${style.headerBackgroundColor} !important; color: ${style.headerTextColor} !important; font-weight: bold !important; }
${table} caption { caption-side: top; text-align: center; font-weight: bold; }`;
  }

  private compileSignature(scope: string, style: PrintSubcomponentStyle): string {
    const signature = `${scope} [data-print-component="signature"]`;
    const lineBorder = style.borderMode === 'none'
      ? 'none'
      : `${style.borderWidthPx}px ${style.borderStyle} ${style.borderColor}`;
    return `${signature} { font-family: ${style.fontFamily} !important; font-size: ${style.fontSizePt}pt !important; color: ${style.textColor} !important; background-color: ${style.backgroundColor} !important; text-align: ${style.alignment} !important; }
${signature} > p:last-child { display: inline-block; width: ${style.signatureLineWidthPercent}%; margin: 30px 0 0; padding-top: 4px; border-top: ${lineBorder} !important; text-align: center; }`;
  }

  private copyDefaults(): PrintSubcomponentStyleMap {
    return {
      'contract-items': { ...DEFAULT_PRINT_SUBCOMPONENT_STYLES['contract-items'] },
      'contract-payments': { ...DEFAULT_PRINT_SUBCOMPONENT_STYLES['contract-payments'] },
      signature: { ...DEFAULT_PRINT_SUBCOMPONENT_STYLES.signature },
      'common-table': { ...DEFAULT_PRINT_SUBCOMPONENT_STYLES['common-table'] },
    };
  }

  private normalize(style: PrintSubcomponentStyle): PrintSubcomponentStyle {
    return {
      ...style,
      fontFamily: FONT_FAMILIES.has(style.fontFamily)
        ? style.fontFamily
        : DEFAULT_PRINT_SUBCOMPONENT_STYLES['common-table'].fontFamily,
      fontSizePt: this.clampNumber(style.fontSizePt, 6, 48, 10),
      textColor: this.safeColor(style.textColor, '#111111'),
      backgroundColor: this.safeColor(style.backgroundColor, 'transparent'),
      borderMode: BORDER_MODES.has(style.borderMode) ? style.borderMode : 'none',
      borderStyle: BORDER_STYLES.has(style.borderStyle) ? style.borderStyle : 'solid',
      borderWidthPx: this.clampNumber(style.borderWidthPx, 0.5, 8, 1),
      borderColor: this.safeColor(style.borderColor, '#111111'),
      cellPaddingPx: this.clampNumber(style.cellPaddingPx, 0, 24, 2),
      alignment: ALIGNMENTS.has(style.alignment) ? style.alignment : 'left',
      showHeader: Boolean(style.showHeader),
      headerBackgroundColor: this.safeColor(style.headerBackgroundColor, 'transparent'),
      headerTextColor: this.safeColor(style.headerTextColor, '#111111'),
      signatureLineWidthPercent: this.clampNumber(style.signatureLineWidthPercent, 10, 100, 35),
    };
  }

  private safeColor(value: string, fallback: string): string {
    return COLOR_PATTERN.test(value) ? value : fallback;
  }

  private clampNumber(value: number, min: number, max: number, fallback: number): number {
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  }

  private isSerializedStyles(value: unknown): value is SerializedSubcomponentStyles {
    if (!value || typeof value !== 'object') return false;
    const parsed = value as Partial<SerializedSubcomponentStyles>;
    return parsed.version === 1 && typeof parsed.styles === 'object' && parsed.styles !== null;
  }
}
