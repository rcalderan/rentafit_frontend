import { inject, Injectable } from '@angular/core';
import { NfceQrCodeService } from './nfce-qr-code.service';

export interface InterpolationContext {
  cliente: {
    codigo?: string;
    nome: string;
    documento: string;
    rg: string;
    endereco: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    telefone: string;
    email: string;
  };
  empresa: {
    nomeFantasia: string;
    razaoSocial: string;
    cnpj: string;
    ie: string;
    im: string;
    endereco: string;
    telefone: string;
    email: string;
    cidade: string;
    site?: string;
  };
  contrato: {
    numero: string;
    dataRetirada: string;
    dataUso: string;
    dataDevolucao: string;
    dataEmissao: string;
    valorTotal: string;
    atendente: string;
    observacoes: string;
  };
  nfce: {
    numero: string;
    serie: string;
    chave: string;
    chaveFormatada: string;
    protocolo: string;
    dataEmissao: string;
    valorTotal: string;
    tributosTotais: string;
    urlConsulta: string;
  };
  sistema: {
    dataAtual: string;
    horaAtual: string;
    dataExtenso: string;
  };
  itensContrato?: Array<{
    codigo: string;
    descricao: string;
    valor: number;
  }>;
  pagamentosContrato?: Array<{
    parcela: string;
    forma: string;
    vencimento: string;
    valor: number;
    status: string;
  }>;
  itensNfce?: Array<{
    item: number;
    codigo: string;
    descricao: string;
    qtd: number;
    un: string;
    valorUnit: number;
    valorTotal: number;
  }>;
  pagamentosNfce?: Array<{
    forma: string;
    valor: number;
  }>;
}

export const DEFAULT_MOCK_CONTEXT: InterpolationContext = {
  cliente: {
    codigo: '20636',
    nome: 'Mariana Silva Santos',
    documento: '123.456.789-00',
    rg: '45.678.910-1',
    endereco: 'Av. São Carlos, 1200',
    bairro: 'Centro',
    cidade: 'São Carlos',
    uf: 'SP',
    cep: '13560-001',
    telefone: '(16) 99876-5432',
    email: 'mariana.silva@email.com',
  },
  empresa: {
    nomeFantasia: 'Noiva Modas',
    razaoSocial: 'C & K LOCACAO DE ROUPAS LTDA-ME',
    cnpj: '08.299.621/0001-20',
    ie: '637.287.665.118',
    im: '51.197',
    endereco: 'Rua Jesuíno de Arruda, 1837 - Centro - São Carlos/SP CEP 13560-642',
    telefone: '(16)33722363 ou (16)99702-7631',
    email: 'noivamodas@live.com',
    cidade: 'São Carlos/SP',
    site: 'www.noivamodas.com.br',
  },
  contrato: {
    numero: '36295',
    dataRetirada: '21/09/2026',
    dataUso: '23/09/2026',
    dataDevolucao: '25/09/2026',
    dataEmissao: '14/09/2026',
    valorTotal: 'R$ 450,00',
    atendente: 'Cleyton',
    observacoes: 'Cliente prefere retirada no período da manhã.',
  },
  nfce: {
    numero: '000001044',
    serie: '1',
    chave: '35260908299621000120650010000010441234567890',
    chaveFormatada: '3526 0908 2996 2100 0120 6500 1000 0010 4412 3456 7890',
    protocolo: '135260001234567 24/09/2026 14:35:10',
    dataEmissao: '24/09/2026 14:35:10',
    valorTotal: 'R$ 650,00',
    tributosTotais: 'R$ 87,42 (13,45%)',
    urlConsulta: 'https://www.nfce.fazenda.sp.gov.br/consulta?p=35260908299621000120650010000010441234567890',
  },
  sistema: {
    dataAtual: '24/09/2026',
    horaAtual: '15:30',
    dataExtenso: 'São Carlos, 24 de setembro de 2026',
  },
  itensContrato: [
    {
      codigo: '2671',
      descricao: 'TERNO AZUL NAVY 2 BOTOES SLIM 50 SEM ACESS',
      valor: 450.0,
    },
  ],
  pagamentosContrato: [
    {
      parcela: 'Entrada',
      forma: '',
      vencimento: '14/09/2026',
      valor: 300.0,
      status: 'PAGO',
    },
    {
      parcela: 'Parcela 1',
      forma: '',
      vencimento: '21/09/2026',
      valor: 150.0,
      status: 'PAGO',
    },
  ],
  itensNfce: [
    {
      item: 1,
      codigo: '1044',
      descricao: 'IMPERIAL 50',
      qtd: 1,
      un: 'UN',
      valorUnit: 350.0,
      valorTotal: 350.0,
    },
    {
      item: 2,
      codigo: '1141',
      descricao: 'VESTIDO DAMA BRANCO',
      qtd: 1,
      un: 'UN',
      valorUnit: 300.0,
      valorTotal: 300.0,
    },
  ],
  pagamentosNfce: [
    { forma: 'PIX', valor: 300 },
    { forma: 'DINHEIRO', valor: 350 },
  ],
};

