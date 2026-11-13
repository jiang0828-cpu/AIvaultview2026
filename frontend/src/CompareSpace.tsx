import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ChevronRight, FileText, History, LoaderCircle, Pencil, Search, Star, Trash2, Upload } from 'lucide-react';
import { api } from './api';
import { ContentBody } from './components';
import { flatten, type Content } from './types';
import {
  nullLabel, offerDestination, packLabel, platformProductUrl, platformSearchUrl, priceLabel,
  providerStatuses, sortOffers, unitPriceLabel, type CompareOffer,
  type CompareRunSummary, type CompareSearchResponse, type CompareSort, type ProviderStatus,
} from './compareModel';
import './compare.css';

const platforms = [['jd', '京东'], ['ebay', 'eBay'], ['goofish', '闲鱼'], ['douyin', '抖音'], ['pinduoduo', '拼多多']] as const;
const categories = [['standard', '手机 / 电脑 / 家电'], ['food', '食品'], ['drink', '饮料 / 乳品'], ['household', '日化 / 家庭用品']] as const;
const platformName = (key: string) => platforms.find(([id]) => id === key)?.[1] || key;
const conditionName = (key: string) => ({ new: '全新', used: '二手', refurbished: '翻新', unknown: '未知' }[key] || key);
const messageOf = (error: unknown) => error instanceof Error ? error.message : '请求失败';
const dateLabel = (value: string) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未知';
const score = (value: number | null | undefined) => value == null ? '未知' : Math.round(value);
const numberOrNull = (value: string) => value.trim() === '' ? null : Number(value);
const jsonRequest = (method: string, body?: unknown) => ({ method, ...(body === undefined ? (method === 'DELETE' ? { body: '{}' } : {}) : { body: JSON.stringify(body) }) });

const blankForm = {
  query: 'iPhone 16', brand: 'Apple', model: 'iPhone 16', category: 'standard',
  storage: '256GB', memory: '', color: '', region: '', warranty: '', bundle: '', accessories: '', variant: '',
  packCount: '', netWeight: '', unit: 'g', condition: 'new', budget: '5000', currency: 'CNY', city: '南京',
  targetDate: '', required: '', acceptable: '', preference: 'balanced', mode: 'demo', demoScenario: 'phone',
  platforms: platforms.map(([id]) => id) as string[],
};
type SearchForm = typeof blankForm;
const blankManual = {
  platform: 'jd', title: '', url: '', brand: '', model: '', category: 'standard', storage: '', memory: '', variant: '',
  packCount: '', netWeight: '', unit: 'g', expiresOn: '', condition: 'new', currency: 'CNY', itemPrice: '',
  shippingFee: '', taxFee: '', serviceFee: '', couponDiscount: '', subsidy: '', positiveRate: '', reviewCount: '',
  likes: '', shares: '', salesCount: '', deliveryDays: '', returnPolicy: '', sellerName: '', source: '用户手工核录', sourceFetchedAt: '',
};
type ImportRow = { id: number | string; offer: CompareOffer };
type Favorite = { id: number | string; offer: CompareOffer; note: string; createdAt: string };
const manualLabels: Record<string, string> = {
  title: '商品标题', url: '原平台商品链接', brand: '品牌', model: '型号 / 产品系列', storage: '容量 / 硬盘', memory: '内存',
  variant: '口味 / 配方 / 浓度', packCount: '包装数量', netWeight: '每包 / 瓶净含量', expiresOn: '保质期截止日期',
  itemPrice: '商品价', shippingFee: '运费', taxFee: '税费', serviceFee: '服务费', couponDiscount: '已确认优惠券',
  subsidy: '已确认补贴', positiveRate: '好评率（%）', reviewCount: '评价数', likes: '点赞', shares: '转发',
  salesCount: '销量', deliveryDays: '配送天数', returnPolicy: '售后政策', sellerName: '卖家', source: '报价来源 / 复核说明',
  sourceFetchedAt: '报价复核时间（留空为本次核录）',
};
const numericManual = new Set(['packCount', 'netWeight', 'itemPrice', 'shippingFee', 'taxFee', 'serviceFee', 'couponDiscount', 'subsidy', 'positiveRate', 'reviewCount', 'likes', 'shares', 'salesCount', 'deliveryDays']);
function rowsOf<T>(value: T[] | Record<string, unknown>, key: string): T[] {
  return Array.isArray(value) ? value : Array.isArray(value[key]) ? value[key] as T[] : [];
}

