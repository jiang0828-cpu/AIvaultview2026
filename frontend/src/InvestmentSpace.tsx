import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, Clipboard, FileText, FolderOpen, Landmark, LoaderCircle, Pencil, Plus, RefreshCw, Scale, Trash2, TrendingUp, Upload, Wallet } from 'lucide-react';
import { api } from './api';
import { flatten, type Content } from './types';
import { categoryName, importExample, investmentCategories, investmentChannels, investmentSource, money, percent,
  type Dataset, type InvestmentAccount, type InvestmentCandidates, type InvestmentCategory, type InvestmentComparison, type InvestmentProduct, type InvestmentReview, type InvestmentState } from './investmentModel';
import './investment.css';

const tabs = [['overview', '账户总览', Wallet], ['compare', '基金 / ETF 对比', Scale], ['candidates', '候选解释', FileText], ['channels', '购买入口', Landmark], ['review', '收益复盘', TrendingUp]] as const;
const datasetNames: Record<Dataset, string> = { products: '产品档案', positions: '持仓快照', transactions: '成交记录', valuations: '账户估值' };
const accountFields: [keyof InvestmentAccount, string, string][] = [
  ['cash', '可支配现金', '0.01'], ['emergency', '应急资金预留', '0.01'], ['expense1y', '一年内确定支出', '0.01'],
  ['expense3y', '第二至三年确定支出', '0.01'], ['liabilities', '负债还款预留', '0.01'], ['monthly', '每月新增资金计划', '0.01'],
  ['horizon', '持有期限（月）', '1'], ['lossAmount', '可承担亏损金额', '0.01'], ['maxDrawdown', '历史回撤研究上限（%）', '0.1'],
];
const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : '请求失败';
const dateText = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false });
const payload = (method: string, value: unknown) => ({ method, body: JSON.stringify(value) });
function Source({ product }: { product: InvestmentProduct }) {
  const url = investmentSource(product.sourceUrl);
  const market = product.market;
  const marketUrl = market ? investmentSource(market.sourceUrl) : null;
  return <div className="invest-source">{url ? <a href={url} target="_blank" rel="noopener noreferrer">{product.sourceName}<ArrowUpRight size={12} /></a> : product.sourceName}
    <span>研究资料日 {product.asOf} · 披露 {dateText(product.publishedAt)} · 获取 {dateText(product.fetchedAt)}</span>
    {market && <div className={`invest-market ${market.status}`}><strong>{market.kind === 'realtime' ? '盘中报价' : market.kind === 'close' ? '收盘价' : '披露净值'} {money(market.price)}</strong><span>{market.reason}</span>
      {market.priceDate && <span>行情日 {market.priceDate}{market.sourceTime ? ` · 源时间 ${dateText(market.sourceTime)}` : ' · 非逐笔实时行情'}</span>}
      {market.fetchedAt && <span>取数 {dateText(market.fetchedAt)}</span>}{marketUrl && <a href={marketUrl} target="_blank" rel="noopener noreferrer">行情来源<ArrowUpRight size={12} /></a>}
      {market.navFetchedAt && <span>净值与复权历史获取 {dateText(market.navFetchedAt)}</span>}
      {market.feesFetchedAt && <span>接口费率参考 · 获取 {dateText(market.feesFetchedAt)} · <a href="https://tushare.pro/document/2?doc_id=19" target="_blank" rel="noopener noreferrer">费率来源</a></span>}
      {market.warnings.map(warning => <span key={warning}>{warning}</span>)}</div>}</div>;
}