@Injectable({
  providedIn: 'root',
})
export class TemplateInterpolationService {
  private readonly qrCodeRenderer = inject(NfceQrCodeService);

  /**
   * Substitui todas as tags {{categoria.campo}} pelos dados fornecidos.
   */
  interpolate(htmlTemplate: string, customData?: Partial<InterpolationContext>): string {
    if (!htmlTemplate) return '';

    const merged: InterpolationContext = {
      cliente: { ...DEFAULT_MOCK_CONTEXT.cliente, ...customData?.cliente },
      empresa: { ...DEFAULT_MOCK_CONTEXT.empresa, ...customData?.empresa },
      contrato: { ...DEFAULT_MOCK_CONTEXT.contrato, ...customData?.contrato },
      nfce: { ...DEFAULT_MOCK_CONTEXT.nfce, ...customData?.nfce },
      sistema: {
        ...DEFAULT_MOCK_CONTEXT.sistema,
        ...customData?.sistema,
        dataAtual: this.getCurrentDateFormatted(),
        horaAtual: this.getCurrentTimeFormatted(),
        dataExtenso: this.getCurrentDateLong(customData?.empresa?.cidade || 'São Carlos'),
      },
      itensContrato: customData?.itensContrato ?? DEFAULT_MOCK_CONTEXT.itensContrato,
      pagamentosContrato: customData?.pagamentosContrato ?? DEFAULT_MOCK_CONTEXT.pagamentosContrato,
      itensNfce: customData?.itensNfce ?? DEFAULT_MOCK_CONTEXT.itensNfce,
      pagamentosNfce: customData?.pagamentosNfce ?? DEFAULT_MOCK_CONTEXT.pagamentosNfce,
    };

    let result = this.replaceSystemAliases(htmlTemplate, merged.sistema);

    // 1. Substituir tags de objetos planos
    result = this.replaceCategoryTags(result, 'cliente', merged.cliente);
    result = this.replaceCategoryTags(result, 'empresa', merged.empresa);
    result = this.replaceCategoryTags(result, 'contrato', merged.contrato);
    result = this.replaceCategoryTags(result, 'nfce', merged.nfce);
    result = this.replaceCategoryTags(result, 'sistema', merged.sistema);

    // 2. Substituir tabelas repetidoras se houver dados específicos fornecidos
    if (customData?.itensContrato && customData.itensContrato.length > 0) {
      result = this.renderContractItemsTable(result, merged.itensContrato || []);
    }
    if (customData?.pagamentosContrato && customData.pagamentosContrato.length > 0) {
      result = this.renderContractPaymentsTable(result, merged.pagamentosContrato || []);
    }
    const isNfceReceipt = result.includes('DANFE NFC-e');
    if (
      customData?.itensNfce !== undefined ||
      result.includes('thermal-items-table') ||
      result.includes('data-print-component="nfce-items"') ||
      isNfceReceipt
    ) {
      result = this.renderNfceItemsTable(result, merged.itensNfce ?? [], isNfceReceipt);
    }
    if (
      customData?.pagamentosNfce !== undefined ||
      result.includes('data-print-component="nfce-payments"') ||
      result.includes('PIX / DINHEIRO') ||
      isNfceReceipt
    ) {
      result = this.renderNfcePaymentsTable(result, merged.pagamentosNfce ?? []);
    }

    result = this.qrCodeRenderer.replaceMarkers(result, merged.nfce.urlConsulta);
    return result;
  }

  /**
   * Gera QR Code real como Data URL (SVG/PNG) assincronamente.
   */
  async generateQrCodeDataUrl(text: string, width = 120): Promise<string> {
    return this.qrCodeRenderer.generateDataUrl(text, width);
  }

