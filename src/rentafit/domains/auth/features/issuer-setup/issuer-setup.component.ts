import { Component, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { IssuerSetupService } from '../../services/issuer-setup.service';
import { IssuerBranchSetupRequest, IssuerInfo, IssuerSetupRequest } from '../../data/issuer.model';
import { resolveHomeRoute } from '../../utils/role-route.util';

@Component({
  selector: 'rentafit-issuer-setup',
  imports: [FormsModule, CommonModule],
  templateUrl: './issuer-setup.component.html',
  styleUrl: './issuer-setup.component.css',
})
export class IssuerSetupComponent {
  private readonly authService = inject(AuthService);
  private readonly issuerSetupService = inject(IssuerSetupService);
  private readonly router = inject(Router);

  cnpj = '';
  razaoSocial = '';
  nomeFantasia = '';
  ie = '';
  im = '';
  crt = '1';
  fone = '';
  logradouro = '';
  numero = '';
  bairro = '';
  municipioCodigo = '';
  municipioNome = '';
  uf = '';
  cep = '';
  paisCodigo = '1058';
  paisNome = 'BRASIL';

  /** Campos fiscais NFS-e salvos junto ao emitente. */
  nfseServiceCode = '';
  nfseNbsCode = '';
  nfseServiceDescription = '';
  nfseIssRate: number | null = null;
  nfseTotalTaxRate: number | null = null;
  /** true = envia a IM do prestador na NFS-e (exige cadastro no CNC do município). */
  nfseSendIm = false;

  errorMessage = signal<string | null>(null);
  isLoading = signal(false);

  /** --- Filiais --- */
  showBranchForm = signal(false);
  branches = signal<IssuerInfo[]>([]);
  branchCnpj = '';
  branchNomeFantasia = '';
  branchIe = '';
  branchIm = '';
  branchFone = '';
  branchLogradouro = '';
  branchNumero = '';
  branchBairro = '';
  branchMunicipioCodigo = '';
  branchMunicipioNome = '';
  branchUf = '';
  branchCep = '';

  toggleBranchForm(): void {
    this.showBranchForm.set(!this.showBranchForm());
    if (this.showBranchForm()) {
      this.loadBranches();
    }
  }

  private loadBranches(): void {
    this.issuerSetupService.listBranches().subscribe({
      next: (issuers) => this.branches.set(issuers),
      error: () => this.branches.set([]),
    });
  }

  submitBranch(): void {
    const validationError = this.validateBranch();
    if (validationError) {
      this.errorMessage.set(validationError);
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const request: IssuerBranchSetupRequest = {
      cnpj: this.branchCnpj.replace(/\D/g, ''),
      nomeFantasia: this.branchNomeFantasia.trim() || undefined,
      ie: this.branchIe.trim() || undefined,
      im: this.branchIm.trim() || undefined,
      fone: this.branchFone.trim() || undefined,
      logradouro: this.branchLogradouro.trim(),
      numero: this.branchNumero.trim(),
      bairro: this.branchBairro.trim(),
      municipioCodigo: this.branchMunicipioCodigo.trim(),
      municipioNome: this.branchMunicipioNome.trim(),
      uf: this.branchUf.trim().toUpperCase(),
      cep: this.branchCep.replace(/\D/g, ''),
    };
    this.issuerSetupService.configureBranch(request).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.resetBranchForm();
        this.loadBranches();
      },
      error: (err: Error) => this.handleError(err),
    });
  }

  private resetBranchForm(): void {
    this.branchCnpj = '';
    this.branchNomeFantasia = '';
    this.branchIe = '';
    this.branchIm = '';
    this.branchFone = '';
    this.branchLogradouro = '';
    this.branchNumero = '';
    this.branchBairro = '';
    this.branchMunicipioCodigo = '';
    this.branchMunicipioNome = '';
    this.branchUf = '';
    this.branchCep = '';
  }

  private validateBranch(): string | null {
    const cnpj = this.branchCnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) return 'CNPJ da filial deve conter 14 dígitos.';
    if (cnpj.substring(8, 12) === '0001')
      return 'CNPJ da filial deve ter sufixo diferente de 0001 (matriz).';
    if (!this.branchLogradouro.trim()) return 'Logradouro da filial é obrigatório.';
    if (!this.branchNumero.trim()) return 'Número da filial é obrigatório.';
    if (!this.branchBairro.trim()) return 'Bairro da filial é obrigatório.';
    if (!this.branchMunicipioCodigo.trim()) return 'Código do município da filial é obrigatório.';
    if (!this.branchMunicipioNome.trim()) return 'Nome do município da filial é obrigatório.';
    if (!this.branchUf.trim() || this.branchUf.trim().length !== 2)
      return 'UF da filial deve conter 2 letras.';
    const cep = this.branchCep.replace(/\D/g, '');
    if (cep.length !== 8) return 'CEP da filial deve conter 8 dígitos.';
    return null;
  }

  submit(): void {
    const validationError = this.validate();
    if (validationError) {
      this.errorMessage.set(validationError);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const request = this.buildRequest();
    this.issuerSetupService.configureIssuer(request).subscribe({
      next: () => this.linkIssuerToUser(request.cnpj),
      error: (err: Error) => this.handleError(err),
    });
  }

  private buildRequest(): IssuerSetupRequest {
    return {
      cnpj: this.cnpj.replace(/\D/g, ''),
      razaoSocial: this.razaoSocial.trim(),
      nomeFantasia: this.nomeFantasia.trim() || undefined,
      ie: this.ie.trim() || undefined,
      im: this.im.trim() || undefined,
      crt: this.crt,
      fone: this.fone.trim() || undefined,
      logradouro: this.logradouro.trim(),
      numero: this.numero.trim(),
      bairro: this.bairro.trim(),
      municipioCodigo: this.municipioCodigo.trim(),
      municipioNome: this.municipioNome.trim(),
      uf: this.uf.trim().toUpperCase(),
      cep: this.cep.replace(/\D/g, ''),
      paisCodigo: this.paisCodigo.trim(),
      paisNome: this.paisNome.trim(),
      nfseServiceCode: this.nfseServiceCode.replace(/\D/g, '') || undefined,
      nfseNbsCode: this.nfseNbsCode.trim() || undefined,
      nfseServiceDescription: this.nfseServiceDescription.trim() || undefined,
      nfseIssRate: this.nfseIssRate ?? undefined,
      nfseTotalTaxRate: this.nfseTotalTaxRate ?? undefined,
      nfseSendIm: this.nfseSendIm,
    };
  }

  private linkIssuerToUser(cnpj: string): void {
    this.authService.setupIssuerCnpj(cnpj).subscribe({
      next: () => this.navigateHome(),
      error: (err: Error) => this.handleError(err),
    });
  }

  private navigateHome(): void {
    this.isLoading.set(false);
    const user = this.authService.getCurrentUser();
    this.router.navigate([resolveHomeRoute(user?.role)]);
  }

  private handleError(err: Error): void {
    this.isLoading.set(false);
    this.errorMessage.set(err.message || 'Erro ao configurar emitente.');
  }

  private validate(): string | null {
    const cnpj = this.cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) return 'CNPJ deve conter 14 dígitos.';
    if (!this.razaoSocial.trim()) return 'Razão Social é obrigatória.';
    if (!this.crt) return 'CRT é obrigatório.';
    if (!this.uf.trim() || this.uf.trim().length !== 2) return 'UF deve conter 2 letras.';
    if (!this.logradouro.trim()) return 'Logradouro é obrigatório.';
    if (!this.numero.trim()) return 'Número é obrigatório.';
    if (!this.bairro.trim()) return 'Bairro é obrigatório.';
    if (!this.municipioCodigo.trim()) return 'Código do município é obrigatório.';
    if (!this.municipioNome.trim()) return 'Nome do município é obrigatório.';
    const cep = this.cep.replace(/\D/g, '');
    if (cep.length !== 8) return 'CEP deve conter 8 dígitos.';
    return null;
  }
}
