import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, ClipboardList, Clock3, House, Landmark, Users, Wallet, BriefcaseBusiness } from 'lucide-react';
import { ContentBody, TopicPills } from './components';
import type { Content } from './types';
import { livelihoodIssueReport, livelihoodIssues, livelihoodSummary } from './livelihoodModel';
import { LivelihoodIssue } from './LivelihoodIssue';
import './livelihood.css';

const fields = [
  { Icon: BriefcaseBusiness, title: '工作与收入', question: '忙碌，是否换来了积累？', detail: '劳动时间、就业变化、收入波动与保障。' },
  { Icon: Wallet, title: '消费与成本', question: '一份生活，要付出多少？', detail: '价格之外，也记录通勤、等待和选择的成本。' },
  { Icon: House, title: '居住与照护', question: '谁在撑起日常的运转？', detail: '租住、社区、育儿养老与家庭分工。' },
  { Icon: Landmark, title: '公共服务', question: '同一项服务，谁更难抵达？', detail: '就医、教育、出行和办事过程中的具体体验。' },
];
const views = [ ['overview', '项目概览'], ['documents', '栏目文档'], ['issues', '期次档案'] ] as const;

export function LivelihoodSpace({ project, world, onOpen, onBack }: {
  project: Content; world?: Content; onOpen: (content: Content) => void; onBack: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const view = views.find(([key]) => key === params.get('lifeView'))?.[0] ?? 'overview';
  const documents = (project.children ?? []).filter((item) => item.type === 'text').sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const requested = params.get('lifeDoc');
  const document = requested ? documents.find((item) => String(item.id) === requested) : documents[0];
  const issues = livelihoodIssues(project);
  const requestedIssue = params.get('lifeIssue');
  const activeIssue = issues.find((item) => String(item.id) === requestedIssue);
  const activeReport = activeIssue ? livelihoodIssueReport(activeIssue) : null;
  function change(nextView: string, doc?: Content) {
    const next = new URLSearchParams({ project: String(project.id), lifeView: nextView });
    if (doc) next.set('lifeDoc', String(doc.id));
    setParams(next);
  }
  function openIssue(issue: Content) {
    setParams({ project: String(project.id), lifeView: 'issues', lifeIssue: String(issue.id), lifeSection: 'situation' });
  }
  const date = (value: string) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  return <section className={`livelihood-space${view === 'issues' && requestedIssue ? ' livelihood-space-reading' : ''}`} aria-labelledby="livelihood-title">
    <div className="livelihood-toolbar"><button className="back-link" onClick={onBack}><ArrowLeft size={15} />空间概览</button>{world && <button className="back-link" onClick={() => onOpen(world)}>观天下<ArrowUpRight size={15} /></button>}</div>
    <header className="livelihood-header"><p className="livelihood-eyebrow"><Users size={16} />微观与民生观察 · 一期一主题</p><h1 id="livelihood-title">{project.title}</h1><p className="livelihood-subtitle">看见忙碌背后的生活。</p><p className="livelihood-intro">{livelihoodSummary(project)}</p>
      <div className="livelihood-metadata"><span><CalendarDays size={14} />创建 {date(project.createdAt)}</span><span><Clock3 size={14} />更新 {date(project.updatedAt)}</span><TopicPills topics={(project.topics ?? []).slice(1)} /></div>
    </header>
    <nav className="livelihood-nav" aria-label="碌碌无为导航">{views.map(([key, label]) => <button key={key} aria-current={view === key ? 'page' : undefined} onClick={() => change(key)}>{label}</button>)}</nav>
    {view === 'overview' && <>
      <section className="livelihood-fields" aria-labelledby="livelihood-fields-title"><h2 id="livelihood-fields-title">从具体处境，理解生活的变化</h2><div>{fields.map(({ Icon, title, question, detail }) => <article key={title}><Icon size={22} /><h3>{title}</h3><strong>{question}</strong><p>{detail}</p></article>)}</div></section>
      <section className="livelihood-method"><div><p className="livelihood-eyebrow">每期的观察路径</p><h2>先看见一个人，再问清一个问题。</h2></div><ol>{['具体处境', '数据与事实', '机制与反证', '影响与应对', '跟踪与更正'].map((step, index) => <li key={step}><span>0{index + 1}</span>{step}</li>)}</ol><p>个体经历说明处境，样本与数据限定范围。先核对发生了什么，再讨论原因，最后提出有条件、可验收的应对。</p></section>
      <section className="livelihood-start"><div><BookOpen size={22} /><h2>栏目文档</h2><p>栏目说明、每期模板与待调研选题。</p></div><div>{documents.map((item) => <button key={item.id} onClick={() => change('documents', item)}><span>{item.title}</span><ArrowUpRight size={17} /></button>)}</div></section>
      <section className="livelihood-archive"><div><h2>期次档案</h2><button className="back-link" onClick={() => change('issues')}>查看档案<ArrowUpRight size={15} /></button></div>{issues.length ? <ul>{issues.slice(0, 3).map((issue) => <li key={issue.id}><button onClick={() => openIssue(issue)}>{issue.title}<ArrowUpRight size={15} /></button></li>)}</ul> : <p>首期尚未建立。选题池中的问题均待调研，完成采集与核验后逐期归档。</p>}</section>
    </>}
    {view === 'documents' && <section className="livelihood-documents"><nav aria-label="栏目文档">{documents.map((item) => <button key={item.id} aria-current={document?.id === item.id ? 'page' : undefined} onClick={() => change('documents', item)}><BookOpen size={15} />{item.title}</button>)}</nav>{document ? <article key={document.id}><ContentBody content={document} /></article> : <p role="status">{requested ? '未找到该文档，请选择其他栏目文档。' : '暂无栏目文档。'}</p>}</section>}
    {view === 'issues' && (requestedIssue ? activeIssue && activeReport ? <LivelihoodIssue key={activeIssue.id} issue={activeIssue} report={activeReport} onBack={() => change('issues')} /> : <section className="livelihood-empty" role="status"><h2>{activeIssue ? '本期资料暂时无法读取' : '未找到该期次'}</h2><p>{activeIssue ? '请管理员检查本期结构化资料，栏目文档与其他期次仍可访问。' : '请从本项目的期次档案重新选择。'}</p><button className="button" onClick={() => change('issues')}>返回期次档案</button></section> : <section className="livelihood-archive"><h2>一期一主题，留下一份可复核的观察</h2>{issues.length ? <ul>{issues.map((issue) => <li key={issue.id}><button onClick={() => openIssue(issue)}><span>{issue.title}</span><ArrowUpRight size={16} /></button></li>)}</ul> : <div className="livelihood-empty"><ClipboardList size={28} /><h3>首期，等待一个值得问清的问题</h3><p>从选题池确定观察对象与资料范围，再建立独立期次。</p><button className="button" onClick={() => change('documents', documents.find((item) => item.title.startsWith('选题池')))}>选题池<ArrowUpRight size={15} /></button></div>}</section>)}
  </section>;
}
