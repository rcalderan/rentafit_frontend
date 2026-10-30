import { Injectable } from '@angular/core';
import { DEFAULT_UI_VARIANT, isUiVariant, UiVariant } from '../data/ui-variant.model';

const UI_VARIANT_STORAGE_KEY = 'rentafit.ui.variant.v1';
const SIDEBAR_VISIBLE_STORAGE_KEY = 'rentafit.ui.sidebarVisible.v1';

@Injectable({ providedIn: 'root' })
export class UiPreferenceStorage {
  read(): UiVariant {
    try {
      const storedVariant = localStorage.getItem(UI_VARIANT_STORAGE_KEY);
      return isUiVariant(storedVariant) ? storedVariant : DEFAULT_UI_VARIANT;
    } catch {
      return DEFAULT_UI_VARIANT;
    }
  }

  write(variant: UiVariant): void {
    try {
      localStorage.setItem(UI_VARIANT_STORAGE_KEY, variant);
    } catch {
      return;
    }
  }

  readSidebarVisible(): boolean {
    try {
      const stored = localStorage.getItem(SIDEBAR_VISIBLE_STORAGE_KEY);
      if (stored === 'false') return false;
      if (stored === 'true') return true;
      return true;
    } catch {
      return true;
    }
  }

  writeSidebarVisible(visible: boolean): void {
    try {
      localStorage.setItem(SIDEBAR_VISIBLE_STORAGE_KEY, String(visible));
    } catch {
      return;
    }
  }
}