function ReturnChart({ review }: { review: InvestmentReview }) {
  const rows = review.curve || [];
  if (rows.length < 2) return null;
  const min = Math.min(0, ...rows.map(p => p.strategy));
  const max = Math.max(1, ...rows.map(p => p.strategy));
  const y = (v: number) => 150 - (v - min) / (max - min) * 125;
  return <figure className="invest-chart"><figcaption>剔除外部现金流后的区间收益</figcaption><svg viewBox="0 0 640 190" role="img" aria-label="账户时间加权收益曲线">
    <line x1="45" x2="620" y1={y(0)} y2={y(0)} stroke="#c9d3d0" strokeDasharray="4 4" />
    <text x="0" y="22">{max.toFixed(1)}%</text><text x="0" y="155">{min.toFixed(1)}%</text>
    <polyline points={rows.map((p, i) => `${45 + i / (rows.length - 1) * 570},${y(p.strategy)}`).join(' ')} fill="none" stroke="#297a68" strokeWidth="2.5" />
    {rows.map((p, i) => <circle key={p.date} cx={45 + i / (rows.length - 1) * 570} cy={y(p.strategy)} r="4" fill="#297a68"><title>{p.date}：{percent(p.strategy)}，账户 {money(p.value)}</title></circle>)}
    <text x="45" y="182">{rows[0].date}</text><text x="530" y="182">{rows.at(-1)?.date}</text>
  </svg></figure>;
}

