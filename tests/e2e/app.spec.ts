import { test, expect } from '@playwright/test';

test('primeira utilização, preço manual, persistência, privacidade e backup', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A sua carteira começa aqui.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'VWCE.DE Nome por obter da fonte' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Sem dados Aguardam consulta ou introdução' })).toHaveCount(8);
  await page.getByRole('button', { name: 'Introduzir preço de VWCE.DE', exact: true }).click();
  await page.getByLabel('Preço por unidade').fill('123,45');
  await page.getByLabel('Moeda ISO').fill('EUR');
  await page.getByRole('button', { name: 'Guardar preço', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Preço manual guardado');
  await expect(page.getByRole('cell', { name: /123,45/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('cell', { name: /123,45/ })).toBeVisible();
  await page.getByRole('button', { name: 'Ocultar valores', exact: true }).click();
  await expect(page.getByRole('cell', { name: /123,45/ })).toHaveCount(0);
  await expect(page.getByRole('cell', { name: /••••••/ })).toBeVisible();
  await page.getByRole('button', { name: 'Dados e definições', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar JSON' }).click();
  expect((await download).suggestedFilename()).toMatch(/^patrimonio-.*\.json$/);
  await page.getByRole('button', { name: 'Ativar modo escuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('CSV validado, restauro com confirmação e funcionamento offline', async ({ page, context }) => {
  await page.goto('/#data');
  const csv = 'symbol;as_of;price;currency;source;name\nVWCE.DE;2025-01-01T12:00:00Z;101,25;EUR;Fixture sintética;Instrumento sintético de teste';
  await page.getByLabel('Importar CSV de cotações').setInputFiles({ name: 'teste.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByRole('dialog', { name: 'Rever importação' })).toBeVisible();
  await page.getByRole('button', { name: 'Importar cotações', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Cotações importadas');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV', exact: true }).click();
  const download = await downloadPromise;
  await page.getByLabel('Restaurar backup', { exact: true }).setInputFiles((await download.path())!);
  await expect(page.getByRole('dialog', { name: 'Rever restauro' })).toBeVisible();
  await page.getByRole('button', { name: 'Guardar cópia e restaurar' }).click();
  await expect(page.getByRole('status')).toContainText('Backup restaurado');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Está offline.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Instrumentos', exact: true }).click();
  await expect(page.getByRole('cell', { name: /101,25/ })).toBeVisible();
});

test('layout móvel, adicionar símbolo e navegação por teclado', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A sua carteira começa aqui.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Adicionar instrumento', exact: true }).click();
  await page.getByLabel('Símbolo Yahoo').fill('TEST.DE');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'TEST.DE' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir navegação' }).click();
  await page.getByRole('button', { name: 'Metodologia', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Como tratamos os seus dados' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('consulta ao proxy, histórico real identificado e preço manual prioritário', async ({ page }) => {
  const asOf = '2025-01-03T16:30:00Z';
  const source = { name: 'Fonte sintética apenas para teste', nature: 'observed', asOf, retrievedAt: asOf };
  await page.route('https://test.workers.dev/api/**', async route => {
    if (route.request().url().endsWith('/health')) return route.fulfill({ json: { ok: true, service: 'patrimonio-dados', version: 1 } });
    const symbol = new URL(route.request().url()).searchParams.get('symbol')!;
    await route.fulfill({ json: { instrument: { symbol, name: { value: 'Nome sintético', source }, currency: { value: 'EUR', source }, kind: symbol === '0P0001PBB6.F' ? 'nav' : 'exchange', createdAt: asOf, manualOverride: false }, quote: { id: symbol + ':test', symbol, price: 100, currency: 'EUR', source }, history: ['2025-01-02', '2025-01-03'].map((date, index) => ({ id: symbol + date, symbol, date, close: 99 + index, currency: 'EUR', source })), warnings: [] } });
  });
  await page.goto('/#data');
  await page.getByLabel('Endereço do Worker').fill('https://test.workers.dev');
  await page.getByRole('button', { name: 'Guardar configuração' }).click();
  await page.getByRole('button', { name: 'Consultar cotações agora' }).click();
  await expect(page.getByRole('status')).toContainText('8 instrumento(s) consultado(s)');
  await page.getByRole('button', { name: 'Instrumentos', exact: true }).click();
  await page.getByRole('button', { name: 'VWCE.DE Nome sintético' }).click();
  await expect(page.getByRole('img', { name: /Histórico de 2/ })).toBeVisible();
  await expect(page.getByText('Máximo do período')).toBeVisible();
  await page.getByRole('button', { name: 'Introduzir preço', exact: true }).click();
  await page.getByLabel('Preço por unidade').fill('88');
  await page.getByRole('button', { name: 'Guardar preço', exact: true }).click();
  await expect(page.locator('.detail-price')).toContainText('88,00');
  await page.getByRole('button', { name: 'Consultar fonte', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('1 instrumento(s) consultado(s)');
  await expect(page.locator('.detail-price')).toContainText('88,00');
  await page.getByRole('button', { name: 'Usar fonte/importação' }).click();
  await expect(page.locator('.detail-price')).toContainText('100,00');
});
