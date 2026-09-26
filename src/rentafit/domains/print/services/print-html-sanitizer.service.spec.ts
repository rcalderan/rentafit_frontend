import { SecurityContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { PrintHtmlSanitizerService } from './print-html-sanitizer.service';

describe('PrintHtmlSanitizerService', () => {
  let service: PrintHtmlSanitizerService;
  let domSanitizer: DomSanitizer;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PrintHtmlSanitizerService);
    domSanitizer = TestBed.inject(DomSanitizer);
  });

  it('preserves safe inline formatting required by preview and print', () => {
    const safeHtml = service.sanitize(
      '<p style="line-height: 2.2; margin-bottom: 30pt; color: #123456">Texto</p><table><tbody><tr><td style="background-color: #ffcc00; border-style: dashed; vertical-align: middle">Célula</td></tr></tbody></table>',
    );
    const sanitized = domSanitizer.sanitize(SecurityContext.HTML, safeHtml);
    const container = document.createElement('div');
    container.innerHTML = sanitized ?? '';
    const paragraph = container.querySelector('p');
    const cell = container.querySelector('td');

    expect(paragraph?.style.lineHeight).toBe('2.2');
    expect(paragraph?.style.marginBottom).toBe('30pt');
    expect(paragraph?.style.color).toBe('rgb(18, 52, 86)');
    expect(cell?.style.backgroundColor).toBe('rgb(255, 204, 0)');
    expect(cell?.style.borderStyle).toBe('dashed');
    expect(cell?.style.verticalAlign).toBe('middle');
  });

  it('removes script, event attributes, URL-based CSS and unsafe positioning', () => {
    const safeHtml = service.sanitize(
      '<p style="line-height: 1.8; position: fixed; background-image: url(https://attacker.test/pixel)"><img src="x" onerror="alert(1)"><script>alert(1)</script>Seguro</p><a href="javascript:alert(1)">link</a>',
    );
    const sanitized = domSanitizer.sanitize(SecurityContext.HTML, safeHtml);
    const container = document.createElement('div');
    container.innerHTML = sanitized ?? '';
    const paragraph = container.querySelector('p');
    const image = container.querySelector('img');
    const link = container.querySelector('a');

    expect(paragraph?.style.lineHeight).toBe('1.8');
    expect(paragraph?.style.position).toBe('');
    expect(paragraph?.style.backgroundImage).toBe('');
    expect(image?.hasAttribute('onerror')).toBe(false);
    expect(container.querySelector('script')).toBeNull();
    expect(link?.getAttribute('href')).toBeNull();
  });
});
