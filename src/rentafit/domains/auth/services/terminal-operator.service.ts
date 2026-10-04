import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, of, interval } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SettingsService } from '../../admin/service/settings.service';
import { AuthService, StoredSession, StoredOperatorSession, isOperationalUser } from './auth.service';

export interface TerminalOperator {
  employeeId: string;
  name: string;
  initials: string;
  /** Epoch ms até quando o PIN deste operador está confiado. */
  pinTrustedUntil: number;
  /** Sessão do login por senha — permite deslogar/trocar sem encerrar o app. */
  session?: StoredSession;
}

export interface OperatorAuthorizeOptions {
  title: string;
  requirePin: boolean;
}

/** Resultado do modal de identificação (employee-verify). */
export interface OperatorConfirmedIdentity {
  employeeId: string;
  employeeName: string;
  initials?: string;
  session?: StoredOperatorSession;
}

export interface PendingOperatorRequest {
  title: string;
  /**
   * 'login'  = usuário+senha (autentica alguém no terminal);
   * 'pin'    = só PIN do operador corrente (ação sensível);
   * 'target' = sigla+PIN do operador alvo (concluir troca).
   */
  mode: 'login' | 'pin' | 'target';
  /** Operador fixo nos modos 'pin'/'target'. */
  employee: { employeeId: string; name: string; initials: string } | null;
  resolve: (operator: TerminalOperator | null) => void;
}

export const PIN_TRUST_MINUTES_KEY = 'operator.pinTrustMinutes';
const DEFAULT_TRUST_MINUTES = 5;
const STORAGE_KEY = 'rentafit.terminalOperators';

/**
 * Operador em comando do terminal.
 *
 * A lista contém apenas quem fez login por senha NAQUELE terminal — cada
 * entrada guarda a `StoredSession` do login, então trocar de operador
 * (sigla+PIN do alvo) restaura a sessão dele e deslogar alguém remove
 * só aquela pessoa, mantendo a aplicação aberta enquanto restar alguém.
 * Vive em sessionStorage: morre ao fechar a aba. Ações sensíveis usam a
 * janela de confiança (`pinTrustedUntil`), renovada a cada PIN confirmado.
 */
@Injectable({ providedIn: 'root' })
export class TerminalOperatorService {
  private readonly authService = inject(AuthService);
  private readonly settingsService = inject(SettingsService);

  readonly operators = signal<TerminalOperator[]>([]);
  readonly currentOperatorId = signal<string | null>(null);
  readonly currentOperator = computed(
    () => this.operators().find(o => o.employeeId === this.currentOperatorId()) ?? null,
  );

  /** Minutos da janela de confiança do PIN — global, editável por ADMIN/MANAGER. */
  readonly trustWindowMinutes = signal(DEFAULT_TRUST_MINUTES);

  /** Pedido de identificação pendente — consumido pelo host do modal (main-layout). */
  readonly pendingRequest = signal<PendingOperatorRequest | null>(null);

