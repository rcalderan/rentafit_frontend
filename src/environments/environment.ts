// Development environment — used by `ng serve` with proxy.conf.json
// apiBaseUrl is empty so HTTP calls use relative paths (proxied by dev-server)
export const environment = {
  appName: 'RentAFit',
  apiBaseUrl: '',
  s3BucketUrl: 'https://placeholder.s3.amazonaws.com',
  // Defaults para emissão fiscal — em homologação o backend não exige certificado
  // e aceita quaisquer valores; em produção esses valores devem vir da configuração
  // cadastral do emitente e do produto/serviço.
  fiscalDefaults: {
    nfse: {
      serviceCode: '',
      nbsCode: '',
      serviceDescription: 'Locação de trajes e vestuário',
      totalTaxRate: 0,
      ibsRate: 0.025,
      cbsRate: 0.015,
      isqnRate: 0.0,
    },
    nfe: {
      // NCM 9505.90.00: "Artigos para festas, carnaval ou outros divertimentos,
      // incluindo os artigos de magia e artigos-surpresa - Outros" (cobre fantasias/costumes).
      ncm: '95059000',
      cfop: '5102',
      unit: 'UN',
    },
  },
};
