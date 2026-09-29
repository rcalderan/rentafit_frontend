import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Editor, findParentNode } from '@tiptap/core';
import { SafeHtml } from '@angular/platform-browser';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TableRow } from '@tiptap/extension-table-row';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { Focus } from '@tiptap/extensions';

import {
  PAGE_FORMAT_PRESETS,
  PageFormat,
  PageOrientation,
  PrintTemplate,
  TemplateType,
  VariableDefinition,
} from '../../data/print-template.model';
import { TEMPLATE_VARIABLES, VARIABLE_CATEGORIES } from '../../data/template-variables';
import { PrintTemplateStorageService } from '../../services/print-template-storage.service';
import { TemplateInterpolationService } from '../../services/template-interpolation.service';
import { PrintHtmlSanitizerService } from '../../services/print-html-sanitizer.service';
import { DEFAULT_CUSTOM_TEMPLATE } from '../../data/default-templates';
import {
  PrintBlockSpacing,
  PrintImage,
  PrintSignatureBlock,
  PrintTable,
  PrintTableCell,
  PrintTableHeader,
} from '../../data/print-editor.extensions';
import {
  PrintSubcomponentStyle,
  PrintSubcomponentType,
} from '../../data/print-subcomponent-style.model';
import { PrintSubcomponentStyleService } from '../../services/print-subcomponent-style.service';
import { EditorToolbarComponent } from '../editor-toolbar/editor-toolbar.component';
import { SubcomponentStyleModalComponent } from '../subcomponent-style-modal/subcomponent-style-modal.component';

