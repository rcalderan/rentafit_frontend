import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, it, expect, beforeEach } from 'vitest';
import { INITIAL_DEFAULT_TEMPLATES } from '../data/default-templates';
import { PrintTemplateStorageService } from './print-template-storage.service';

describe('PrintTemplateStorageService', () => {
  let service: PrintTemplateStorageService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PrintTemplateStorageService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('deve inicializar com os 5 templates padrão', () => {
    const list = service.getTemplates();
    expect(list.length).toBeGreaterThanOrEqual(5);

    const contrato = service.getDefaultByType('RENTAL_CONTRACT');
    expect(contrato).toBeDefined();
    expect(contrato?.name).toContain('Contrato');
    expect(contrato?.pageFormat).toBe('A4');
  });

  it('initializes the legacy contract with repeatable style-aware subcomponents', () => {
    const contract = service.getDefaultByType('RENTAL_CONTRACT');

    expect(contract?.id).toBe('template-contrato-locacao-legado-v2');
    expect(contract?.contentHtml).toContain('data-print-component="contract-items"');
    expect(contract?.contentHtml).toContain('data-print-component="contract-payments"');
    expect(contract?.contentHtml).toContain('data-print-component="signature"');
    expect(JSON.parse(contract?.cssStyles ?? '{}').version).toBe(1);
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
      printOffsetMm: 5,
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

  it('deve carregar templates do backend e ativar persistência remota', async () => {
    const loading = service.initialize();
    httpMock.expectOne('/api/v1/print-templates').flush(INITIAL_DEFAULT_TEMPLATES);
    await loading;

    expect(service.persistenceMode()).toBe('backend');
    expect(service.getTemplates()).toHaveLength(5);
  });

  it('deve sincronizar alterações com PUT mantendo o ID estável', async () => {
    const loading = service.initialize();
    httpMock.expectOne('/api/v1/print-templates').flush(INITIAL_DEFAULT_TEMPLATES);
    await loading;
    const edited = { ...INITIAL_DEFAULT_TEMPLATES[0], name: 'Contrato Atualizado' };

    const saving = service.saveAndSync(edited);
    const request = httpMock.expectOne(`/api/v1/print-templates/${edited.id}`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.name).toBe('Contrato Atualizado');
    request.flush({ ...edited, updatedAt: new Date().toISOString() });
    await saving;

    expect(service.getById(edited.id)?.name).toBe('Contrato Atualizado');
    expect(service.persistenceMode()).toBe('backend');
  });

  it('deve duplicar um template no backend preservando a configuração', async () => {
    const loading = service.initialize();
    httpMock.expectOne('/api/v1/print-templates').flush(INITIAL_DEFAULT_TEMPLATES);
    await loading;

    const duplicating = service.duplicateAndSync(INITIAL_DEFAULT_TEMPLATES[0].id);
    const duplicate = service.getTemplates().at(-1);
    expect(duplicate).toBeDefined();
    const request = httpMock.expectOne(`/api/v1/print-templates/${duplicate?.id}`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.name).toContain('(Cópia)');
    request.flush({ ...request.request.body, id: duplicate?.id });
    await duplicating;
    expect(service.getById(duplicate!.id)?.name).toContain('(Cópia)');
  });

  it('deve remover um template do backend', async () => {
    const loading = service.initialize();
    httpMock.expectOne('/api/v1/print-templates').flush(INITIAL_DEFAULT_TEMPLATES);
    await loading;

    const deleting = service.deleteAndSync(INITIAL_DEFAULT_TEMPLATES[0].id);
    const request = httpMock.expectOne(`/api/v1/print-templates/${INITIAL_DEFAULT_TEMPLATES[0].id}`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    expect(await deleting).toBe(true);
    expect(service.getById(INITIAL_DEFAULT_TEMPLATES[0].id)).toBeUndefined();
  });

  it('deve restaurar templates padrão no backend e remover customizados', async () => {
    const custom = { ...INITIAL_DEFAULT_TEMPLATES[4], id: 'custom-backend', name: 'Temporário' };
    const current = [...INITIAL_DEFAULT_TEMPLATES, custom];
    const loading = service.initialize();
    httpMock.expectOne('/api/v1/print-templates').flush(current);
    await loading;

    const resetting = service.resetToDefaultsAndSync();
    httpMock.expectOne('/api/v1/print-templates').flush(current);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    httpMock.expectOne('/api/v1/print-templates/custom-backend').flush(null);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const puts = httpMock.match((request) => request.method === 'PUT');
    expect(puts).toHaveLength(5);
    puts.forEach((request) => request.flush({ ...request.request.body, id: request.request.url.split('/').at(-1) }));
    await resetting;

    expect(service.getTemplates()).toHaveLength(5);
    expect(service.getById('custom-backend')).toBeUndefined();
  });

  it('deve alternar para fallback local quando salvar no backend falha', async () => {
    const loading = service.initialize();
    httpMock.expectOne('/api/v1/print-templates').flush(INITIAL_DEFAULT_TEMPLATES);
    await loading;
    const edited = { ...INITIAL_DEFAULT_TEMPLATES[0], name: 'Alteração local' };

    const saving = service.saveAndSync(edited);
    httpMock.expectOne(`/api/v1/print-templates/${edited.id}`).flush({}, { status: 503, statusText: 'Unavailable' });
    await saving;

    expect(service.persistenceMode()).toBe('local');
    expect(service.getById(edited.id)?.name).toBe('Alteração local');
  });

  it('deve semear os templates padrão quando o backend está vazio', async () => {
    const loading = service.initialize();
    httpMock.expectOne('/api/v1/print-templates').flush([]);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const puts = httpMock.match((request) => request.method === 'PUT');
    expect(puts).toHaveLength(5);
    puts.forEach((request) => request.flush({ ...request.request.body, id: request.request.url.split('/').at(-1) }));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    httpMock.expectOne('/api/v1/print-templates').flush(INITIAL_DEFAULT_TEMPLATES);
    await loading;

    expect(service.persistenceMode()).toBe('backend');
    expect(service.getTemplates()).toHaveLength(5);
  });

  it('cria nova versão via POST /versions e a torna padrão', async () => {
    const loading = service.initialize();
    httpMock.expectOne('/api/v1/print-templates').flush(INITIAL_DEFAULT_TEMPLATES);
    await loading;
    const source = service.getDefaultByType('RENTAL_CONTRACT')!;
    const edited = { ...source, contentHtml: '<p>Conteúdo alterado</p>' };

    const creating = service.createVersionAndSync(source.id, edited);
    const request = httpMock.expectOne(`/api/v1/print-templates/${source.id}/versions`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.contentHtml).toBe('<p>Conteúdo alterado</p>');
    request.flush({
      ...request.request.body,
      id: `${source.id}-v2`,
      version: 2,
      previousVersionId: source.id,
      isDefault: true,
    });
    const created = await creating;

    expect(created?.id).toBe(`${source.id}-v2`);
    expect(created?.version).toBe(2);
    expect(created?.previousVersionId).toBe(source.id);
    expect(service.getById(created!.id)?.isDefault).toBe(true);
    expect(service.getById(source.id)?.isDefault).toBe(false);
    expect(service.getById(source.id)?.contentHtml).not.toBe('<p>Conteúdo alterado</p>');
  });

  it('cria nova versão localmente quando o backend está indisponível', async () => {
    const loading = service.initialize();
    httpMock.expectOne('/api/v1/print-templates').flush({}, { status: 503, statusText: 'Unavailable' });
    await loading;
    const source = service.getDefaultByType('RENTAL_CONTRACT')!;

    const created = await service.createVersionAndSync(source.id, {
      ...source,
      contentHtml: '<p>Novo conteúdo</p>',
    });

    expect(created?.version).toBe(2);
    expect(created?.previousVersionId).toBe(source.id);
    expect(created?.isDefault).toBe(true);
    expect(service.getById(source.id)?.isDefault).toBe(false);
  });

  it('define um template como padrão via POST /default', async () => {
    const loading = service.initialize();
    httpMock.expectOne('/api/v1/print-templates').flush(INITIAL_DEFAULT_TEMPLATES);
    await loading;
    const target = service.getTemplates().find((t) => t.templateType === 'CUSTOM')!;

    const setting = service.setDefaultAndSync(target.id);
    const request = httpMock.expectOne(`/api/v1/print-templates/${target.id}/default`);
    expect(request.request.method).toBe('POST');
    request.flush({ ...target, isDefault: true });
    expect(await setting).toBe(true);

    expect(service.getById(target.id)?.isDefault).toBe(true);
  });

  it('retorna false ao definir padrão de template inexistente', async () => {
    expect(await service.setDefaultAndSync('nao-existe')).toBe(false);
  });

  it('deve manter o fallback local se a API estiver indisponível', async () => {
    const loading = service.initialize();
    httpMock.expectOne('/api/v1/print-templates').flush({}, { status: 503, statusText: 'Unavailable' });
    await loading;

    expect(service.persistenceMode()).toBe('local');
    expect(service.getTemplates()).toHaveLength(5);
  });
});
