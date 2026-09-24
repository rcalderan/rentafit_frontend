import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { PrintTemplateStorageService } from './print-template-storage.service';

describe('PrintTemplateStorageService', () => {
  let service: PrintTemplateStorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(PrintTemplateStorageService);
  });

  it('deve inicializar com os 5 templates padrão', () => {
    const list = service.getTemplates();
    expect(list.length).toBeGreaterThanOrEqual(5);

    const contrato = service.getDefaultByType('RENTAL_CONTRACT');
    expect(contrato).toBeDefined();
    expect(contrato?.name).toContain('Contrato');
    expect(contrato?.pageFormat).toBe('A4');
  });

  it('deve salvar um novo template e retornar com id', () => {
    const saved = service.save({
      id: '',
      name: 'Template Especial Festa',
      templateType: 'CUSTOM',
      pageFormat: 'A4',
      orientation: 'PORTRAIT',
      pageWidthMm: 210,
      pageHeightMm: 297,
      marginTopMm: 15,
      marginBottomMm: 15,
      marginLeftMm: 15,
      marginRightMm: 15,
      contentJson: null,
      contentHtml: '<h1>Festa</h1>',
      isDefault: false,
      isActive: true,
      createdAt: '',
      updatedAt: '',
    });

    expect(saved.id).toBeTruthy();
    expect(service.getById(saved.id)).toBeDefined();
  });

  it('deve duplicar um template existente', () => {
    const contrato = service.getDefaultByType('RENTAL_CONTRACT')!;
    const duplicate = service.duplicate(contrato.id);

    expect(duplicate).toBeDefined();
    expect(duplicate?.id).not.toBe(contrato.id);
    expect(duplicate?.name).toContain('(Cópia)');
  });

  it('deve excluir template por id', () => {
    const list = service.getTemplates();
    const target = list[list.length - 1];
    const ok = service.delete(target.id);

    expect(ok).toBe(true);
    expect(service.getById(target.id)).toBeUndefined();
  });
});
