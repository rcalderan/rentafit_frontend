import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CertificateService } from '../../service/certificate.service';
import { ICertificateDetails } from '../../data/certificate.model';
import { IssuerSetupService } from '../../../auth/services/issuer-setup.service';
import {
  IssuerBranchSetupRequest,
  IssuerInfo,
  IssuerSetupRequest,
} from '../../../auth/data/issuer.model';

@Component({
  selector: 'rentafit-cnpj',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './cnpj.component.html',
  styleUrl: './cnpj.component.css',
})
export class CnpjComponent implements OnInit {
  private readonly certificateService = inject(CertificateService);
  private readonly issuerSetupService = inject(IssuerSetupService);

  details = signal<ICertificateDetails | null>(null);
  selectedFile = signal<File | null>(null);
  password = signal('');
  isUploading = signal(false);
  errorMessage = signal<string | null>(null);
  showUploadModal = signal(false);

  showUploadControls = computed(() => {
    const d = this.details();
    if (!d) return true;
    if (!d.valido) return true;
    if (d.diasRestantes == null) return true;
    return d.diasRestantes <= 30;
  });

  uploadButtonLabel = computed(() => (this.details() ? 'Atualizar' : 'Verificar'));

  /** --- Firm / Issuer --- */
  firm = signal<IssuerInfo | null>(null);
  firmLoading = signal(false);
  firmEditing = signal(false);
  firmSaving = signal(false);
  firmError = signal<string | null>(null);

  editRazaoSocial = '';
  editNomeFantasia = '';
  editIe = '';
  editIm = '';
  editCrt = '1';
  editFone = '';
  editLogradouro = '';
  editNumero = '';
  editBairro = '';
  editMunicipioCodigo = '';
  editMunicipioNome = '';
  editUf = '';
  editCep = '';
  editPaisCodigo = '1058';
  editPaisNome = 'BRASIL';

  /** Campos fiscais NFS-e salvos junto ao emitente (sistema/cnpj). */
  editNfseServiceCode = '';
  editNfseNbsCode = '';
  editNfseServiceDescription = '';
  editNfseIssRate: number | null = null;
  editNfseTotalTaxRate: number | null = null;
  /** true = envia a IM do prestador na NFS-e (E0120 exige cadastro no CNC do município). */
  editNfseSendIm = false;

  /** --- Branches / Filiais --- */
  branches = signal<IssuerInfo[]>([]);
  branchLoading = signal(false);
  branchSaving = signal(false);
  branchError = signal<string | null>(null);
  showBranchForm = signal(false);

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

  ngOnInit(): void {
    this.loadStatus();
    this.loadFirm();
    this.loadBranches();
  }

