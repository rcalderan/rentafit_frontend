import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { INITIAL_DEFAULT_TEMPLATES } from '../data/default-templates';
import { PAGE_FORMAT_PRESETS, PrintTemplate, TemplateType } from '../data/print-template.model';

const STORAGE_KEY = 'rentafit_print_templates_v1';
const API_URL = '/api/v1/print-templates';

@Injectable({
  providedIn: 'root',
})
export class PrintTemplateStorageService {
  private readonly http = inject(HttpClient, { optional: true });
  private backendAvailable = false;
  private initialization?: Promise<void>;

  readonly templates = signal<PrintTemplate[]>([]);
  readonly persistenceMode = signal<'loading' | 'backend' | 'local'>('loading');

  constructor() {
    this.loadFromStorage();
    if (!this.http) this.persistenceMode.set('local');
  }

  initialize(): Promise<void> {
    if (!this.http) return Promise.resolve();
    this.initialization ??= this.loadFromBackend();
    return this.initialization;
  }

  private async loadFromBackend(): Promise<void> {
    const http = this.http;
    if (!http) return;
    try {
      let remote = await firstValueFrom(http.get<PrintTemplate[]>(API_URL));
      const cached = this.templates();
      const cachedById = new Map(cached.map((template) => [template.id, template]));
      const ids = new Set(remote.map((template) => template.id));
      const defaultsToSeed = INITIAL_DEFAULT_TEMPLATES
        .filter((template) => !ids.has(template.id))
        .map((template) => cachedById.get(template.id) ?? template);
      const missingLocalTemplates = remote.length ? [] : cached.filter((template) => !ids.has(template.id));
      const toSeed = [
        ...missingLocalTemplates,
        ...defaultsToSeed.filter(
          (template) => !missingLocalTemplates.some((local) => local.id === template.id),
        ),
      ];
      await Promise.all(toSeed.map((template) => this.putRemote(template)));
      if (toSeed.length) remote = await firstValueFrom(http.get<PrintTemplate[]>(API_URL));
      this.templates.set(remote.map((template) => this.normalizeTemplate(template)));
      this.persist();
      this.backendAvailable = true;
      this.persistenceMode.set('backend');
    } catch {
      this.backendAvailable = false;
      this.persistenceMode.set('local');
      this.loadFromStorage();
    }
  }

  loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PrintTemplate[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.templates.set(parsed.map((t) => this.normalizeTemplate(t)));
          return;
        }
      }
    } catch {
      // Fallback on JSON parse error
    }
    // Initialize with default templates
    this.templates.set([...INITIAL_DEFAULT_TEMPLATES]);
    this.persist();
  }

  getTemplates(): PrintTemplate[] {
    return this.templates();
  }

  getById(id: string): PrintTemplate | undefined {
    return this.templates().find((t) => t.id === id);
  }

  getDefaultByType(type: TemplateType): PrintTemplate | undefined {
    const matching = this.templates().filter((t) => t.templateType === type && t.isActive);
    return matching.find((t) => t.isDefault) || matching[0];
  }

  save(template: PrintTemplate): PrintTemplate {
    const list = [...this.templates()];
    const now = new Date().toISOString();

    if (!template.id) {
      template.id = `template-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      template.createdAt = now;
      template.updatedAt = now;
      list.push(template);
    } else {
      const index = list.findIndex((t) => t.id === template.id);
      template.updatedAt = now;
      if (index >= 0) {
        list[index] = { ...template };
      } else {
        template.createdAt = now;
        list.push(template);
      }
    }

    // Se este foi marcado como default, desmarca os outros do mesmo tipo
    if (template.isDefault) {
      for (const item of list) {
        if (item.id !== template.id && item.templateType === template.templateType) {
          item.isDefault = false;
        }
      }
    }

    this.templates.set(list);
    this.persist();
    return template;
  }

  async saveAndSync(template: PrintTemplate): Promise<PrintTemplate> {
    const saved = this.save(template);
    if (!this.backendAvailable) return saved;
    const affected = template.isDefault
      ? this.templates().filter((item) => item.templateType === template.templateType)
      : [saved];
    try {
      await Promise.all(affected.map((item) => this.putRemote(item)));
    } catch {
      this.useLocalFallback();
    }
    return saved;
  }

  async duplicateAndSync(id: string): Promise<PrintTemplate | undefined> {
    const copy = this.duplicate(id);
    if (!copy || !this.backendAvailable) return copy;
    try {
      await this.putRemote(copy);
    } catch {
      this.useLocalFallback();
    }
    return copy;
  }

  duplicate(id: string): PrintTemplate | undefined {
    const original = this.getById(id);
    if (!original) return undefined;

    const copy: PrintTemplate = {
      ...JSON.parse(JSON.stringify(original)),
      id: `template-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: `${original.name} (Cópia)`,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const list = [...this.templates(), copy];
    this.templates.set(list);
    this.persist();
    return copy;
  }

  delete(id: string): boolean {
    const current = this.templates();
    const filtered = current.filter((t) => t.id !== id);
    if (filtered.length !== current.length) {
      this.templates.set(filtered);
      this.persist();
      return true;
    }
    return false;
  }

  async deleteAndSync(id: string): Promise<boolean> {
    const deleted = this.delete(id);
    if (!deleted || !this.backendAvailable || !this.http) return deleted;
    try {
      await firstValueFrom(this.http.delete<void>(`${API_URL}/${encodeURIComponent(id)}`));
    } catch {
      this.useLocalFallback();
    }
    return deleted;
  }

  resetToDefaults(): void {
    this.templates.set([...INITIAL_DEFAULT_TEMPLATES]);
    this.persist();
  }

  async resetToDefaultsAndSync(): Promise<void> {
    const http = this.http;
    if (!this.backendAvailable || !http) {
      this.resetToDefaults();
      return;
    }
    try {
      const current = await firstValueFrom(http.get<PrintTemplate[]>(API_URL));
      const defaults = [...INITIAL_DEFAULT_TEMPLATES];
      const defaultIds = new Set(defaults.map((template) => template.id));
      await Promise.all(
        current
          .filter((template) => !defaultIds.has(template.id))
          .map((template) => firstValueFrom(http.delete<void>(`${API_URL}/${encodeURIComponent(template.id)}`))),
      );
      await Promise.all(defaults.map((template) => this.putRemote(template)));
      this.templates.set(defaults);
      this.persist();
    } catch {
      this.useLocalFallback();
      this.resetToDefaults();
    }
  }

  private async putRemote(template: PrintTemplate): Promise<PrintTemplate> {
    const http = this.http;
    if (!http) throw new Error('Print template API requires HttpClient.');
    const { id, createdAt: _createdAt, updatedAt: _updatedAt, ...body } = template;
    return firstValueFrom(http.put<PrintTemplate>(`${API_URL}/${encodeURIComponent(id)}`, body));
  }

  private useLocalFallback(): void {
    this.backendAvailable = false;
    this.persistenceMode.set('local');
    this.persist();
  }

  private normalizeTemplate(t: PrintTemplate): PrintTemplate {
    if (typeof t.printOffsetMm === 'number') return t;
    return { ...t, printOffsetMm: PAGE_FORMAT_PRESETS[t.pageFormat]?.defaultOffsetMm ?? 0 };
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.templates()));
    } catch (e) {
      console.error('Erro ao salvar templates no LocalStorage:', e);
    }
  }
}
