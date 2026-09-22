/**
 * Pre-build script: reads .env (or process.env in CI) and generates
 * src/environments/environment.prod.ts with the resolved values.
 *
 * Usage:
 *   node scripts/generate-env.mjs          # reads .env file
 *   APP_NAME=Foo AWS_S3_BUCKET_URL=https://... node scripts/generate-env.mjs  # CI via env vars
 *
 * API_BASE_URL is optional and defaults to '' (relative URLs for same-origin Caddy gateway).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const envFile = resolve(rootDir, '.env');
const outputFile = resolve(rootDir, 'src/environments/environment.prod.ts');

// Variaveis obrigatorias. API_BASE_URL nao esta aqui porque e opcional
// (default vazio = URLs relativas para o Caddy gateway na mesma origem).
const REQUIRED_VARS = ['APP_NAME', 'AWS_S3_BUCKET_URL'];
const OPTIONAL_VARS = ['API_BASE_URL'];

/** Minimal .env parser — no external dependencies needed. */
function parseEnvFile(content) {
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex < 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed
      .slice(eqIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    vars[key] = value;
  }
  return vars;
}

// 1. Start from .env file (local dev), if present
let fileVars = {};
if (existsSync(envFile)) {
  fileVars = parseEnvFile(readFileSync(envFile, 'utf-8'));
  console.log('📄  Loaded .env file.');
}

// 2. process.env always wins over .env (CI secrets injected via workflow env: block)
const merged = { ...fileVars };
for (const key of [...REQUIRED_VARS, ...OPTIONAL_VARS]) {
  const val = process.env[key];
  if (val !== undefined) {
    merged[key] = val;
  }
}

// Default API_BASE_URL to relative (empty) for same-origin Caddy gateway.
if (merged.API_BASE_URL === undefined) {
  merged.API_BASE_URL = '';
}

// Debug: show what was resolved (values masked for security)
const allVars = [...REQUIRED_VARS, ...OPTIONAL_VARS];
for (const key of allVars) {
  const val = merged[key];
  console.log(`    ${key}: ${val ? `${val.slice(0, 12)}...` : '(not set)'}`);
}

// Validate all required vars are present.
const missing = REQUIRED_VARS.filter((k) => !merged[k] || merged[k].trim() === '');
if (missing.length > 0) {
  console.error('❌  Missing required environment variables:', missing.join(', '));
  console.error('    Create a .env file based on .env.template or set them in CI.');
  process.exit(1);
}

const content = `// AUTO-GENERATED — do not edit manually.
// Run: node scripts/generate-env.mjs
export const environment = {
  appName: '${merged.APP_NAME}',
  apiBaseUrl: '${merged.API_BASE_URL}',
  s3BucketUrl: '${merged.AWS_S3_BUCKET_URL}',
  // Defaults para emissao fiscal — em homologacao o backend nao exige certificado
  // e aceita quaisquer valores; em producao esses valores devem vir da configuracao
  // cadastral do emitente e do produto/servico.
  fiscalDefaults: {
    nfse: {
      serviceCode: '',
      nbsCode: '',
      serviceDescription: 'Locacao de trajes e vestuario',
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
`;

writeFileSync(outputFile, content, 'utf-8');
console.log('✅  src/environments/environment.prod.ts generated successfully.');
console.log(`    APP_NAME      → ${merged.APP_NAME}`);
console.log(`    API_BASE_URL  → ${merged.API_BASE_URL}`);
console.log(`    S3_BUCKET_URL → ${merged.AWS_S3_BUCKET_URL}`);
