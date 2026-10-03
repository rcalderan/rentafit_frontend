import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import {
  createEnvironmentInjector,
  EnvironmentInjector,
  runInInjectionContext,
  WritableSignal,
} from '@angular/core';
import { Editor } from '@tiptap/core';
import { Schema } from '@tiptap/pm/model';
import { Selection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrintTemplateStorageService } from '../../services/print-template-storage.service';
import { TemplateInterpolationService } from '../../services/template-interpolation.service';
import { PrintHtmlSanitizerService } from '../../services/print-html-sanitizer.service';
import { PrintSubcomponentStyleService } from '../../services/print-subcomponent-style.service';
import { PrintImageUploadService } from '../../services/print-image-upload.service';
import { PrintTemplate, VariableDefinition } from '../../data/print-template.model';
import { TEMPLATE_VARIABLES } from '../../data/template-variables';
import { PrintQrCodeBlock } from '../../data/print-editor.extensions';
import { PageEditorComponent } from './page-editor.component';

const VARIABLE_DRAG_DATA_TYPE = 'application/x-rentafit-template-variable';

class FakePrintImageUploadService {
  failure: Error | null = null;

  async readAsDataUrl(file: File): Promise<string> {
    if (this.failure) throw this.failure;
    return `data:${file.type};base64,bG9nbw==`;
  }
}

class FakePrintTemplateStorageService {
  savedCalls: PrintTemplate[] = [];
  versionCalls: Array<{ id: string; template: PrintTemplate }> = [];
  persisted: Record<string, PrintTemplate> = {};

  initialize(): Promise<void> { return Promise.resolve(); }
  persistenceMode(): string { return 'local'; }
  getById(id: string): PrintTemplate | undefined {
    return this.persisted[id];
  }
  async saveAndSync(t: PrintTemplate): Promise<PrintTemplate> {
    this.savedCalls.push(t);
    return t;
  }
  async createVersionAndSync(id: string, t: PrintTemplate): Promise<PrintTemplate> {
    this.versionCalls.push({ id, template: t });
    const created = { ...t, id: `${id}-v2`, version: (t.version ?? 1) + 1 };
    this.persisted[created.id] = created;
    return created;
  }
}

class FakeTemplateInterpolationService {
  interpolate(html: string): string { return html; }
}

class FakePrintHtmlSanitizerService {
  sanitize(html: string): string { return html; }
}

class FakePrintSubcomponentStyleService {
  compile(): string { return ''; }
  scopeToken(templateId: string): string { return `test-${templateId}`; }
}

class FakeDragTransfer {
  readonly types: string[] = [];
  readonly values = new Map<string, string>();
  dropEffect: DataTransfer['dropEffect'] = 'none';
  effectAllowed: DataTransfer['effectAllowed'] = 'none';

  setData(type: string, value: string): void {
    this.values.set(type, value);
    if (!this.types.includes(type)) this.types.push(type);
  }

  getData(type: string): string {
    return this.values.get(type) ?? '';
  }
}

const FAKE_EDITOR_SCHEMA = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'text*', group: 'block' },
    text: { group: 'inline' },
  },
});
const FAKE_EDITOR_DOCUMENT = FAKE_EDITOR_SCHEMA.node('doc', null, [
  FAKE_EDITOR_SCHEMA.node('paragraph', null, [FAKE_EDITOR_SCHEMA.text('Drop target')]),
]);

interface FakeEditorCommandChain {
  focus(): FakeEditorCommandChain;
  insertContent(content: string): FakeEditorCommandChain;
  setImage(attributes: { src: string; alt?: string }): FakeEditorCommandChain;
  run(): boolean;
}

class FakeTiptapEditor {
  readonly insertedContent: string[] = [];
  readonly selections: number[] = [];
  readonly dispatchedTransactions: unknown[] = [];
  readonly images: Array<{ src: string; alt?: string }> = [];
  html = '<p>Doc</p>';
  readonly state = {
    doc: FAKE_EDITOR_DOCUMENT,
    tr: { setSelection: (selection: Selection) => { this.selections.push(selection.from); return { selection }; } },
  };
  readonly view = {
    posAtCoords: (_coords: { left: number; top: number }) => ({ pos: 1 }),
    dispatch: (transaction: unknown) => this.dispatchedTransactions.push(transaction),
  };

