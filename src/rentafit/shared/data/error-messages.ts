/**
 * Mensagens de erro padronizadas para a aplicação
 */
export enum ErrorMessages {
  CONNECTION_ERROR = 'Erro de conexão. Verifique sua internet.',
  INVALID_FORMAT = 'Formato inválido. Verifique os dados informados.',
  NOT_FOUND = 'Registro não encontrado.',
  TIMEOUT = 'A requisição expirou. Tente novamente.',
  SERVER_ERROR = 'Erro interno no servidor. Tente novamente mais tarde.',
  PAYLOAD_TOO_LARGE = 'Arquivo ou requisição maior que o permitido.',
  RATE_LIMITED = 'Muitas requisições deste dispositivo. Aguarde alguns instantes e tente novamente.',
  UNKNOWN_ERROR = 'Ocorreu um erro inesperado.',
  
  // Mensagens específicas (opcional, ou manter genéricas)
  ZIP_CODE_NOT_FOUND = 'CEP não encontrado.',
  ZIP_CODE_INVALID = 'CEP inválido. Verifique o formato.',
}

/**
 * Mapeamento de status HTTP para mensagens amigáveis
 */
export const HTTP_ERROR_MAP: Record<number, string> = {
  0: ErrorMessages.CONNECTION_ERROR,
  400: ErrorMessages.INVALID_FORMAT,
  404: ErrorMessages.NOT_FOUND,
  408: ErrorMessages.TIMEOUT,
  413: ErrorMessages.PAYLOAD_TOO_LARGE,
  429: ErrorMessages.RATE_LIMITED,
  500: ErrorMessages.SERVER_ERROR
};
