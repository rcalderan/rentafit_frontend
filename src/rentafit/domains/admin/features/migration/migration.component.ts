import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { MigrationComparison, MigrationSession } from './migration.model';
import { MigrationService } from './migration.service';

const STEP_PROGRESS: Record<string, number> = {
    created: 0,
    uploaded: 1,
    migrating: 1,
    validating: 2,
    valid: 3,
    promoting: 3,
    promoted: 4,
};

const TERMINAL_STATUSES = new Set(['valid', 'failed', 'promoted']);
const POLL_INTERVAL_MS = 2000;

interface StepDefinition {
    index: number;
    label: string;
}

@Component({
    selector: 'app-migration',
    imports: [],
    templateUrl: './migration.component.html',
    styleUrl: './migration.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MigrationComponent implements OnDestroy {
    protected readonly steps: StepDefinition[] = [
        { index: 0, label: 'Upload' },
        { index: 1, label: 'Migração' },
        { index: 2, label: 'Validação' },
        { index: 3, label: 'Promoção' },
    ];

    protected readonly session = signal<MigrationSession | null>(null);
    protected readonly comparison = signal<MigrationComparison | null>(null);
    protected readonly loading = signal(false);
    protected readonly failed = signal(false);
    protected readonly logs = signal<string[]>([]);
    protected readonly completedSteps = signal(0);

    protected readonly currentStep = computed(() => Math.min(this.completedSteps(), 3));
    protected readonly running = computed(() => {
        const status = this.session()?.status;
        return status === 'uploaded' || status === 'migrating' || status === 'validating' || status === 'promoting';
    });
    protected readonly statusLabel = computed(() => {
        const status = this.session()?.status;
        const labels: Record<string, string> = {
            created: 'Sessão criada',
            uploaded: 'Arquivo enviado, iniciando migração',
            migrating: 'Migrando dados para rentafit_dump',
            validating: 'Validando dados migrados',
            valid: 'Migração validada — pronta para promover',
            promoting: 'Promovendo rentafit_dump para rentafit',
            promoted: 'Banco promovido com sucesso',
            failed: 'Falha na migração',
        };
        return status ? (labels[status] ?? status) : 'Aguardando upload do dump BSON';
    });

    private readonly service = inject(MigrationService);
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private pollInFlight = false;

    ngOnDestroy(): void {
        this.stopPolling();
    }

    protected onDrop(event: DragEvent): void {
        event.preventDefault();
        const file = event.dataTransfer?.files?.[0];
        if (file) {
            this.uploadDump(file);
        }
    }

    protected onDragOver(event: DragEvent): void {
        event.preventDefault();
    }

    protected onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) {
            this.uploadDump(file);
        }
        input.value = '';
    }

    protected reset(): void {
        this.stopPolling();
        this.session.set(null);
        this.comparison.set(null);
        this.completedSteps.set(0);
        this.failed.set(false);
        this.logs.set([]);
    }

    protected promote(): void {
        const id = this.session()?.id;
        if (!id) return;
        if (!confirm('Promover rentafit_dump para rentafit? O banco atual será substituído (backup automático). Esta ação é irreversível.')) {
            return;
        }
        this.loading.set(true);
        this.service.promote(id).subscribe({
            next: result => {
                this.log(result.message ?? result.status);
                this.refreshSession(id);
            },
            error: e => { this.log(e); this.loading.set(false); },
        });
    }

    private uploadDump(file: File): void {
        if (!file.name.toLowerCase().endsWith('.bson')) {
            this.log(`Arquivo rejeitado: "${file.name}". Envie um único arquivo .bson`);
            return;
        }
        this.reset();
        this.loading.set(true);
        this.service.upload(file).subscribe({
            next: s => {
                this.applySession(s);
                this.loading.set(false);
                this.startPolling(s.id);
            },
            error: e => { this.log(e); this.loading.set(false); },
        });
    }

    private refreshSession(id: string): void {
        this.service.getSession(id).subscribe({
            next: s => { this.applySession(s); this.loading.set(false); },
            error: e => { this.log(e); this.loading.set(false); },
        });
    }

    private startPolling(sessionId: string): void {
        this.stopPolling();
        this.pollTimer = setInterval(() => {
            if (this.pollInFlight) return;
            this.pollInFlight = true;
            this.service.getSession(sessionId).subscribe({
                next: s => { this.pollInFlight = false; this.applySession(s); },
                error: e => { this.pollInFlight = false; this.log(e); this.stopPolling(); },
            });
        }, POLL_INTERVAL_MS);
    }

    private stopPolling(): void {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.pollInFlight = false;
    }

    private applySession(s: MigrationSession): void {
        this.session.set(s);
        const progress = STEP_PROGRESS[s.status];
        if (progress !== undefined && progress > this.completedSteps()) {
            this.completedSteps.set(progress);
        }
        if (s.status === 'failed') {
            this.failed.set(true);
        }
        if (TERMINAL_STATUSES.has(s.status)) {
            this.stopPolling();
            if (s.status === 'valid') {
                this.loadComparison();
            }
        }
    }

    private loadComparison(): void {
        this.service.compare().subscribe({
            next: c => this.comparison.set(c),
            error: e => this.log(e),
        });
    }

    private log(message: string | Error): void {
        const text = typeof message === 'string' ? message : message.message;
        this.logs.update(list => [...list, text]);
    }
}
