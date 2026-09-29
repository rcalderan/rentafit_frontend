import { ChangeDetectionStrategy, Component, OnInit, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DEFAULT_PRINT_SUBCOMPONENT_STYLES,
  PRINT_COMPONENT_FONT_FAMILIES,
  PRINT_SUBCOMPONENTS,
  PrintSubcomponentStyle,
  PrintSubcomponentType,
} from '../../data/print-subcomponent-style.model';

@Component({
  selector: 'rentafit-subcomponent-style-modal',
  imports: [FormsModule],
  templateUrl: './subcomponent-style-modal.component.html',
  styleUrl: './subcomponent-style-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubcomponentStyleModalComponent implements OnInit {
  readonly componentType = input.required<PrintSubcomponentType>();
  readonly initialStyle = input.required<PrintSubcomponentStyle>();
  readonly cancel = output<void>();
  readonly save = output<PrintSubcomponentStyle>();

  protected readonly fontFamilies = PRINT_COMPONENT_FONT_FAMILIES;
  protected readonly componentNames = PRINT_SUBCOMPONENTS;
  protected readonly style = signal<PrintSubcomponentStyle>({
    ...DEFAULT_PRINT_SUBCOMPONENT_STYLES['common-table'],
  });

  ngOnInit(): void {
    this.style.set({ ...this.initialStyle() });
  }

  protected update<K extends keyof PrintSubcomponentStyle>(
    key: K,
    value: PrintSubcomponentStyle[K],
  ): void {
    this.style.update((current) => ({ ...current, [key]: value }));
  }

  protected updateNumber(
    key: 'fontSizePt' | 'borderWidthPx' | 'cellPaddingPx' | 'signatureLineWidthPercent',
    value: number | string,
  ): void {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) this.update(key, numberValue);
  }

  protected setBackgroundTransparent(transparent: boolean): void {
    this.update('backgroundColor', transparent ? 'transparent' : '#ffffff');
  }

  protected setHeaderBackgroundTransparent(transparent: boolean): void {
    this.update('headerBackgroundColor', transparent ? 'transparent' : '#eeeeee');
  }

  protected apply(): void {
    this.save.emit({ ...this.style() });
  }
}