@Component({
  selector: 'rentafit-page-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, EditorToolbarComponent, SubcomponentStyleModalComponent],
  templateUrl: './page-editor.component.html',
  styleUrl: './page-editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageEditorComponent implements OnInit, OnDestroy {
  private readonly storageService = inject(PrintTemplateStorageService);
  private readonly interpolationService = inject(TemplateInterpolationService);
  private readonly printHtmlSanitizer = inject(PrintHtmlSanitizerService);
  private readonly subcomponentStyleService = inject(PrintSubcomponentStyleService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly editorContainer = viewChild<ElementRef<HTMLDivElement>>('editorContainer');

  protected readonly editor = signal<Editor | null>(null);
  protected readonly template = signal<PrintTemplate>({ ...DEFAULT_CUSTOM_TEMPLATE });
  protected readonly Math = Math;
  protected readonly isPreviewMode = signal<boolean>(false);
  protected readonly previewHtml = signal<SafeHtml | string>('');
  protected readonly selectedCategory = signal<string>('todos');
  protected readonly variableSearch = signal<string>('');
  protected readonly zoomLevel = signal<number>(100);
  protected readonly leftTab = signal<'blocks' | 'variables'>('variables');
  protected readonly saveSuccessMsg = signal<string | null>(null);
  protected readonly activeSubcomponentStyle = signal<PrintSubcomponentType | null>(null);

  protected readonly activeSubcomponentStyleConfig = computed(() => {
    const type = this.activeSubcomponentStyle();
    return type ? this.subcomponentStyleService.read(this.template().cssStyles)[type] : null;
  });
  protected readonly subcomponentStyleScope = computed(() =>
    this.subcomponentStyleService.scopeToken(this.template().id),
  );
  protected readonly subcomponentCss = computed(() =>
    this.subcomponentStyleService.compile(this.template().cssStyles, this.subcomponentStyleScope()),
  );

  protected readonly categories = VARIABLE_CATEGORIES;
  protected readonly formatPresets = PAGE_FORMAT_PRESETS;

  protected readonly filteredVariables = computed(() => {
    const cat = this.selectedCategory();
    const search = this.variableSearch().toLowerCase().trim();
    return TEMPLATE_VARIABLES.filter((v) => {
      const matchCat = cat === 'todos' || v.category === cat;
      const matchSearch =
        !search ||
        v.label.toLowerCase().includes(search) ||
        v.tag.toLowerCase().includes(search) ||
        v.sampleValue.toLowerCase().includes(search);
      return matchCat && matchSearch;
    });
  });

  protected readonly sheetWidthMm = computed(() => {
    const t = this.template();
    return t.orientation === 'LANDSCAPE' && t.pageHeightMm ? t.pageHeightMm : t.pageWidthMm;
  });

  protected readonly sheetHeightMm = computed(() => {
    const t = this.template();
    return t.orientation === 'LANDSCAPE' && t.pageHeightMm ? t.pageWidthMm : t.pageHeightMm;
  });

  protected readonly offsetMm = computed(() => this.template().printOffsetMm ?? 0);

  protected readonly sheetStyle = computed(() => {
    const t = this.template();
    const offset = this.offsetMm();
    const height = this.sheetHeightMm();

    return {
      width: `${this.sheetWidthMm()}mm`,
      minHeight: height ? `${height}mm` : '160mm',
      fontFamily: t.templateType === 'RENTAL_CONTRACT' ? 'Arial, sans-serif' : null,
      fontSize: t.templateType === 'RENTAL_CONTRACT' ? '9pt' : null,
      lineHeight: t.templateType === 'RENTAL_CONTRACT' ? '1.12' : null,
      // Offset = zona física morta da impressora; margem = área reservada do layout.
      // Ambos viram padding para que preview e impressão batam 1:1 (@page margin 0).
      paddingTop: `${offset + t.marginTopMm}mm`,
      paddingBottom: `${offset + t.marginBottomMm}mm`,
      paddingLeft: `${offset + t.marginLeftMm}mm`,
      paddingRight: `${offset + t.marginRightMm}mm`,
    };
  });

  protected readonly frameStyle = computed(() => ({
    transform: `scale(${this.zoomLevel() / 100})`,
    transformOrigin: 'top center',
  }));

  protected readonly rulerTicksX = computed(() => this.buildTicks(this.sheetWidthMm()));
  protected readonly rulerTicksY = computed(() => this.buildTicks(this.sheetHeightMm() ?? 160));

  // @page dinâmico: anula a margem padrão do browser (~10mm) que deslocava
  // o conteúdo na impressão sem aparecer no preview. O offset físico da
  // impressora é compensado no padding da folha.
  private readonly printPageStyleEl = document.createElement('style');

  constructor() {
    effect(() => {
      const width = this.sheetWidthMm();
      const height = this.sheetHeightMm();
      const size = height ? `size: ${width}mm ${height}mm;` : `size: ${width}mm auto;`;
      const components = this.subcomponentCss();
      this.printPageStyleEl.textContent = `@page { ${size} margin: 0; }\n${components}`;
    });
  }

  private buildTicks(lengthMm: number): number[] {
    const ticks: number[] = [];
    for (let mm = 0; mm <= Math.floor(lengthMm); mm += 10) {
      ticks.push(mm);
    }
    return ticks;
  }

  protected updateTemplate(patch: Partial<PrintTemplate>): void {
    this.template.update((t) => ({ ...t, ...patch }));
  }

  ngOnInit(): void {
    document.head.appendChild(this.printPageStyleEl);
    void this.initializeTemplate();
  }

  private async initializeTemplate(): Promise<void> {
    await this.storageService.initialize();
    const id = this.route.snapshot.paramMap.get('id');
    const existing = id ? this.storageService.getById(id) : undefined;
    if (existing) this.template.set({ ...existing });
    setTimeout(() => this.initTiptap(), 0);
  }

  ngOnDestroy(): void {
    this.editor()?.destroy();
    this.editor.set(null);
    this.printPageStyleEl.remove();
  }

  private initTiptap(): void {
    const el = this.editorContainer()?.nativeElement;
    if (!el) return;

    this.editor.set(
      new Editor({
        element: el,
        extensions: [
          StarterKit.configure({
            heading: { levels: [1, 2, 3] },
          }),
          TextStyleKit,
          Highlight.configure({ multicolor: true }),
          TextAlign.configure({
            types: ['heading', 'paragraph'],
          }),
          PrintTable.configure({
            resizable: true,
          }),
          TableRow,
          PrintTableHeader,
          PrintTableCell,
          PrintBlockSpacing,
          PrintSignatureBlock,
          PrintImage,
          // marca o nó em foco com .has-focus (feedback visual do elemento ativo)
          Focus.configure({ className: 'has-focus', mode: 'deepest' }),
          Placeholder.configure({
            placeholder: 'Comece a digitar o documento ou adicione blocos e variáveis...',
          }),
        ],
        content: this.template().contentHtml || '',
        onUpdate: ({ editor }) => {
          const html = editor.getHTML();
          this.template.update((t) => ({ ...t, contentHtml: html }));
        },
      }),
    );
  }

  protected setPageFormat(format: PageFormat): void {
    const preset = PAGE_FORMAT_PRESETS[format];
    this.template.update((t) => ({
      ...t,
      pageFormat: format,
      pageWidthMm: preset.widthMm,
      pageHeightMm: preset.heightMm,
      marginTopMm: preset.defaultMargins.top,
      marginBottomMm: preset.defaultMargins.bottom,
      marginLeftMm: preset.defaultMargins.left,
      marginRightMm: preset.defaultMargins.right,
      printOffsetMm: preset.defaultOffsetMm,
    }));
  }

  protected setOrientation(orientation: PageOrientation): void {
    this.template.update((t) => ({ ...t, orientation }));
  }

  protected openSubcomponentStyle(type: PrintSubcomponentType): void {
    this.activeSubcomponentStyle.set(type);
  }

  protected saveSubcomponentStyle(style: PrintSubcomponentStyle): void {
    const type = this.activeSubcomponentStyle();
    if (!type) return;
    const styles = this.subcomponentStyleService.read(this.template().cssStyles);
    styles[type] = style;
    this.updateTemplate({ cssStyles: this.subcomponentStyleService.write(styles) });
    this.activeSubcomponentStyle.set(null);
  }

  protected togglePreview(): void {
    const willBePreview = !this.isPreviewMode();
    this.isPreviewMode.set(willBePreview);

    if (willBePreview) {
      const rawHtml = this.editor()?.getHTML() ?? this.template().contentHtml;
      const merged = this.interpolationService.interpolate(rawHtml);
      this.previewHtml.set(this.printHtmlSanitizer.sanitize(merged));
    }
  }

  protected insertTag(v: VariableDefinition): void {
    this.editor()?.chain().focus().insertContent(` ${v.tag} `).run();
  }

  protected insertText(type: 'p' | 'h1' | 'h2' | 'h3'): void {
    const ed = this.editor();
    if (!ed) return;
    if (type === 'h1') ed.chain().focus().toggleHeading({ level: 1 }).run();
    else if (type === 'h2') ed.chain().focus().toggleHeading({ level: 2 }).run();
    else if (type === 'h3') ed.chain().focus().toggleHeading({ level: 3 }).run();
    else ed.chain().focus().setParagraph().run();
  }

  protected insertDivider(): void {
    this.editor()?.chain().focus().setHorizontalRule().run();
  }

  protected insertSimpleTable(): void {
    const ed = this.editor();
    if (!ed) return;
    ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run();
    const { state, view } = ed;
    const table = findParentNode((node) => node.type.name === 'table')(state.selection);
    if (!table) return;
    view.dispatch(state.tr.setNodeMarkup(table.pos, undefined, {
      ...table.node.attrs,
      printComponent: 'common-table',
    }));
  }

  protected insertContractItemsTable(): void {
    const ed = this.editor();
    if (!ed) return;
    const tableHtml = `
      <table class="print-table contract-items-table" data-print-component="contract-items" style="width: 100%;">
        <thead>
          <tr style="background: #f2f2f2; font-weight: bold;">
            <th style="padding: 4px 6px; border: 1px solid #ccc; width: 15%;">Código</th>
            <th style="padding: 4px 6px; border: 1px solid #ccc; width: 65%;">Descrição / Detalhes</th>
            <th style="padding: 4px 6px; border: 1px solid #ccc; width: 20%; text-align: right;">Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 4px 6px; border: 1px solid #ccc;">1044</td>
            <td style="padding: 4px 6px; border: 1px solid #ccc;">IMPERIAL 50, C44, BARRA CALÇA 11 CM</td>
            <td style="padding: 4px 6px; border: 1px solid #ccc; text-align: right;">R$ 350,00</td>
          </tr>
        </tbody>
        <tfoot>
          <tr style="background: #fafafa; font-weight: bold;">
            <td colspan="2" style="padding: 4px 6px; border: 1px solid #ccc; text-align: right;">TOTAL:</td>
            <td style="padding: 4px 6px; border: 1px solid #ccc; text-align: right;">{{contrato.valorTotal}}</td>
          </tr>
        </tfoot>
      </table>
    `;
    ed.chain().focus().insertContent(tableHtml).run();
  }

  protected insertPaymentsTable(): void {
    const ed = this.editor();
    if (!ed) return;
    const tableHtml = `
      <p style="margin: 10px 0 2px; text-align: center; font-size: 9pt; font-weight: bold;">PAGAMENTO</p>
      <table class="print-table contract-payments-table" data-print-component="contract-payments" style="width: 100%;">
        <thead>
          <tr><th>Pagamento</th><th>Data</th><th>Situação</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Entrada: R$ 300,00</td>
            <td>14/09/2026</td>
            <td>PAGO</td>
          </tr>
          <tr>
            <td>Parcela 1: R$ 150,00</td>
            <td>21/09/2026</td>
            <td>PAGO</td>
          </tr>
        </tbody>
      </table>
    `;
    ed.chain().focus().insertContent(tableHtml).run();
  }

  protected insertSignatureBlock(): void {
    const ed = this.editor();
    if (!ed) return;
    const signatureHtml = `
      <div data-print-component="signature">
        <p>{{sistema.dataExtenso}}</p>
        <p><strong>{{cliente.nome}}</strong><br>CPF: {{cliente.documento}} (Locatário)</p>
      </div>
    `;
    ed.chain().focus().insertContent(signatureHtml).run();
  }

  protected insertQrCodeBlock(): void {
    const ed = this.editor();
    if (!ed) return;
    const qrHtml = `
      <div style="text-align: center; margin: 12px 0;" data-qrcode-container="true">
        <div style="font-size: 10px; margin-bottom: 4px;">Consulta via QR Code SEFAZ:</div>
        <div style="display: inline-block; padding: 4px; border: 1px solid #ccc; background: #fff;">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <rect width="100" height="100" fill="#fff" />
            <rect x="10" y="10" width="30" height="30" fill="#000" />
            <rect x="15" y="15" width="20" height="20" fill="#fff" />
            <rect x="20" y="20" width="10" height="10" fill="#000" />
            <rect x="60" y="10" width="30" height="30" fill="#000" />
            <rect x="65" y="15" width="20" height="20" fill="#fff" />
            <rect x="70" y="20" width="10" height="10" fill="#000" />
            <rect x="10" y="60" width="30" height="30" fill="#000" />
            <rect x="15" y="65" width="20" height="20" fill="#fff" />
            <rect x="20" y="70" width="10" height="10" fill="#000" />
            <rect x="45" y="45" width="12" height="12" fill="#000" />
            <rect x="65" y="65" width="25" height="25" fill="#000" />
          </svg>
        </div>
        <div style="font-size: 9px; color: #555; margin-top: 2px;">{{nfce.urlConsulta}}</div>
      </div>
    `;
    ed.chain().focus().insertContent(qrHtml).run();
  }

  protected async saveTemplate(): Promise<void> {
    const html = this.editor()?.getHTML();
    if (html) this.template.update((t) => ({ ...t, contentHtml: html }));

    const saved = await this.storageService.saveAndSync(this.template());
    this.template.set(saved);
    this.saveSuccessMsg.set(
      this.storageService.persistenceMode() === 'backend'
        ? 'Template salvo no servidor.'
        : 'API indisponível: template salvo localmente neste navegador.',
    );
    setTimeout(() => this.saveSuccessMsg.set(null), 4000);
  }

  protected printDocument(): void {
    if (!this.isPreviewMode()) {
      this.togglePreview();
    }
    setTimeout(() => window.print(), 150);
  }

  protected goBack(): void {
    this.router.navigate(['/admin/print-templates']);
  }
}
