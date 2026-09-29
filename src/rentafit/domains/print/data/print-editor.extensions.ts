import { Extension, mergeAttributes, Node } from '@tiptap/core';
import { Table, TableView, type TableOptions } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import type { Node as PMNode } from '@tiptap/pm/model';
import Image from '@tiptap/extension-image';
import { PrintSubcomponentType } from './print-subcomponent-style.model';

const PRINT_SUBCOMPONENT_TYPES = new Set<PrintSubcomponentType>([
  'contract-items',
  'contract-payments',
  'signature',
  'common-table',
]);

/**
 * Extensões de formatação específicas para impressão.
 * Os atributos extras viram atributos/estilos inline no HTML final,
 * garantindo que sobrevivam ao preview interpolado e à impressão.
 */

/**
 * Com resizable: true, quem instancia o TableView é o plugin columnResizing
 * do prosemirror-tables — sem HTMLAttributes e com update() que só recalcula
 * colunas. Sem esta subclasse, data-align/width nunca chegam ao DOM do editor.
 */
export class PrintTableView extends TableView {
  constructor(node: PMNode, cellMinWidth: number) {
    super(node, cellMinWidth);
    this.applyPrintAttrs(node);
  }

  override update(node: PMNode): boolean {
    if (!super.update(node)) return false;
    this.applyPrintAttrs(node);
    return true;
  }

  private applyPrintAttrs(node: PMNode): void {
    this.table.setAttribute('data-align', (node.attrs['align'] as string) || 'left');
    if (node.attrs['width']) this.table.style.width = node.attrs['width'] as string;
    const componentType = node.attrs['printComponent'] as PrintSubcomponentType | null;
    if (componentType && PRINT_SUBCOMPONENT_TYPES.has(componentType)) {
      this.table.setAttribute('data-print-component', componentType);
    } else {
      this.table.removeAttribute('data-print-component');
    }
    // espaçamento de bloco é aplicado no wrapper — o <table> em si só recebe largura
    this.dom.style.marginTop = (node.attrs['spacingBefore'] as string) || '';
    this.dom.style.marginBottom = (node.attrs['spacingAfter'] as string) || '';
  }
}

const alignmentAttribute = () => ({
  default: 'left' as const,
  parseHTML: (element: HTMLElement) => element.getAttribute('data-align') || 'left',
  renderHTML: (attributes: Record<string, unknown>) => ({ 'data-align': attributes['align'] }),
});

export const PrintTable = Table.extend({
  addOptions(): TableOptions {
    return { ...this.parent?.(), View: PrintTableView } as TableOptions;
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      printComponent: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const marker = element.getAttribute('data-print-component');
          if (marker && PRINT_SUBCOMPONENT_TYPES.has(marker as PrintSubcomponentType)) return marker;
          if (element.classList.contains('contract-items-table')) return 'contract-items';
          if (element.classList.contains('contract-payments-table')) return 'contract-payments';
          return null;
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes['printComponent'] === 'string'
            ? { 'data-print-component': attributes['printComponent'] }
            : {},
      },
      // data-align é estilizado via CSS (margin auto) para alinhar a tabela na página
      align: alignmentAttribute(),
      // largura manual em %; null = colwidth/min-width calculados pelo Tiptap
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.width || null,
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['width'] ? { style: `width: ${attributes['width']}` } : {},
      },
    };
  },
});

const cellBorderAttributes = () => {
  const cssBorder = (cssProp: 'border-style' | 'border-width' | 'border-color', jsProp: 'borderStyle' | 'borderWidth' | 'borderColor') => ({
    default: null as string | null,
    parseHTML: (element: HTMLElement) => element.style[jsProp] || null,
    renderHTML: (attributes: Record<string, unknown>) => {
      const value = attributes[jsProp];
      if (!value) return {};
      return value === 'none' && cssProp === 'border-style' ? { style: 'border: none' } : { style: `${cssProp}: ${value}` };
    },
  });
  return {
    borderStyle: cssBorder('border-style', 'borderStyle'),
    borderWidth: cssBorder('border-width', 'borderWidth'),
    borderColor: cssBorder('border-color', 'borderColor'),
  };
};

const cellPrintAttributes = () => ({
  backgroundColor: {
    default: null,
    parseHTML: (element: HTMLElement) => element.style.backgroundColor || null,
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes['backgroundColor']
        ? { style: `background-color: ${attributes['backgroundColor']}` }
        : {},
  },
  verticalAlign: {
    default: 'top' as const,
    parseHTML: (element: HTMLElement) => element.style.verticalAlign || 'top',
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes['verticalAlign'] && attributes['verticalAlign'] !== 'top'
        ? { style: `vertical-align: ${attributes['verticalAlign']}` }
        : {},
  },
  ...cellBorderAttributes(),
});

export const PrintTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellPrintAttributes() };
  },
});

export const PrintTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...cellPrintAttributes(),
      printTableHeader: {
        default: true,
        parseHTML: (element: HTMLElement) => element.hasAttribute('data-print-table-header'),
        renderHTML: () => ({ 'data-print-table-header': 'true' }),
      },
    };
  },
});

/**
 * Espaçamento entre componentes (margin-top/bottom) e entrelinha de bloco.
 * São atributos globais de nó — aplicam-se ao bloco inteiro (não à seleção de
 * texto como o lineHeight do textStyle) e serializam como inline style.
 */
const spacingAttribute = (
  key: 'spacingBefore' | 'spacingAfter' | 'blockLineHeight',
  cssProp: 'margin-top' | 'margin-bottom' | 'line-height',
  jsProp: 'marginTop' | 'marginBottom' | 'lineHeight',
) => ({
  default: null as string | null,
  parseHTML: (element: HTMLElement) => element.style[jsProp] || null,
  renderHTML: (attributes: Record<string, unknown>) =>
    attributes[key] ? { style: `${cssProp}: ${attributes[key]}` } : {},
});

export const PrintBlockSpacing = Extension.create({
  name: 'printBlockSpacing',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'listItem', 'table'],
        attributes: {
          spacingBefore: spacingAttribute('spacingBefore', 'margin-top', 'marginTop'),
          spacingAfter: spacingAttribute('spacingAfter', 'margin-bottom', 'marginBottom'),
        },
      },
      {
        types: ['paragraph', 'heading', 'blockquote', 'listItem'],
        attributes: {
          blockLineHeight: spacingAttribute('blockLineHeight', 'line-height', 'lineHeight'),
        },
      },
    ];
  },
});

export const PrintSignatureBlock = Node.create({
  name: 'printSignatureBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-print-component="signature"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-print-component': 'signature' }),
      0,
    ];
  },
});

export const PrintImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.width || null,
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['width'] ? { style: `width: ${attributes['width']}` } : {},
      },
    };
  },
});
