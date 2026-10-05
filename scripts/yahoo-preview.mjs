import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
mkdirSync('artifacts', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, colorScheme: 'light' });
  page.on('pageerror', error => console.log('page-error', error.message));
  await page.goto('http://127.0.0.1:4173/#transactions');
  await page.getByRole('button', { name: 'Nova carteira', exact: true }).click();
  await page.getByLabel('Nome da carteira').fill('Yahoo · dados sintéticos');
  await page.getByRole('button', { name: 'Guardar carteira' }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  const csv = 'Symbol,Current Price,Date,Time,Change,Open,High,Low,Volume,Trade Date,Purchase Price,Quantity,Commission,High Limit,Low Limit,Comment,Transaction Type\nVWCE.DE,14,2025/09/03,17:35 CEST,,,,,,20250901,10,10,,,,Dados sintéticos,BUY\nVWCE.DE,14,2025/09/03,17:35 CEST,,,,,,20250902,12,3,1,,,Dados sintéticos,SELL';
  await page.getByLabel('Importar movimentos CSV', { exact: true }).setInputFiles({ name: 'portfolio.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByRole('dialog', { name: 'Importar Yahoo Finance' }).waitFor();
  await page.screenshot({ path: 'artifacts/yahoo-import-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/yahoo-import-mobile.png' });
  console.log('mobile-layout', await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth })));
} finally { await browser.close(); }
