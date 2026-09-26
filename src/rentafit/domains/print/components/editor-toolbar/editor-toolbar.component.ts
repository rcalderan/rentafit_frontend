import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Editor, findParentNode } from '@tiptap/core';

interface SelectOption {
  value: string;
  label: string;
}

const FONT_FAMILIES: SelectOption[] = [
  { value: '', label: 'Fonte padrão' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: "'Times New Roman', serif", label: 'Times New Roman' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: "'Courier New', monospace", label: 'Courier New' },
  { value: 'Inter, system-ui, sans-serif', label: 'Inter' },
];

const FONT_SIZES: SelectOption[] = [
  { value: '', label: 'Auto' },
  ...[6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40, 48].map(
    (pt): SelectOption => ({ value: `${pt}pt`, label: `${pt}` }),
  ),
];

const LINE_HEIGHTS: SelectOption[] = [
  { value: '', label: 'Auto' },
  { value: '1', label: '1.0' },
  { value: '1.15', label: '1.15' },
  { value: '1.5', label: '1.5' },
  { value: '2', label: '2.0' },
  { value: '2.5', label: '2.5' },
];

const TABLE_WIDTHS: SelectOption[] = [
  { value: '', label: 'Automática' },
  { value: '100%', label: '100% (página inteira)' },
  { value: '75%', label: '75%' },
  { value: '50%', label: '50%' },
  { value: '25%', label: '25%' },
];

const VERTICAL_ALIGNS: SelectOption[] = [
  { value: 'top', label: 'Topo' },
  { value: 'middle', label: 'Meio' },
  { value: 'bottom', label: 'Base' },
];