  private replaceCategoryTags(html: string, prefix: string, obj: Record<string, any>): string {
    let out = html;
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        const regex = new RegExp(`\\{\\{${prefix}\\.${key}\\}\\}`, 'g');
        out = out.replace(regex, String(value));
      }
    }
    return out;
  }

  private renderContractItemsTable(html: string, items: Array<{ codigo: string; descricao: string; valor: number }>): string {
    const tbodyRows = items
      .map((item) => `
      <tr>
        <td>${item.codigo}</td>
        <td>${item.descricao}</td>
        <td style="text-align: right;">${this.formatCurrency(item.valor)}</td>
      </tr>`)
      .join('');
    return this.replaceRepeatingTableBody(html, 'contract-items', 'contract-items-table', tbodyRows);
  }

  private renderContractPaymentsTable(
    html: string,
    payments: Array<{ parcela: string; forma: string; vencimento: string; valor: number; status: string }>
  ): string {
    const columnCount = this.repeatingTableHeaderCount(html, 'contract-payments', 'contract-payments-table');
    const tbodyRows = payments
      .map((payment) => {
        const cells = columnCount >= 5
          ? [
              payment.parcela,
              payment.forma,
              payment.vencimento,
              this.formatCurrency(payment.valor),
              payment.status,
            ]
          : [
              `${payment.parcela && payment.forma ? `${payment.parcela} — ${payment.forma}` : payment.parcela || payment.forma}: ${this.formatCurrency(payment.valor)}`,
              payment.vencimento,
              payment.status,
            ];
        return `<tr>${cells.map((cell, index) => `<td${index === cells.length - 1 ? ' style="text-align: right;"' : ''}>${cell}</td>`).join('')}</tr>`;
      })
      .join('');
    return this.replaceRepeatingTableBody(html, 'contract-payments', 'contract-payments-table', tbodyRows);
  }

  private renderNfcePaymentsTable(html: string, payments: NonNullable<InterpolationContext['pagamentosNfce']>): string {
    const table = this.repeatingTablePattern('nfce-payments', 'nfce-payments-table').exec(html)?.[0];
    if (table) {
      const rows = payments.map((payment) => this.renderNfcePaymentRow(payment)).join('');
      return this.replaceRepeatingTableBody(html, 'nfce-payments', 'nfce-payments-table', rows);
    }
    if (html.includes('PIX / DINHEIRO')) return this.replaceLegacyNfcePaymentLabel(html, payments);
    return this.insertLegacyNfcePayments(html, payments);
  }

  private renderNfcePaymentRow(payment: NonNullable<InterpolationContext['pagamentosNfce']>[number]): string {
    return `<tr><td>${this.escapePrintCell(payment.forma)}</td><td style="text-align: right;">${this.formatNfceAmount(payment.valor)}</td></tr>`;
  }

  private replaceLegacyNfcePaymentLabel(
    html: string,
    payments: NonNullable<InterpolationContext['pagamentosNfce']>,
  ): string {
    const summary = payments
      .map((payment) => `${this.escapePrintCell(payment.forma)}: ${this.formatCurrency(payment.valor)}`)
      .join(' / ');
    return html.replace('PIX / DINHEIRO', summary);
  }

  private insertLegacyNfcePayments(
    html: string,
    payments: NonNullable<InterpolationContext['pagamentosNfce']>,
  ): string {
    const anchor = /<(?:div|p)\b[^>]*>\s*Nº(?=\s|$)/i.exec(html);
    if (!anchor || payments.length === 0 || !html.includes('Extrato Auxiliar')) return html;
    const rows = payments.map((payment) =>
      `<div style="display: flex; justify-content: space-between;"><span>${this.escapePrintCell(payment.forma)}</span><span>${this.formatCurrency(payment.valor)}</span></div>`,
    ).join('');
    const section = `<div style="font-size: 7.5px; margin-bottom: 4px;"><strong>FORMAS DE PAGAMENTO</strong>${rows}</div>`;
    return `${html.slice(0, anchor.index)}${section}${html.slice(anchor.index)}`;
  }

  private renderNfceItemsTable(
    html: string,
    items: NonNullable<InterpolationContext['itensNfce']>,
    allowLegacyTable: boolean,
  ): string {
    const table = this.findNfceItemsTable(html, allowLegacyTable);
    if (!table) return html;
    const columnCount = this.tableHeaderCount(table);
    const rows = items.map((item) => this.renderNfceItemRow(item, columnCount)).join('');
    const replaced = table.replace(/(<tbody\b[^>]*>)[\s\S]*?(<\/tbody>)/i, `$1${rows}$2`);
    return html.replace(table, replaced);
  }

  private findNfceItemsTable(html: string, allowLegacyTable: boolean): string | null {
    const markedTable = this.repeatingTablePattern('nfce-items', 'thermal-items-table').exec(html)?.[0];
    if (markedTable || !allowLegacyTable) return markedTable ?? null;
    const tables = html.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) ?? [];
    return tables.find((table) => {
      const header = this.tableHeaderContent(table);
      return /\bItem\b/i.test(header) && /(Qtd|Vl\.)/i.test(header);
    }) ?? null;
  }

  private tableHeaderCount(table: string): number {
    return this.tableHeaderContent(table).match(/<th\b/gi)?.length ?? 0;
  }

  private tableHeaderContent(table: string): string {
    return table.match(/<thead\b[^>]*>[\s\S]*?<tr\b[^>]*>([\s\S]*?)<\/tr>/i)?.[1] ?? '';
  }

  private renderNfceItemRow(
    item: NonNullable<InterpolationContext['itensNfce']>[number],
    columnCount: number,
  ): string {
    const label = [String(item.item).padStart(3, '0'), item.codigo, item.descricao]
      .map((value) => this.escapePrintCell(value))
      .join(' ');
    const quantity = `${this.formatNfceQuantity(item.qtd)} ${this.escapePrintCell(item.un)}`;
    const unitValue = this.formatNfceAmount(item.valorUnit);
    const totalValue = this.formatNfceAmount(item.valorTotal);
    if (columnCount >= 4) return this.renderNfceDetailedItemRows(label, quantity, unitValue, totalValue);
    const details = `${label} — ${quantity} × ${unitValue}`;
    return `<tr><td style="padding: 1px 0;">${details}</td><td style="text-align: right;">${totalValue}</td></tr>`;
  }

  private renderNfceDetailedItemRows(label: string, quantity: string, unitValue: string, totalValue: string): string {
    const descriptionRow = `<tr><td colspan="4" style="padding-top: 3px;">${label}</td></tr>`;
    const valuesRow = `<tr style="border-bottom: 1px dotted #ccc;"><td></td><td style="text-align: center;">${quantity}</td><td style="text-align: right;">${unitValue}</td><td style="text-align: right;">${totalValue}</td></tr>`;
    return descriptionRow + valuesRow;
  }

  private formatNfceAmount(value: number): string {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }

  private formatNfceQuantity(value: number): string {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(value);
  }

  private escapePrintCell(value: string | number): string {
    const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value).replace(/[&<>"']/g, (character) => entities[character]);
  }

  private replaceSystemAliases(html: string, system: InterpolationContext['sistema']): string {
    return html
      .replace(/\{\{dataAtual\}\}/g, () => system.dataAtual)
      .replace(/\{\{horaAtual\}\}/g, () => system.horaAtual)
      .replace(/\{\{cidadeDataExtenso\}\}/g, () => system.dataExtenso);
  }

  private repeatingTableHeaderCount(html: string, component: string, legacyClass: string): number {
    const tablePattern = this.repeatingTablePattern(component, legacyClass);
    const table = tablePattern.exec(html)?.[0];
    const firstHeaderRow = table?.match(/<thead\b[^>]*>[\s\S]*?<tr\b[^>]*>([\s\S]*?)<\/tr>/i)?.[1];
    return firstHeaderRow?.match(/<th\b/gi)?.length ?? 0;
  }

  private replaceRepeatingTableBody(html: string, component: string, legacyClass: string, rows: string): string {
    const tablePattern = this.repeatingTablePattern(component, legacyClass);
    const table = tablePattern.exec(html);
    if (!table) return html;
    const bodyPattern = /(<tbody\b[^>]*>)[\s\S]*?(<\/tbody>)/i;
    const replacedTable = table[0].replace(bodyPattern, `$1${rows}$2`);
    return html.replace(table[0], replacedTable);
  }

  private repeatingTablePattern(component: string, legacyClass: string): RegExp {
    return new RegExp(
      `<table\\b(?=[^>]*(?:data-print-component=["']${component}["']|class=["'][^"']*${legacyClass}[^"']*["']))[^>]*>[\\s\\S]*?<\\/table>`,
      'i',
    );
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  }

  private getCurrentDateFormatted(): string {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private getCurrentTimeFormatted(): string {
    const d = new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
  }

  private getCurrentDateLong(city: string): string {
    const d = new Date();
    const day = d.getDate();
    const months = [
      'janeiro',
      'fevereiro',
      'março',
      'abril',
      'maio',
      'junho',
      'julho',
      'agosto',
      'setembro',
      'outubro',
      'novembro',
      'dezembro',
    ];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const cleanCity = city.replace(/\/.*$/, '').trim();
    return `${cleanCity}, ${day} de ${month} de ${year}`;
  }
}
