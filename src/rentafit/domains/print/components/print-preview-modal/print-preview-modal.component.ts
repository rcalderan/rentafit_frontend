import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { TemplateType } from '../../data/print-template.model';
import { PrintTemplateStorageService } from '../../services/print-template-storage.service';
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
export class PrintPreviewModalComponent {
  private readonly storageService = inject(PrintTemplateStorageService);
  private readonly interpolationService = inject(TemplateInterpolationService);

  templateId = input<string | null>(null);
  templateType = input<TemplateType | null>(null);
  customData = input<Partial<InterpolationContext> | null>(null);
  isOpen = input<boolean>(true);

  close = output<void>();

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

  protected readonly renderedHtml = computed(() => {
    const t = this.resolvedTemplate();
    if (!t) return '<p>Template não encontrado.</p>';
    const data = this.customData() || undefined;
    return this.interpolationService.interpolate(t.contentHtml, data);
  });

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
