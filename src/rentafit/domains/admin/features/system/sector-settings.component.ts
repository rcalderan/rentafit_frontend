import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../auth/services/auth.service';
import { UserRole } from '../../../auth/data/user.model';
import { IssuerSetupService } from '../../../auth/services/issuer-setup.service';
import { Sector } from '../../../sector/data/sector.model';
import { SectorService } from '../../../sector/service/sector.service';
import { TerminalSectorService } from '../../../sector/service/terminal-sector.service';

interface EstablishmentOption {
  cnpj: string;
  label: string;
}

/**
 * Configuração de setores: CRUD por estabelecimento (MANAGER/ADMIN) e vínculo
 * do terminal local a um setor (qualquer perfil — a escolha fica na máquina).
 */
@Component({
  selector: 'rentafit-sector-settings',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sector-settings.component.html',
  styleUrl: './sector-settings.component.css',
})
export class SectorSettingsComponent implements OnInit {
  private readonly sectorService = inject(SectorService);
  private readonly issuerSetup = inject(IssuerSetupService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly terminalSector = inject(TerminalSectorService);

  protected readonly sectors = signal<Sector[]>([]);
  protected readonly establishments = signal<EstablishmentOption[]>([]);
  protected readonly busy = signal(false);
  protected readonly feedback = signal('');
  protected readonly editingId = signal<string | null>(null);
  protected readonly canManage = this.auth.hasAnyRole([UserRole.ADMIN, UserRole.MANAGER]);

  /** Select do setor deste terminal — '' significa "não configurado". */
  protected readonly terminalSelect = new FormControl<string>('', { nonNullable: true });

  protected readonly createForm = new FormGroup({
    issuerCnpj: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{14}$/)],
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    code: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(20),
        Validators.pattern(/^[A-Za-z0-9_\-]+$/),
      ],
    }),
    isDefault: new FormControl(false, { nonNullable: true }),
  });

  protected readonly editForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    code: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(20),
        Validators.pattern(/^[A-Za-z0-9_\-]+$/),
      ],
    }),
  });

  ngOnInit(): void {
    this.loadEstablishments();
    this.loadSectors();
  }

  private loadEstablishments(): void {
    forkJoin({
      matriz: this.issuerSetup.getCurrentIssuer(),
      branches: this.issuerSetup.listBranches(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ matriz, branches }) => {
          const options: EstablishmentOption[] = [];
          if (matriz) {
            options.push({ cnpj: matriz.cnpj, label: this.issuerLabel(matriz, true) });
          }
          for (const b of branches ?? []) {
            options.push({ cnpj: b.cnpj, label: this.issuerLabel(b, false) });
          }
          this.establishments.set(options);
          if (options.length === 1) {
            this.createForm.controls.issuerCnpj.setValue(options[0].cnpj);
          }
        },
        error: () => this.establishments.set([]),
      });
  }

  protected loadSectors(): void {
    this.busy.set(true);
    this.sectorService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.sectors.set(list);
          this.busy.set(false);
          const resolved = this.terminalSector.resolveFrom(list);
          this.terminalSelect.setValue(resolved?.id ?? '', { emitEvent: false });
        },
        error: (err: Error) => {
          this.busy.set(false);
          this.feedback.set(err.message);
        },
      });
  }

  /** Persiste o vínculo deste terminal com o setor escolhido ('' limpa). */
  protected assignTerminal(): void {
    const id = this.terminalSelect.value;
    const found = this.sectors().find((s) => s.id === id) ?? null;
    if (found) {
      this.terminalSector.assign(found);
      this.feedback.set(`Terminal vinculado ao setor "${found.name}".`);
      return;
    }
    this.terminalSector.clear();
    this.feedback.set('Terminal sem setor: operações de caixa ficarão bloqueadas.');
  }

  protected create(): void {
    if (!this.canManage || this.createForm.invalid || this.busy()) return;
    this.busy.set(true);
    this.feedback.set('');
    const value = this.createForm.getRawValue();
    const branch = this.establishments().find((e) => e.cnpj === value.issuerCnpj);
    this.sectorService
      .create({
        issuerCnpj: value.issuerCnpj,
        branchName: branch?.label ?? null,
        name: value.name.trim(),
        code: value.code.trim().toUpperCase(),
        isDefault: value.isDefault,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.feedback.set('Setor criado.');
          this.createForm.reset({
            issuerCnpj: this.establishments().length === 1 ? this.establishments()[0].cnpj : '',
            name: '',
            code: '',
            isDefault: false,
          });
          this.loadSectors();
        },
        error: (err: Error) => {
          this.busy.set(false);
          this.feedback.set(err.message);
        },
      });
  }

  protected startEdit(sector: Sector): void {
    this.editingId.set(sector.id);
    this.editForm.setValue({ name: sector.name, code: sector.code });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
  }

  protected saveEdit(sector: Sector): void {
    if (this.editForm.invalid || this.busy()) return;
    this.busy.set(true);
    this.sectorService
      .update(sector.id, {
        name: this.editForm.controls.name.value.trim(),
        code: this.editForm.controls.code.value.trim().toUpperCase(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.editingId.set(null);
          this.feedback.set('Setor atualizado.');
          this.loadSectors();
        },
        error: (err: Error) => {
          this.busy.set(false);
          this.feedback.set(err.message);
        },
      });
  }

  protected toggleActive(sector: Sector): void {
    if (!this.canManage || this.busy()) return;
    this.busy.set(true);
    this.sectorService
      .update(sector.id, { active: !sector.active })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.loadSectors();
        },
        error: (err: Error) => {
          this.busy.set(false);
          this.feedback.set(err.message);
        },
      });
  }

  protected markDefault(sector: Sector): void {
    if (!this.canManage || sector.isDefault || this.busy()) return;
    this.busy.set(true);
    this.sectorService
      .setDefault(sector.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.loadSectors();
        },
        error: (err: Error) => {
          this.busy.set(false);
          this.feedback.set(err.message);
        },
      });
  }

  protected establishmentLabel(cnpj: string): string {
    return this.establishments().find((e) => e.cnpj === cnpj)?.label ?? cnpj;
  }

  private issuerLabel(info: { nomeFantasia?: string; razaoSocial: string; cnpj: string }, matriz: boolean): string {
    const base = info.nomeFantasia?.trim() || info.razaoSocial;
    return `${base} — ${this.formatCnpj(info.cnpj)}${matriz ? ' (Matriz)' : ''}`;
  }

  private formatCnpj(cnpj: string): string {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) return cnpj;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
}
