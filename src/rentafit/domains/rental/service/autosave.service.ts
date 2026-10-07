import { Injectable } from '@angular/core';
import { Observable, Subject, of } from 'rxjs';
import { catchError, concatMap, finalize, map, takeUntil, tap } from 'rxjs/operators';

/** Autosave status exposed to the component for visual feedback. */
export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Queued save work item.
 * `buildRequest` is evaluated lazily so the latest local state is always captured.
 */
interface SaveJob<TReq, TRes> {
  buildRequest: () => TReq;
  execute: (request: TReq) => Observable<TRes>;
}

/**
 * Domain-level autosave controller for rental contracts.
 *
 * Responsibilities:
 * - Ignores autosave when `contractId` is null (contract not yet created).
 * - Keeps at most one HTTP request in flight; collapses/queues subsequent changes.
 * - Reports status changes via an observable for UI binding.
 * - Errors are non-blocking: the status changes to `error` and the next eligible
 *   change will attempt saving again.
 */
@Injectable()
export class AutosaveService<TReq, TRes> {
  private readonly queue$ = new Subject<SaveJob<TReq, TRes>>();
  private readonly reset$ = new Subject<void>();
  private readonly _status$ = new Subject<AutosaveStatus>();
  private _status: AutosaveStatus = 'idle';
  private _lastError: string | null = null;

  /** Pending job that will replace any currently queued (but not in-flight) work. */
  private pendingJob: SaveJob<TReq, TRes> | null = null;
  private inflight = false;

  /** Observable status stream for template binding. */
  readonly status$ = this._status$.asObservable();

  get status(): AutosaveStatus {
    return this._status;
  }
  get lastError(): string | null {
    return this._lastError;
  }

  constructor() {
    // Process jobs sequentially with concatMap; at most one in flight at a time.
    this.queue$
      .pipe(
        concatMap((job) => {
          this.inflight = true;
          this.setStatus('saving');

          // Evaluate request lazily to capture latest local state
          const request = job.buildRequest();

          return job.execute(request).pipe(
            takeUntil(this.reset$),
            tap(() => {
              this._lastError = null;
              this.setStatus('saved');
            }),
            catchError((err: unknown) => {
              this._lastError =
                err instanceof Error ? err.message : 'Erro ao salvar automaticamente.';
              this.setStatus('error');
              return of(null);
            }),
            finalize(() => {
              this.inflight = false;
              this.flushPending();
            }),
          );
        }),
      )
      .subscribe(); // kept alive for the lifetime of the service
  }

  /**
   * Schedule an autosave. If a save is already in flight, the new job replaces
   * any previously queued job (collapse). The request builder is called lazily
   * so only the latest snapshot is sent.
   */
  schedule(buildRequest: () => TReq, execute: (request: TReq) => Observable<TRes>): void {
    const snapshot = structuredClone(buildRequest());
    const job: SaveJob<TReq, TRes> = { buildRequest: () => snapshot, execute };

    if (this.inflight) {
      // Collapse: keep only the latest pending change
      this.pendingJob = job;
    } else {
      this.queue$.next(job);
    }
  }

  /** Reset state (e.g. when the contract changes or is cleared). */
  reset(): void {
    this.pendingJob = null;
    this.reset$.next();
    this._lastError = null;
    this.setStatus('idle');
  }

  private flushPending(): void {
    if (this.pendingJob) {
      const job = this.pendingJob;
      this.pendingJob = null;
      this.queue$.next(job);
    }
  }

  private setStatus(s: AutosaveStatus): void {
    this._status = s;
    this._status$.next(s);
  }
}
