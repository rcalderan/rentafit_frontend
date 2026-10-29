import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { IAddress, AddressResponse } from '../data/address.model';
import { ErrorMessages } from '../../../shared/data/error-messages';
import { apiErrorMessage } from '../../../shared/utils/api-error';
import { APP_CONFIG } from '../../../shared/data/app-config.token';

/**
 * Serviço responsável por operações relacionadas a endereços
 * Fornece métodos para busca e manipulação de dados de endereço
 */
@Injectable({
  providedIn: 'root'
})
export class AddressService {
  private readonly config = inject(APP_CONFIG);
  private readonly apiUrl = `${this.config.apiBaseUrl}/api/v1/addresses`;
  private readonly requestTimeout = 30000; // 30 segundos

  constructor(private http: HttpClient) {}

  /**
   * Busca endereço por CEP
   * @param zipCode - CEP no formato: XXXXX-XXX
   * @returns Observable<IAddress> - Endereço encontrado
   * @throws Erro se CEP for inválido ou não encontrado
   * @example
   * this.addressService.searchByZipCode('01310-100').subscribe({
   *   next: (address) => console.log(address),
   *   error: (error) => console.error(error)
   * });
   */
  searchByZipCode(zipCode: string): Observable<IAddress> {
    // Validação do CEP
    if (!zipCode || zipCode.trim().length === 0) {
      return throwError(() => new Error('CEP não pode estar vazio'));
    }

    const sanitizedZipCode = this.sanitizeZipCode(zipCode);

    return this.http.get<AddressResponse>(
      `${this.apiUrl}/find/${sanitizedZipCode}`
    ).pipe(
      //timeout(this.requestTimeout),
      map(response => this.mapAddressResponse(response)),
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Remove caracteres especiais do CEP
   * @param zipCode - CEP com possíveis caracteres especiais
   * @returns CEP limpo
   * @private
   */
  private sanitizeZipCode(zipCode: string): string {
    return zipCode.replace(/\D/g, '');
  }

  /**
   * Mapeia a resposta da API para o formato esperado
   * @param response - Resposta bruta da API
   * @returns IAddress mapeado e validado
   * @private
   */
  private mapAddressResponse(response: AddressResponse): IAddress {
    return {
      zipCode: response.zipCode?.trim() || '',
      street: response.street?.trim() || '',
      neighborhood: response.neighborhood?.trim() || '',
      city: response.city?.trim() || '',
      state: response.state?.trim().toUpperCase() || ''
    };
  }

  /**
   * Trata erros da requisição HTTP
   * @param error - Erro da requisição
   * @returns Observable que emite um erro tratado
   * @private
   */
  private handleError(error: HttpErrorResponse | Error): Observable<never> {
    let errorMessage = 'Erro ao buscar endereço';

    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) errorMessage = ErrorMessages.ZIP_CODE_INVALID;
      else if (error.status === 404) errorMessage = ErrorMessages.ZIP_CODE_NOT_FOUND;
      else errorMessage = apiErrorMessage(error);

      console.error('Erro HTTP:', {
        status: error.status,
        statusText: error.statusText,
        message: error.message
      });
    } else if (error instanceof Error) {
      errorMessage = error.message;
      console.error('Erro:', error.message);
    }

    return throwError(() => new Error(errorMessage));
  }
}
