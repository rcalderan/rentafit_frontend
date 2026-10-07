import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { RentalIntervalSettingsComponent } from './rental-interval-settings.component';
import { UiVariantSelectorComponent } from './ui-variant-selector.component';
import { MigrationComponent } from '../migration/migration.component';
import { AuthService } from '../../../auth/services/auth.service';
import { UserRole } from '../../../auth/data/user.model';

@Component({
  selector: 'rentafit-system',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UiVariantSelectorComponent,
    RouterModule,
    MigrationComponent,
    RentalIntervalSettingsComponent,
  ],
  templateUrl: './system.component.html',
  styleUrl: './system.component.css',
})
export class SystemComponent {
  private readonly authService = inject(AuthService);
  protected readonly UserRole = UserRole;

  get isAdmin(): boolean {
    return this.authService.hasRole(UserRole.ADMIN);
  }
}
