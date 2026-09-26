import { Injectable, signal } from '@angular/core';
import { INITIAL_DEFAULT_TEMPLATES } from '../data/default-templates';
import { PAGE_FORMAT_PRESETS, PrintTemplate, TemplateType } from '../data/print-template.model';

const STORAGE_KEY = 'rentafit_print_templates_v1';

@Injectable({
  providedIn: 'root',
})
export class PrintTemplateStorageService {
  readonly templates = signal<PrintTemplate[]>([]);

  constructor() {
    this.loadFromStorage();
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

  resetToDefaults(): void {
    this.templates.set([...INITIAL_DEFAULT_TEMPLATES]);
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
