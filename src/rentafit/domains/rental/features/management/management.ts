import { Component, signal } from '@angular/core';
import { PrintPreviewModalComponent } from '../../../print/components/print-preview-modal/print-preview-modal.component';

@Component({
  selector: 'rentafit-management',
  imports: [PrintPreviewModalComponent],
  templateUrl: './management.html',
  styleUrl: './management.css',
})
export class Management {
  protected readonly showPrintModal = signal<boolean>(false);

  protected openPrintModal(): void {
    this.showPrintModal.set(true);
  }

  protected closePrintModal(): void {
    this.showPrintModal.set(false);
  }
}
