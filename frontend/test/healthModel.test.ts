import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyHealthWorkspace, type HealthMember, type HealthMeasurement } from '../../shared/health';
import { dueActions, dueCareItems, focusCount, healthToday, healthSummary, measurementSeries, measurementValue, memberRecords, nextRecurringAction, removeMember } from '../src/healthModel';

const member: HealthMember = { id: 'a', name: '测试成员', birthDate: '', relationship: '', management: 'general', conditions: '', allergies: '', emergencyContact: '', doctor: '', hospital: '', doctorContact: '', goals: '', monitoringPlan: '', consent: true };
const measure = (id: string, memberId: string, kind: HealthMeasurement['kind'], measuredAt: string, value = 0): HealthMeasurement => ({ id, memberId, kind, measuredAt, value, secondary: null, context: '', source: 'self', note: '' });

test('health date follows Shanghai across UTC day boundary', () => {
  assert.equal(healthToday(new Date('2026-11-11T17:00:00Z')), '2026-11-12');
});
test('due actions include overdue and today, excluding completed and other members', () => {
  const data = emptyHealthWorkspace();
  data.actions = [['old', 'a', '2026-11-10', 'todo'], ['today', 'a', '2026-11-12', 'waiting'], ['future', 'a', '2026-11-13', 'todo'], ['done', 'a', '2026-11-01', 'done'], ['other', 'b', '2026-11-01', 'todo']].map(([id, memberId, dueDate, status]) => ({ id, memberId, dueDate, status: status as 'todo' | 'waiting' | 'done', title: id, category: 'other', owner: '本人', focus: true, evidence: '', obstacle: '' }));
  assert.deepEqual(dueActions(data, 'a', '2026-11-12').map(row => row.id), ['old', 'today']);
  assert.equal(focusCount(data, 'a'), 3);
});
test('trend never mixes members or measurement kinds and preserves zero', () => {
  const rows = [measure('later', 'a', 'activity', '2026-11-12T12:00:00Z', 30), measure('other', 'b', 'activity', '2026-11-12T11:00:00Z', 100), measure('weight', 'a', 'weight', '2026-11-12T11:00:00Z', 70), measure('zero', 'a', 'activity', '2026-11-11T12:00:00Z')];
  assert.deepEqual(measurementSeries(rows, 'a', 'activity').map(row => row.id), ['zero', 'later']);
  assert.deepEqual(measurementSeries(rows, 'all', 'activity'), []);
  assert.equal(measurementValue(rows[3]), '0 分钟');
  assert.equal(memberRecords(rows, 'b').length, 1);
  assert.equal(measurementValue(measure('sleep-zero', 'a', 'sleep', '2026-11-11T12:00:00Z')), '0 小时');
  const originalOrder = rows.map(row => row.id);
  memberRecords(rows, 'all').reverse();
  assert.deepEqual(rows.map(row => row.id), originalOrder);
});
test('summary marks missing data unknown and never includes another member', () => {
  const data = emptyHealthWorkspace(); data.members = [member];
  data.measurements = [measure('private', 'b', 'weight', '2026-11-12T12:00:00Z', 99)];
  const summary = healthSummary(data, member, '2026-11-12');
  assert.ok(summary.includes('过敏物及具体反应：未记录，请当面确认'));
  assert.ok(summary.includes('未录入，不代表未用药'));
  assert.ok(summary.includes('暂无记录，不代表指标正常'));
  assert.ok(!summary.includes('99 kg'));
});
test('removing member removes associated records while preserving the other person', () => {
  const data = emptyHealthWorkspace(); data.members = [member, { ...member, id: 'b' }];
  data.measurements = [measure('a1', 'a', 'sleep', '2026-11-12T12:00:00Z'), measure('b1', 'b', 'sleep', '2026-11-12T12:00:00Z')];
  assert.deepEqual(removeMember(data, 'a').measurements.map(row => row.id), ['b1']);
  assert.deepEqual(removeMember(data, 'a').members.map(row => row.id), ['b']);
});

