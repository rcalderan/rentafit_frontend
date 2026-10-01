import { Extension, mergeAttributes, Node } from '@tiptap/core';
import { Table, TableView, type TableOptions } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import type { Node as PMNode } from '@tiptap/pm/model';
import Image from '@tiptap/extension-image';

const PRINT_TABLE_COMPONENTS = new Set([
  'contract-items',
  'contract-payments',
  'common-table',
  'nfce-items',
  'nfce-payments',
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
    const componentType = node.attrs['printComponent'] as string | null;
    if (componentType && PRINT_TABLE_COMPONENTS.has(componentType)) {
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
          if (marker && PRINT_TABLE_COMPONENTS.has(marker)) return marker;
          if (element.classList.contains('contract-items-table')) return 'contract-items';
          if (element.classList.contains('contract-payments-table')) return 'contract-payments';
          if (element.classList.contains('thermal-items-table')) return 'nfce-items';
          const isCompactNfceTable = Boolean(element.closest('.thermal-receipt-58'))
            && /\bItem\b/i.test(element.querySelector('thead')?.textContent ?? '');
          return isCompactNfceTable ? 'nfce-items' : null;
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          const component = attributes['printComponent'];
          return typeof component === 'string' && PRINT_TABLE_COMPONENTS.has(component)
            ? { 'data-print-component': component }
            : {};
        },
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

export const PrintQrCodeBlock = Node.create({
  name: 'printQrCodeBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      qrSize: {
        default: 100,
        parseHTML: (element: HTMLElement) => Number(element.querySelector('svg')?.getAttribute('width')) || 100,
        renderHTML: () => ({}),
      },
      qrLabel: {
        default: 'Consulta via QR Code SEFAZ:',
        parseHTML: (element: HTMLElement) => {
          const label = element.querySelector('[data-qrcode-label]')?.textContent?.trim()
            || Array.from(element.children).find((child) => child.tagName.toLowerCase() === 'div')?.textContent?.trim();
          return label || 'Consulta via QR Code SEFAZ:';
        },
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{
      tag: 'div',
      getAttrs: (element) => {
        const wrapper = element as HTMLElement;
        const marked = wrapper.matches('[data-print-qrcode-block="true"], [data-qrcode-container="true"]');
        const legacyQr = Array.from(wrapper.children).some((child) =>
          child.tagName.toLowerCase() === 'svg' &&
          child.querySelector('rect[x="10"][y="10"][width="30"][height="30"]'),
        );
        return marked || legacyQr ? {} : false;
      },
    }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const qrSize = Math.min(240, Math.max(48, Number(node.attrs['qrSize']) || 100));
    const qrLabel = String(node.attrs['qrLabel'] || 'Consulta via QR Code SEFAZ:');
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-print-qrcode-block': 'true',
        'data-qrcode-container': 'true',
        style: 'text-align: center; margin: 12px 0;',
      }),
      ['div', { 'data-qrcode-label': 'true', style: 'font-size: 10px; margin-bottom: 4px;' }, qrLabel],
      ['div', { 'data-qrcode': 'true', style: 'display: inline-block; padding: 4px; background: #fff;' }, [
        'svg', { width: qrSize, height: qrSize, viewBox: '0 0 100 100', 'aria-hidden': 'true' },
        ['rect', { width: '100', height: '100', fill: '#fff' }],
        ['rect', { x: '10', y: '10', width: '30', height: '30', fill: '#000' }],
        ['rect', { x: '60', y: '10', width: '30', height: '30', fill: '#000' }],
        ['rect', { x: '10', y: '60', width: '30', height: '30', fill: '#000' }],
      ]],
      ['div', { style: 'font-size: 9px; color: #555; margin-top: 2px; word-break: break-all;' }, '{{nfce.urlConsulta}}'],
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
