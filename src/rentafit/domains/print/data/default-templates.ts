import { PrintTemplate } from './print-template.model';
import { DEFAULT_PRINT_SUBCOMPONENT_STYLES } from './print-subcomponent-style.model';

export const DEFAULT_RENTAL_CONTRACT_TEMPLATE: PrintTemplate = {
  id: 'template-contrato-locacao-legado-v2',
  name: 'Contrato de Locação (Legado A4)',
  description: 'Layout compatível com o contrato impresso legado, incluindo itens, pagamentos, cláusulas, assinatura e autorização de imagem',
  templateType: 'RENTAL_CONTRACT',
  pageFormat: 'A4',
  orientation: 'PORTRAIT',
  pageWidthMm: 210,
  pageHeightMm: 297,
  marginTopMm: 2,
  marginBottomMm: 2,
  marginLeftMm: 2,
  marginRightMm: 2,
  printOffsetMm: 0,
  contentJson: null,
  contentHtml: `
<div class="print-contract-container">
  <div class="contract-header" style="font-family: Arial, sans-serif; font-size: 9pt; line-height: 1.12; color: #111;">
    <table class="print-layout-table" data-print-component="common-table" style="width: 100%;">
      <tbody><tr>
        <td style="width: 80%; text-align: center; font-weight: bold; font-size: 11pt;">{{empresa.nomeFantasia}}</td>
        <td style="width: 20%; text-align: right; white-space: nowrap;">N. {{contrato.numero}}</td>
      </tr></tbody>
    </table>
    <hr style="border: 0; border-top: 1px solid #111; margin: 2px 0 8px;">
    <p style="margin: 0;">{{empresa.razaoSocial}}. CNPJ: {{empresa.cnpj}}, Inscrição Estadual: {{empresa.ie}} e Inscrição Municipal: {{empresa.im}}.</p>
    <p style="margin: 0;">Empresa especializada em Aluguéis de Noivas, Trajes a Rigor e Artigos do vestuário em geral.</p>
    <p style="margin: 0;">{{empresa.endereco}}. Telefone: {{empresa.telefone}}, E-Mail: {{empresa.email}}</p>
    <p style="margin: 0 0 8px;">Acesse: {{empresa.site}}</p>
  </div>

  <div class="contract-customer" style="font-family: Arial, sans-serif; font-size: 9pt; line-height: 1.12; border-top: 1px solid #111; border-bottom: 1px solid #111; padding: 6px 0; margin-bottom: 4px;">
    <p style="margin: 0;">Cliente: {{cliente.codigo}} - {{cliente.nome}}</p>
    <p style="margin: 0;">CPF: {{cliente.documento}}</p>
    <p style="margin: 0;">Endereço: {{cliente.endereco}}, Bairro: {{cliente.bairro}}</p>
    <p style="margin: 0;">Cidade: {{cliente.cidade}}/{{cliente.uf}} &nbsp; Telefone: {{cliente.telefone}}</p>
  </div>

  <table class="print-layout-table contract-dates" data-print-component="common-table" style="width: 100%; margin-bottom: 8px;">
    <tbody><tr>
      <td style="width: 33%; text-align: left;">RETIRADA: {{contrato.dataRetirada}}</td>
      <td style="width: 34%; text-align: center;">USA DIA: {{contrato.dataUso}}</td>
      <td style="width: 33%; text-align: right;">DEVOLUÇÃO: {{contrato.dataDevolucao}}</td>
    </tr></tbody>
  </table>
  <hr style="border: 0; border-top: 1px solid #111; margin: 0 0 4px;">

  <table class="print-table contract-items-table" data-print-component="contract-items" style="width: 100%;">
    <thead>
      <tr>
        <th style="width: 12%;">Código</th>
        <th style="width: 68%;">Descrição</th>
        <th style="width: 20%; text-align: right;">Valor</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>2671</td>
        <td>TERNO AZUL NAVY 2 BOTOES SLIM 50<br>SEM ACESS</td>
        <td style="text-align: right;">R$ 450,00</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="text-align: right;">Total</td>
        <td style="text-align: right;">{{contrato.valorTotal}}</td>
      </tr>
    </tfoot>
  </table>

  <p style="margin: 10px 0 2px; text-align: center; font-size: 9pt; font-weight: bold;">PAGAMENTO</p>
  <table class="print-table contract-payments-table" data-print-component="contract-payments" style="width: 100%;">
    <thead>
      <tr><th>Pagamento</th><th>Data</th><th>Situação</th></tr>
    </thead>
    <tbody>
      <tr><td>Entrada: R$ 300,00</td><td>14/09/2026</td><td style="text-align: right;">PAGO</td></tr>
      <tr><td>Parcela 1: R$ 150,00</td><td>21/09/2026</td><td style="text-align: right;">PAGO</td></tr>
    </tbody>
  </table>

  <div class="contract-terms" style="font-family: Arial, sans-serif; font-size: 8pt; line-height: 1.05; color: #111; border-top: 1px solid #111; padding-top: 8px; margin-top: 8px;">
    <p style="margin: 0 0 2px;"><strong>LEIA COM ATENÇÃO:</strong></p>
    <p style="margin: 0 0 2px;">{{empresa.razaoSocial}} acima identificada, e a seguir denominada LOCADORA, e de outro lado o Cliente {{cliente.nome}} (acima identificado), e a seguir denominado LOCATÁRIO, celebram o presente contrato de locação mediante as seguintes Cláusulas e Condições:</p>
    <p style="margin: 0 0 2px;"><strong>Cláusula 1a -</strong> O objeto do presente contrato é a Locação de artigos do vestuário, acima especificados.</p>
    <p style="margin: 0 0 2px;"><strong>Cláusula 2a -</strong> As datas, para retirada das mercadorias, bem como da sua utilização e devolução encontram-se acima especificadas.</p>
    <p style="margin: 0 0 2px;"><strong>Cláusula 3a -</strong> A LOCADORA não se responsabilizará pelas mercadorias que não forem retiradas até UM dia antes da data de uso estabelecida neste contrato.</p>
    <p style="margin: 0 0 2px;"><strong>Cláusula 4a -</strong> A mercadoria alugada deverá ser devolvida até as 18:00 (Dezoito) horas da data estabelecida neste contrato, completa, tal como foi retirada.</p>
    <p style="margin: 0 0 2px;"><strong>Parágrafo Primeiro:</strong> Caso as mercadorias não sejam devolvidas na data prevista neste contrato sofrerão um acréscimo de R$ 35,00 (Trinta e Cinco Reais) por dia útil de atraso. Se esta condição perdurar por 03 (três) dias será cobrada uma nova taxa de locação, de acordo com o valor pago pelo LOCATÁRIO.</p>
    <p style="margin: 0 0 2px;"><strong>Parágrafo Segundo:</strong> Caso as mercadorias sejam devolvidas com manchas de gordura, graxa, tinta ou qualquer outro produto que as danifique, será cobrada uma taxa de R$ 100,00 (Cem Reais).</p>
    <p style="margin: 0 0 2px;"><strong>Cláusula 5a -</strong> O LOCATÁRIO poderá requerer TROCA da mercadoria deste contrato nas seguintes condições abaixo.</p>
    <p style="margin: 0 0 2px;"><strong>Parágrafo Primeiro:</strong> Em até 5 (cinco) dias úteis corridos da data de locação, sem ônus.</p>
    <p style="margin: 0 0 2px;"><strong>Parágrafo Segundo:</strong> Após 5 (cinco) dias úteis, mediante ao pagamento de ônus de 20% (Vinte Porcento) do valor de locação da referida mercadoria a ser trocada.</p>
    <p style="margin: 0 0 2px;"><strong>Cláusula 6a -</strong> Em caso de desistência o LOCATÁRIO deverá pagar à LOCADORA multa de 30% do valor total deste contrato.</p>
    <p style="margin: 0 0 2px;"><strong>Parágrafo primeiro:</strong> Os valores pagos NÃO serão devolvidos em caso de reserva igual ou superior a três meses, ou seja, a data de assinatura menos a data de desistência igual ou superior a três meses.</p>
    <p style="margin: 0 0 2px;"><strong>Cláusula 7a -</strong> As mercadorias, objeto da referida locação, não poderão ser emprestadas ou transferidas a outras pessoas.</p>
    <p style="margin: 0 0 2px;"><strong>Cláusula 8a -</strong> O LOCATÁRIO se compromete a ressarcir a LOCADORA pelo valor de tabela de Mercado, vigente na data do evento, pelo extravio ou dano nas mercadorias objeto deste contrato, bem como seu uso indevido.</p>
    <p style="margin: 0 0 2px;"><strong>Cláusula 9a -</strong> A LOCADORA se compromete a entregar a Mercadoria lavada e passada, com os devidos ajustes solicitados pelo LOCATÁRIO e em perfeito estado de conservação.</p>
    <p style="margin: 0 0 2px;"><strong>Cláusula 10a -</strong> Caso seja constatada alguma danificação na Mercadoria locada no momento da retirada pelo LOCATÁRIO, a LOCADORA se compromete a efetuar a substituição, troca ou devolução do valor pago, conforme disponibilidade do produto ou conveniência da LOCADORA.</p>
    <p style="margin: 0 0 2px;"><strong>Cláusula 11a -</strong> E por estarem juntos e acordados, firmam o presente contrato, ficando eleito o Fórum desta Comarca para dirimir quaisquer dúvidas que possam surgir.</p>
  </div>

  <div style="font-family: Arial, sans-serif; font-size: 9pt; margin-top: 8px;">
    <p style="margin: 0 0 10px;">São Carlos, {{sistema.dataAtual}}</p>
    <div data-print-component="signature">
      <p><strong>{{cliente.nome}}</strong></p>
    </div>
  </div>

  <div class="contract-notices" style="font-family: Arial, sans-serif; font-size: 8pt; line-height: 1.1; margin-top: 10px;">
    <strong>Atenção:</strong><br>
    NÃO FAZEMOS PROVAS AOS SÁBADOS!<br>
    É OBRIGATÓRIO APRESENTAR ESTE CONTRATO NA RETIRADA!<br><br>
    Assinalar abaixo se SIM aceita ou NÃO aceita CEDER sua IMAGEM para as veicularmos a mídia (facebook e nosso site) para divulgação de nosso trabalho, desde que não haja desvirtuação destas finalidades (marketing).<br>
    ( &nbsp; ) SIM &nbsp;&nbsp;&nbsp; ( &nbsp; ) NÃO
  </div>
</div>
`,
  cssStyles: JSON.stringify({ version: 1, styles: DEFAULT_PRINT_SUBCOMPONENT_STYLES }),
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
