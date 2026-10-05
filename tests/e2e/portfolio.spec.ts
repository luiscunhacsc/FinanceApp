import { test, expect, type Page } from '@playwright/test';

async function createPortfolio(page: Page, name: string) {
  await page.getByRole('button', { name: 'Carteiras e transações', exact: true }).click();
  await page.getByRole('button', { name: 'Nova carteira', exact: true }).click();
  await page.getByLabel('Nome da carteira').fill(name);
  await page.getByRole('button', { name: 'Guardar carteira', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function movement(page: Page, kind: string, amount?: string) {
  await page.getByRole('button', { name: 'Registar movimento', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo de movimento', exact: true }).selectOption(kind);
  if (amount) await page.getByLabel('Montante em EUR', { exact: true }).fill(amount);
}
test('carteira, compra com comissão, lotes, venda parcial e reconciliação do painel', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/'); await createPortfolio(page, 'Longo prazo');
  await movement(page, 'deposit', '2000'); await page.getByRole('button', { name: 'Guardar movimento', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await movement(page, 'buy'); await page.getByRole('combobox', { name: 'Instrumento', exact: true }).selectOption('VWCE.DE');
  await page.getByLabel('Quantidade de unidades').fill('10'); await page.getByLabel('Preço de execução por unidade').fill('100'); await page.getByLabel('Moeda da transação', { exact: true }).fill('EUR'); await page.getByLabel('Comissão na moeda da transação').fill('1');
  await page.getByRole('button', { name: 'Guardar movimento', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Instrumentos', exact: true }).click();
  await page.getByRole('button', { name: 'Introduzir preço de VWCE.DE', exact: true }).click();
  await page.getByLabel('Preço por unidade').fill('110'); await page.getByLabel('Moeda ISO').fill('EUR'); await page.getByRole('button', { name: 'Guardar preço', exact: true }).click();
  await page.getByRole('button', { name: 'Visão geral', exact: true }).click();
  await expect(page.locator('.portfolio-stats .stat-card').nth(0)).toContainText(/2\s099,00/);
  await expect(page.locator('.portfolio-stats .stat-card').nth(2)).toContainText('99,00');
  await page.getByRole('button', { name: 'Ver lotes de VWCE.DE' }).click();
  await expect(page.getByRole('dialog')).toContainText(/1\s001,00/); await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Carteiras e transações', exact: true }).click();
  await movement(page, 'sell'); await page.getByRole('combobox', { name: 'Instrumento', exact: true }).selectOption('VWCE.DE'); await page.getByLabel('Quantidade de unidades').fill('5'); await page.getByLabel('Preço de execução por unidade').fill('120'); await page.getByLabel('Moeda da transação', { exact: true }).fill('EUR'); await page.getByLabel('Comissão na moeda da transação').fill('2');
  await page.getByRole('button', { name: 'Guardar movimento', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Visão geral', exact: true }).click();
  await expect(page.locator('.portfolio-stats .stat-card').nth(0)).toContainText(/2\s147,00/);
  await expect(page.locator('.ledger-breakdown .stat-card').nth(0)).toContainText('97,50');
  await expect(page.locator('.ledger-breakdown .stat-card').nth(1)).toContainText('49,50');
  await page.getByRole('button', { name: 'Ocultar valores', exact: true }).click(); await expect(page.getByRole('img', { name: /Evolução do património/ })).toHaveCount(0);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Valores ocultos' })).toBeVisible();
});
test('bloqueia saldo insuficiente e preserva dados após uma remoção inválida', async ({ page }) => {
  await page.goto('/'); await createPortfolio(page, 'Principal');
  await movement(page, 'withdrawal', '50'); await page.getByRole('button', { name: 'Guardar movimento' }).click(); await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Saldo insuficiente'); await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await movement(page, 'deposit', '100'); await page.getByRole('button', { name: 'Guardar movimento' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await movement(page, 'withdrawal', '50'); await page.getByRole('button', { name: 'Guardar movimento' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  const row = page.getByRole('row').filter({ hasText: 'Entrada de dinheiro' }); await row.getByRole('button', { name: /Eliminar movimento/ }).click(); await page.getByRole('button', { name: 'Confirmar eliminação' }).click();
  await expect(page.locator('.toast')).toContainText('Saldo insuficiente'); await page.getByRole('button', { name: 'Cancelar', exact: true }).click(); await expect(row).toBeVisible();
});
test('CSV de movimentos, duplicados, transferência entre carteiras e observação', async ({ page }) => {
  await page.goto('/'); await createPortfolio(page, 'Principal'); await createPortfolio(page, 'Reserva');
  const csv = 'id;portfolio;at;kind;symbol;quantity;price;currency;fx_rate;fee;amount;to_portfolio;lot_id;opening_value;note\ndep;Principal;2025-01-01T12:00:00Z;deposit;;;;EUR;1;0;1000;;;0;Fixture sintética\nmove;Principal;2025-01-02T12:00:00Z;transfer;;;;EUR;1;2;400;Reserva;;0;Fixture sintética';
  await page.getByLabel('Importar movimentos CSV', { exact: true }).setInputFiles({ name: 'movimentos.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByRole('dialog')).toContainText('2 novos movimentos'); await page.getByRole('button', { name: 'Confirmar importação' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Carteira apresentada').selectOption('all'); await expect(page.locator('.portfolio-stats .stat-card').nth(0)).toContainText('998,00');
  await page.getByLabel('Importar movimentos CSV', { exact: true }).setInputFiles({ name: 'movimentos.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByRole('dialog')).toContainText('0 novos movimentos · 2 duplicados'); await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Lista de observação', exact: true }).click(); await page.getByLabel('Instrumento a acompanhar').selectOption('VWCE.DE'); await page.getByRole('button', { name: 'Acompanhar', exact: true }).click(); await expect(page.locator('.watch-card')).toContainText('VWCE.DE');
  await page.reload(); await expect(page.locator('.watch-card')).toContainText('VWCE.DE');
});
test('vista patrimonial móvel mantém todo o conteúdo dentro do ecrã', async ({ page }) => {
  await page.goto('/'); await createPortfolio(page, 'Longo prazo'); await movement(page, 'deposit', '1234,56'); await page.getByRole('button', { name: 'Guardar movimento' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Visão geral', exact: true }).click(); await expect(page.locator('.portfolio-stats .stat-card').first()).toContainText(/1\s234,56/);
  await page.setViewportSize({ width: 390, height: 844 }); await expect(page.getByRole('button', { name: 'Abrir navegação' })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