  constructor() {
    this.restore();
    this.refreshTrustWindow();
    const destroyRef = inject(DestroyRef);
    this.authService.terminalLogin$.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.clear());
    interval(30_000).pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.pruneExpiredOperators());
    this.authService.currentUser$.pipe(takeUntilDestroyed(destroyRef)).subscribe(user => {
      if (!user) {
        this.clear();
        return;
      }
      this.ensureSessionOperator(user.id, this.authService.captureSession());
    });
  }

  /**
   * Resolve o operador autorizado para uma ação.
   * - Com operador e ação não sensível: retorna o operador direto.
   * - Ação sensível dentro da janela: retorna direto e renova a janela.
   * - Ação sensível fora da janela: pede só o PIN do operador corrente.
   * - Sem operador: pede usuário+senha para autenticar alguém no terminal.
   * Emite `null` quando o usuário cancela o modal.
   */
  authorize(options: OperatorAuthorizeOptions): Observable<TerminalOperator | null> {
    this.pruneExpiredOperators();
    const current = this.currentOperator();
    if (!current) {
      return this.requestIdentity(options.title, 'login', null);
    }
    if (!options.requirePin) {
      return of(current);
    }
    if (this.isTrusted(current)) {
      this.touchTrust(current.employeeId);
      return of(current);
    }
    return this.requestIdentity(options.title, 'pin', {
      employeeId: current.employeeId,
      name: current.name,
      initials: current.initials,
    });
  }

  /** Abre o modal usuário+senha para autenticar um novo operador no terminal. */
  requestAuthentication(title = 'Autenticar Usuário'): Observable<TerminalOperator | null> {
    return this.requestIdentity(title, 'login', null);
  }

  /**
   * Pede sigla+PIN do operador ALVO para concluir a troca de comando.
   * Após confirmado, a sessão do alvo é restaurada (JWT passa a ser dele).
   */
  requestSwitch(employeeId: string): Observable<TerminalOperator | null> {
    this.pruneExpiredOperators();
    const target = this.operators().find(o => o.employeeId === employeeId);
    if (!target || target.employeeId === this.currentOperatorId()) return of(null);
    return this.requestIdentity(`Trocar para ${target.name}`, 'target', {
      employeeId: target.employeeId,
      name: target.name,
      initials: target.initials,
    });
  }

  /**
   * Desloga UMA pessoa do terminal — a aplicação continua aberta.
   * Se for o dono da sessão, transfere para outro operador com sessão;
   * se não sobrar ninguém, faz o logout real.
   */
  removeOperator(employeeId: string): void {
    this.pruneExpiredOperators();
    const remaining = this.operators().filter(o => o.employeeId !== employeeId);
    if (remaining.length === 0) {
      this.clear();
      this.authService.logout();
      return;
    }

    this.operators.set(remaining);
    const wasSessionOwner = this.authService.getCurrentUser()?.id === employeeId;
    if (wasSessionOwner) {
      this.currentOperatorId.set(null);
      this.activateFallback();
      return;
    }

    if (!remaining.some(o => o.employeeId === this.currentOperatorId())) {
      const ownerId = this.authService.getCurrentUser()?.id;
      const fallback = remaining.find(o => o.employeeId === ownerId) ?? remaining[0];
      this.currentOperatorId.set(fallback.employeeId);
    }
    this.persist();
  }

  private activateFallback(): void {
    const next = this.operators().find(operator => operator.session);
    if (!next?.session) {
      this.clear();
      this.authService.logout();
      return;
    }
    this.authService.validateOperatorSession(next.session).subscribe({
      next: session => {
        if (!this.operators().some(operator => operator.employeeId === next.employeeId)) return;
        this.upsertOperator({ employeeId: session.user.id, name: session.user.name ?? session.user.username,
          initials: session.initials, session });
        this.currentOperatorId.set(session.user.id);
        this.authService.restoreSession(session);
        this.persist();
      },
      error: () => {
        this.operators.update(operators => operators.filter(operator => operator.employeeId !== next.employeeId));
        this.activateFallback();
      },
    });
  }

  /** Chamado pelo host do modal quando a identificação é confirmada. */
  resolvePending(identity: OperatorConfirmedIdentity): void {
    const request = this.pendingRequest();
    if (!request) return;
    if (request.mode === 'login' || (identity.session && request.mode === 'pin')) {
      this.resolveLogin(request, identity);
      return;
    }
    if (request.employee && identity.employeeId !== request.employee.employeeId) {
      this.pendingRequest.set(null);
      request.resolve(null);
      return;
    }
    this.pruneExpiredOperators();
    const existing = this.operators().find(o => o.employeeId === identity.employeeId);
    if (!existing || !this.hasValidSession(existing.session, existing.employeeId)) {
      this.cancelPending();
      return;
    }
    this.authService.validateOperatorSession(existing.session!).subscribe({
      next: session => {
        if (this.pendingRequest() !== request) return;
        if (!this.hasValidSession(session, identity.employeeId)) {
          this.cancelPending();
          return;
        }
        this.completeAuthorization(request, session);
      },
      error: () => {
        if (this.pendingRequest() !== request) return;
        this.operators.update(operators => operators.filter(operator => operator.employeeId !== identity.employeeId));
        this.pruneExpiredOperators();
        this.cancelPending();
      },
    });
  }

  /** Chamado pelo host do modal quando o usuário cancela. */
  cancelPending(): void {
    const request = this.pendingRequest();
    this.pendingRequest.set(null);
    request?.resolve(null);
  }

  /** Recarrega a janela de confiança do backend (fallback: default). */
  refreshTrustWindow(): void {
    this.settingsService
      .getNumber(PIN_TRUST_MINUTES_KEY, DEFAULT_TRUST_MINUTES)
      .subscribe(minutes => this.trustWindowMinutes.set(this.clampMinutes(minutes)));
  }

  /** Persiste a nova janela global e atualiza o estado local. */
  updateTrustWindow(minutes: number): Observable<void> {
    const clamped = this.clampMinutes(minutes);
    return this.settingsService.put(PIN_TRUST_MINUTES_KEY, String(clamped)).pipe(
      tap(() => this.trustWindowMinutes.set(clamped)),
    );
  }

  clear(): void {
    this.operators.set([]);
    this.currentOperatorId.set(null);
    this.pendingRequest.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  private resolveLogin(request: PendingOperatorRequest, identity: OperatorConfirmedIdentity): void {
    const session = identity.session;
    if (!session?.initials || !this.hasValidSession(session, identity.employeeId)) {
      this.cancelPending();
      return;
    }
    this.completeAuthorization(request, session);
  }

  private completeAuthorization(request: PendingOperatorRequest, session: StoredOperatorSession): void {
    const operator = this.upsertOperator({
      employeeId: session.user.id,
      name: session.user.name ?? session.user.username,
      initials: session.initials,
      session,
    });
    operator.pinTrustedUntil = this.trustedUntilFromNow();
    this.currentOperatorId.set(operator.employeeId);
    this.authService.restoreSession(session);
    this.persist();
    this.pendingRequest.set(null);
    request.resolve(operator);
  }

  private ensureSessionOperator(userId: string, session: StoredSession | null): void {
    if (!this.hasValidSession(session, userId)) {
      this.pruneExpiredOperators();
      return;
    }
    this.authService.validateOperatorSession(session!).subscribe({
      next: verified => {
        if (this.authService.getCurrentUser()?.id !== userId
            || this.authService.captureSession()?.accessToken !== session?.accessToken
            || !this.hasValidSession(verified, userId)) return;
        const existing = this.operators().find(operator => operator.employeeId === userId);
        const operator = this.upsertOperator({
          employeeId: userId,
          name: verified.user.name ?? verified.user.username,
          initials: verified.initials,
          session: verified,
        });
        // Login por senha conta como autenticação — janela inicial confiada.
        operator.pinTrustedUntil = existing?.pinTrustedUntil ?? this.trustedUntilFromNow();
        this.currentOperatorId.set(operator.employeeId);
        this.persist();
      },
      error: () => {
        if (this.authService.captureSession()?.accessToken !== session?.accessToken) return;
        this.operators.update(operators => operators.filter(operator => operator.employeeId !== userId));
        this.pruneExpiredOperators();
      },
    });
  }

  private requestIdentity(
    title: string,
    mode: PendingOperatorRequest['mode'],
    employee: PendingOperatorRequest['employee'],
  ): Observable<TerminalOperator | null> {
    return new Observable<TerminalOperator | null>(subscriber => {
      this.pendingRequest.set({
        title,
        mode,
        employee,
        resolve: operator => {
          subscriber.next(operator);
          subscriber.complete();
        },
      });
    });
  }

  pruneExpiredOperators(): void {
    const operators = this.operators();
    const valid = operators.filter(operator => this.hasValidSession(operator?.session, operator?.employeeId));
    if (valid.length !== operators.length) this.operators.set(valid);
    if (!valid.some(operator => operator.employeeId === this.currentOperatorId())) {
      this.currentOperatorId.set(null);
    }
    this.persist();
  }

  private hasValidSession(session: StoredSession | null | undefined, employeeId: string): boolean {
    if (!session?.accessToken || !session.refreshToken || session.user?.id !== employeeId
        || !isOperationalUser(session.user) || session.user.pinConfigured !== true || session.user.passwordExpired) return false;
    try {
      const parts = session.accessToken.split('.');
      if (parts.length !== 3) return false;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as { exp?: unknown };
      return typeof payload.exp === 'number' && Number.isFinite(payload.exp) && payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  private isTrusted(operator: TerminalOperator): boolean {
    return operator.pinTrustedUntil > Date.now();
  }

  private touchTrust(employeeId: string): void {
    const operator = this.operators().find(o => o.employeeId === employeeId);
    if (!operator) return;
    operator.pinTrustedUntil = this.trustedUntilFromNow();
    this.persist();
  }

  private trustedUntilFromNow(): number {
    return Date.now() + this.trustWindowMinutes() * 60_000;
  }

  private upsertOperator(operator: Omit<TerminalOperator, 'pinTrustedUntil'>): TerminalOperator {
    const list = [...this.operators()];
    const index = list.findIndex(o => o.employeeId === operator.employeeId);
    if (index >= 0) {
      const merged = { ...list[index], ...operator };
      merged.session = operator.session ?? list[index].session;
      list[index] = merged;
      this.operators.set(list);
      return merged;
    }
    const created: TerminalOperator = { ...operator, pinTrustedUntil: 0 };
    this.operators.set([...list, created]);
    return created;
  }

  private clampMinutes(minutes: number): number {
    if (!Number.isFinite(minutes)) return DEFAULT_TRUST_MINUTES;
    return Math.min(120, Math.max(1, Math.round(minutes)));
  }

  private persist(): void {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        operators: this.operators(),
        currentOperatorId: this.currentOperatorId(),
      }),
    );
  }

  private restore(): void {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        operators?: TerminalOperator[];
        currentOperatorId?: string | null;
      };
      if (Array.isArray(parsed.operators)) {
        this.operators.set(parsed.operators);
      }
      this.currentOperatorId.set(parsed.currentOperatorId ?? null);
      this.pruneExpiredOperators();
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }
}