export function InvestmentSpace({ project, onOpenDocument }: { project: Content; onOpenDocument: (id: number) => void }) {
  const [params, setParams] = useSearchParams();
  const demo = params.get('demo') === '1';
  const tab = tabs.some(([key]) => key === params.get('tab')) ? params.get('tab')! : 'overview';
  const [data, setData] = useState<InvestmentState | null>(null);
  const [account, setAccount] = useState<InvestmentAccount | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<InvestmentCategory>('etf');
  const [peer, setPeer] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState<InvestmentComparison | null>(null);
  const [recommendation, setRecommendation] = useState<InvestmentCandidates | null>(null);
  const [review, setReview] = useState<InvestmentReview | null>(null);
  const [amount, setAmount] = useState('10000');
  const [months, setMonths] = useState('36');
  const [importOpen, setImportOpen] = useState(false);
  const [kind, setKind] = useState<Dataset>('products');
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [importText, setImportText] = useState('');
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [pollError, setPollError] = useState('');
  const [pageCheckedAt, setPageCheckedAt] = useState('');
  const path = useCallback((endpoint: string) => `/investment/${endpoint}${endpoint.includes('?') ? '&' : '?'}projectId=${project.id}`, [project.id]);
  const load = useCallback(async () => {
    const value = await api<InvestmentState>(path(`state?demo=${demo}`));
    setData(value); setAccount(value.account);
    return value;
  }, [path, demo]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setNotice(''); setData(null); setComparison(null); setRecommendation(null); setReview(null); setSelected([]); setPeer(''); setImportOpen(false);
    void api<InvestmentState>(path(`state?demo=${demo}`)).then(value => { if (active) { setData(value); setAccount(value.account); } })
      .catch(cause => { if (active) setError(errorMessage(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, demo]);
  useEffect(() => { setSelected([]); setComparison(null); setRecommendation(null); }, [category, peer]);
  const navigateTab = (value: string) => { const next = new URLSearchParams(params); next.set('tab', value); setParams(next); };
  const run = async (action: () => Promise<void>) => { setBusy(true); setError(''); setNotice(''); try { await action(); } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); } };
  const saveAccount = (event: FormEvent) => { event.preventDefault(); if (!account || demo) return; void run(async () => {
    await api(path('account'), payload('PUT', { ...account, updatedOn: new Date().toLocaleDateString('en-CA') }));
    await load(); setRecommendation(null); setNotice('资金计划已保存。');
  }); };
  const saveImport = (event: FormEvent) => { event.preventDefault(); if (demo) return; void run(async () => {
    const result = await api<{ count: number }>(path('import'), payload('POST', { kind, format, data: importText }));
    await load(); setComparison(null); setRecommendation(null); setReview(null); setNotice(`已保存 ${result.count} 条记录；同键更新。`);
  }); };
  const edit = (dataset: Dataset, item: unknown) => { const cleaned = { ...(item as Record<string, unknown>) }; if (dataset === 'products') delete cleaned.market;
    setKind(dataset); setFormat('json'); setImportText(JSON.stringify([cleaned], null, 2)); setImportOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const remove = (dataset: Dataset, key: string) => { if (demo || !window.confirm('删除这条本人记录？')) return; void run(async () => {
    await api(path(`${dataset}/${encodeURIComponent(key)}`), payload('DELETE', {})); await load(); setReview(null); setRecommendation(null); setComparison(null); setNotice('已删除记录。');
  }); };
  const copy = async (product: InvestmentProduct) => { if (demo) return; try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(product.code);
    else { const field = document.createElement('textarea'); field.value = product.code; field.style.position = 'fixed'; field.style.opacity = '0'; document.body.append(field); field.select(); const ok = document.execCommand('copy'); field.remove(); if (!ok) throw new Error('请手动选择产品代码复制'); }
    setCopied(product.code); setNotice(`已复制代码 ${product.code}`);
  } catch (cause) { setError(errorMessage(cause)); } };
  const products = data?.products || [];
  const peers = [...new Set(products.filter(p => p.category === category).map(p => p.peer))];
  const activePeer = peer || peers[0] || '';
  const hasData = Boolean(data);
  const hasComparison = Boolean(comparison);
  useEffect(() => {
    if (!autoRefresh || demo || !hasData || busy || importOpen) return;
    let active = true;
    const controller = new AbortController();
    let polling = false;
    const refresh = async () => {
      if (polling || document.visibilityState === 'hidden') return;
      polling = true;
      try {
        const value = await api<InvestmentState>(path('state?demo=false'), { signal: controller.signal });
        let nextCandidates: InvestmentCandidates | null = null;
        let nextComparison: InvestmentComparison | null = null;
        let nextReview: InvestmentReview | null = null;
        if (tab === 'candidates' && activePeer) nextCandidates = await api(path(`candidates?category=${category}&peer=${encodeURIComponent(activePeer)}&demo=false`), { signal: controller.signal });
        if (tab === 'compare' && hasComparison && selected.length) nextComparison = await api(path('compare'), { ...payload('POST', { codes: selected, amount: Number(amount), months: Number(months), demo: false }), signal: controller.signal });
        if (tab === 'review') nextReview = await api(path('review?demo=false'), { signal: controller.signal });
        if (!active) return;
        setData(value); // Preserve an account form that the user is still editing.
        if (tab === 'candidates') setRecommendation(nextCandidates);
        if (tab === 'compare' && hasComparison) setComparison(nextComparison);
        if (tab === 'review') setReview(nextReview);
        setPollError(''); setPageCheckedAt(new Date().toISOString());
      } catch (cause) {
        if (active) { setPollError(errorMessage(cause)); setRecommendation(null); setComparison(null); setReview(null); }
      } finally { polling = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [autoRefresh, demo, hasData, busy, importOpen, path, tab, category, activePeer, hasComparison, selected, amount, months]);
  const visible = products.filter(p => p.category === category && p.peer === activePeer && `${p.name} ${p.code}`.toLowerCase().includes(query.toLowerCase()));
  const docs = flatten(project.children || []).filter(p => p.type === 'text');
  const records = data ? data[kind] : [];
  const setGroup = (value: InvestmentCategory) => { setCategory(value); setPeer(''); };
  const filter = <div className="invest-controls"><label>产品类别<select disabled={busy} value={category} onChange={e => setGroup(e.target.value as InvestmentCategory)}>{investmentCategories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label>同类组 / 跟踪指数<select disabled={busy} value={activePeer} onChange={e => setPeer(e.target.value)}>{!peers.length && <option value="">暂无档案</option>}{peers.map(value => <option key={value}>{value}</option>)}</select></label>
    <label>代码 / 名称<input value={query} onChange={e => setQuery(e.target.value)} placeholder="筛选当前同类组" /></label></div>;
  const tools = (dataset: Dataset, item: Record<string, unknown>, key: string) => !demo && <div className="invest-row-tools"><button title="编辑记录" className="icon-button" onClick={() => edit(dataset, item)}><Pencil size={15} /></button><button title="删除记录" className="icon-button" onClick={() => remove(dataset, key)}><Trash2 size={15} /></button></div>;
  return <section className="investment-space">
    <header className="invest-header"><div><Link to="/home" className="invest-back"><ArrowLeft size={15} />生活场景</Link><h1>基础生活 | 钱 | 投资理财</h1><p>账户、研究、执行与复盘</p></div>
      <div className="invest-header-actions"><label className="invest-mode">账户模式<select disabled={busy} value={demo ? 'demo' : 'real'} onChange={e => { const next = new URLSearchParams(params); next.set('demo', e.target.value === 'demo' ? '1' : '0'); setParams(next); }}><option value="real">本人真实账户</option><option value="demo">合成演示 · 独立查看</option></select></label>
        <button className="icon-button" title="请求更新行情" disabled={busy || loading} onClick={() => void run(async () => {
          if (!demo) await api(path('refresh'), payload('POST', {}));
          await load(); setComparison(null); setRecommendation(null); setReview(null); setNotice(demo ? '演示数据已刷新。' : '已请求后台更新；行情按数据源授权与披露周期同步。');
        })}><RefreshCw size={17} /></button>
        <button className="button secondary" onClick={() => setImportOpen(!importOpen)} aria-expanded={importOpen}><Upload size={16} />资料与导入</button></div></header>
    {demo && <div className="invest-banner">当前为合成演示，无真实账户或可购买产品；退出演示后恢复本人数据。</div>}
    {error && <div role="alert" className="invest-error">{error}<button className="button secondary" onClick={() => void run(async () => { await load(); setLoading(false); })}>重试</button></div>}
    {notice && <p role="status" className="invest-notice">{notice}</p>}
    {loading && <p className="invest-empty"><LoaderCircle size={18} />正在读取本人账户…</p>}
    {importOpen && <section className="invest-import"><div className="invest-section-title"><h2>资料与数据管理</h2><span>人民币 · 同键更新 · 不自动下单</span></div>
      <div className="invest-docs">{docs.map(doc => <button key={doc.id} onClick={() => onOpenDocument(doc.id)}><FileText size={15} />{doc.title}</button>)}</div>
      <form onSubmit={saveImport}><div className="invest-controls"><label>导入数据<select value={kind} onChange={e => { setKind(e.target.value as Dataset); setImportText(''); }}>{Object.entries(datasetNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>格式<select value={format} onChange={e => setFormat(e.target.value as 'json' | 'csv')}><option value="json">JSON</option><option value="csv">CSV</option></select></label><label>选择文件<input type="file" accept=".json,.csv" disabled={demo} onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 200000) setError('文件超过200KB'); else { setFormat(file.name.endsWith('.csv') ? 'csv' : 'json'); setImportText(await file.text()); } }} /></label></div>
        <label className="invest-text-label">可编辑导入内容<textarea required maxLength={200000} rows={9} value={importText} onChange={e => setImportText(e.target.value)} placeholder="粘贴本人已核实数据，或打开字段模板后替换" /></label>
        <div className="invest-actions"><button type="button" className="button secondary" onClick={() => { setFormat('json'); setImportText(JSON.stringify(importExample(kind), null, 2)); }}><Plus size={15} />字段模板</button><button className="button" disabled={demo || busy || !importText}><Upload size={15} />校验并保存</button></div>
        <p className="invest-note">空值保持未知；同批重复键拒绝。产品代码、成交key或估值日期相同会更新原记录。模板为格式示例，保存前替换；成交不会自动改写持仓和现金。</p>
      </form>
      {records.length > 0 && <div className="invest-table-wrap"><table><thead><tr><th>{datasetNames[kind]}</th><th>详情</th><th>操作</th></tr></thead><tbody>{records.map((record, i) => { const item = record as unknown as Record<string, unknown>; const key = String(item.key || item.code || item.date); return <tr key={key || i}><td>{String(item.name || item.code || item.date)}</td><td><code>{JSON.stringify(item).slice(0, 240)}</code></td><td>{tools(kind, item, key)}</td></tr>; })}</tbody></table></div>}
      <details><summary>数据接入状态</summary>{data?.providers.map(provider => <p key={provider.name}>{provider.name}：{provider.status}</p>)}</details>
    </section>}
    <nav className="invest-tabs" aria-label="投资工作台视图">{tabs.map(([key, label, Icon]) => <button key={key} onClick={() => navigateTab(key)} aria-current={tab === key ? 'page' : undefined}><Icon size={16} />{label}</button>)}</nav>
    {data?.sync && !demo && <section className="invest-sync" aria-label="自动更新状态"><div><strong>{data.sync.serviceError || (!data.sync.enabled ? '自动取数已暂停' : !data.sync.configured ? '行情等待数据授权' : data.sync.realtimeEnabled ? 'ETF盘中同步已启用' : '行情定时同步已启用')}</strong>
      <span>行情检查间隔 {data.sync.realtimeEnabled ? '盘中60秒；其他' : ''}{Math.round(data.sync.intervalSeconds / 60)}分钟 · 净值按披露更新</span>
      <small>{data.sync.lastCycleAt ? `后台检查 ${dateText(data.sync.lastCycleAt)}` : '等待后台首次检查'}{pageCheckedAt ? ` · 页面同步 ${dateText(pageCheckedAt)}` : ''}</small></div>
      <label><input type="checkbox" checked={autoRefresh} onChange={event => setAutoRefresh(event.target.checked)} />自动刷新 · 60秒</label>
      {pollError && <p role="alert">页面同步失败：{pollError}。已暂停展示旧候选与收益结果。</p>}
      <small>{data.sync.accountSync}</small></section>}
    {data && <>
      {tab === 'overview' && <>
        <div className="invest-metrics"><div><span>净资产参考</span><strong>{money(data.summary.netAssets)}</strong><small>现金＋持仓−负债预留</small></div><div><span>现金 / 已投资</span><strong>{money(data.summary.cash)}</strong><small>持仓 {money(data.summary.invested)}</small></div><div><span>应急与支出等预留</span><strong>{money(data.summary.reserved)}</strong><small>确定用钱优先保护</small></div><div><span>新增投资可用现金</span><strong>{money(data.summary.available)}</strong><small>未计每月未来新增资金</small></div></div>
        <div className="invest-status"><h2>{data.summary.ready ? '资金计划可进入研究，今天也可以无需操作' : '先完善资金计划，今天无需操作'}</h2>{data.summary.warnings.map(value => <p key={value}>{value}</p>)}</div>
        <form className="invest-section" onSubmit={saveAccount}><div className="invest-section-title"><h2>资金用途与承受能力</h2><small>记录日期 {data.account.updatedOn}</small></div><div className="invest-account-grid">{accountFields.map(([key, label, step]) => <label key={key}>{label}<input disabled={demo} required type="number" step={step} min={key === 'horizon' ? 1 : key === 'maxDrawdown' ? .1 : 0} max={key === 'horizon' ? 600 : key === 'maxDrawdown' ? 100 : 1e12} value={String(account?.[key] ?? '')} onChange={e => setAccount(previous => previous ? { ...previous, [key]: Number(e.target.value) } : previous)} /></label>)}<label>风险等级<select disabled={demo} value={account?.riskLevel} onChange={e => setAccount(previous => previous ? { ...previous, riskLevel: Number(e.target.value) } : previous)}>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} / 5</option>)}</select></label></div><p className="invest-note">第二至三年支出不重复包含一年内支出。风险等级需依据本人适当性评估；亏损与回撤约束不保证未来损失上限。</p><button className="button" disabled={demo || busy}><Check size={16} />保存资金计划</button></form>
        <section className="invest-section"><div className="invest-section-title"><h2>持仓与组合</h2><button className="button secondary" disabled={demo} onClick={() => { setKind('positions'); setImportOpen(true); }}><Upload size={15} />导入持仓</button></div>
          {!data.positions.length ? <p className="invest-empty">暂无本人持仓。导入后按份额与价格核对账户；演示不会写入真实账本。</p> : <div className="invest-table-wrap"><table><thead><tr><th>产品</th><th>类别</th><th>份额</th><th>价格</th><th>市值</th><th>持仓成本</th><th>浮动差额</th><th>估值日</th><th>操作</th></tr></thead><tbody>{data.positions.map(item => <tr key={item.code}><td>{item.name}<small>{item.code}</small></td><td>{categoryName(item.category)}</td><td>{item.units}</td><td>{money(item.price)}</td><td>{money(Number(item.units) * Number(item.price))}</td><td>{money(item.cost)}</td><td>{money(Number(item.units) * Number(item.price) - Number(item.cost))}</td><td>{item.asOf}</td><td>{tools('positions', item as unknown as Record<string, unknown>, item.code)}</td></tr>)}</tbody></table></div>}
          <div className="invest-exposures">{Object.entries(data.summary.exposures).map(([label, value]) => <div key={label}><span>{label}</span><progress max={Math.max(1, data.summary.invested)} value={value} /><strong>{money(value)}</strong></div>)}</div><p className="invest-note">现有持仓压力损失参考 {money(data.summary.existingStress)} · 剩余亏损预算 {money(data.summary.remainingLossBudget)}。未建产品档案的持仓按100%损失保守预留。浮动差额不含已经实现的交易损益与分红。穿透按已导入资料计算，未披露部分保持未知。</p>
        </section></>}
      {tab === 'compare' && <section className="invest-section">{filter}<div className="invest-controls"><label>假设金额（元）<input type="number" min="1" max="1000000000000" value={amount} onChange={e => setAmount(e.target.value)} /></label><label>持有月数<input type="number" min="1" max="600" value={months} onChange={e => setMonths(e.target.value)} /></label><button className="button" disabled={busy || !selected.length || Number(amount) <= 0 || Number(months) < 1} onClick={() => void run(async () => setComparison(await api(path('compare'), payload('POST', { codes: selected, amount: Number(amount), months: Number(months), demo }))))}><Scale size={16} />比较已选 {selected.length} 项</button></div>
        {!visible.length ? <p className="invest-empty">暂无本组产品。导入产品档案，或切换合成演示。</p> : <div className="invest-table-wrap"><table><thead><tr><th>选择</th><th>产品 / 份额</th><th>历史收益 / 区间</th><th>历史回撤</th><th>管理 / 托管 / 销售服务费</th><th>申购 / 赎回费</th><th>跟踪误差 / 折溢价</th><th>风险 / 最短期限</th><th>来源</th></tr></thead><tbody>{visible.map(product => <tr key={product.code}><td><input aria-label={`比较 ${product.code}`} type="checkbox" checked={selected.includes(product.code)} onChange={e => setSelected(old => e.target.checked ? [...old, product.code] : old.filter(code => code !== product.code))} /></td><td>{product.name}<small>{product.code} · {product.shareClass}</small></td><td>{percent(product.annualReturn)}<small>{product.returnPeriod}</small></td><td>{percent(product.drawdown)}</td><td>{percent(product.managementFee)} / {percent(product.custodyFee)} / {percent(product.salesFee)}</td><td>{percent(product.subscriptionFee)} / {percent(product.redemptionFee)}</td><td>{percent(product.trackingError)} / {percent(product.premium)}</td><td>{product.riskLevel}/5 · {product.minMonths}个月</td><td><Source product={product} /></td></tr>)}</tbody></table></div>}
        {comparison && <div className="invest-comparison"><h2>同类费用与资料复核</h2><p>{comparison.costBasis}</p><div className="invest-table-wrap"><table><thead><tr><th>产品</th><th>假设持有成本</th><th>资料待复核</th><th>流动性与限制</th></tr></thead><tbody>{comparison.rows.map(row => <tr key={row.product.code}><td>{row.product.name}</td><td>{money(row.illustrativeCost)}</td><td>{row.issues.join('；') || '所需字段齐全（未独立核实真实性）'}</td><td>{row.product.liquidity}<br />{row.product.restrictions}</td></tr>)}</tbody></table></div></div>}
      </section>}
      {tab === 'candidates' && <section className="invest-section">{filter}<button className="button" disabled={busy || !activePeer} onClick={() => void run(async () => setRecommendation(await api(path(`candidates?demo=${demo}&category=${category}&peer=${encodeURIComponent(activePeer)}`))))}><FileText size={16} />检查候选与组合</button>
        <p className="invest-note">只比较当前同类组，最多3项。规则匹配分不代表上涨概率；缺数据或资金不适合时不凑推荐。</p>{recommendation && <><p role="status">{recommendation.message}</p><div className="invest-candidates">{recommendation.candidates.map((item, index) => <article key={item.product.code}><div className="invest-rank"><span>研究候选 {index + 1}</span><strong>{item.score} / 100</strong></div><h2>{item.product.name}</h2><small>{item.product.code} · {item.product.peer}</small><ul>{item.reasons.map(value => <li key={value}>{value}</li>)}</ul><dl><dt>收益逻辑</dt><dd>{item.logic}</dd><dt>主要风险</dt><dd>{item.risks}</dd><dt>组合影响</dt><dd>{item.overlap.join('；')}</dd><dt>执行条件</dt><dd>{item.product.liquidity}；{item.product.restrictions}</dd><dt>重新评估</dt><dd>{item.reassess}</dd><dt>压力情景与研究上界</dt><dd>{item.stressPercent}% 价格下跌情景 · {money(item.researchCeiling)}<small>{item.sizingNote}</small></dd></dl><Source product={item.product} /><button className="button secondary" onClick={() => navigateTab('channels')}><Landmark size={15} />查看官方入口</button></article>)}</div><details><summary>未入选资料（{recommendation.excluded.length}）</summary>{recommendation.excluded.map(item => <p key={item.code}><strong>{item.name}</strong>：{item.reasons.join('；')}</p>)}</details></>}
      </section>}
      {tab === 'channels' && <section className="invest-section"><h2>购买前核对，再由本人确认</h2><p className="invest-note">入口为官方网站，未核验实时费率、可售状态或购买资格。研究入口不是下单页；本系统不保存证券账号与支付信息。</p>
        <div className="invest-channels">{investmentChannels.map(channel => {
          const state = data.sync?.channels.find(item => item.name === channel.name);
          const status = ({ reachable: '官网可达', needs_check: '需在平台核实', unavailable: '暂时无法访问', stale: '检查已过期', pending: '等待检查' } as Record<string, string>)[state?.status || 'pending'] || '待核实';
          return <article key={channel.name}><span>{channel.type}</span><h3>{channel.name}</h3><p>{channel.note}</p>
            {!demo && <p className="invest-channel-state">{status}<small>{state?.checkedAt ? `检查 ${dateText(state.checkedAt)}` : '后台每6小时检查官网可达性'} · 不代表产品可购或费率已核实</small></p>}
            <a href={channel.url} target="_blank" rel="noopener noreferrer">打开官方入口<ArrowUpRight size={15} /></a></article>;
        })}</div>
        <h2>研究清单与代码</h2>{!products.length && <p className="invest-empty">暂无产品档案。</p>}<div className="invest-table-wrap"><table><thead><tr><th>产品</th><th>市场类别 / 份额</th><th>费用与限制</th><th>代码</th><th>资料</th></tr></thead><tbody>{products.map(product => <tr key={product.code}><td>{product.name}</td><td>{categoryName(product.category)} / {product.shareClass}</td><td>申购 {percent(product.subscriptionFee)} · 赎回 {percent(product.redemptionFee)}<small>{product.restrictions || '交易限制未核实'}</small></td><td><code>{product.code}</code><button className="icon-button" title={demo ? '演示代码不可用于交易' : '复制产品代码'} disabled={demo} onClick={() => void copy(product)}>{copied === product.code ? <Check size={15} /> : <Clipboard size={15} />}</button></td><td><Source product={product} /></td></tr>)}</tbody></table></div>
      </section>}
      {tab === 'review' && <section className="invest-section"><div className="invest-section-title"><h2>真实收益与决策复盘</h2><div className="invest-actions"><button className="button secondary" disabled={demo} onClick={() => { setKind('valuations'); setImportOpen(true); }}><Upload size={15} />录入估值</button><button className="button" disabled={busy} onClick={() => void run(async () => setReview(await api(path(`review?demo=${demo}`))))}><TrendingUp size={16} />计算收益</button></div></div>
        <p className="invest-note">完整账户价值含现金和持仓，已扣实际费用。flow为日终外部净流入；内部买卖不计入，首日填0。每个资金流日都需估值。基准缺失显示待补，不生成回测盈利。</p>
        {!demo && data.liveValuation && <div className="invest-live"><div><span>行情参考估值</span><strong>{money(data.liveValuation.value)}</strong><small>{data.liveValuation.message}</small></div><p>真实账本已对账至 {review?.reconciledThrough || [...data.valuations].map(item => item.date).sort().at(-1) || '尚未录入'}。{data.liveValuation.missingCodes.length > 0 && `缺少有效行情：${data.liveValuation.missingCodes.join('、')}。`}</p></div>}
        {review && <><p role="status">{review.message}</p>{review.ready && <><div className="invest-metrics"><div><span>投资盈亏</span><strong>{money(review.profit)}</strong><small>外部净流入 {money(review.netFlow)}</small></div><div><span>TWR · 区间收益</span><strong>{percent(review.twr)}</strong></div><div><span>XIRR · 年化</span><strong>{percent(review.xirr)}</strong><small>多解/无解时不显示</small></div><div><span>观察点最大回撤</span><strong>{percent(review.maxDrawdown)}</strong><small>可能低估日内及未录日期的回撤</small></div></div><ReturnChart review={review} /><div className="invest-benchmarks"><p>固定股债组合 TWR：<strong>{percent(review.benchmarks?.fixedBenchmark)}</strong></p><p>简单定投 / 再平衡 TWR：<strong>{percent(review.benchmarks?.simpleBenchmark)}</strong></p></div></>}</>}
        <details open><summary>账户估值（{data.valuations.length}）</summary><div className="invest-table-wrap"><table><thead><tr><th>日期</th><th>账户总值</th><th>外部净流入</th><th>固定股债基准</th><th>简单策略基准</th><th>操作</th></tr></thead><tbody>{[...data.valuations].sort((a, b) => a.date.localeCompare(b.date)).map(item => <tr key={item.date}><td>{item.date}</td><td>{money(item.value)}</td><td>{money(item.flow)}</td><td>{money(item.fixedBenchmark)}</td><td>{money(item.simpleBenchmark)}</td><td>{tools('valuations', item as unknown as Record<string, unknown>, item.date)}</td></tr>)}</tbody></table></div></details>
        <details><summary>成交与复盘备注（{data.transactions.length}）</summary><div className="invest-actions"><button className="button secondary" disabled={demo} onClick={() => { setKind('transactions'); setImportOpen(true); }}><Plus size={15} />记录成交</button></div><div className="invest-table-wrap"><table><thead><tr><th>日期 / 代码</th><th>类型</th><th>成交金额</th><th>费用</th><th>复盘备注</th><th>操作</th></tr></thead><tbody>{data.transactions.map(item => <tr key={item.key}><td>{item.date}<small>{item.code}</small></td><td>{{ buy: '买入', sell: '卖出', deposit: '追加', withdrawal: '提取', dividend: '分红', fee: '费用' }[item.kind] || item.kind}</td><td>{money(item.amount)}</td><td>{money(item.fee)}</td><td>{item.note}</td><td>{tools('transactions', item as unknown as Record<string, unknown>, item.key)}</td></tr>)}</tbody></table></div></details>
      </section>}
    </>}
    <footer className="invest-footer"><FolderOpen size={15} />行情按授权自动同步，份额与现金由本人对账；候选只供研究，盈利能力需由同口径长期复盘检验。</footer>
  </section>;
}
