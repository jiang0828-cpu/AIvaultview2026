import { healthProjectMarker, type HealthAction, type HealthMember, type HealthMeasurement, type HealthMedication, type HealthVisit, type HealthWorkspace, type MeasurementKind } from '../../shared/health';
import type { Content } from './types';

export const measurementKinds: Record<MeasurementKind, { label: string; unit: string; min: number; max: number }> = {
  bloodPressure: { label: '血压', unit: 'mmHg', min: 30, max: 300 },
  weight: { label: '体重', unit: 'kg', min: 0.1, max: 500 },
  sleep: { label: '睡眠时长', unit: '小时', min: 0, max: 24 },
  activity: { label: '活动时长', unit: '分钟', min: 0, max: 1440 },
  glucose: { label: '血糖', unit: 'mmol/L', min: 0.1, max: 60 },
  temperature: { label: '体温', unit: '℃', min: 25, max: 45 },
};

export function isHealthProject(content: Content | null | undefined): content is Content {
  return Boolean(content?.isProject && content.scene === 'life' && content.type === 'folder' && content.description.includes(healthProjectMarker));
}

export function healthToday(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function healthDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '时间待确认' : date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}

export function localInputDateTime(value = new Date().toISOString()): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function memberRecords<T extends { memberId: string }>(rows: T[], memberId: string): T[] {
  return memberId === 'all' ? [...rows] : rows.filter(row => row.memberId === memberId);
}

export function dueActions(data: HealthWorkspace, memberId = 'all', today = healthToday()): HealthAction[] {
  return memberRecords(data.actions, memberId).filter(action => action.status !== 'done' && action.dueDate <= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title));
}

export interface DueCareItem {
  id: string;
  memberId: string;
  dueDate: string;
  title: string;
  detail: string;
  kind: 'actions' | 'visits' | 'medications';
  record: HealthAction | HealthVisit | HealthMedication;
}

export function dueCareItems(data: HealthWorkspace, memberId = 'all', today = healthToday()): DueCareItem[] {
  const items: DueCareItem[] = dueActions(data, memberId, today).map(row => ({
    id: `action-${row.id}`, memberId: row.memberId, dueDate: row.dueDate, title: row.title,
    detail: `${row.owner}负责${row.obstacle ? ` · 困难：${row.obstacle}` : ''}`, kind: 'actions', record: row,
  }));
  for (const row of memberRecords(data.visits, memberId)) {
    if (row.status !== 'done' && row.date <= today) {
      items.push({ id: `visit-${row.id}`, memberId: row.memberId, dueDate: row.date,
        title: `${row.status === 'waiting' ? '核对就医结果' : '就医预约'}：${row.reason || row.institution}`,
        detail: `${row.institution} · 更新就医状态、结果和下一步`, kind: 'visits', record: row });
    } else if (row.status === 'done' && row.nextDate && row.nextDate <= today) {
      items.push({ id: `visit-${row.id}`, memberId: row.memberId, dueDate: row.nextDate,
        title: `复诊 / 复查：${row.reason || row.institution}`,
        detail: `${row.institution} · 处理后更新或清空下次日期`, kind: 'visits', record: row });
    }
  }
  for (const row of memberRecords(data.medications, memberId)) {
    if (row.reviewDate && row.reviewDate <= today) items.push({
      id: `medication-${row.id}`, memberId: row.memberId, dueDate: row.reviewDate, title: `核对药单：${row.name}`,
      detail: '登记核对结果，并更新或清空下次核对日期', kind: 'medications', record: row,
    });
  }
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
}

export function focusCount(data: HealthWorkspace, memberId: string): number {
  return data.actions.filter(action => action.memberId === memberId && action.focus && action.status !== 'done').length;
}

export function nextRecurringAction(action: HealthAction, today: string, id: string): HealthAction | null {
  if (action.status !== 'done' || !action.recurrence || action.recurrence === 'none') return null;
  const base = action.dueDate > today ? action.dueDate : today;
  const next = new Date(`${base}T00:00:00Z`);
  if (Number.isNaN(next.getTime())) return null;
  next.setUTCDate(next.getUTCDate() + (action.recurrence === 'weekly' ? 7 : 1));
  return { ...action, id, dueDate: next.toISOString().slice(0, 10), status: 'todo', evidence: '', obstacle: '' };
}