function ProductLink({ offer, compact = false }: { offer: CompareOffer; compact?: boolean }) {
  const destination = offerDestination(offer);
  if (!destination) return <span className="muted">暂无平台链接</span>;
  return <a className={compact ? 'compare-product-link' : 'button secondary'} href={destination.href} target="_blank" rel="noopener noreferrer"
    title={destination.isSearch ? '在平台搜索此商品；搜索结果与演示报价无关联' : '打开原平台商品页面，购买前复核价格与库存'}>
    <ArrowUpRight size={compact ? 15 : 16} />{destination.label}
  </a>;
}

function OfferCard({ offer, rank, baselinePrice, onFavorite }: { offer: CompareOffer; rank: number; baselinePrice: number | null; onFavorite: (offer: CompareOffer) => void }) {
  const daily = offer.category && offer.category !== 'standard';
  return <article className={`compare-offer rank-${rank}`}>
    <div className="compare-offer-top"><span>推荐 {rank} · {platformName(offer.platform)}</span><span>{offer.matchLevel === 'exact' ? '完全匹配' : '参考报价'}</span></div>
    <h3>{offer.title}</h3>
    <div className="compare-price">{priceLabel(offer)}</div>
    {baselinePrice != null && offer.landedPrice != null && <small>与本次同款最低价差额：{new Intl.NumberFormat('zh-CN', { style: 'currency', currency: offer.currency }).format(Math.max(0, offer.landedPrice - baselinePrice))}</small>}
    {daily && <p className="compare-unit-price"><strong>{unitPriceLabel(offer)}</strong><small>{packLabel(offer)}</small></p>}
    {daily && <p className="muted"><small>保质期截止：{offer.expiresOn || '未提供，请核对标签'}</small></p>}
    <small>{offer.priceStatus === 'confirmed' ? '到手价已录入确认' : '费用或优惠待复核'} · {conditionName(offer.condition)}</small>
    <div className="compare-meta">
      <span>性价比推荐分<strong>{score(offer.scores.total)}</strong></span><span>质量口碑<strong>{score(offer.scores.quality)}</strong></span>
      <span>价格竞争力<strong>{score(offer.scores.price)}</strong></span><span>数据完整度<strong>{score(offer.scores.completeness)}</strong></span>
    </div>
    {!!offer.reasons.length && <ul className="compare-reasons">{offer.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>}
    {!!offer.risks.length && <ul className="compare-reasons compare-risks">{offer.risks.map((risk, index) => <li key={index}>{risk}</li>)}</ul>}
    <p className="muted"><small>{offer.source} · {dateLabel(offer.sourceFetchedAt)}</small></p>
    <div className="compare-actions"><button className="button secondary" onClick={() => onFavorite(offer)}><Star size={15} />收藏</button><ProductLink offer={offer} /></div>
  </article>;
}

export function CompareSpace({ project, workbench, onOpenDocument }: { project: Content; workbench: boolean; onOpenDocument: (id: number) => void }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState<SearchForm>({ ...blankForm });
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [result, setResult] = useState<CompareSearchResponse | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [history, setHistory] = useState<CompareRunSummary[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [tab, setTab] = useState<'search' | 'import' | 'history' | 'favorites'>('search');
  const [sort, setSort] = useState<CompareSort>('score');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterCurrency, setFilterCurrency] = useState('CNY');
  const [filterUnit, setFilterUnit] = useState('all');
  const [exactOnly, setExactOnly] = useState(true);
  const [importFormat, setImportFormat] = useState<'manual' | 'csv' | 'json'>('manual');
  const [importText, setImportText] = useState('');
  const [editingImport, setEditingImport] = useState<number | string | null>(null);
  const [manual, setManual] = useState({ ...blankManual });
  const path = useCallback((suffix: string) => `/compare${suffix}${suffix.includes('?') ? '&' : '?'}projectId=${project.id}`, [project.id]);
  const loadLists = useCallback(async () => {
    const [providerData, runData, favoriteData, importData] = await Promise.all([
      api<ProviderStatus[] | Record<string, unknown>>(path('/providers')),
      api<CompareRunSummary[] | Record<string, unknown>>(path('/runs')),
      api<Favorite[] | Record<string, unknown>>(path('/favorites')),
      api<ImportRow[] | Record<string, unknown>>(path('/imports')),
    ]);
    setProviders(rowsOf(providerData, 'providers')); setHistory(rowsOf(runData, 'runs'));
    setFavorites(rowsOf(favoriteData, 'favorites')); setImports(rowsOf(importData, 'imports'));
  }, [path]);
  useEffect(() => {
    if (!workbench) return;
    let active = true;
    void loadLists().catch(cause => { if (active) setError(messageOf(cause)); });
    return () => { active = false; };
  }, [workbench, loadLists]);
  const runId = params.get('run');
  useEffect(() => {
    if (!workbench || !runId) return;
    let active = true; setBusy(true); setError('');
    void api<CompareSearchResponse>(path(`/runs/${encodeURIComponent(runId)}`)).then(value => {
      if (!active) return;
      setResult({ ...value, summary: value.summary || { matchedCount: value.offers.length, exactMatchCount: value.offers.filter(offer => offer.matchLevel === 'exact').length } });
      setFilterCurrency(String(value.request.currency || 'CNY'));
      const request = value.request;
      const savedSpecs = request.specs && typeof request.specs === 'object' ? request.specs as Record<string, unknown> : {};
      const strings = (input: unknown) => Array.isArray(input) ? input.map(String).join('，') : '';
      setForm({ ...blankForm,
        query: String(request.query || ''), brand: String(request.brand || ''), model: String(request.model || ''),
        category: String(request.category || 'standard'), condition: String(request.condition || 'new'),
        ...Object.fromEntries(['storage', 'memory', 'color', 'region', 'warranty', 'bundle', 'accessories', 'variant'].map(key => [key, String(savedSpecs[key] || '')])),
        packCount: request.packCount == null ? '' : String(request.packCount), netWeight: request.netWeight == null ? '' : String(request.netWeight),
        unit: String(request.unit || 'g'), budget: request.budgetMax == null ? '' : String(request.budgetMax), currency: String(request.currency || 'CNY'),
        city: String(request.city || ''), targetDate: String(request.targetDate || ''), required: strings(request.requiredConditions), acceptable: strings(request.acceptableConditions),
        preference: String(request.preference || 'balanced'), mode: String(request.mode || 'demo'), demoScenario: String(request.demoScenario || 'phone'),
        platforms: Array.isArray(request.platforms) ? request.platforms.map(String) : [...blankForm.platforms],
      });
      setConfirmed(false);
    }).catch(cause => { if (active) setError(messageOf(cause)); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [runId, workbench, path]);

  const updateForm = (key: keyof SearchForm, value: string | string[]) => { setForm(previous => ({ ...previous, [key]: value })); setConfirmed(false); };
  const chooseScenario = (scenario: string) => {
    const defaults: Record<string, Partial<SearchForm>> = {
      phone: { query: 'iPhone 16', brand: 'Apple', model: 'iPhone 16', storage: '256GB', budget: '5000' },
      mixed: { query: 'iPhone 16', brand: 'Apple', model: 'iPhone 16', storage: '256GB', budget: '5000' },
      laptop: { query: 'ThinkBook 14 G7', brand: 'Lenovo', model: 'ThinkBook 14 G7', memory: '16GB', storage: '1TB', budget: '6000' },
      food: { category: 'food', query: '原味燕麦片', brand: '示例粮坊', model: '原味燕麦片', packCount: '2', netWeight: '500', unit: 'g', variant: '原味', budget: '100' },
      drink: { category: 'drink', query: '全脂纯牛奶', brand: '示例牧场', model: '全脂纯牛奶', packCount: '12', netWeight: '250', unit: 'ml', variant: '全脂', budget: '100' },
      household: { category: 'household', query: '无香洗衣液', brand: '示例净护', model: '无香洗衣液', packCount: '2', netWeight: '2', unit: 'l', variant: '无香标准浓度', budget: '100' },
    };
    setForm(previous => ({ ...blankForm, platforms: previous.platforms, demoScenario: scenario, storage: '', ...defaults[scenario] }));
    setConfirmed(false);
  };
  const search = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setNotice('');
    if (!form.platforms.length) { setError('请至少选择一个平台'); return; }
    if (form.category !== 'standard' && (!form.packCount || !form.netWeight)) { setError('日常消费品请填写包装数量和每包 / 瓶净含量'); return; }
    if (!confirmed) { setConfirmed(true); return; }
    setBusy(true);
    try {
      const keys = form.category === 'standard' ? ['storage', 'memory', 'color', 'region', 'warranty', 'bundle', 'accessories'] : ['variant'];
      const specs = Object.fromEntries(keys.filter(key => form[key as keyof SearchForm]).map(key => [key, form[key as keyof SearchForm]]));
      const value = await api<CompareSearchResponse>(path('/search'), jsonRequest('POST', {
        query: form.query, brand: form.brand || undefined, model: form.model || undefined, specs, category: form.category,
        ...(form.category !== 'standard' ? { packCount: Number(form.packCount), netWeight: Number(form.netWeight), unit: form.unit } : {}),
        condition: form.condition, budgetMax: numberOrNull(form.budget), currency: form.currency, platforms: form.platforms,
        city: form.city, targetDate: form.targetDate || null, requiredConditions: form.required.split(/[,，\n]/).map(value => value.trim()).filter(Boolean),
        acceptableConditions: form.acceptable.split(/[,，\n]/).map(value => value.trim()).filter(Boolean), preference: form.preference, mode: form.mode, demoScenario: form.demoScenario,
      }));
      setResult(value); setFilterCurrency(form.currency); setFilterPlatform('all'); setFilterUnit('all');
      const next = new URLSearchParams(params); next.set('run', value.runId); setParams(next, { replace: true }); await loadLists();
    } catch (cause) { setError(messageOf(cause)); } finally { setBusy(false); }
  };
  const favorite = async (offer: CompareOffer) => {
    setError(''); try { await api(path('/favorites'), jsonRequest('POST', { offerId: String(offer.id), note: '' })); await loadLists(); setNotice('已加入收藏'); }
    catch (cause) { setError(messageOf(cause)); }
  };
  const removeFavorite = async (id: string | number) => {
    try { await api(path(`/favorites/${id}`), jsonRequest('DELETE')); await loadLists(); } catch (cause) { setError(messageOf(cause)); }
  };
  const updateFavorite = async (item: Favorite) => {
    const note = window.prompt('收藏备注', item.note || ''); if (note === null) return;
    try { await api(path(`/favorites/${item.id}`), jsonRequest('PUT', { note })); await loadLists(); } catch (cause) { setError(messageOf(cause)); }
  };
  const saveImport = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      let data: unknown = importText;
      if (importFormat === 'json') data = JSON.parse(importText);
      if (importFormat === 'manual') {
        const url = platformProductUrl(manual.platform, manual.url);
        if (!url) throw new Error(`请填写${platformName(manual.platform)}官方域名下的 HTTPS 商品链接，链接不能包含账号密码`);
        data = {
          platform: manual.platform, title: manual.title, url, externalId: editingImport ? String(editingImport) : `manual-${Date.now()}`,
          brand: manual.brand || null, model: manual.model || null, category: manual.category,
          specs: manual.category === 'standard' ? { ...(manual.storage ? { storage: manual.storage } : {}), ...(manual.memory ? { memory: manual.memory } : {}) } : { ...(manual.variant ? { variant: manual.variant } : {}) },
          ...(manual.category !== 'standard' ? { packCount: numberOrNull(manual.packCount), netWeight: numberOrNull(manual.netWeight), unit: manual.unit, expiresOn: manual.expiresOn || null } : {}),
          condition: manual.condition, currency: manual.currency,
          ...Object.fromEntries([...numericManual].filter(key => !['packCount', 'netWeight'].includes(key)).map(key => [key, numberOrNull(manual[key as keyof typeof manual])])),
          returnPolicy: manual.returnPolicy || null, sellerName: manual.sellerName || null,
          sourceFetchedAt: manual.sourceFetchedAt ? new Date(manual.sourceFetchedAt).toISOString() : new Date().toISOString(), source: manual.source || '用户手工核录',
        };
      }
      await api(path(editingImport ? `/imports/${editingImport}` : '/imports'), jsonRequest(editingImport ? 'PUT' : 'POST', { format: importFormat, data }));
      setEditingImport(null); setNotice('报价已保存，选择“真实接口 / 我的导入”重新比价。'); await loadLists();
    } catch (cause) { setError(messageOf(cause)); } finally { setBusy(false); }
  };
  const editImport = (row: ImportRow) => { setEditingImport(row.id); setImportFormat('json'); setImportText(JSON.stringify(row.offer, null, 2)); setTab('import'); };
  const removeImport = async (id: string | number) => {
    if (!window.confirm('确认删除这条导入报价？历史比价快照会保留。')) return;
    try { await api(path(`/imports/${id}`), jsonRequest('DELETE')); await loadLists(); } catch (cause) { setError(messageOf(cause)); }
  };
  const docs = flatten(project.children || []).filter(item => item.type !== 'folder');
  const selectedDoc = docs.find(doc => String(doc.id) === params.get('compareDoc'));
  const currencies = [...new Set(result?.offers.map(offer => offer.currency) || ['CNY'])];
  const units = [...new Set(result?.offers.map(offer => offer.comparisonUnit).filter((value): value is string => Boolean(value)) || [])];
  const visibleOffers = sortOffers((result?.offers || []).filter(offer => (!exactOnly || offer.matchLevel === 'exact') && (filterPlatform === 'all' || offer.platform === filterPlatform)
    && offer.currency === filterCurrency && (filterUnit === 'all' || offer.comparisonUnit === filterUnit)), sort);
  const selectRun = (id: string) => { const next = new URLSearchParams(params); next.set('run', id); setParams(next); setTab('search'); };
  const minimumFor = (offer: CompareOffer) => {
    const prices = (result?.offers || []).filter(row => row.eligible && row.currency === offer.currency && row.landedPrice != null).map(row => row.landedPrice!);
    return prices.length ? Math.min(...prices) : null;
  };
  const daily = form.category !== 'standard';
  const manualFields = Object.keys(manual).filter(key => !['platform', 'condition', 'currency', 'category', 'unit'].includes(key)
    && (manual.category === 'standard' ? !['variant', 'packCount', 'netWeight', 'expiresOn'].includes(key) : !['storage', 'memory'].includes(key)));

  return <section className="compare-space">
    <div className="compare-hero"><div>
      <button className="back-link" onClick={() => navigate(workbench ? `/home?project=${project.id}` : '/home')}><ArrowLeft size={15} />{workbench ? '返回项目' : '返回空间'}</button>
      <h1>{workbench ? '消费比价工作台' : project.title}</h1><p>核对同款规格与到手价，日常消费品按净含量和包装数比较单位价。</p>
    </div>{!workbench && <Link className="button" to={`/compare?project=${project.id}`}><Search size={16} />开始比价</Link>}</div>
    {error && <div className="error-message" role="alert">{error}</div>}{notice && <p role="status" className="compare-notice">{notice}</p>}
    {!workbench ? <>
      <div className="compare-doc-list">{docs.map(doc => <div className="compare-doc" key={doc.id}>
        <button onClick={() => { const next = new URLSearchParams(params); next.set('compareDoc', String(doc.id)); setParams(next); }}><FileText size={15} /> {doc.title}</button>
        <button title="打开资料详情" onClick={() => onOpenDocument(doc.id)}><ChevronRight size={16} /></button>
      </div>)}</div>{selectedDoc && <div className="compare-document"><ContentBody content={selectedDoc} /></div>}
    </> : <>
      <nav className="compare-tabs" aria-label="比价功能">{([['search', Search, '比价'], ['import', Upload, '报价导入'], ['history', History, '历史记录'], ['favorites', Star, '收藏夹']] as const).map(([key, Icon, label]) =>
        <button key={key} className={tab === key ? 'active' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}><Icon size={15} /> {label}</button>)}</nav>
      {tab === 'search' && <>
        <form className="compare-panel" onSubmit={search}>
          <div className="compare-form">
            <label>数据来源<select value={form.mode} onChange={event => updateForm('mode', event.target.value)}><option value="demo">演示数据（合成报价）</option><option value="live">真实接口 / 我的导入</option></select></label>
            {form.mode === 'demo' && <label>演示场景<select value={form.demoScenario} onChange={event => chooseScenario(event.target.value)}>
              <option value="phone">iPhone 16 256GB</option><option value="laptop">笔记本配置差异</option><option value="mixed">新品与二手隔离</option>
              <option value="food">食品：燕麦片</option><option value="drink">饮料：纯牛奶</option><option value="household">日化：洗衣液</option>
            </select></label>}
            <label>商品类别<select value={form.category} onChange={event => updateForm('category', event.target.value)}>{categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label>商品名称<input required maxLength={160} value={form.query} onChange={event => updateForm('query', event.target.value)} /></label>
            <label>品牌<input maxLength={80} value={form.brand} onChange={event => updateForm('brand', event.target.value)} /></label>
            <label>型号 / 产品系列<input maxLength={100} value={form.model} onChange={event => updateForm('model', event.target.value)} /></label>
            {daily ? <>
              <label>口味 / 配方 / 浓度<input maxLength={100} value={form.variant} onChange={event => updateForm('variant', event.target.value)} /></label>
              <label>包装数量<input required type="number" min="1" max="10000" step="1" value={form.packCount} onChange={event => updateForm('packCount', event.target.value)} /></label>
              <label>每包 / 瓶净含量<input required type="number" min="0.001" step="any" value={form.netWeight} onChange={event => updateForm('netWeight', event.target.value)} /></label>
              <label>净含量单位<select value={form.unit} onChange={event => updateForm('unit', event.target.value)}><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="l">L</option><option value="piece">件 / 片 / 抽</option></select></label>
            </> : (['storage', 'memory', 'color', 'region', 'warranty', 'bundle', 'accessories'] as const).map(key => <label key={key}>{({ storage: '容量 / 硬盘', memory: '内存', color: '颜色', region: '地区版本', warranty: '保修', bundle: '套装', accessories: '配件' })[key]}
              <input maxLength={100} value={form[key]} onChange={event => updateForm(key, event.target.value)} /></label>)}
            <label>商品状态<select value={form.condition} onChange={event => updateForm('condition', event.target.value)}><option value="new">全新</option><option value="used">二手</option><option value="refurbished">翻新</option></select></label>
            <label>预算上限<input type="number" min="0" max="100000000" step="0.01" value={form.budget} onChange={event => updateForm('budget', event.target.value)} /></label>
            <label>货币<select value={form.currency} onChange={event => updateForm('currency', event.target.value)}>{['CNY', 'USD', 'EUR', 'GBP', 'HKD'].map(value => <option key={value}>{value}</option>)}</select></label>
            <label>配送城市<input maxLength={80} value={form.city} onChange={event => updateForm('city', event.target.value)} /></label>
            <label>最晚到货日期<input type="date" value={form.targetDate} onChange={event => updateForm('targetDate', event.target.value)} /></label>
            <label>排序偏好<select value={form.preference} onChange={event => updateForm('preference', event.target.value)}><option value="balanced">综合性价比</option><option value="price">价格优先</option><option value="quality">质量优先</option></select></label>
            <label className="wide">必须满足条件<input maxLength={1000} placeholder="用逗号分隔，如：官方保修" value={form.required} onChange={event => updateForm('required', event.target.value)} /></label>
            <label className="wide">可接受条件<input maxLength={1000} value={form.acceptable} onChange={event => updateForm('acceptable', event.target.value)} /></label>
          </div>
          <fieldset className="compare-checks"><legend>平台范围</legend>{platforms.map(([id, name]) => <label key={id}><input type="checkbox" checked={form.platforms.includes(id)} onChange={() => updateForm('platforms', form.platforms.includes(id) ? form.platforms.filter(value => value !== id) : [...form.platforms, id])} />{name}</label>)}</fieldset>
          {confirmed && <div className="compare-chip-row" aria-label="已确认需求">{[form.brand, form.model, daily ? `${form.netWeight}${form.unit} × ${form.packCount}` : form.storage, conditionName(form.condition), form.budget ? `≤ ${form.budget} ${form.currency}` : '预算不限', form.city].filter(Boolean).map((value, index) => <span className="compare-chip" key={index}>{value}</span>)}</div>}
          <div className="compare-actions"><button className="button" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <Search size={16} />}{busy ? '正在比价' : confirmed ? '开始比价' : '确认需求'}</button>{confirmed && <small className="muted">修改参数后需重新确认</small>}</div>
        </form>
        <div className="compare-platform-shortcuts" aria-label="到平台搜索商品">{form.platforms.map(platform => <a key={platform} href={platformSearchUrl(platform, form.query) || '#'} target="_blank" rel="noopener noreferrer"><ArrowUpRight size={14} />{platformName(platform)}搜索</a>)}</div>
        {!!providers.length && <details className="compare-provider-section"><summary>平台接入状态</summary><div className="compare-provider-list">{providers.map(provider => <div className="compare-provider" key={provider.platform}><strong>{platformName(provider.platform)}</strong><small>{provider.reason || provider.status}{provider.fallback === 'manual_import' ? ' · 可手工导入' : ''}</small></div>)}</div></details>}
        {result && <>
          <div className="compare-result-head"><h2>严格推荐 · {result.recommendations.length} 项</h2><small className="muted">共 {result.offers.length} 条报价 · 完全匹配 {result.summary.exactMatchCount} 条</small></div>
          {result.request.mode === 'demo' && <p className="compare-notice">合成演示数据，不代表平台实时报价；“平台搜索”打开的是相关搜索结果。</p>}
          <p className="compare-disclosure">性价比结合可确认价格、口碑样本、售后、配送和数据完整度。不同净含量、包装数或配方只作参考，不进入同款前三；低单位价不等于适合囤货。</p>
          {!result.recommendations.length ? <div className="compare-empty">没有满足全部条件的推荐。请核对规格、预算及费用；相似商品不会补足前三。</div> : <div className="compare-offer-grid">{result.recommendations.map((offer, index) => <OfferCard key={offer.id} offer={offer} rank={offer.rank || index + 1} baselinePrice={minimumFor(offer)} onFavorite={favorite} />)}</div>}
          {!!providerStatuses(result.summary.providerStatus).length && <details className="compare-provider-section"><summary>本次搜索的平台反馈</summary>{providerStatuses(result.summary.providerStatus).map((provider, index) => <p key={`${provider.platform}-${index}`}><strong>{platformName(provider.platform)}</strong> · {provider.reason || provider.status}</p>)}</details>}
          <div className="compare-result-head"><h2>详细比较</h2><div className="compare-checks">
            <label><input type="checkbox" checked={exactOnly} onChange={event => setExactOnly(event.target.checked)} />仅完全匹配</label>
            <select aria-label="筛选平台" value={filterPlatform} onChange={event => setFilterPlatform(event.target.value)}><option value="all">全部平台</option>{platforms.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
            <select aria-label="筛选货币" value={filterCurrency} onChange={event => setFilterCurrency(event.target.value)}>{[...new Set([filterCurrency, ...currencies])].map(value => <option key={value}>{value}</option>)}</select>
            {!!units.length && <select aria-label="筛选单位" value={filterUnit} onChange={event => setFilterUnit(event.target.value)}><option value="all">所有计量单位</option>{units.map(unit => <option key={unit}>{unit}</option>)}</select>}
            <select aria-label="结果排序" value={sort} onChange={event => setSort(event.target.value as CompareSort)}><option value="score">性价比推荐分</option><option value="price">到手价</option><option value="unitPrice">单位价（同单位内）</option><option value="platform">平台</option></select>
          </div></div>
          <div className="compare-table-wrap" tabIndex={0} aria-label="商品详细比较表，可横向滚动"><table className="compare-table"><thead><tr>{['商品 / 平台', '型号 / 参数', '包装 / 单位价', '成色', '商品价', '优惠 / 补贴', '运费 / 税费 / 服务费', '到手价', '推荐分', '好评率 / 评价', '点赞 / 转发 / 销量', '配送 / 售后', '来源 / 更新时间', '操作'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{visibleOffers.map(offer => <tr key={offer.id}>
            <td>{offer.title}<br />{platformName(offer.platform)}</td><td>{offer.model || '未知'}<br />{Object.entries(offer.specs).map(([key, value]) => `${key}: ${value}`).join(' · ')}</td>
            <td>{offer.category && offer.category !== 'standard' ? <>{packLabel(offer)}<br /><strong>{unitPriceLabel(offer)}</strong></> : '不适用'}</td>
            <td>{conditionName(offer.condition)}</td><td>{nullLabel(offer.itemPrice)}</td><td>{nullLabel(offer.couponDiscount)} / {nullLabel(offer.subsidy)}</td>
            <td>{nullLabel(offer.shippingFee)} / {nullLabel(offer.taxFee)} / {nullLabel(offer.serviceFee)}</td><td>{priceLabel(offer)}<br /><small>{offer.priceStatus === 'confirmed' ? '已录入确认' : '待复核'}</small></td>
            <td>{score(offer.scores.total)}</td><td>{nullLabel(offer.positiveRate, '%')} / {nullLabel(offer.reviewCount)}</td><td>{nullLabel(offer.likes)} / {nullLabel(offer.shares)} / {nullLabel(offer.salesCount)}</td>
            <td>{nullLabel(offer.deliveryDays, '天')}<br />{offer.returnPolicy || '未知'}</td><td>{offer.source}<br />{dateLabel(offer.sourceFetchedAt)}</td><td><button className="icon-button" title="收藏报价" onClick={() => void favorite(offer)}><Star size={15} /></button><ProductLink offer={offer} compact /></td>
          </tr>)}</tbody></table></div>{!visibleOffers.length && <p className="compare-empty">当前筛选没有报价。</p>}
        </>}
      </>}
      {tab === 'import' && <>
        <form className="compare-panel" onSubmit={saveImport}>
          <div className="compare-result-head"><h2>{editingImport ? '编辑导入报价' : '新增报价'}</h2><select aria-label="报价导入格式" value={importFormat} onChange={event => setImportFormat(event.target.value as typeof importFormat)}><option value="manual">手工补录</option><option value="csv">CSV</option><option value="json">JSON</option></select></div>
          {importFormat === 'manual' ? <div className="compare-form">
            <label>平台<select value={manual.platform} onChange={event => setManual(previous => ({ ...previous, platform: event.target.value }))}>{platforms.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
            <label>商品类别<select value={manual.category} onChange={event => setManual(previous => ({ ...previous, category: event.target.value }))}>{categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label>成色<select value={manual.condition} onChange={event => setManual(previous => ({ ...previous, condition: event.target.value }))}><option value="new">全新</option><option value="used">二手</option><option value="refurbished">翻新</option></select></label>
            <label>货币<select value={manual.currency} onChange={event => setManual(previous => ({ ...previous, currency: event.target.value }))}>{['CNY', 'USD', 'EUR', 'GBP', 'HKD'].map(value => <option key={value}>{value}</option>)}</select></label>
            {manual.category !== 'standard' && <label>净含量单位<select value={manual.unit} onChange={event => setManual(previous => ({ ...previous, unit: event.target.value }))}>{['g', 'kg', 'ml', 'l', 'piece'].map(value => <option key={value}>{value}</option>)}</select></label>}
            {manualFields.map(key => <label key={key}>{manualLabels[key]}<input required={['title', 'url', 'itemPrice'].includes(key)}
              type={key === 'url' ? 'url' : key === 'expiresOn' ? 'date' : key === 'sourceFetchedAt' ? 'datetime-local' : numericManual.has(key) ? 'number' : 'text'} min={key === 'netWeight' ? '0.001' : '0'}
              step={['packCount', 'reviewCount', 'likes', 'shares', 'salesCount', 'deliveryDays'].includes(key) ? '1' : 'any'}
              value={manual[key as keyof typeof manual]} onChange={event => setManual(previous => ({ ...previous, [key]: event.target.value }))} /></label>)}
          </div> : <div className="compare-form"><label className="wide">选择文件<input type="file" accept={importFormat === 'csv' ? '.csv,text/csv' : '.json,application/json'} onChange={async event => {
            const file = event.target.files?.[0]; if (!file) return;
            if (file.size > 100000) setError('文件超过 100KB，请拆分导入'); else setImportText(await file.text());
          }} /></label><label className="wide">{importFormat.toUpperCase()} 报价内容<textarea required value={importText} onChange={event => setImportText(event.target.value)} rows={10} /></label></div>}
          <div className="compare-actions"><button className="button" disabled={busy}><Upload size={16} />{editingImport ? '保存修改' : '保存报价'}</button>{editingImport && <button type="button" className="button secondary" onClick={() => { setEditingImport(null); setImportText(''); }}>取消编辑</button>}</div>
          <p className="compare-disclosure">未知费用留空，明确无此费用才填 0；需要领取或凑单的优惠应先核实资格。食品记录保质期，日化核对配方与浓度。</p>
        </form>
        <div className="compare-history-list">{imports.map(row => <div className="compare-history" key={row.id}><div><strong>{row.offer.title}</strong><br /><small>{platformName(row.offer.platform)} · {nullLabel(row.offer.itemPrice)} {row.offer.currency} · {row.offer.source} · {dateLabel(row.offer.sourceFetchedAt)}</small></div>
          <div className="compare-checks"><ProductLink offer={row.offer} compact /><button className="icon-button" title="编辑报价" onClick={() => editImport(row)}><Pencil size={16} /></button><button className="icon-button" title="删除报价" onClick={() => void removeImport(row.id)}><Trash2 size={16} /></button></div></div>)}{!imports.length && <p className="compare-empty">尚未导入报价。</p>}</div>
      </>}
      {tab === 'history' && <div className="compare-history-list">{history.map(run => <div className="compare-history" key={run.runId}><div><strong>{run.query}</strong><br /><small>{dateLabel(run.createdAt)} · {run.mode === 'demo' ? '演示' : '真实 / 导入'} · {run.exactMatchCount} 条完全匹配</small></div><button className="button secondary" onClick={() => selectRun(run.runId)}><History size={15} />查看</button></div>)}{!history.length && <p className="compare-empty">还没有比价记录。</p>}</div>}
      {tab === 'favorites' && <div className="compare-history-list">{favorites.map(item => <div className="compare-history" key={item.id}><div><strong>{item.offer.title}</strong><br /><small>{priceLabel(item.offer)} · {platformName(item.offer.platform)} · {item.note || '暂无备注'}</small></div><div className="compare-checks"><ProductLink offer={item.offer} compact /><button className="icon-button" title="修改备注" onClick={() => void updateFavorite(item)}><Pencil size={16} /></button><button className="icon-button" title="移除收藏" onClick={() => void removeFavorite(item.id)}><Trash2 size={16} /></button></div></div>)}{!favorites.length && <p className="compare-empty">收藏你关注的报价，便于之后复核。</p>}</div>}
    </>}
  </section>;
}
