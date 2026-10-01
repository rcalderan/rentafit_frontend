import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_MOCK_CONTEXT, TemplateInterpolationService } from './template-interpolation.service';

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

  it('deve repetir itens de NFC-e no formato térmico e escapar descrições', () => {
    const template = '<table data-print-component="nfce-items"><thead><tr><th>Item</th><th>Qtd</th><th>Unitário</th><th>Total</th></tr></thead><tbody><tr><td>Antigo</td></tr></tbody></table>';
    const result = service.interpolate(template, {
      itensNfce: [
        { item: 1, codigo: '1044', descricao: '<b>Vestido</b>', qtd: 1, un: 'UN', valorUnit: 350, valorTotal: 350 },
        { item: 2, codigo: '1141', descricao: 'Véu', qtd: 2, un: 'UN', valorUnit: 25, valorTotal: 50 },
      ],
    });

    expect(result).toContain('001 1044 &lt;b&gt;Vestido&lt;/b&gt;');
    expect(result).toContain('1 UN');
    expect(result).toContain('350,00');
    expect(result).toContain('002 1141 Véu');
    expect(result).not.toContain('Antigo');

    const compactTable = service.interpolate(
      '<table data-print-component="nfce-items"><thead><tr><th>Item</th><th>Total</th></tr></thead><tbody></tbody></table>',
      { itensNfce: [{ item: 1, codigo: '1044', descricao: 'Vestido', qtd: 1, un: 'UN', valorUnit: 350, valorTotal: 350 }] },
    );
    expect(compactTable).toContain('1 UN × 350,00');
  });

  it('deve repetir formas de pagamento da NFC-e e permitir remover linhas sem dados', () => {
    const template = '<table data-print-component="nfce-payments"><tbody><tr><td>Antigo</td></tr></tbody></table>';
    const result = service.interpolate(template, {
      pagamentosNfce: [{ forma: 'CARTÃO', valor: 125.5 }],
    });
    const emptyResult = service.interpolate(template, { pagamentosNfce: [] });

    expect(result).toContain('CARTÃO');
    expect(result).toContain('125,50');
    expect(result).not.toContain('Antigo');
    expect(emptyResult).not.toContain('Antigo');
  });

  it('atualiza tabelas e QR de templates NFC-e legados sem marcadores', () => {
    const legacyTemplate = `<div>DANFE NFC-e - Extrato Auxiliar</div>
      <table><thead><tr><th>Item</th><th>Vl. Tot</th></tr></thead><tbody><tr><td>Antigo</td></tr></tbody></table>
      <p>Nº {{nfce.numero}}<br>Chave {{nfce.chave}}</p>
      <div><svg width="90" height="90"><rect x="10" y="10" width="30" height="30" /></svg></div>`;
    const result = service.interpolate(legacyTemplate, {
      nfce: { ...DEFAULT_MOCK_CONTEXT.nfce, urlConsulta: 'https://example.test/nfce' },
      itensNfce: [{ item: 1, codigo: '001', descricao: 'Boné', qtd: 1, un: 'UN', valorUnit: 25, valorTotal: 25 }],
      pagamentosNfce: [{ forma: 'PIX', valor: 25 }],
    });

    expect(result).toContain('001 001 Boné — 1 UN × 25,00');
    expect(result).toContain('PIX');
    expect(result).toContain('<path d="M');
    expect(result).not.toContain('Antigo');
    expect(result).not.toContain('x="10"');
  });

  it('deve aceitar aliases de sistema previstos para tags simples', () => {
    const result = service.interpolate('{{dataAtual}}|{{horaAtual}}|{{cidadeDataExtenso}}');

    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}\|\d{2}:\d{2}\|São Carlos, /);
    expect(result).not.toContain('{{');
  });

  it('deve gerar SVG de QR Code real com a URL NFC-e informada', () => {
    const template = '<div data-qrcode="true"><svg><rect x="10" y="10" width="30" height="30" /></svg></div><p>{{nfce.urlConsulta}}</p>';
    const urlConsulta = 'https://example.test/consulta?chave=3526';
    const result = service.interpolate(template, {
      nfce: { ...DEFAULT_MOCK_CONTEXT.nfce, urlConsulta },
    });

    expect(result).toContain('<path d="M');
    expect(result).toContain(urlConsulta);
    expect(result).not.toContain('data-qrcode="true"');
    expect(result).not.toContain('x="10"');
  });

  it('omite o QR Code se a URL exceder a capacidade de codificação', () => {
    const longUrl = `https://example.test/${'x'.repeat(5000)}`;
    const result = service.interpolate('<div data-qrcode="true"><svg><rect /></svg></div>', {
      nfce: { ...DEFAULT_MOCK_CONTEXT.nfce, urlConsulta: longUrl },
    });

    expect(result).not.toContain('<path');
    expect(result).not.toContain('data-qrcode="true"');
  });

  it('deve gerar dataURL válida para QR Code', async () => {
    const qrDataUrl = await service.generateQrCodeDataUrl('https://sefaz.sp.gov.br/nfce');
    expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