@Component({
  selector: 'rentafit-editor-toolbar',
  imports: [FormsModule],
  templateUrl: './editor-toolbar.component.html',
  styleUrl: './editor-toolbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorToolbarComponent {
  readonly editor = input.required<Editor>();

  // Bump em cada transação/seleção: sem isso o estado ativo dos botões
  // não re-renderiza, pois o Editor do Tiptap vive fora do Angular.
  protected readonly version = signal(0);

  protected readonly fontFamilies = FONT_FAMILIES;
  protected readonly fontSizes = FONT_SIZES;
  protected readonly lineHeights = LINE_HEIGHTS;
  protected readonly tableWidths = TABLE_WIDTHS;
  protected readonly verticalAligns = VERTICAL_ALIGNS;

  constructor() {
    effect((onCleanup) => {
      const ed = this.editor();
      const bump = (): void => this.version.update((v) => v + 1);
      ed.on('transaction', bump);
      ed.on('selectionUpdate', bump);
      onCleanup(() => {
        ed.off('transaction', bump);
        ed.off('selectionUpdate', bump);
      });
    });
  }

  // --- Leitura de estado (reavaliadas quando version() muda) ---

  protected isActive(attrs: Record<string, unknown>): boolean;
  protected isActive(name: string, attrs?: Record<string, unknown>): boolean;
  protected isActive(
    nameOrAttrs: string | Record<string, unknown>,
    attrs?: Record<string, unknown>,
  ): boolean {
    this.version();
    return typeof nameOrAttrs === 'string'
      ? this.editor().isActive(nameOrAttrs, attrs)
      : this.editor().isActive(nameOrAttrs);
  }

  protected attr(name: string, key: string): string {
    this.version();
    const value = this.editor().getAttributes(name)[key];
    return value == null ? '' : String(value);
  }

  // Lê atributo de um nó ancestral da seleção (table, tableCell, tableHeader).
  // getAttributes() não resolve ancestrais quando o cursor está dentro de célula.
  private ancestorAttr(names: string[], key: string): string {
    this.version();
    const sel = this.editor().state.selection;
    const found = findParentNode((node) => names.includes(node.type.name))(sel);
    const value = found?.node.attrs[key];
    return value == null ? '' : String(value);
  }

  protected inTable(): boolean {
    this.version();
    return this.editor().isActive('table');
  }

  protected inImage(): boolean {
    this.version();
    return this.editor().isActive('image');
  }

  protected blockType(): string {
    this.version();
    const ed = this.editor();
    if (ed.isActive('heading', { level: 1 })) return 'h1';
    if (ed.isActive('heading', { level: 2 })) return 'h2';
    if (ed.isActive('heading', { level: 3 })) return 'h3';
    if (ed.isActive('blockquote')) return 'blockquote';
    return 'p';
  }

  protected canUndo(): boolean {
    this.version();
    return this.editor().can().undo();
  }

  protected canRedo(): boolean {
    this.version();
    return this.editor().can().redo();
  }

  protected canMergeCells(): boolean {
    this.version();
    return this.editor().can().mergeCells();
  }

  protected textColor(): string {
    const color = this.attr('textStyle', 'color');
    return color || '#0f172a';
  }

  protected highlightColor(): string {
    const color = this.attr('highlight', 'color');
    return color || '#fef08a';
  }

  // --- Comandos de texto/bloco ---

  protected setBlockType(value: string): void {
    const chain = this.editor().chain().focus();
    if (value === 'blockquote') chain.toggleBlockquote().run();
    else if (value.startsWith('h')) chain.toggleHeading({ level: Number(value[1]) as 1 | 2 | 3 }).run();
    else chain.setParagraph().run();
  }

  protected setFontFamily(value: string): void {
    const chain = this.editor().chain().focus();
    if (value) chain.setFontFamily(value).run();
    else chain.unsetFontFamily().run();
  }

  protected setFontSize(value: string): void {
    const chain = this.editor().chain().focus();
    if (value) chain.setFontSize(value).run();
    else chain.unsetFontSize().run();
  }

  protected setLineHeight(value: string): void {
    const chain = this.editor().chain().focus();
    if (value) chain.setLineHeight(value).run();
    else chain.unsetLineHeight().run();
  }

  protected setTextColor(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.editor().chain().focus().setColor(value).run();
  }

  protected setHighlight(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.editor().chain().focus().setHighlight({ color: value }).run();
  }

  protected clearFormatting(): void {
    this.editor().chain().focus().unsetAllMarks().clearNodes().run();
  }

  // --- Comandos de tabela ---

  protected tableAlign(): string {
    return this.ancestorAttr(['table'], 'align') || 'left';
  }

  protected ancestorAttrValue(key: string): string {
    return this.ancestorAttr(['table'], key);
  }

  // updateAttributes() do core só enxerga nós entre from..to da seleção —
  // com o cursor dentro de uma célula o <table> é ancestral e não é alterado.
  private updateTableAttr(key: string, value: unknown): void {
    const { state, view } = this.editor();
    const parent = findParentNode((node) => node.type.name === 'table')(state.selection);
    if (!parent) return;
    const tr = state.tr.setNodeMarkup(parent.pos, undefined, {
      ...parent.node.attrs,
      [key]: value,
    });
    view.dispatch(tr.scrollIntoView());
  }

  protected setTableAlign(value: string): void {
    this.updateTableAttr('align', value);
  }

  protected setTableWidth(value: string): void {
    this.updateTableAttr('width', value || null);
  }

  protected setCellVerticalAlign(value: string): void {
    this.editor().chain().focus().setCellAttribute('verticalAlign', value).run();
  }

  protected setCellBackground(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.editor().chain().focus().setCellAttribute('backgroundColor', value).run();
  }

  protected clearCellBackground(): void {
    this.editor().chain().focus().setCellAttribute('backgroundColor', null).run();
  }

  protected cellBackground(): string {
    return this.ancestorAttr(['tableCell', 'tableHeader'], 'backgroundColor') || '#ffffff';
  }

  protected cellVerticalAlign(): string {
    return this.ancestorAttr(['tableCell', 'tableHeader'], 'verticalAlign') || 'top';
  }

  // --- Comandos de imagem ---

  protected setImageWidth(value: number | string): void {
    const pct = Math.min(100, Math.max(5, Number(value) || 100));
    this.editor().chain().focus().updateAttributes('image', { width: `${pct}%` }).run();
  }

  protected imageWidth(): number {
    const w = this.attr('image', 'width');
    return parseInt(w, 10) || 100;
  }
}
