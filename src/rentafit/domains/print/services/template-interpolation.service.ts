import { Injectable } from '@angular/core';
import QRCode from 'qrcode';

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
};

@Injectable({
  providedIn: 'root',
})
export class TemplateInterpolationService {
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
    };

    let result = htmlTemplate;

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

    return result;
  }

  /**
   * Gera QR Code real como Data URL (SVG/PNG) assincronamente.
   */
  async generateQrCodeDataUrl(text: string, width = 120): Promise<string> {
    try {
      return await QRCode.toDataURL(text, {
        width,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
    } catch (e) {
      console.error('Erro ao gerar QRCode:', e);
      return '';
    }
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
