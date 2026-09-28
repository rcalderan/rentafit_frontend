import { Injectable, SecurityContext, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';

const SAFE_STYLE_PROPERTIES = new Set([
  'align-items',
  'background',
  'background-color',
  'border',
  'border-bottom',
  'border-collapse',
  'border-color',
  'border-left',
  'border-radius',
  'border-right',
  'border-style',
  'border-top',
  'border-width',
  'box-sizing',
  'color',
  'display',
  'flex',
  'flex-direction',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'gap',
  'height',
  'justify-content',
  'letter-spacing',
  'line-height',
  'list-style-type',
  'margin',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'max-width',
  'min-width',
  'opacity',
  'padding',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'page-break-after',
  'page-break-before',
  'page-break-inside',
  'text-align',
  'text-decoration',
  'text-indent',
  'text-transform',
  'vertical-align',
  'white-space',
  'width',
  'word-break',
]);
const UNSAFE_CSS_VALUE = /(?:url|expression|var)\s*\(|javascript\s*:|@import/i;

@Injectable({ providedIn: 'root' })
export class PrintHtmlSanitizerService {
  private readonly domSanitizer = inject(DomSanitizer);

  sanitize(html: string): SafeHtml | string {
    if (!DOMPurify.isSupported) {
      return this.domSanitizer.sanitize(SecurityContext.HTML, html) ?? '';
    }
    const fragment = DOMPurify.sanitize(html, {
      RETURN_DOM_FRAGMENT: true,
      USE_PROFILES: { html: true, svg: true },
      FORBID_TAGS: ['embed', 'form', 'iframe', 'object', 'script', 'style'],
    });
    this.sanitizeStyles(fragment);
    const container = document.createElement('div');
    container.append(fragment);
    return this.domSanitizer.bypassSecurityTrustHtml(container.innerHTML);
  }

  private sanitizeStyles(fragment: DocumentFragment): void {
    fragment.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
      const style = element.style;
      const properties = Array.from({ length: style.length }, (_, index) => style.item(index));
      properties.forEach((property) => {
        const value = style.getPropertyValue(property);
        if (!SAFE_STYLE_PROPERTIES.has(property) || UNSAFE_CSS_VALUE.test(value)) {
          style.removeProperty(property);
        }
      });
      if (!style.cssText) element.removeAttribute('style');
    });
  }
}
