import { Injectable } from '@angular/core';

const MAX_IMAGE_SIZE_BYTES = 512 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

@Injectable({ providedIn: 'root' })
export class PrintImageUploadService {
  readAsDataUrl(file: File): Promise<string> {
    const validationError = this.validateFile(file);
    return validationError ? Promise.reject(validationError) : this.readFile(file);
  }

  private validateFile(file: File): Error | null {
    if (!SUPPORTED_IMAGE_TYPES.has(file.type) || file.size === 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
      return new Error(`Imagem "${file.name}" inválida; use PNG/JPEG/WebP/GIF até 512 KB.`);
    }
    return null;
  }

  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => this.resolveDataUrl(reader, file, resolve, reject);
      reader.onerror = () => reject(new Error(`Não foi possível ler a imagem "${file.name}".`));
      reader.readAsDataURL(file);
    });
  }

  private resolveDataUrl(
    reader: FileReader,
    file: File,
    resolve: (value: string) => void,
    reject: (reason: Error) => void,
  ): void {
    const expectedPrefix = `data:${file.type};base64,`;
    if (typeof reader.result !== 'string' || !reader.result.startsWith(expectedPrefix)) {
      reject(new Error(`O arquivo "${file.name}" não gerou uma imagem válida.`));
      return;
    }
    resolve(reader.result);
  }
}
