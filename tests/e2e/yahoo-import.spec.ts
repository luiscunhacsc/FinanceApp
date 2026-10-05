import { test, expect } from '@playwright/test';
const header = 'Symbol,Current Price,Date,Time,Change,Open,High,Low,Volume,Trade Date,Purchase Price,Quantity,Commission,High Limit,Low Limit,Comment,Transaction Type';
const csv = header + '\nVWCE.DE,14,2025/09/03,17:35 CEST,,,,,,20250901,10,10,,,,Dados sintéticos,BUY\nVWCE.DE,14,2025/09/03,17:35 CEST,,,,,,20250902,12,3,1,,,Dados sintéticos,SELL';
test('Yahoo exige dados em falta, importa sem duplicar e conserva as datas das cotações', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/#transactions'); await page.getByRole('button', { name: 'Nova carteira', exact: true }).click(); await page.getByLabel('Nome da carteira').fill('Yahoo · teste sintético'); await page.getByRole('button', { name: 'Guardar carteira' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Registar movimento', exact: true }).click(); await page.getByLabel('Montante em EUR', { exact: true }).fill('1000'); await page.getByLabel('Data e hora do movimento', { exact: false }).fill('2025-01-01T00:00'); await page.getByRole('button', { name: 'Guardar movimento' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  const upload = () => page.getByLabel('Importar movimentos CSV', { exact: true }).setInputFiles({ name: 'portfolio.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await upload(); const dialog = page.getByRole('dialog', { name: 'Importar Yahoo Finance' }); await expect(dialog).toContainText('2 operações · 1 instrumentos');
  await expect(page.getByLabel('Moeda de VWCE.DE', { exact: true })).toHaveValue('');
  await page.getByLabel('Aplicar moeda a todos', { exact: true }).fill('EUR'); await page.getByRole('button', { name: 'Aplicar a todos os símbolos' }).click();
  await page.getByLabel(/Confirmei moedas e preços/).check(); await page.getByRole('button', { name: 'Validar importação Yahoo' }).click(); await expect(dialog.getByRole('alert')).toContainText('comissão em falta');
  await page.getByLabel(/Confirmo que as comissões vazias/).check(); await page.getByRole('button', { name: 'Validar importação Yahoo' }).click(); await expect(dialog.getByRole('status')).toContainText('2 novos movimentos');
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Confirmar importação Yahoo' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.portfolio-stats .stat-card').first()).toContainText(/1\s033,00/);
  await upload(); await page.getByLabel('Moeda de VWCE.DE', { exact: true }).fill('EUR'); await page.getByLabel(/Confirmo que as comissões vazias/).check(); await page.getByLabel(/Confirmei moedas e preços/).check(); await page.getByRole('button', { name: 'Validar importação Yahoo' }).click(); await expect(dialog.getByRole('status')).toContainText('0 novos movimentos · 2 duplicados'); await page.getByRole('button', { name: 'Confirmar importação Yahoo' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload(); await expect(page.locator('.portfolio-stats .stat-card').first()).toContainText(/1\s033,00/);
});
test('Yahoo sem depósitos bloqueia a gravação sem inventar reforços', async ({ page }) => {
  await page.goto('/#transactions'); await page.getByRole('button', { name: 'Nova carteira', exact: true }).click(); await page.getByLabel('Nome da carteira').fill('Sem fundos'); await page.getByRole('button', { name: 'Guardar carteira' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Importar movimentos CSV', { exact: true }).setInputFiles({ name: 'portfolio.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) }); await page.getByLabel('Moeda de VWCE.DE', { exact: true }).fill('EUR'); await page.getByLabel(/Confirmo que as comissões vazias/).check(); await page.getByLabel(/Confirmei moedas e preços/).check(); await page.getByRole('button', { name: 'Validar importação Yahoo' }).click(); await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Saldo insuficiente'); await page.getByRole('button', { name: 'Cancelar', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Ainda não há movimentos nesta vista' })).toBeVisible();
});
