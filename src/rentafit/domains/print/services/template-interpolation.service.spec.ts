import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateInterpolationService } from './template-interpolation.service';

describe('TemplateInterpolationService', () => {
  let service: TemplateInterpolationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TemplateInterpolationService);
  });

  it('deve interpolar tags simples de cliente e empresa', () => {
    const template = 'Cliente: {{cliente.nome}}, CNPJ: {{empresa.cnpj}}';
    const result = service.interpolate(template, {
      cliente: {
        nome: 'João da Silva',
        documento: '111.222.333-44',
        rg: '',
        endereco: '',
        bairro: '',
        cidade: '',
        uf: '',
        cep: '',
        telefone: '',
        email: '',
      },
      empresa: {
        nomeFantasia: 'Loja Teste',
        razaoSocial: '',
        cnpj: '12.345.678/0001-90',
        ie: '',
        im: '',
        endereco: '',
        telefone: '',
        email: '',
        cidade: '',
      },
    });

    expect(result).toContain('Cliente: João da Silva');
    expect(result).toContain('CNPJ: 12.345.678/0001-90');
  });

  it('deve interpolar tabela de itens do contrato quando dados forem fornecidos', () => {
    const template = `
      <table class="print-table contract-items-table">
        <thead><tr><th>Item</th></tr></thead>
        <tbody><tr><td>Velho</td></tr></tbody>
      </table>
    `;

    const result = service.interpolate(template, {
      itensContrato: [
        { codigo: '999', descricao: 'SMOKING SLIM PRETO', valor: 400 },
      ],
    });

    expect(result).toContain('999');
    expect(result).toContain('SMOKING SLIM PRETO');
    expect(result).toContain('R$');
    expect(result).not.toContain('Velho');
  });

  it('mantém a marcação dos subcomponentes ao repetir itens e pagamentos', () => {
    const template = `
      <table data-print-component="contract-items"><tbody><tr><td>Antigo</td></tr></tbody></table>
      <table data-print-component="contract-payments"><caption>PAGAMENTO</caption><thead><tr><th>Pagamento</th><th>Data</th><th>Situação</th></tr></thead><tbody></tbody></table>
    `;

    const result = service.interpolate(template, {
      itensContrato: [{ codigo: '1044', descricao: 'Terno azul', valor: 450 }],
      pagamentosContrato: [{ parcela: 'Entrada', forma: 'DINHEIRO', vencimento: '14/09/2026', valor: 300, status: 'PAGO' }],
    });

    expect(result).toContain('data-print-component="contract-items"');
    expect(result).toContain('data-print-component="contract-payments"');
    expect(result).toContain('Terno azul');
    expect(result.replace(/\u00a0/g, ' ')).toContain('Entrada — DINHEIRO: R$ 300,00');
    expect(result).toContain('PAGAMENTO');
    expect(result).not.toContain('Antigo');
    expect(result).not.toContain('border: 1px solid');
  });

  it('deve gerar dataURL válida para QR Code', async () => {
    const qrDataUrl = await service.generateQrCodeDataUrl('https://sefaz.sp.gov.br/nfce');
    expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
