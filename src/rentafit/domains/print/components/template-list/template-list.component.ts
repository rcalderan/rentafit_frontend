import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { PrintTemplate, TemplateType } from '../../data/print-template.model';
import { PrintTemplateStorageService } from '../../services/print-template-storage.service';
import { PrintPreviewModalComponent } from '../print-preview-modal/print-preview-modal.component';

@Component({
  selector: 'rentafit-template-list',
  standalone: true,
  imports: [CommonModule, PrintPreviewModalComponent],
  templateUrl: './template-list.component.html',
  styleUrl: './template-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateListComponent {
  private readonly storageService = inject(PrintTemplateStorageService);
  private readonly router = inject(Router);

  protected readonly templates = this.storageService.templates;
  protected readonly persistenceMode = this.storageService.persistenceMode;
  protected readonly previewTemplateId = signal<string | null>(null);
  protected readonly showPreviewModal = signal<boolean>(false);

  constructor() {
    void this.storageService.initialize();
  }

  protected createNewTemplate(): void {
    this.router.navigate(['/admin/print-templates/new']);
  }

  protected editTemplate(id: string): void {
    this.router.navigate(['/admin/print-templates/editor', id]);
  }

  protected async duplicateTemplate(id: string): Promise<void> {
    const copy = await this.storageService.duplicateAndSync(id);
    if (copy) this.editTemplate(copy.id);
  }

  protected deleteTemplate(t: PrintTemplate): void {
    if (confirm(`Deseja realmente remover o template "${t.name}"?`)) {
      void this.storageService.deleteAndSync(t.id);
    }
  }

  protected previewTemplate(id: string): void {
    this.previewTemplateId.set(id);
    this.showPreviewModal.set(true);
  }

  protected closePreview(): void {
    this.showPreviewModal.set(false);
    this.previewTemplateId.set(null);
  }

  protected resetDefaults(): void {
    if (confirm('Restaurar todos os templates para as versões de fábrica? Modificações locais serão substituídas.')) {
      void this.storageService.resetToDefaultsAndSync();
    }
  }

  protected getFormatBadgeClass(format: string): string {
    switch (format) {
      case 'A4':
        return 'badge-a4';
      case 'THERMAL_80MM':
        return 'badge-80mm';
      case 'THERMAL_58MM':
        return 'badge-58mm';
      default:
        return 'badge-custom';
    }
  }

  protected getFormatLabel(format: string): string {
    switch (format) {
      case 'A4':
        return 'Folha A4';
      case 'THERMAL_80MM':
        return 'Térmica 80 mm';
      case 'THERMAL_58MM':
        return 'Térmica 58 mm';
      default:
        return 'Personalizado';
    }
  }

  protected getTypeLabel(type: TemplateType): string {
    switch (type) {
      case 'RENTAL_CONTRACT':
        return 'Contrato de Locação';
      case 'RENTAL_CANCELLATION':
        return 'Termo de Desistência';
      case 'FISCAL_RECEIPT_80MM':
        return 'Cupom Fiscal 80mm';
      case 'FISCAL_RECEIPT_58MM':
        return 'Cupom Fiscal 58mm';
      default:
        return 'Customizado';
    }
  }
}