  getHTML(): string {
    return this.html;
  }

  chain(): FakeEditorCommandChain {
    return new FakeEditorCommandChainImpl(this);
  }

  destroy(): void {}
}

class FakeEditorCommandChainImpl implements FakeEditorCommandChain {
  constructor(private readonly editor: FakeTiptapEditor) {}
  focus(): FakeEditorCommandChain { return this; }
  insertContent(content: string): FakeEditorCommandChain { this.editor.insertedContent.push(content); return this; }
  setImage(attributes: { src: string; alt?: string }): FakeEditorCommandChain { this.editor.images.push(attributes); return this; }
  run(): boolean { return true; }
}

interface PageEditorActions {
  editor: WritableSignal<Editor | null>;
  imageError: WritableSignal<string | null>;
  insertNfceItemsTable(): void;
  startVariableDrag(event: DragEvent, variable: VariableDefinition): void;
  allowVariableDrop(event: DragEvent): void;
  dropVariable(event: DragEvent): void;
  insertImageFromFile(event: Event): Promise<void>;
}

interface PageEditorSaveFlow {
  template: WritableSignal<PrintTemplate>;
  showVersionConfirm: WritableSignal<boolean>;
  loadedContentHtml: string;
  saveTemplate(): Promise<void>;
  confirmNewVersion(): Promise<void>;
  cancelVersionConfirm(): void;
}

