import { Injectable } from '@angular/core';
import QRCode from 'qrcode';

@Injectable({ providedIn: 'root' })
export class NfceQrCodeService {
  replaceMarkers(html: string, url: string): string {
    const documentTemplate = document.createElement('template');
    documentTemplate.innerHTML = html;
    const markers = documentTemplate.content.querySelectorAll<HTMLElement>('[data-qrcode="true"]');
    const legacyQr = html.includes('DANFE NFC-e')
      ? Array.from(documentTemplate.content.querySelectorAll('svg')).find((svg) =>
          svg.querySelector('rect[x="10"][y="10"][width="30"][height="30"]'),
        )
      : undefined;
    if (markers.length === 0 && !legacyQr) return html;
    if (!url.trim()) {
      markers.forEach((marker) => marker.remove());
      legacyQr?.remove();
      return documentTemplate.innerHTML;
    }
    markers.forEach((marker) => {
      const width = Number(marker.querySelector('svg')?.getAttribute('width')) || 120;
      marker.removeAttribute('data-qrcode');
      marker.innerHTML = this.createSvg(url, width);
    });
    if (markers.length === 0 && legacyQr) {
      const width = Number(legacyQr.getAttribute('width')) || 120;
      legacyQr.outerHTML = this.createSvg(url, width);
    }
    return documentTemplate.innerHTML;
  }

  async generateDataUrl(text: string, width = 120): Promise<string> {
    try {
      return await QRCode.toDataURL(text, {
        width,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
    } catch {
      return '';
    }
  }

  private createSvg(value: string, width: number): string {
    try {
      const modules = QRCode.create(value, { errorCorrectionLevel: 'M' }).modules;
      const quietZone = 4;
      const commands: string[] = [];
      for (let row = 0; row < modules.size; row++) {
        for (let column = 0; column < modules.size; column++) {
          if (modules.get(row, column)) commands.push(`M${column + quietZone} ${row + quietZone}h1v1h-1z`);
        }
      }
      const viewSize = modules.size + quietZone * 2;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" viewBox="0 0 ${viewSize} ${viewSize}" role="img" aria-label="QR Code da consulta NFC-e"><rect width="${viewSize}" height="${viewSize}" fill="#fff"/><path d="${commands.join('')}" fill="#000"/></svg>`;
    } catch {
      return '';
    }
  }
}
