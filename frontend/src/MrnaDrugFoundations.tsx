import { useState, type CSSProperties } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, ChevronRight, FlaskConical, Microscope, ShieldCheck } from 'lucide-react';
import { antigenTypes, carrierParts, foundationQuestions, foundationSources, foundationUpdatedAt, mechanismRoutes, rnaSegments, tumorBarriers } from './mrnaFoundationContent';
import './mrna-foundations.css';

function References({ ids }: { ids: string[] }) {
  return <span className="mrna-source-links">{ids.map((id) => {
    const source = foundationSources.find((item) => item.id === id);
    return source ? <a key={id} href={source.url} target="_blank" rel="noreferrer" title={source.title}>{id}<ArrowUpRight size={10} /></a> : null;
  })}</span>;
}

export function MrnaFoundations({ onNavigate }: { onNavigate: (view: string) => void }) {
  const [segmentId, setSegmentId] = useState('orf');
  const [routeId, setRouteId] = useState('vaccine');
  const [stepIndex, setStepIndex] = useState(0);
  const segment = rnaSegments.find((item) => item.id === segmentId)!;
  const route = mechanismRoutes.find((item) => item.id === routeId)!;
  const step = route.steps[stepIndex];

  return <div className="mrna-foundations">
    <section className="mrna-found-intro">
      <div><span className="mrna-eyebrow">DRUG FOUNDATIONS</span><h2>从一条 mRNA，到抗肿瘤作用</h2><p>mRNA携带蛋白编码信息。治疗作用取决于表达什么、送到哪里，以及能否在患者体内形成有效且可耐受的生物学反应。</p></div>
      <dl className="mrna-found-concepts"><div><dt>mRNA</dt><dd>编码信息</dd></div><ArrowRight size={17} aria-hidden="true" /><div><dt>蛋白</dt><dd>表达产物</dd></div><ArrowRight size={17} aria-hidden="true" /><div><dt>生物学作用</dt><dd>需临床验证</dd></div></dl>
      <References ids={['F01', 'F03', 'F09']} />
    </section>

    <section className="mrna-section" aria-labelledby="mrna-structure-title">
      <div className="mrna-section-head"><div><span className="mrna-eyebrow">01 · MOLECULE & FORMULATION</span><h2 id="mrna-structure-title">药物的结构：RNA 与递送载体</h2></div><span className="mrna-chip">常规线性 mRNA</span></div>
      <p>mRNA由含A、U、C、G四类碱基的核苷酸组成，通常是单链，可形成局部二级结构。下面展示功能区段，而非原子结构或真实长度比例。<References ids={['F01', 'F02']} /></p>
      <div className="mrna-rna-strip" role="group" aria-label="mRNA功能区段">{rnaSegments.map((item) => <button key={item.id} className={`mrna-rna-part ${item.id} ${segmentId === item.id ? 'selected' : ''}`} aria-pressed={segmentId === item.id} aria-controls="mrna-segment-detail" onClick={() => setSegmentId(item.id)}><strong>{item.label}</strong><span>{item.english}</span></button>)}</div>
      <div id="mrna-segment-detail" className="mrna-found-detail" aria-live="polite"><h3>{segment.label}</h3><p>{segment.role}</p><p className="mrna-found-implication">与药物设计的关系：{segment.connection}</p><References ids={segment.sourceIds} /></div>
      <div className="mrna-carrier-layout">
        <figure className="mrna-carrier-figure">
          <svg viewBox="0 0 360 240" role="img" aria-labelledby="mrna-carrier-title mrna-carrier-desc">
            <title id="mrna-carrier-title">脂质纳米颗粒功能示意</title><desc id="mrna-carrier-desc">RNA与脂质在颗粒内部共同组织，表面含PEG脂质。图示不代表固定配方或真实内部结构。</desc>
            <ellipse cx="160" cy="120" rx="101" ry="83" fill="#edf5f2" stroke="#82aaa0" strokeWidth="2" />
            {Array.from({ length: 18 }, (_, i) => { const angle = i * Math.PI / 9; const x = 160 + Math.cos(angle) * 84; const y = 120 + Math.sin(angle) * 65; return <g key={i}><circle cx={x} cy={y} r="6" fill={['#177568', '#8582ad', '#b39250'][i % 3]} /><line x1={x} y1={y} x2={160 + Math.cos(angle) * 69} y2={120 + Math.sin(angle) * 51} stroke="#82aaa0" strokeWidth="2" /></g>; })}
            <path d="M109 115 Q125 79 142 111 T175 113 T205 112 M115 146 Q133 117 148 145 T180 144 T207 140" fill="none" stroke="#177568" strokeWidth="4" strokeLinecap="round" />
            <circle cx="145" cy="84" r="5" fill="#b39250" /><circle cx="193" cy="151" r="5" fill="#8582ad" />
            <path d="M224 72 l8 -10 l5 5 l8 -11 l5 5 l8 -10 M242 111 l11 -3 l4 6 l12 -4 l4 6 l12 -4 M128 44 l-4 -12 l-6 2 l-4 -13" fill="none" stroke="#6488ad" strokeWidth="3" />
            <line x1="180" y1="124" x2="287" y2="155" stroke="#81938c" /><text x="290" y="162" fill="#426359" fontSize="13">RNA</text>
            <text x="160" y="228" textAnchor="middle" fill="#718079" fontSize="12">LNP · 功能示意，非比例</text>
          </svg>
          <figcaption>载体保护RNA并帮助递送。LNP不能简单理解成装有RNA的空心脂质双层球；内部组织、比例及分布因配方而异。</figcaption>
        </figure>
        <div><h3>常见 LNP 的四类脂质</h3><dl className="mrna-carrier-parts">{carrierParts.map((item) => <div key={item.title}><dt><i className={item.color} />{item.title}</dt><dd>{item.detail}</dd></div>)}</dl><p className="mrna-chart-note">并非所有mRNA产品都采用同一种LNP；RNA-LPX、其他载体与体外细胞转染应分别识别。<References ids={['F02', 'F06', 'F07', 'F08']} /></p></div>
      </div>
    </section>

    <section className="mrna-section" aria-labelledby="mrna-mechanism-title">
      <div className="mrna-section-head"><div><span className="mrna-eyebrow">02 · MECHANISM OF ACTION</span><h2 id="mrna-mechanism-title">三条路线，作用链条各不相同</h2></div></div>
      <div className="mrna-route-switch" role="group" aria-label="药物机制路线">{mechanismRoutes.map((item) => <button key={item.id} aria-pressed={routeId === item.id} onClick={() => { setRouteId(item.id); setStepIndex(0); }}>{item.label}</button>)}</div>
      <div className="mrna-route-purpose"><span>编码载荷：<strong>{route.payload}</strong></span><ArrowRight size={17} aria-hidden="true" /><span>{route.destination}</span></div>
      <ol className="mrna-mechanism-steps" style={{ '--step-count': route.steps.length } as CSSProperties}>{route.steps.map((item, index) => <li key={item.title}><button aria-pressed={stepIndex === index} aria-controls="mrna-step-detail" onClick={() => setStepIndex(index)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.title}</strong><small>{item.location}</small></button></li>)}</ol>
      <div id="mrna-step-detail" className="mrna-found-detail" aria-live="polite"><span className="mrna-eyebrow">{step.location}</span><h3>{step.title}</h3><p>{step.detail}</p><div className="mrna-mechanism-barrier"><Microscope size={17} /><p><strong>关键瓶颈</strong>{step.barrier}</p></div><References ids={route.sourceIds} /></div>
      <p className="mrna-chart-note">常规mRNA在胞质中由核糖体翻译，随后逐步降解；表达持续时间取决于分子、制剂及组织。递送到细胞内、表达蛋白、产生免疫反应和改善临床结局，是不同层次的证据。<References ids={['F01', 'F02', 'F03']} /></p>
    </section>

    <section className="mrna-section" aria-labelledby="mrna-tumor-title">
      <div className="mrna-section-head"><div><span className="mrna-eyebrow">03 · TUMOR & IMMUNITY</span><h2 id="mrna-tumor-title">与肿瘤的关系：靶标、识别与免疫逃逸</h2></div></div>
      <div className="mrna-antigen-grid">{antigenTypes.map((item) => <article key={item.title}><span className="mrna-chip">{item.label}</span><h3>{item.title}</h3><p>{item.detail}</p><p className="mrna-found-implication">核验重点：{item.question}</p><References ids={item.sourceIds} /></article>)}</div>
      <div className="mrna-checkpoint-band"><ShieldCheck size={25} /><div><h3>为什么常与 PD-1 / PD-L1 抑制剂联用？</h3><p>疫苗尝试启动或增强针对抗原的T细胞反应；PD-1与PD-L1结合可向T细胞传递抑制信号。阻断这一通路可能帮助恢复免疫攻击，但不能弥补所有抗原缺失或递送失败，也不保证每位患者获益。</p><p>检查点同时参与正常免疫制动，阻断可导致免疫相关不良反应。联合方案的增益与风险需要对照试验验证。<References ids={['F03', 'F05']} /></p></div></div>
      <div className="mrna-found-table-wrap"><table className="mrna-found-table"><caption>从机制到患者获益，需要跨过哪些关口</caption><thead><tr><th scope="col">环节</th><th scope="col">可能的限制</th><th scope="col">研究与业务含义</th></tr></thead><tbody>{tumorBarriers.map((item) => <tr key={item.stage}><th scope="row">{item.stage}</th><td>{item.challenge}</td><td>{item.consequence}</td></tr>)}</tbody></table></div>
      <p className="mrna-chart-note">以上为机制层面的研究检查点，不是已确证的患者筛选标准；检测指标的预测价值仍需逐产品验证。<References ids={['F03', 'F04', 'F05', 'F07']} /></p>
    </section>

    <section className="mrna-section" aria-labelledby="mrna-questions-title"><div className="mrna-section-head"><div><span className="mrna-eyebrow">04 · KEY DISTINCTIONS</span><h2 id="mrna-questions-title">常见概念辨析</h2></div></div><div className="mrna-found-faq">{foundationQuestions.map((item) => <details key={item.question}><summary>{item.question}<ChevronRight size={16} /></summary><p>{item.answer}<References ids={item.sourceIds} /></p></details>)}</div></section>

    <div className="mrna-found-next"><span>继续查看实际药物与临床验证</span><div><button onClick={() => onNavigate('pipeline')}><BookOpen size={16} />管线台账<ArrowRight size={15} /></button><button onClick={() => onNavigate('evidence')}><FlaskConical size={16} />临床证据<ArrowRight size={15} /></button></div></div>
    <section className="mrna-section"><details className="mrna-found-sources"><summary>基础知识来源与阅读范围<span>{foundationSources.length} 条 · 核验 {foundationUpdatedAt}<ChevronRight size={16} /></span></summary><div className="mrna-source-register">{foundationSources.map((source) => <article key={source.id}><span className="mrna-source-id">{source.id}</span><div><a href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowUpRight size={13} /></a><p>{source.publisher}</p><p>定位：{source.locator}</p><p>{source.access}</p></div></article>)}</div></details></section>
    <footer className="mrna-footer"><span><ShieldCheck size={13} />机制基础 · 不替代临床疗效证据</span><span>基础内容更新 {foundationUpdatedAt} · 管线资料日期见研究概览</span></footer>
  </div>;
}
