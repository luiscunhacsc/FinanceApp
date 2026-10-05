import { useState } from 'react';
import { ZodError } from 'zod';
import { Modal } from '../../components/Modal';
import { saveYahooPlan } from '../../storage/yahoo';
import { buildYahooPlan, type YahooFile, type YahooOptions, type YahooPlan } from '../../../../../packages/import-export/yahoo';
import { replayLedger } from '../../../../../packages/quantitative/ledger';
import { decimalText } from '../../../../../packages/quantitative/decimal';
import { date, money } from '../../../../../packages/domain/format';
import type { Instrument } from '../../../../../packages/domain';
import type { Portfolio, Transaction } from '../../../../../packages/domain/ledger';

type Props = { file: YahooFile; selected: string; portfolios: Portfolio[]; instruments: Instrument[]; transactions: Transaction[]; hidden: boolean; onClose: () => void; onDone: () => void };
export function YahooImport({ file, selected, portfolios, instruments, transactions, hidden, onClose, onDone }: Props) {
  const [options, setOptions] = useState<YahooOptions>({ portfolioId: selected === 'all' ? portfolios[0]?.id ?? '' : selected, currencies: Object.fromEntries(file.symbols.map(s => [s, instruments.find(i => i.symbol === s)?.currency?.value ?? ''])), fees: {}, fxRates: {}, blankFeesAreZero: false, confirmConventions: false, includeQuotes: true });
  const [allCurrency, setAllCurrency] = useState(''); const [page, setPage] = useState(0);
  const [plan, setPlan] = useState<YahooPlan | null>(null); const [balance, setBalance] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const update = (patch: Partial<YahooOptions>) => { setPlan(null); setError(''); setOptions(old => ({ ...old, ...patch })); };
  const missingFees = file.rows.filter(r => r.fee === null).length;
  const showError = (e: unknown) => setError(e instanceof ZodError ? 'Preencha as moedas e os valores em falta com códigos ISO e números válidos.' : e instanceof Error ? e.message : 'Não foi possível importar.');
  const preview = async () => {
    setBusy(true); setError(''); setPlan(null);
    try {
      const candidate = await buildYahooPlan(file, options, transactions);
      const ledger = replayLedger(portfolios, [...transactions, ...candidate.transactions]);
      setBalance(decimalText(ledger.cash.get(options.portfolioId)!)); setPlan(candidate);
    } catch (e) { showError(e); } finally { setBusy(false); }
  };
  return <Modal title="Importar Yahoo Finance" onClose={() => !busy && onClose()} wide>
    <div className="form-stack yahoo-import">
      <p><strong>{file.rows.length} operações · {file.symbols.length} instrumentos</strong><br />{file.rows.filter(r => r.kind === 'buy').length} compras e {file.rows.filter(r => r.kind === 'sell').length} vendas. Datas entre {date([...file.rows].sort((a, b) => a.day.localeCompare(b.day))[0].day)} e {date([...file.rows].sort((a, b) => b.day.localeCompare(a.day))[0].day)}.</p>
      <div className="notice amber-notice"><span>Este CSV não contém entradas de dinheiro. Registe previamente os depósitos reais, com as suas datas, em Carteiras e transações (ou no CSV nativo). A importação verifica o saldo e não cria reforços automaticamente.</span></div>
      <label>Carteira de destino Yahoo<select value={options.portfolioId} disabled={busy} onChange={e => update({ portfolioId: e.target.value })}>{portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <h3>Moeda dos preços exportados</h3><p className="muted">A moeda não consta do CSV. Confirme-a por símbolo, tanto para os preços das operações como para as cotações. Não é deduzida do sufixo da bolsa. Os campos preenchidos provêm dos metadados já guardados.</p>
      <div className="form-row"><label>Aplicar moeda a todos<input maxLength={3} placeholder="Código ISO" value={allCurrency} onChange={e => setAllCurrency(e.target.value.toUpperCase())} /></label><button className="button secondary" disabled={busy || !/^[A-Z]{3}$/.test(allCurrency)} onClick={() => update({ currencies: Object.fromEntries(file.symbols.map(s => [s, allCurrency])) })}>Aplicar a todos os símbolos</button></div>
      <div className="yahoo-currencies">{file.symbols.map(s => <label key={s}>{s}<input aria-label={`Moeda de ${s}`} maxLength={3} placeholder="Código ISO" value={options.currencies[s]} disabled={busy} onChange={e => update({ currencies: { ...options.currencies, [s]: e.target.value.toUpperCase() } })} /></label>)}</div>
      <h3>Rever operações</h3><p className="muted">Purchase Price é o preço por unidade da operação. Current Price é uma cotação separada. Nas vendas, confirme o preço de execução antes de importar. Quantidades são positivas e Transaction Type determina compra ou venda.</p>
      {missingFees > 0 && <label className="yahoo-check"><input type="checkbox" checked={options.blankFeesAreZero} disabled={busy} onChange={e => update({ blankFeesAreZero: e.target.checked })} /><span>Confirmo que as comissões vazias que não preencher abaixo são zero ({missingFees} campos em falta).</span></label>}
      <div className="table-scroll"><table className="instrument-table"><thead><tr><th>Linha / data</th><th>Operação</th><th>Unidades / preço</th><th>Comissão</th><th>EUR por unidade da moeda</th></tr></thead><tbody>{file.rows.slice(page * 25, (page + 1) * 25).map(row => <tr key={row.line}><td>{row.line}<small>{date(row.day)}</small></td><td>{row.kind === 'buy' ? 'Compra' : 'Venda'}<small>{row.symbol}</small></td><td>{hidden ? '••••' : row.quantity}<small>{hidden ? '••••' : row.price} {options.currencies[row.symbol]}</small></td><td>{row.fee === null ? <input aria-label={`Comissão da linha ${row.line}`} inputMode="decimal" placeholder={options.blankFeesAreZero ? 'Zero confirmado' : 'Em falta'} value={options.fees[row.line] ?? ''} disabled={busy} onChange={e => update({ fees: { ...options.fees, [row.line]: e.target.value } })} /> : hidden ? '••••' : row.fee}</td><td>{options.currencies[row.symbol] === 'EUR' ? '1' : <input aria-label={`Câmbio da linha ${row.line}`} inputMode="decimal" placeholder="Em falta" value={options.fxRates[row.line] ?? ''} disabled={busy} onChange={e => update({ fxRates: { ...options.fxRates, [row.line]: e.target.value } })} />}</td></tr>)}</tbody></table></div>
      {file.rows.length > 25 && <div className="form-actions"><button className="button secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anteriores</button><span>Página {page + 1} de {Math.ceil(file.rows.length / 25)}</span><button className="button secondary" disabled={(page + 1) * 25 >= file.rows.length} onClick={() => setPage(p => p + 1)}>Seguintes</button></div>}
      <label className="yahoo-check"><input type="checkbox" checked={options.confirmConventions} disabled={busy} onChange={e => update({ confirmConventions: e.target.checked })} /><span>Confirmei moedas e preços, incluindo o preço de execução das vendas. Aceito a hora convencional 12:00 UTC, pois Trade Date só indica o dia; operações do mesmo dia seguem a ordem das linhas e as vendas usam FIFO.</span></label>
      <label className="yahoo-check"><input type="checkbox" checked={options.includeQuotes} disabled={busy} onChange={e => update({ includeQuotes: e.target.checked })} /><span>Importar também {file.snapshots.length} cotações datadas de Current Price. Não constituem um histórico diário.</span></label>
      <details><summary>Datas das cotações e limites do formato</summary><ul>{file.snapshots.map(q => <li key={`${q.symbol}:${q.at}`}>{q.symbol}: {date(q.at)} · {q.at.slice(11, 16)} UTC</li>)}</ul><p className="fine-print">O NAV do PPR mantém a sua própria data. Open, High, Low, Volume e Change não são usados para reconstruir preços ou desempenho. Não são importados nome, ISIN ou TER, ausentes deste ficheiro. Comentários são texto e nunca são executados.</p><p className="fine-print">Sem identificadores Yahoo: reimportações iguais são reconhecidas pelo conteúdo financeiro e multiplicidade. Linhas corrigidas, adicionadas ou removidas no Yahoo exigem reconciliação; não sincronizam nem substituem automaticamente movimentos anteriores. O mesmo histórico importado por outra via pode gerar conflitos.</p></details>
      {file.warnings.map(w => <p key={w} className="notice">{w}</p>)}
      {error && <p className="form-error" role="alert">{error}</p>}
      {plan && <div role="status" className="notice"><span>{plan.transactions.length} novos movimentos · {plan.duplicates} duplicados ignorados · {plan.quotes.length} cotações. Saldo após importação: {money(Number(balance), 'EUR', hidden)}. Verifique-o com o extrato.</span></div>}
      <div className="form-actions"><button className="button secondary" disabled={busy} onClick={onClose}>Cancelar</button>{!plan ? <button className="button primary" disabled={busy} onClick={preview}>{busy ? 'A validar…' : 'Validar importação Yahoo'}</button> : <button className="button primary" disabled={busy || !plan.transactions.length && !plan.quotes.length} onClick={async () => { setBusy(true); setError(''); try { await saveYahooPlan(plan); onDone(); } catch (e) { showError(e); setPlan(null); } finally { setBusy(false); } }}>Confirmar importação Yahoo</button>}</div>
    </div>
  </Modal>;
}
