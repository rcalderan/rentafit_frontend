import { PrintTemplate } from './print-template.model';

export const DEFAULT_RENTAL_CONTRACT_TEMPLATE: PrintTemplate = {
  id: 'template-contrato-locacao-default',
  name: 'Contrato de Locação Padrão (A4)',
  description: 'Template oficial de locação com itens, pagamentos, cláusulas 1ª a 11ª e termo de cessão de imagem',
  templateType: 'RENTAL_CONTRACT',
  pageFormat: 'A4',
  orientation: 'PORTRAIT',
  pageWidthMm: 210,
  pageHeightMm: 297,
  marginTopMm: 12,
  marginBottomMm: 12,
  marginLeftMm: 14,
  marginRightMm: 14,
  printOffsetMm: 5,
  contentJson: null,
  contentHtml: `
<div class="print-contract-container">
  <div class="contract-header" style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 12px;">
    <h2 style="margin: 0; font-size: 18px; text-transform: uppercase;">{{empresa.nomeFantasia}}</h2>
    <div style="font-size: 11px; margin-top: 4px; color: #444;">
      <strong>{{empresa.razaoSocial}}</strong> &bull; CNPJ: {{empresa.cnpj}} &bull; IE: {{empresa.ie}} &bull; IM: {{empresa.im}}<br>
      Empresa especializada em Aluguéis de Noivas, Trajes a Rigor e Artigos do Vestuário em geral.<br>
      {{empresa.endereco}} &bull; Tel: {{empresa.telefone}} &bull; E-mail: {{empresa.email}}
    </div>
    <div style="margin-top: 6px; font-size: 13px; font-weight: bold; background: #eee; padding: 4px;">
      CONTRATO DE LOCAÇÃO N.º {{contrato.numero}}
    </div>
  </div>

  <table style="width: 100%; font-size: 11px; margin-bottom: 10px; border-collapse: collapse;">
    <tr>
      <td style="padding: 2px 0;"><strong>Cliente:</strong> {{cliente.nome}}</td>
      <td style="padding: 2px 0; text-align: right;"><strong>CPF:</strong> {{cliente.documento}}</td>
    </tr>
    <tr>
      <td style="padding: 2px 0;"><strong>Endereço:</strong> {{cliente.endereco}} - {{cliente.bairro}}</td>
      <td style="padding: 2px 0; text-align: right;"><strong>Cidade/UF:</strong> {{cliente.cidade}}/{{cliente.uf}}</td>
    </tr>
    <tr>
      <td style="padding: 2px 0;"><strong>Telefone:</strong> {{cliente.telefone}}</td>
      <td style="padding: 2px 0; text-align: right;"><strong>E-mail:</strong> {{cliente.email}}</td>
    </tr>
  </table>

  <div style="background: #f5f5f5; border: 1px solid #ccc; padding: 6px 10px; font-size: 11px; font-weight: bold; display: flex; justify-content: space-between; margin-bottom: 10px;">
    <span>RETIRADA: {{contrato.dataRetirada}}</span>
    <span>USA NO DIA: {{contrato.dataUso}}</span>
    <span>DEVOLUÇÃO: {{contrato.dataDevolucao}}</span>
  </div>

  <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px;">ITENS LOCADOS</div>
  <table class="print-table contract-items-table" style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 10px; border: 1px solid #ddd;">
    <thead>
      <tr style="background: #eee; text-align: left;">
        <th style="padding: 4px 6px; border: 1px solid #ddd; width: 12%;">Código</th>
        <th style="padding: 4px 6px; border: 1px solid #ddd; width: 68%;">Descrição / Detalhes / Ajustes</th>
        <th style="padding: 4px 6px; border: 1px solid #ddd; width: 20%; text-align: right;">Valor</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 4px 6px; border: 1px solid #ddd;">1044</td>
        <td style="padding: 4px 6px; border: 1px solid #ddd;">IMPERIAL 50, C44, SEM SAPATO, MANGA DIR 49CM, MANGA ESQ 48.5CM, BARRA CALÇA 11 CM</td>
        <td style="padding: 4px 6px; border: 1px solid #ddd; text-align: right;">R$ 350,00</td>
      </tr>
      <tr>
        <td style="padding: 4px 6px; border: 1px solid #ddd;">1141</td>
        <td style="padding: 4px 6px; border: 1px solid #ddd;">VESTIDO DAMA BRANCO GAZAR DRAPE, SAPATO 31 SONHO, ALMOFADA E CINTO LILAS</td>
        <td style="padding: 4px 6px; border: 1px solid #ddd; text-align: right;">R$ 300,00</td>
      </tr>
    </tbody>
    <tfoot>
      <tr style="background: #fafafa; font-weight: bold;">
        <td colspan="2" style="padding: 4px 6px; border: 1px solid #ddd; text-align: right;">TOTAL:</td>
        <td style="padding: 4px 6px; border: 1px solid #ddd; text-align: right;">{{contrato.valorTotal}}</td>
      </tr>
    </tfoot>
  </table>

  <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px;">FORMAS DE PAGAMENTO</div>
  <table class="print-table contract-payments-table" style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 12px; border: 1px solid #ddd;">
    <thead>
      <tr style="background: #eee; text-align: left;">
        <th style="padding: 4px 6px; border: 1px solid #ddd; width: 15%;">Parcela</th>
        <th style="padding: 4px 6px; border: 1px solid #ddd; width: 25%;">Forma</th>
        <th style="padding: 4px 6px; border: 1px solid #ddd; width: 20%;">Vencimento</th>
        <th style="padding: 4px 6px; border: 1px solid #ddd; width: 20%; text-align: right;">Valor</th>
        <th style="padding: 4px 6px; border: 1px solid #ddd; width: 20%; text-align: center;">Visto / Carimbo</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 4px 6px; border: 1px solid #ddd;">1 / 2</td>
        <td style="padding: 4px 6px; border: 1px solid #ddd;">DINHEIRO / PIX</td>
        <td style="padding: 4px 6px; border: 1px solid #ddd;">{{contrato.dataEmissao}}</td>
        <td style="padding: 4px 6px; border: 1px solid #ddd; text-align: right;">R$ 350,00</td>
        <td style="padding: 4px 6px; border: 1px solid #ddd; text-align: center;">[QUITADO]</td>
      </tr>
      <tr>
        <td style="padding: 4px 6px; border: 1px solid #ddd;">2 / 2</td>
        <td style="padding: 4px 6px; border: 1px solid #ddd;">NA RETIRADA</td>
        <td style="padding: 4px 6px; border: 1px solid #ddd;">{{contrato.dataRetirada}}</td>
        <td style="padding: 4px 6px; border: 1px solid #ddd; text-align: right;">R$ 300,00</td>
        <td style="padding: 4px 6px; border: 1px solid #ddd; text-align: center;">______________</td>
      </tr>
    </tbody>
  </table>

  <div style="font-size: 9px; line-height: 1.35; color: #222; border-top: 1px solid #444; padding-top: 6px; margin-bottom: 12px;">
    <div style="font-weight: bold; text-align: center; margin-bottom: 4px;">LEIA COM ATENÇÃO: CLÁUSULAS E CONDIÇÕES CONTRATUAIS</div>
    <p style="margin: 2px 0;"><strong>{{empresa.razaoSocial}}</strong> acima identificada, doravante denominada <strong>LOCADORA</strong>, e de outro lado o Cliente <strong>{{cliente.nome}}</strong>, denominado <strong>LOCATÁRIO</strong>, celebram o presente contrato sob as cláusulas abaixo:</p>
    <p style="margin: 2px 0;"><strong>Cláusula 1ª:</strong> O objeto deste contrato é a Locação dos artigos do vestuário acima especificados.</p>
    <p style="margin: 2px 0;"><strong>Cláusula 2ª:</strong> As datas de retirada, utilização e devolução encontram-se especificadas neste contrato.</p>
    <p style="margin: 2px 0;"><strong>Cláusula 3ª:</strong> A LOCADORA não se responsabiliza pelas mercadorias que não forem retiradas até UM dia antes da data de uso.</p>
    <p style="margin: 2px 0;"><strong>Cláusula 4ª:</strong> A mercadoria deverá ser devolvida até as 18:00h da data prevista, completa e nas mesmas condições em que foi retirada. Parágrafo 1º: Atrasos incorrem em acréscimo de R$ 10,00 por dia útil. Após 7 dias, será cobrada nova taxa integral de locação. Parágrafo 2º: Manchas de gordura, graxa, tinta ou produtos danosos acarretarão taxa de higienização de R$ 30,00.</p>
    <p style="margin: 2px 0;"><strong>Cláusula 5ª:</strong> Trocas podem ser requeridas sem ônus em até 5 dias úteis corridos da data da locação. Após 5 dias, mediante taxa de 20% do valor de locação do item.</p>
    <p style="margin: 2px 0;"><strong>Cláusula 6ª:</strong> Em caso de desistência, o LOCATÁRIO pagará multa de 30% do valor pago pelo item em questão.</p>
    <p style="margin: 2px 0;"><strong>Cláusula 7ª:</strong> As peças locadas não poderão ser emprestadas ou transferidas a terceiros.</p>
    <p style="margin: 2px 0;"><strong>Cláusula 8ª:</strong> O LOCATÁRIO ressarcirá a LOCADORA pelo valor de tabela de mercado vigente pelo extravio, avaria ou dano irreparável na mercadoria.</p>
    <p style="margin: 2px 0;"><strong>Cláusula 9ª:</strong> A LOCADORA se compromete a entregar a mercadoria lavada, passada e com os devidos ajustes solicitados e aprovados na prova.</p>
    <p style="margin: 2px 0;"><strong>Cláusula 10ª:</strong> Constatada avaria no momento da retirada, a LOCADORA fará a substituição imediata ou devolução do valor conforme conveniência.</p>
    <p style="margin: 2px 0;"><strong>Cláusula 11ª:</strong> Fica eleito o Foro da Comarca de São Carlos/SP para dirimir eventuais litígios oriundos deste contrato.</p>
  </div>

  <div style="font-size: 10px; margin-top: 14px; text-align: center;">
    <div>{{sistema.dataExtenso}}</div>
    <div style="margin-top: 30px; display: inline-block; width: 60%; border-top: 1px solid #333; padding-top: 4px;">
      <strong>{{cliente.nome}}</strong><br>
      CPF: {{cliente.documento}} (Locatário)
    </div>
  </div>

  <div style="margin-top: 14px; padding: 6px 10px; background: #fafafa; border: 1px dashed #999; font-size: 9.5px;">
    <strong>TERMO DE AUTORIZAÇÃO DE USO DE IMAGEM (OPCIONAL):</strong><br>
    Autorizo a veiculação de fotos do traje locado nas mídias sociais e site da loja para fins de divulgação:
    &nbsp;&nbsp;&nbsp; ( &nbsp; ) SIM &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ( &nbsp; ) NÃO
    <div style="margin-top: 4px; font-weight: bold; color: #900;">
      * NÃO FAZEMOS PROVAS AOS SÁBADOS &bull; É OBRIGATÓRIA A APRESENTAÇÃO DESTE CONTRATO NA RETIRADA!
    </div>
  </div>
</div>
`,
  cssStyles: `
    .print-contract-container { font-family: 'Inter', Arial, sans-serif; color: #111; line-height: 1.3; }
    .print-table th, .print-table td { border: 1px solid #ccc; }
  `,
  isDefault: true,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_CANCELLATION_TEMPLATE: PrintTemplate = {
  id: 'template-desistencia-default',
  name: 'Termo de Desistência (A4)',
  description: 'Termo formal de rescisão/desistência de locação conforme modelo legado',
  templateType: 'RENTAL_CANCELLATION',
  pageFormat: 'A4',
  orientation: 'PORTRAIT',
  pageWidthMm: 210,
  pageHeightMm: 297,
  marginTopMm: 25,
  marginBottomMm: 25,
  marginLeftMm: 25,
  marginRightMm: 25,
  printOffsetMm: 5,
  contentJson: null,
  contentHtml: `
<div class="print-cancellation-container" style="font-family: 'Inter', Arial, sans-serif; line-height: 1.6; font-size: 13px;">
  <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 12px;">
    <h2 style="margin: 0; font-size: 20px; letter-spacing: 2px;">T E R M O &nbsp;&nbsp; D E &nbsp;&nbsp; D E S I S T Ê N C I A</h2>
    <div style="font-size: 11px; margin-top: 6px; color: #555;">{{empresa.razaoSocial}} &bull; CNPJ: {{empresa.cnpj}}</div>
  </div>

  <p style="text-indent: 30px; text-align: justify; margin-bottom: 20px;">
    Eu, <strong>{{cliente.nome}}</strong>, portador(a) do CPF <strong>{{cliente.documento}}</strong> e do RG <strong>{{cliente.rg}}</strong>, residente em {{cliente.endereco}} - {{cliente.cidade}}/{{cliente.uf}}, declaro por meio deste termo que estou <strong>DESISTINDO</strong> formally da locação do(s) seguinte(s) artigo(s):
  </p>

  <table class="print-table" style="width: 100%; border-collapse: collapse; font-size: 12px; margin: 20px 0; border: 1px solid #ccc;">
    <thead>
      <tr style="background: #f0f0f0;">
        <th style="padding: 6px 10px; border: 1px solid #ccc; text-align: left;">Código</th>
        <th style="padding: 6px 10px; border: 1px solid #ccc; text-align: left;">Descrição do Item</th>
        <th style="padding: 6px 10px; border: 1px solid #ccc; text-align: right;">Valor</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 6px 10px; border: 1px solid #ccc;">1044</td>
        <td style="padding: 6px 10px; border: 1px solid #ccc;">IMPERIAL 50</td>
        <td style="padding: 6px 10px; border: 1px solid #ccc; text-align: right;">R$ 350,00</td>
      </tr>
    </tbody>
  </table>

  <p style="text-indent: 30px; text-align: justify; margin-bottom: 20px;">
    Artigo(s) este(s) discriminado(s) no contrato de locação número <strong>{{contrato.numero}}</strong>, o qual fora firmado no dia <strong>{{contrato.dataEmissao}}</strong> e cuja utilização ocorreria no dia <strong>{{contrato.dataUso}}</strong>.
  </p>

  <p style="text-indent: 30px; text-align: justify; margin-bottom: 35px;">
    Declaro ainda estar plenamente ciente das condições contratuais, bem como da retenção da taxa administrativa/multa rescisória de 30% pactuada, e da impossibilidade de transferência a outrem sem a anuência prévia da LOCADORA.
  </p>

  <div style="text-align: center; margin-top: 50px;">
    <div>{{sistema.dataExtenso}}</div>
    <div style="margin-top: 60px; display: inline-block; width: 60%; border-top: 1px solid #333; padding-top: 6px;">
      <strong>{{cliente.nome}}</strong><br>
      CPF: {{cliente.documento}}
    </div>
  </div>
</div>
`,
  cssStyles: '',
  isDefault: true,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_NFCE_80MM_TEMPLATE: PrintTemplate = {
  id: 'template-cupom-nfce-80mm-default',
  name: 'Cupom Fiscal NFC-e / DANFE (Térmica 80mm)',
  description: 'Extrato auxiliar DANFE NFC-e para impressoras térmicas de 80mm (Bematech, Elgin, Epson)',
  templateType: 'FISCAL_RECEIPT_80MM',
  pageFormat: 'THERMAL_80MM',
  orientation: 'PORTRAIT',
  pageWidthMm: 80,
  pageHeightMm: null,
  marginTopMm: 4,
  marginBottomMm: 4,
  marginLeftMm: 4,
  marginRightMm: 4,
  printOffsetMm: 2,
  contentJson: null,
  contentHtml: `
<div class="thermal-receipt" style="font-family: 'Courier New', Courier, monospace; font-size: 10px; line-height: 1.25; color: #000; text-align: left; width: 100%;">
  <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 6px;">
    <div style="font-size: 13px; font-weight: bold;">{{empresa.nomeFantasia}}</div>
    <div>{{empresa.razaoSocial}}</div>
    <div>CNPJ: {{empresa.cnpj}} &nbsp; IE: {{empresa.ie}}</div>
    <div>{{empresa.endereco}}</div>
    <div>Tel: {{empresa.telefone}}</div>
  </div>

  <div style="text-align: center; font-weight: bold; margin-bottom: 6px; border-bottom: 1px dashed #000; padding-bottom: 4px;">
    DANFE NFC-e - Documento Auxiliar da<br>
    Nota Fiscal de Consumidor Eletrônica<br>
    <span style="font-size: 9px; font-weight: normal;">Não permite aproveitamento de crédito de ICMS</span>
  </div>

  <table class="thermal-items-table" style="width: 100%; border-collapse: collapse; font-size: 9.5px; margin-bottom: 6px;">
    <thead>
      <tr style="border-bottom: 1px solid #000;">
        <th style="text-align: left; width: 45%;">Item / Descrição</th>
        <th style="text-align: center; width: 15%;">Qtd</th>
        <th style="text-align: right; width: 20%;">Vl.Unit</th>
        <th style="text-align: right; width: 20%;">Total</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td colspan="4" style="padding-top: 3px;">001 1044 IMPERIAL 50</td>
      </tr>
      <tr style="border-bottom: 1px dotted #ccc;">
        <td></td>
        <td style="text-align: center;">1 UN</td>
        <td style="text-align: right;">350,00</td>
        <td style="text-align: right;">350,00</td>
      </tr>
      <tr>
        <td colspan="4" style="padding-top: 3px;">002 1141 VESTIDO DAMA BRANCO</td>
      </tr>
      <tr style="border-bottom: 1px dotted #ccc;">
        <td></td>
        <td style="text-align: center;">1 UN</td>
        <td style="text-align: right;">300,00</td>
        <td style="text-align: right;">300,00</td>
      </tr>
    </tbody>
  </table>

  <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin-bottom: 6px; font-weight: bold;">
    <div style="display: flex; justify-content: space-between;">
      <span>QTD. TOTAL DE ITENS:</span>
      <span>2</span>
    </div>
    <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 2px;">
      <span>VALOR TOTAL R$:</span>
      <span>{{nfce.valorTotal}}</span>
    </div>
  </div>

  <div style="font-size: 9.5px; margin-bottom: 6px; border-bottom: 1px dashed #000; padding-bottom: 4px;">
    <div style="font-weight: bold; margin-bottom: 2px;">FORMA DE PAGAMENTO &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; VALOR PAGO</div>
    <div style="display: flex; justify-content: space-between;">
      <span>PIX / DINHEIRO</span>
      <span>{{nfce.valorTotal}}</span>
    </div>
  </div>

  <div style="font-size: 9px; margin-bottom: 6px; border-bottom: 1px dashed #000; padding-bottom: 4px;">
    Informação dos Tributos Totais Incidentes<br>
    (Lei Federal 12.741/2012): {{nfce.tributosTotais}}
  </div>

  <div style="text-align: center; font-size: 9px; margin-bottom: 6px;">
    <strong>EMISSÃO:</strong> Nº {{nfce.numero}} &bull; Série: {{nfce.serie}}<br>
    Data/Hora: {{nfce.dataEmissao}}<br>
    Protocolo: {{nfce.protocolo}}<br>
    <strong>CHAVE DE ACESSO:</strong><br>
    <span style="font-size: 8.5px; letter-spacing: 0.5px;">{{nfce.chaveFormatada}}</span>
  </div>

  <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin-bottom: 6px; font-size: 9px;">
    <strong>CONSUMIDOR:</strong> {{cliente.nome}}<br>
    CPF: {{cliente.documento}}
  </div>

  <div style="text-align: center; margin: 8px 0;" data-qrcode-container="true">
    <div style="font-size: 8.5px; margin-bottom: 4px;">Consulta via leitor de QR Code:</div>
    <div class="qr-code-placeholder" data-qrcode="true" style="display: inline-block; padding: 4px; background: #fff;">
      <svg width="120" height="120" viewBox="0 0 100 100" style="display: block; margin: 0 auto;">
        <rect width="100" height="100" fill="#fff" />
        <rect x="10" y="10" width="30" height="30" fill="#000" />
        <rect x="15" y="15" width="20" height="20" fill="#fff" />
        <rect x="20" y="20" width="10" height="10" fill="#000" />
        <rect x="60" y="10" width="30" height="30" fill="#000" />
        <rect x="65" y="15" width="20" height="20" fill="#fff" />
        <rect x="70" y="20" width="10" height="10" fill="#000" />
        <rect x="10" y="60" width="30" height="30" fill="#000" />
        <rect x="15" y="65" width="20" height="20" fill="#fff" />
        <rect x="20" y="70" width="10" height="10" fill="#000" />
        <rect x="45" y="45" width="12" height="12" fill="#000" />
        <rect x="65" y="65" width="25" height="25" fill="#000" />
      </svg>
    </div>
    <div style="font-size: 8px; color: #333; margin-top: 4px; word-break: break-all;">
      {{nfce.urlConsulta}}
    </div>
  </div>

  <div style="text-align: center; font-size: 9px; border-top: 1px dashed #000; padding-top: 4px;">
    Sistema RentAFit - Aluguel e Venda
  </div>
</div>
`,
  cssStyles: '',
  isDefault: true,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_NFCE_58MM_TEMPLATE: PrintTemplate = {
  id: 'template-cupom-nfce-58mm-default',
  name: 'Cupom Fiscal NFC-e / DANFE (Térmica 58mm)',
  description: 'Extrato auxiliar compacto para impressoras portáteis de 58mm / POS',
  templateType: 'FISCAL_RECEIPT_58MM',
  pageFormat: 'THERMAL_58MM',
  orientation: 'PORTRAIT',
  pageWidthMm: 58,
  pageHeightMm: null,
  marginTopMm: 3,
  marginBottomMm: 3,
  marginLeftMm: 3,
  marginRightMm: 3,
  printOffsetMm: 1,
  contentJson: null,
  contentHtml: `
<div class="thermal-receipt-58" style="font-family: 'Courier New', Courier, monospace; font-size: 8.5px; line-height: 1.2; color: #000; width: 100%;">
  <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 3px; margin-bottom: 4px;">
    <div style="font-size: 11px; font-weight: bold;">{{empresa.nomeFantasia}}</div>
    <div>CNPJ: {{empresa.cnpj}}</div>
    <div>{{empresa.endereco}}</div>
  </div>

  <div style="text-align: center; font-weight: bold; margin-bottom: 4px; font-size: 8px;">
    DANFE NFC-e - Extrato Auxiliar
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 8px; margin-bottom: 4px;">
    <thead>
      <tr style="border-bottom: 1px solid #000;">
        <th style="text-align: left;">Item</th>
        <th style="text-align: right;">Vl. Tot</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 1px 0;">1044 IMPERIAL 50</td>
        <td style="text-align: right;">350,00</td>
      </tr>
      <tr>
        <td style="padding: 1px 0;">1141 VESTIDO DAMA</td>
        <td style="text-align: right;">300,00</td>
      </tr>
    </tbody>
  </table>

  <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 2px 0; margin-bottom: 4px; font-weight: bold; display: flex; justify-content: space-between; font-size: 9.5px;">
    <span>TOTAL R$:</span>
    <span>{{nfce.valorTotal}}</span>
  </div>

  <div style="text-align: center; font-size: 7.5px; margin-bottom: 4px;">
    Nº {{nfce.numero}} &bull; Série {{nfce.serie}}<br>
    Chave: {{nfce.chave}}
  </div>

  <div style="text-align: center; margin: 4px 0;">
    <svg width="90" height="90" viewBox="0 0 100 100" style="display: block; margin: 0 auto;">
      <rect width="100" height="100" fill="#fff" />
      <rect x="10" y="10" width="30" height="30" fill="#000" />
      <rect x="15" y="15" width="20" height="20" fill="#fff" />
      <rect x="20" y="20" width="10" height="10" fill="#000" />
      <rect x="60" y="10" width="30" height="30" fill="#000" />
      <rect x="65" y="15" width="20" height="20" fill="#fff" />
      <rect x="70" y="20" width="10" height="10" fill="#000" />
      <rect x="10" y="60" width="30" height="30" fill="#000" />
      <rect x="15" y="65" width="20" height="20" fill="#fff" />
      <rect x="20" y="70" width="10" height="10" fill="#000" />
      <rect x="45" y="45" width="12" height="12" fill="#000" />
      <rect x="65" y="65" width="25" height="25" fill="#000" />
    </svg>
  </div>
</div>
`,
  cssStyles: '',
  isDefault: true,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_CUSTOM_TEMPLATE: PrintTemplate = {
  id: 'template-customizado-default',
  name: 'Template em Branco (Customizado)',
  description: 'Folha em branco para criação e personalização livre',
  templateType: 'CUSTOM',
  pageFormat: 'A4',
  orientation: 'PORTRAIT',
  pageWidthMm: 210,
  pageHeightMm: 297,
  marginTopMm: 15,
  marginBottomMm: 15,
  marginLeftMm: 15,
  marginRightMm: 15,
  printOffsetMm: 0,
  contentJson: null,
  contentHtml: `
<div style="font-family: Arial, sans-serif;">
  <h2 style="text-align: center;">Título do Documento</h2>
  <hr>
  <p>Comece a digitar seu documento aqui ou arraste elementos do painel esquerdo.</p>
</div>
`,
  cssStyles: '',
  isDefault: false,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const INITIAL_DEFAULT_TEMPLATES: PrintTemplate[] = [
  DEFAULT_RENTAL_CONTRACT_TEMPLATE,
  DEFAULT_CANCELLATION_TEMPLATE,
  DEFAULT_NFCE_80MM_TEMPLATE,
  DEFAULT_NFCE_58MM_TEMPLATE,
  DEFAULT_CUSTOM_TEMPLATE,
];
