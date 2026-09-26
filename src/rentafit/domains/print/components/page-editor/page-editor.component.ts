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
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TableRow } from '@tiptap/extension-table-row';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';

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
import { DEFAULT_CUSTOM_TEMPLATE } from '../../data/default-templates';
import { PrintImage, PrintTable, PrintTableCell, PrintTableHeader } from '../../data/print-editor.extensions';
import { EditorToolbarComponent } from '../editor-toolbar/editor-toolbar.component';

@Component({
  selector: 'rentafit-page-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, EditorToolbarComponent],
  templateUrl: './page-editor.component.html',
  styleUrl: './page-editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageEditorComponent implements OnInit, OnDestroy {
  private readonly storageService = inject(PrintTemplateStorageService);
  private readonly interpolationService = inject(TemplateInterpolationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly editorContainer = viewChild<ElementRef<HTMLDivElement>>('editorContainer');

  protected readonly editor = signal<Editor | null>(null);
  protected readonly template = signal<PrintTemplate>({ ...DEFAULT_CUSTOM_TEMPLATE });
  protected readonly Math = Math;
  protected readonly isPreviewMode = signal<boolean>(false);
  protected readonly previewHtml = signal<string>('');
  protected readonly selectedCategory = signal<string>('todos');
  protected readonly variableSearch = signal<string>('');
  protected readonly zoomLevel = signal<number>(100);
  protected readonly leftTab = signal<'blocks' | 'variables'>('variables');
  protected readonly saveSuccessMsg = signal<string | null>(null);

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
      this.printPageStyleEl.textContent = `@page { ${size} margin: 0; }`;
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

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const existing = this.storageService.getById(id);
      if (existing) {
        this.template.set({ ...existing });
      }
    }

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
          PrintImage,
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

  protected togglePreview(): void {
    const willBePreview = !this.isPreviewMode();
    this.isPreviewMode.set(willBePreview);

    if (willBePreview) {
      const rawHtml = this.editor()?.getHTML() ?? this.template().contentHtml;
      const merged = this.interpolationService.interpolate(rawHtml);
      this.previewHtml.set(merged);
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
    this.editor()?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  protected insertContractItemsTable(): void {
    const ed = this.editor();
    if (!ed) return;
    const tableHtml = `
      <table class="print-table contract-items-table" style="width: 100%; border-collapse: collapse; font-size: 11px; margin: 8px 0; border: 1px solid #ccc;">
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
      <table class="print-table contract-payments-table" style="width: 100%; border-collapse: collapse; font-size: 11px; margin: 8px 0; border: 1px solid #ccc;">
        <thead>
          <tr style="background: #f2f2f2; font-weight: bold;">
            <th style="padding: 4px 6px; border: 1px solid #ccc;">Parcela</th>
            <th style="padding: 4px 6px; border: 1px solid #ccc;">Forma</th>
            <th style="padding: 4px 6px; border: 1px solid #ccc;">Vencimento</th>
            <th style="padding: 4px 6px; border: 1px solid #ccc; text-align: right;">Valor</th>
            <th style="padding: 4px 6px; border: 1px solid #ccc; text-align: center;">Carimbo / Visto</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 4px 6px; border: 1px solid #ccc;">1 / 2</td>
            <td style="padding: 4px 6px; border: 1px solid #ccc;">DINHEIRO / PIX</td>
            <td style="padding: 4px 6px; border: 1px solid #ccc;">{{contrato.dataEmissao}}</td>
            <td style="padding: 4px 6px; border: 1px solid #ccc; text-align: right;">R$ 350,00</td>
            <td style="padding: 4px 6px; border: 1px solid #ccc; text-align: center;">[QUITADO]</td>
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
      <div style="text-align: center; margin-top: 35px; margin-bottom: 20px;">
        <div>{{sistema.dataExtenso}}</div>
        <div style="margin-top: 40px; display: inline-block; width: 65%; border-top: 1px solid #222; padding-top: 6px;">
          <strong>{{cliente.nome}}</strong><br>
          CPF: {{cliente.documento}} (Locatário)
        </div>
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

  protected saveTemplate(): void {
    const html = this.editor()?.getHTML();
    if (html) {
      this.template.update((t) => ({ ...t, contentHtml: html }));
    }

    const saved = this.storageService.save(this.template());
    this.template.set(saved);

    this.saveSuccessMsg.set('Template salvo com sucesso!');
    setTimeout(() => this.saveSuccessMsg.set(null), 3000);
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
