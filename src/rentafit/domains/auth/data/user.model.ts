export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
  CUSTOMER = 'CUSTOMER'
}
      // *  this.id = user.getId();
      //   this.username = user.getUsername();
      //   this.name = user.getPerson() != null ? user.getPerson().getName() : null;
      //   this.pin = user.getPin();
      //   this.legacyId = user.getPerson() != null ? user.getPerson().getLegacyId() : null;
      //   this.roles = user.getRoles() != null ? user.getRoles().stream()
      //           .map(role -> role.getRole().name())
      //           .toList() : List.of();
      //   this.isActive = Boolean.TRUE.equals(user.getIsActive());
export interface User {
  id: string;
  username: string;
  legacyId?: string;
  email?: string;
  name?: string;
  pinConfigured?: boolean;
  role: UserRole;
  active: boolean;
  passwordExpired?: boolean;
  issuerCnpj?: string;
  createdAt?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ISignUpAddress {
  zipCode: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

export interface SignUpRequest {
  name: string;
  username: string;
  email: string;
  document: string;
  phones: string[];
  address: ISignUpAddress;
  number?: string;
  complement?: string;
}

/** Cadastro aceito: a conta aguarda a confirmação do e-mail. */
export interface SignUpResponse {
  maskedEmail: string;
}
