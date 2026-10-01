import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PrintImageUploadService } from './print-image-upload.service';

describe('PrintImageUploadService', () => {
  let service: PrintImageUploadService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PrintImageUploadService);
  });

  it('converts a supported image to a data URL', async () => {
    const file = new File(['logo'], 'logo.png', { type: 'image/png' });

    await expect(service.readAsDataUrl(file)).resolves.toMatch(/^data:image\/png;base64,/);
  });

  it('rejects unsupported and oversized files with the expected format', async () => {
    const unsupported = new File(['text'], 'logo.svg', { type: 'image/svg+xml' });
    const oversized = new File([new Uint8Array(512 * 1024 + 1)], 'large.png', { type: 'image/png' });

    await expect(service.readAsDataUrl(unsupported)).rejects.toThrow('PNG/JPEG/WebP/GIF até 512 KB');
    await expect(service.readAsDataUrl(oversized)).rejects.toThrow('PNG/JPEG/WebP/GIF até 512 KB');
  });
});