describe('PageEditorComponent insertion actions', () => {
  let injector: EnvironmentInjector;
  let component: PageEditorComponent;
  let actions: PageEditorActions;
  let saveFlow: PageEditorSaveFlow;
  let fakeEditor: FakeTiptapEditor;
  let imageUpload: FakePrintImageUploadService;
  let storage: FakePrintTemplateStorageService;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    imageUpload = new FakePrintImageUploadService();
    storage = new FakePrintTemplateStorageService();
    router = { navigate: vi.fn() };
    injector = createEnvironmentInjector([
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
      { provide: Router, useValue: router },
      { provide: PrintTemplateStorageService, useValue: storage },
      { provide: TemplateInterpolationService, useValue: new FakeTemplateInterpolationService() },
      { provide: PrintHtmlSanitizerService, useValue: new FakePrintHtmlSanitizerService() },
      { provide: PrintSubcomponentStyleService, useValue: new FakePrintSubcomponentStyleService() },
      { provide: PrintImageUploadService, useValue: imageUpload },
    ], TestBed.inject(EnvironmentInjector));
    component = runInInjectionContext(injector, () => new PageEditorComponent());
    actions = component as unknown as PageEditorActions;
    saveFlow = component as unknown as PageEditorSaveFlow;
    fakeEditor = new FakeTiptapEditor();
    actions.editor.set(fakeEditor as unknown as Editor);
  });

  afterEach(() => {
    component.ngOnDestroy();
    injector.destroy();
  });

  it('inserts a repeatable NFC-e items table marker', () => {
    actions.insertNfceItemsTable();

    expect(fakeEditor.insertedContent[0]).toContain('data-print-component="nfce-items"');
    expect(fakeEditor.insertedContent[0]).toContain('<th>Vl.Unit</th>');
  });

  it('roundtrips the QR block marker through Tiptap serialization', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit, PrintQrCodeBlock],
      content: '<div data-print-qrcode-block="true"></div>',
    });
    const html = editor.getHTML();

    expect(html).toContain('data-qrcode-container="true"');
    expect(html).toContain('data-qrcode="true"');
    expect(html).toContain('{{nfce.urlConsulta}}');
    editor.destroy();

    const legacyEditor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit, PrintQrCodeBlock],
      content: '<div class="thermal-receipt-58"><div><svg width="90" height="90"><rect x="10" y="10" width="30" height="30" /></svg></div></div>',
    });
    expect(legacyEditor.getHTML()).toContain('data-qrcode="true"');
    legacyEditor.destroy();
  });

  it('drags a known variable to the drop cursor in the editor', () => {
    const variable = TEMPLATE_VARIABLES.find((entry) => entry.tag === '{{cliente.nome}}');
    if (!variable) throw new Error('Expected cliente.nome variable in the editor catalog');
    const transfer = new FakeDragTransfer();
    actions.startVariableDrag({ dataTransfer: transfer } as unknown as DragEvent, variable);
    const preventDefault = vi.fn();
    const event = {
      dataTransfer: transfer,
      clientX: 30,
      clientY: 12,
      preventDefault,
    } as unknown as DragEvent;

    actions.allowVariableDrop(event);
    actions.dropVariable(event);

    expect(transfer.effectAllowed).toBe('copy');
    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(fakeEditor.selections).toEqual([1]);
    expect(fakeEditor.dispatchedTransactions).toHaveLength(1);
    expect(fakeEditor.insertedContent[0]).toContain('{{cliente.nome}}');
  });

  it('inserts a validated image file and reports read failures', async () => {
    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    const input = { files: [file], value: 'logo.png' } as unknown as HTMLInputElement;
    await actions.insertImageFromFile({ target: input } as unknown as Event);

    expect(fakeEditor.images).toEqual([{ src: 'data:image/png;base64,bG9nbw==', alt: 'logo.png' }]);
    expect(input.value).toBe('');

    imageUpload.failure = new Error('Imagem inválida');
    await actions.insertImageFromFile({ target: input } as unknown as Event);
    expect(actions.imageError()).toBe('Imagem inválida');
  });

  it('salva in-place quando apenas o estilo muda em template persistido', async () => {
    const persisted: PrintTemplate = {
      ...saveFlow.template(),
      id: 'persisted-1',
      contentHtml: '<p>Doc</p>',
    };
    storage.persisted['persisted-1'] = persisted;
    saveFlow.template.set({ ...persisted });
    saveFlow.loadedContentHtml = '<p>Doc</p>';
    fakeEditor.html = '<p>Doc</p>';

    await saveFlow.saveTemplate();

    expect(saveFlow.showVersionConfirm()).toBe(false);
    expect(storage.savedCalls).toHaveLength(1);
    expect(storage.versionCalls).toHaveLength(0);
  });

  it('pede confirmação e cria nova versão quando o conteúdo muda', async () => {
    const persisted: PrintTemplate = {
      ...saveFlow.template(),
      id: 'persisted-2',
      contentHtml: '<p>Original</p>',
    };
    storage.persisted['persisted-2'] = persisted;
    saveFlow.template.set({ ...persisted });
    saveFlow.loadedContentHtml = '<p>Original</p>';
    fakeEditor.html = '<p>Alterado</p>';

    await saveFlow.saveTemplate();

    expect(saveFlow.showVersionConfirm()).toBe(true);
    expect(storage.savedCalls).toHaveLength(0);

    await saveFlow.confirmNewVersion();

    expect(storage.versionCalls).toHaveLength(1);
    expect(storage.versionCalls[0].id).toBe('persisted-2');
    expect(saveFlow.template().id).toBe('persisted-2-v2');
    expect(saveFlow.template().version).toBe(2);
    expect(router.navigate).toHaveBeenCalledWith(
      ['/admin/print-templates/editor', 'persisted-2-v2'],
      { replaceUrl: true },
    );
  });

  it('salva in-place quando o template ainda não existe no storage', async () => {
    saveFlow.template.update((t) => ({ ...t, id: 'brand-new' }));
    fakeEditor.html = '<p>Novo</p>';

    await saveFlow.saveTemplate();

    expect(saveFlow.showVersionConfirm()).toBe(false);
    expect(storage.savedCalls).toHaveLength(1);
  });
});