export function measurementSeries(rows: HealthMeasurement[], memberId: string, kind: MeasurementKind): HealthMeasurement[] {
  if (memberId === 'all') return [];
  return rows.filter(row => row.memberId === memberId && row.kind === kind && Number.isFinite(row.value) && !Number.isNaN(Date.parse(row.measuredAt)))
    .sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt)).slice(-20);
}

export function measurementValue(row: HealthMeasurement): string {
  return `${row.value}${row.kind === 'bloodPressure' ? ` / ${row.secondary ?? '未填'}` : ''} ${measurementKinds[row.kind].unit}`;
}

export function removeMember(data: HealthWorkspace, id: string): HealthWorkspace {
  return { members: data.members.filter(member => member.id !== id), measurements: data.measurements.filter(row => row.memberId !== id),
    actions: data.actions.filter(row => row.memberId !== id), medications: data.medications.filter(row => row.memberId !== id),
    visits: data.visits.filter(row => row.memberId !== id), reviews: data.reviews.filter(row => row.memberId !== id) };
}

export function healthSummary(data: HealthWorkspace, member: HealthMember, today = healthToday()): string {
  const known = (value: string) => value.trim() || '未记录，请当面确认';
  const statuses = { todo: '待处理', doing: '处理中', waiting: '待结果', done: '已完成' };
  const measures = memberRecords(data.measurements, member.id).sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt)).slice(0, 12);
  const actions = memberRecords(data.actions, member.id).filter(row => row.status !== 'done');
  const medicines = memberRecords(data.medications, member.id);
  const visits = memberRecords(data.visits, member.id).sort((a, b) => b.date.localeCompare(a.date));
  return [
    `个人健康与就诊摘要  ${today}`, `成员：${member.name}；出生日期：${known(member.birthDate)}；关系：${known(member.relationship)}`,
    `病史：${known(member.conditions)}`, `过敏物及具体反应：${known(member.allergies)}`, `紧急联系人：${known(member.emergencyContact)}`,
    `家庭医生/机构：${known(member.doctor)} / ${known(member.hospital)}`, `医生联系：${known(member.doctorContact)}`,
    `当前诉求与目标：${known(member.goals)}`, `医生确认的监测计划：${known(member.monitoringPlan)}`,
    '\n完整药单（由本人提供，需与医生核对）', ...medicines.map(row => `${row.name}｜规格${known(row.strength)}｜每次${known(row.dose)}｜${known(row.schedule)}｜用途${known(row.purpose)}｜开方${known(row.prescriber)}｜下次核对${known(row.reviewDate)}｜${known(row.notes)}`),
    ...(!medicines.length ? ['未录入，不代表未用药。'] : []),
    '\n近期记录（单次读数不等于诊断）', ...measures.map(row => `${healthDateTime(row.measuredAt)}｜${measurementKinds[row.kind].label} ${measurementValue(row)}｜条件${known(row.context)}｜${row.source === 'clinic' ? '医疗机构' : row.source === 'device' ? '设备' : '本人记录'}｜${known(row.note)}`),
    ...(!measures.length ? ['暂无记录，不代表指标正常。'] : []),
    '\n待处理行动', ...actions.map(row => `${row.title}｜责任人${row.owner}｜截止${row.dueDate}｜状态${statuses[row.status]}｜困难${known(row.obstacle)}`),
    ...(!actions.length ? ['暂无登记的待处理行动。'] : []),
    '\n最近就医与待提问', ...visits.slice(0, 5).map(row => `${row.date} ${row.institution}｜问题${row.reason}｜待问${known(row.questions)}｜结果${known(row.outcome)}｜下次${known(row.nextDate)}`),
    '\n本摘要为家庭整理信息，不替代医生评估；未填写项目均为未知。紧急症状直接拨打120，不等待本系统。',
  ].join('\n');
}