  loadStatus(): void {
    this.certificateService.status().subscribe({
      next: (status) => {
        this.details.set(status);
        this.errorMessage.set(null);
      },
      error: (err: Error) => this.errorMessage.set(err.message),
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    if (!file.name.toLowerCase().endsWith('.pfx')) {
      this.errorMessage.set('O arquivo deve estar no formato .pfx.');
      this.selectedFile.set(null);
      this.password.set('');
      return;
    }
    this.errorMessage.set(null);
    this.selectedFile.set(file);
  }

  openUploadModal(): void {
    this.password.set('');
    this.errorMessage.set(null);
    this.showUploadModal.set(true);
  }

  closeUploadModal(): void {
    this.showUploadModal.set(false);
    this.password.set('');
    this.errorMessage.set(null);
  }

  upload(): void {
    const file = this.selectedFile();
    const password = this.password();
    if (!file || !password) return;

    this.isUploading.set(true);
    this.errorMessage.set(null);
    this.certificateService.upload(file, password).subscribe({
      next: (status) => {
        this.details.set(status);
        this.showUploadModal.set(false);
        this.selectedFile.set(null);
        this.password.set('');
        this.isUploading.set(false);
      },
      error: (err: Error) => {
        this.errorMessage.set(err.message);
        this.isUploading.set(false);
      },
    });
  }

  /** --- Firm / Issuer methods --- */
  loadFirm(): void {
    this.firmLoading.set(true);
    this.firmError.set(null);
    this.issuerSetupService.getCurrentIssuer().subscribe({
      next: (issuer) => {
        this.firm.set(issuer);
        this.firmLoading.set(false);
        if (issuer) {
          this.populateEditFields(issuer);
        }
      },
      error: (err: Error) => {
        this.firmError.set(err.message);
        this.firmLoading.set(false);
      },
    });
  }

  private populateEditFields(f: IssuerInfo): void {
    this.editRazaoSocial = f.razaoSocial || '';
    this.editNomeFantasia = f.nomeFantasia || '';
    this.editIe = f.ie || '';
    this.editIm = f.im || '';
    this.editCrt = f.crt || '1';
    this.editFone = f.fone || '';
    this.editLogradouro = f.logradouro || '';
    this.editNumero = f.numero || '';
    this.editBairro = f.bairro || '';
    this.editMunicipioCodigo = f.municipioCodigo || '';
    this.editMunicipioNome = f.municipioNome || '';
    this.editUf = f.uf || '';
    this.editCep = f.cep || '';
    this.editPaisCodigo = f.paisCodigo || '1058';
    this.editPaisNome = f.paisNome || 'BRASIL';
    this.editNfseServiceCode = f.nfseServiceCode || '';
    this.editNfseNbsCode = f.nfseNbsCode || '';
    this.editNfseServiceDescription = f.nfseServiceDescription || '';
    this.editNfseIssRate = f.nfseIssRate ?? null;
    this.editNfseTotalTaxRate = f.nfseTotalTaxRate ?? null;
    this.editNfseSendIm = f.nfseSendIm ?? false;
  }

  startEditFirm(): void {
    this.firmEditing.set(true);
    this.firmError.set(null);
  }

  cancelEditFirm(): void {
    this.firmEditing.set(false);
    const f = this.firm();
    if (f) {
      this.populateEditFields(f);
    }
  }

  saveFirm(): void {
    const f = this.firm();
    if (!f) {
      return;
    }
    this.firmSaving.set(true);
    this.firmError.set(null);
    const request: IssuerSetupRequest = {
      cnpj: f.cnpj,
      razaoSocial: this.editRazaoSocial.trim(),
      nomeFantasia: this.editNomeFantasia.trim() || undefined,
      ie: this.editIe.trim() || undefined,
      im: this.editIm.trim() || undefined,
      crt: this.editCrt,
      fone: this.editFone.trim() || undefined,
      logradouro: this.editLogradouro.trim(),
      numero: this.editNumero.trim(),
      bairro: this.editBairro.trim(),
      municipioCodigo: this.editMunicipioCodigo.trim(),
      municipioNome: this.editMunicipioNome.trim(),
      uf: this.editUf.trim().toUpperCase(),
      cep: this.editCep.replace(/\D/g, ''),
      paisCodigo: this.editPaisCodigo.trim(),
      paisNome: this.editPaisNome.trim(),
      nfseServiceCode: this.editNfseServiceCode.replace(/\D/g, '') || undefined,
      nfseNbsCode: this.editNfseNbsCode.trim() || undefined,
      nfseServiceDescription: this.editNfseServiceDescription.trim() || undefined,
      nfseIssRate: this.editNfseIssRate ?? undefined,
      nfseTotalTaxRate: this.editNfseTotalTaxRate ?? undefined,
      nfseSendIm: this.editNfseSendIm,
    };
    this.issuerSetupService.configureIssuer(request).subscribe({
      next: (updated) => {
        this.firm.set(updated);
        this.populateEditFields(updated);
        this.firmEditing.set(false);
        this.firmSaving.set(false);
      },
      error: (err: Error) => {
        this.firmError.set(err.message);
        this.firmSaving.set(false);
      },
    });
  }

  /** --- Branch / Filial methods --- */
  toggleBranchForm(): void {
    this.showBranchForm.set(!this.showBranchForm());
    this.branchError.set(null);
  }

  loadBranches(): void {
    this.branchLoading.set(true);
    this.branchError.set(null);
    this.issuerSetupService.listBranches().subscribe({
      next: (list) => {
        this.branches.set(list);
        this.branchLoading.set(false);
      },
      error: (err: Error) => {
        this.branchError.set(err.message);
        this.branchLoading.set(false);
      },
    });
  }

  submitBranch(): void {
    const validationError = this.validateBranch();
    if (validationError) {
      this.branchError.set(validationError);
      return;
    }

    this.branchSaving.set(true);
    this.branchError.set(null);
    const request: IssuerBranchSetupRequest = this.buildBranchRequest();
    this.issuerSetupService.configureBranch(request).subscribe({
      next: () => {
        this.branchSaving.set(false);
        this.resetBranchForm();
        this.showBranchForm.set(false);
        this.loadBranches();
      },
      error: (err: Error) => {
        this.branchError.set(err.message);
        this.branchSaving.set(false);
      },
    });
  }

  private buildBranchRequest(): IssuerBranchSetupRequest {
    return {
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
}
