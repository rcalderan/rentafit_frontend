import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Editor } from '@tiptap/core';
import { TableRow } from '@tiptap/extension-table-row';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PrintBlockSpacing,
  PrintTable,
  PrintTableCell,
  PrintTableHeader,
} from '../../data/print-editor.extensions';
import { EditorToolbarComponent } from './editor-toolbar.component';

describe('EditorToolbarComponent block spacing', () => {
  let editor: Editor;
  let fixture: ComponentFixture<EditorToolbarComponent>;
  let host: HTMLDivElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EditorToolbarComponent] });
    host = document.createElement('div');
    document.body.append(host);
  });

  afterEach(() => {
    fixture?.destroy();
    editor?.destroy();
    host?.remove();
  });

  it('applies and reads editable line height and paragraph spacing at a collapsed cursor', () => {
    createEditor('<p>Primeiro parágrafo</p><p>Segundo parágrafo</p>');
    editor.commands.setTextSelection(5);

    setNumberInput('input[list="tb-lh-presets"]', '2.2');
    setNumberInput('label[title*="depois do bloco"] input', '30');

    const paragraphs = editor.state.doc.content.content;
    expect(paragraphs[0].attrs['blockLineHeight']).toBe('2.2');
    expect(paragraphs[0].attrs['spacingAfter']).toBe('30pt');
    expect(paragraphs[1].attrs['blockLineHeight']).toBeNull();
    expect(paragraphs[1].attrs['spacingAfter']).toBeNull();
    expect(editor.getHTML()).toContain('line-height: 2.2');
    expect(editor.getHTML()).toContain('margin-bottom: 30pt');
  });

  it('applies component spacing to a table ancestor when the cursor is inside a cell', () => {
    createEditor('<table><tbody><tr><td><p>Célula</p></td></tr></tbody></table>');
    editor.commands.setTextSelection(5);

    setNumberInput('label[title*="antes do bloco"] input', '24');

    const table = editor.state.doc.firstChild;
    expect(table?.type.name).toBe('table');
    expect(table?.attrs['spacingBefore']).toBe('24pt');
    expect(editor.getHTML()).toContain('margin-top: 24pt');
  });

  function createEditor(content: string): void {
    editor = new Editor({
      element: host,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        TextStyleKit,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        PrintTable.configure({ resizable: true }),
        TableRow,
        PrintTableHeader,
        PrintTableCell,
        PrintBlockSpacing,
      ],
      content,
    });
    fixture = TestBed.createComponent(EditorToolbarComponent);
    fixture.componentRef.setInput('editor', editor);
    fixture.detectChanges();
  }

  function setNumberInput(selector: string, value: string): void {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }
});
