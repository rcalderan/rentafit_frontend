import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';

/**
 * Extensões de formatação específicas para impressão.
 * Os atributos extras viram atributos/estilos inline no HTML final,
 * garantindo que sobrevivam ao preview interpolado e à impressão.
 */

const alignmentAttribute = (tag: 'table' | 'cell') => ({
  default: 'left' as const,
  parseHTML: (element: HTMLElement) => element.getAttribute('data-align') || 'left',
  renderHTML: (attributes: Record<string, unknown>) => ({ 'data-align': attributes['align'] }),
});

export const PrintTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      // data-align é estilizado via CSS (margin auto) para alinhar a tabela na página
      align: alignmentAttribute('table'),
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
});

export const PrintTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellPrintAttributes() };
  },
});

export const PrintTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellPrintAttributes() };
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