test('recurring completion schedules next calendar day after current date, not past missed days', () => {
  const action = { id: 'old', memberId: 'a', title: '走路', category: 'lifestyle' as const, owner: '本人', focus: true, dueDate: '2026-11-01', status: 'done' as const, evidence: '完成', obstacle: '', recurrence: 'daily' as const };
  const next = nextRecurringAction(action, '2026-11-12', 'new');
  assert.equal(next?.dueDate, '2026-11-13');
  assert.equal(next?.status, 'todo');
  assert.equal(next?.evidence, '');
  assert.equal(next?.id, 'new');
  assert.equal(action.evidence, '完成');
  assert.equal(nextRecurringAction({ ...action, recurrence: 'weekly', dueDate: '2026-12-28' }, '2026-11-12', 'n')?.dueDate, '2027-01-04');
  assert.equal(nextRecurringAction({ ...action, status: 'todo' }, '2026-11-12', 'n'), null);
  assert.equal(nextRecurringAction({ ...action, recurrence: 'none' }, '2026-11-12', 'n'), null);
});

test('today care list combines due appointments, follow-ups and medication reviews without duplicate visits', () => {
  const data = emptyHealthWorkspace();
  const visit = { id: 'visit', memberId: 'a', date: '2026-11-12', institution: '社区', reason: '复查', questions: '', status: 'planned' as const, outcome: '', nextDate: '' };
  data.visits = [visit, { ...visit, id: 'old', date: '2026-11-10', status: 'waiting', nextDate: '2026-11-11' },
    { ...visit, id: 'finished', status: 'done', outcome: '已解释结果' },
    { ...visit, id: 'next', date: '2026-11-01', status: 'done', outcome: '安排复诊', nextDate: '2026-11-12' },
    { ...visit, id: 'future', date: '2026-11-13' }, { ...visit, id: 'other', memberId: 'b' }];
  const medication = { id: 'medicine', memberId: 'a', name: '药单', strength: '', dose: '', schedule: '', purpose: '', prescriber: '', notes: '', reviewDate: '2026-11-12' };
  data.medications = [medication, { ...medication, id: 'overdue-medicine', reviewDate: '2026-11-09' },
    { ...medication, id: 'future-medicine', reviewDate: '2026-11-13' }, { ...medication, id: 'cleared-medicine', reviewDate: '' }];
  const items = dueCareItems(data, 'a', '2026-11-12');
  assert.deepEqual(items.map(item => item.id), ['medication-overdue-medicine', 'visit-old', 'medication-medicine', 'visit-next', 'visit-visit']);
  assert.equal(items.filter(item => item.id === 'visit-old').length, 1);
  assert.ok(items.find(item => item.id === 'visit-next')?.title.includes('复诊'));
  assert.equal(dueCareItems(data, 'b', '2026-11-12').length, 1);
  data.actions.push({ id: 'direct-action', memberId: 'a', title: '安排散步', category: 'lifestyle', dueDate: '2026-11-12', owner: '本人', focus: false, status: 'todo', evidence: '', obstacle: '' });
  assert.deepEqual(new Set(dueCareItems(data, 'a', '2026-11-12').map(item => item.kind)), new Set(['actions', 'visits', 'medications']));
  data.visits.find(row => row.id === 'next')!.nextDate = '';
  data.medications.find(row => row.id === 'medicine')!.reviewDate = '2026-12-01';
  assert.ok(!dueCareItems(data, 'a', '2026-11-12').some(item => item.id === 'visit-next' || item.id === 'medication-medicine'));
});

test('summary selects actual latest timestamps across offsets before limiting to twelve records', () => {
  const data = emptyHealthWorkspace(); data.members = [member];
  data.measurements = Array.from({ length: 12 }, (_, index) => ({ ...measure(`earlier-${index}`, 'a', 'weight', '2026-11-12T07:00:00+08:00', 70), note: '较早记录' }));
  data.measurements.push({ ...measure('latest', 'a', 'weight', '2026-11-11T23:30:00Z', 71), note: '跨时区最新记录' });
  const summary = healthSummary(data, member, '2026-11-12');
  assert.ok(summary.includes('跨时区最新记录'));
  assert.ok(summary.indexOf('71 kg') < summary.indexOf('70 kg'));
  assert.equal((summary.match(/较早记录/g) || []).length, 11);
});
