import { computed, Injectable, signal } from '@angular/core';
import { Sector } from '../data/sector.model';

const STORAGE_KEY = 'rentafit.terminal.sectorId';

/**
 * Setor do terminal corrente — vínculo local da máquina (localStorage), não da sessão
 * do usuário: o mesmo operador pode autenticar em terminais de setores diferentes e
 * cada terminal mantém o próprio contexto.
 *
 * O id persistido é enviado ao backend pelo `terminalSectorInterceptor`
 * (header `X-Terminal-Sector-Id`); o objeto `Sector` só é resolvido após
 * `resolveFrom()` cruzar o id com a lista carregada da API.
 */
@Injectable({ providedIn: 'root' })
export class TerminalSectorService {
  private readonly storedId = signal<string | null>(this.readStoredId());
  private readonly resolved = signal<Sector | null>(null);

  /** Id do setor persistido para este terminal (null = não configurado). */
  readonly sectorId = this.storedId.asReadonly();
  /** Setor resolvido com dados de exibição; null enquanto a lista não foi carregada. */
  readonly sector = this.resolved.asReadonly();
  readonly configured = computed(() => this.storedId() !== null);

  /** Vincula este terminal ao setor informado e persiste a escolha. */
  assign(sector: Sector): void {
    try {
      localStorage.setItem(STORAGE_KEY, sector.id);
    } catch {
      // Sem storage disponível: mantém apenas em memória nesta sessão.
    }
    this.storedId.set(sector.id);
    this.resolved.set(sector);
  }

  /** Remove o vínculo do terminal — operações passam a exigir configuração (422). */
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // noop
    }
    this.storedId.set(null);
    this.resolved.set(null);
  }

  /**
   * Resolve o objeto `Sector` a partir da lista carregada. Se o id persistido não
   * existir mais (setor removido/desativado), limpa o vínculo para sinalizar
   * reconfiguração.
   */
  resolveFrom(sectors: Sector[]): Sector | null {
    const id = this.storedId();
    if (!id) {
      this.resolved.set(null);
      return null;
    }
    const found = sectors.find((s) => s.id === id) ?? null;
    this.resolved.set(found);
    if (!found) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // noop
      }
      this.storedId.set(null);
    }
    return found;
  }

  private readStoredId(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
