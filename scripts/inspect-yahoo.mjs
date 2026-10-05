// Leitura local apenas. Não importa posições, não escreve backups nem contacta serviços.
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
if (!process.argv[2]) throw new Error('Uso: node scripts/inspect-yahoo.mjs caminho/portfolio.csv');
const compiled = await build({ entryPoints: ['packages/import-export/yahoo.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { parseYahooCSV } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const file = parseYahooCSV(await readFile(process.argv[2], 'utf8'));
console.log(JSON.stringify({ operations: file.rows.length, buys: file.rows.filter(r => r.kind === 'buy').length, sells: file.rows.filter(r => r.kind === 'sell').length, instruments: file.symbols.length, missingCommissions: file.rows.filter(r => r.fee === null).length, datedQuotes: file.snapshots.length, warnings: file.warnings }, null, 2));
