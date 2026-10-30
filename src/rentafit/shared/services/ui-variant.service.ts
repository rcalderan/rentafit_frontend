import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../domains/auth/services/auth.service';
import { isUiVariant, UiVariant } from '../data/ui-variant.model';
import { UiPreferenceStorage } from './ui-preference-storage';

@Injectable({ providedIn: 'root' })
export class UiVariantService {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(UiPreferenceStorage);
  private readonly authService = inject(AuthService, { optional: true });
  private readonly preferredVariantState = signal<UiVariant>(this.storage.read());
  private readonly mobileState = signal(false);

  readonly preferredVariant = this.preferredVariantState.asReadonly();
  readonly isMobile = this.mobileState.asReadonly();
  readonly activeVariant = computed<UiVariant>(() =>
    this.mobileState() ? 'simplified' : this.preferredVariantState(),
  );

  constructor() {
    this.applyVariant(this.activeVariant());
    this.breakpointObserver
      .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        this.mobileState.set(result.matches);
        this.applyVariant(this.activeVariant());
      });
    this.authService?.currentUser$
      ?.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(user => {
        if (user && isUiVariant(user.uiVariant)) {
          this.preferredVariantState.set(user.uiVariant);
          this.storage.write(user.uiVariant);
          this.applyVariant(this.activeVariant());
        }
      });
  }

  selectVariant(variant: UiVariant): void {
    this.preferredVariantState.set(variant);
    this.storage.write(variant);
    this.applyVariant(this.activeVariant());
    if (this.authService?.getCurrentUser?.()) {
      this.authService
        .updatePreferences?.({ uiVariant: variant })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ error: () => undefined });
    }
  }

  private applyVariant(variant: UiVariant): void {
    this.document.documentElement.dataset['ui'] = variant;
  }
}
