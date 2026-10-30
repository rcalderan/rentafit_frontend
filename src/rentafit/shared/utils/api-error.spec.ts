import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { ErrorMessages } from '../data/error-messages';
import { apiErrorMessage, apiErrorMessages } from './api-error';

describe('apiErrorMessage', () => {
  it('prioriza message do ErrorResponse (/api) sobre HTTP_ERROR_MAP', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: {
        status: 400,
        error: 'Bad Request',
        message: 'CPF já cadastrado para outro cliente.',
        path: '/api/v1/customers',
      },
    });
    expect(apiErrorMessage(err)).toBe('CPF já cadastrado para outro cliente.');
  });

  it('extrai errors[].message de validação 400 mesmo com message vazio (prod)', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: {
        status: 400,
        error: '',
        message: '',
        path: '/api/v1/products/rental',
        errors: [
          { field: 'name', message: 'Nome é obrigatório' },
          { field: 'rentalPrice', message: 'Preço deve ser positivo' },
        ],
      },
    });
    expect(apiErrorMessage(err)).toBe('Nome é obrigatório | Preço deve ser positivo');
    expect(apiErrorMessages(err)).toEqual(['Nome é obrigatório', 'Preço deve ser positivo']);
  });

  it('ignora máscaras técnicas em inglês de prod e cai no HTTP_ERROR_MAP em pt-BR', () => {
    const err = new HttpErrorResponse({
      status: 500,
      error: {
        status: 500,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        path: '/api/v1/rental/contracts',
      },
    });
    expect(apiErrorMessage(err)).toBe(ErrorMessages.SERVER_ERROR);
  });

  it('ignora "Invalid argument" em prod e usa fallback ou HTTP_ERROR_MAP', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: {
        status: 400,
        error: '',
        message: 'Invalid argument',
        path: '/api/v1/sectors',
      },
    });
    expect(apiErrorMessage(err)).toBe(ErrorMessages.INVALID_FORMAT);
    expect(apiErrorMessage(err, 'Falha customizada.')).toBe('Falha customizada.');
  });

  it('extrai campo error do nfe-api quando não é envelope ErrorResponse', () => {
    const err = new HttpErrorResponse({
      status: 422,
      error: { error: 'Rejeição 539: Duplicidade de NF-e' },
    });
    expect(apiErrorMessage(err)).toBe('Rejeição 539: Duplicidade de NF-e');
  });

  it('extrai mapa plano {campo: msg} de validação 400 do nfe-api', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: { cnpj: 'CNPJ inválido', uf: 'UF deve ter 2 letras' },
    });
    expect(apiErrorMessage(err)).toBe('CNPJ inválido | UF deve ter 2 letras');
  });

  it('extrai campo erro do CertificateDetailsResponse', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: { valido: false, erro: 'Senha do certificado incorreta.' },
    });
    expect(apiErrorMessage(err)).toBe('Senha do certificado incorreta.');
  });

  it('extrai array message do NestJS (/nfse-api)', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: {
        statusCode: 400,
        message: ['serviceCode é obrigatório', 'valor deve ser maior que zero'],
        error: 'Bad Request',
      },
    });
    expect(apiErrorMessage(err)).toBe('serviceCode é obrigatório | valor deve ser maior que zero');
  });

  it('não usa reason-phrase (error: "Unprocessable Entity") quando envelope /api vem sem message útil', () => {
    const err = new HttpErrorResponse({
      status: 422,
      error: {
        status: 422,
        error: 'Unprocessable Entity',
        message: '',
        path: '/api/fiscal-documents',
      },
    });
    expect(apiErrorMessage(err, 'Falha fiscal.')).toBe('Falha fiscal.');
  });

  it('preserva mensagem de Error já embrulhado por service', () => {
    const err = new Error('Roupa já reservada para esta data.');
    expect(apiErrorMessage(err, 'Erro genérico')).toBe('Roupa já reservada para esta data.');
  });

  it('nunca vaza HttpErrorResponse.message ("Http failure response for...") quando body é nulo', () => {
    const err = new HttpErrorResponse({ status: 503, url: 'http://internal/api/x' });
    expect(apiErrorMessage(err)).toBe(ErrorMessages.UNKNOWN_ERROR);
  });
});
