import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeHtml } from '@angular/platform-browser';

import { TemplateType } from '../../data/print-template.model';
import { PrintTemplateStorageService } from '../../services/print-template-storage.service';
import { PrintHtmlSanitizerService } from '../../services/print-html-sanitizer.service';
import { PrintSubcomponentStyleService } from '../../services/print-subcomponent-style.service';
import {
  InterpolationContext,
  TemplateInterpolationService,
} from '../../services/template-interpolation.service';

@Component({
  selector: 'rentafit-print-preview-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './print-preview-modal.component.html',
  styleUrl: './print-preview-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrintPreviewModalComponent implements AfterViewInit, OnDestroy {
  private readonly storageService = inject(PrintTemplateStorageService);
  private readonly interpolationService = inject(TemplateInterpolationService);
  private readonly printHtmlSanitizer = inject(PrintHtmlSanitizerService);
  private readonly subcomponentStyleService = inject(PrintSubcomponentStyleService);
  private readonly subcomponentStyleElement = document.createElement('style');
  private destroyed = false;

  templateId = input<string | null>(null);
  templateType = input<TemplateType | null>(null);
  customData = input<Partial<InterpolationContext> | null>(null);
  isOpen = input<boolean>(true);
  aboveSystemMenu = input<boolean>(false);
  printImmediately = input<boolean>(false);

  close = output<void>();

  constructor() {
    void this.storageService.initialize();
    effect(() => {
      const template = this.resolvedTemplate();
      if (!this.isOpen() || !template) {
        this.subcomponentStyleElement.remove();
        return;
      }
      const scope = this.subcomponentStyleService.scopeToken(template.id);
      const isLandscape = template.orientation === 'LANDSCAPE' && template.pageHeightMm !== null;
      const width = isLandscape ? template.pageHeightMm! : template.pageWidthMm;
      const height = isLandscape ? template.pageWidthMm : template.pageHeightMm;
      const size = height ? `${width}mm ${height}mm` : `${width}mm auto`;
      const componentStyles = this.subcomponentStyleService.compile(template.cssStyles, scope);
      this.subcomponentStyleElement.textContent = `@page { size: ${size}; margin: 0; }\n${componentStyles}`;
      if (!this.subcomponentStyleElement.isConnected) {
        document.head.append(this.subcomponentStyleElement);
      }
    });
  }

  ngAfterViewInit(): void {
    if (!this.isOpen() || !this.printImmediately()) return;
    void this.printAfterTemplateReady();
  }

  private async printAfterTemplateReady(): Promise<void> {
    await this.storageService.initialize();
    if (this.destroyed || !this.isOpen() || !this.resolvedTemplate()) return;
    window.print();
    this.close.emit();
  }

  protected readonly resolvedTemplate = computed(() => {
    const id = this.templateId();
    if (id) {
      return this.storageService.getById(id);
    }
    const type = this.templateType();
    if (type) {
      return this.storageService.getDefaultByType(type);
    }
    return undefined;
  });

  protected readonly renderedHtml = computed<SafeHtml | string>(() => {
    const t = this.resolvedTemplate();
    if (!t) return this.printHtmlSanitizer.sanitize('<p>Template não encontrado.</p>');
    const data = this.customData() || undefined;
    const html = this.interpolationService.interpolate(t.contentHtml, data);
    return this.printHtmlSanitizer.sanitize(html);
  });

  protected readonly styleScope = computed(() => {
    const template = this.resolvedTemplate();
    return template ? this.subcomponentStyleService.scopeToken(template.id) : 'print-missing';
  });

  ngOnDestroy(): void {
    this.destroyed = true;
    this.subcomponentStyleElement.remove();
  }

  protected readonly paperStyle = computed(() => {
    const t = this.resolvedTemplate();
    if (!t) return {};

    const isLandscape = t.orientation === 'LANDSCAPE';
    let width = t.pageWidthMm;
    let height = t.pageHeightMm;

    if (isLandscape && height) {
      width = t.pageHeightMm!;
      height = t.pageWidthMm;
    }

    // padding visual = margem da página + offset físico da impressora,
    // o mesmo cálculo da folha do editor
    const offset = t.printOffsetMm ?? 0;
    return {
      width: `${width}mm`,
      minHeight: height ? `${height}mm` : '150mm',
      fontFamily: t.templateType === 'RENTAL_CONTRACT' ? 'Arial, sans-serif' : null,
      fontSize: t.templateType === 'RENTAL_CONTRACT' ? '9pt' : null,
      lineHeight: t.templateType === 'RENTAL_CONTRACT' ? '1.12' : null,
      paddingTop: `${t.marginTopMm + offset}mm`,
      paddingBottom: `${t.marginBottomMm + offset}mm`,
      paddingLeft: `${t.marginLeftMm + offset}mm`,
      paddingRight: `${t.marginRightMm + offset}mm`,
    };
  });

  protected print(): void {
    window.print();
  }
}
