/* 영업기획 홈 — 순수 규칙(화면·네트워크 없이 시험 가능). 구포털 기획 홈의 요약(프로젝트 수·유효 견적·총 청구액·미수금)과 목록을 그대로 옮기고, "챙길 일"(연체 청구·지급 임박)을 새로 더했다.
 * 총 청구액·미수금은 프로젝트별 집계(projects.js pjtSummary)의 합이다: 청구 누계는 공급가액 기준(폐기 제외, 공동 발행분은 프로젝트 몫만), 미수금 = 청구 − 완결된 청구. */
import { sortProjects, pjtSummary, estSupply, isEstActive, TYPE_LABEL } from './projects.js?v=20261031f';
const T = (n) => Number(n) || 0;
const STATUS = { run: '진행중', done: '종료' };
/** 요약 카드: 프로젝트 수(진행중·종료), 유효 견적 수·공급가액 합, 총 청구액·지급·미수금(프로젝트별 합) */
export function homeKpis(projects, estimates, settlements) {
  const ps = projects || []; const sums = ps.map((p) => pjtSummary(p.id, estimates, settlements)); const act = (estimates || []).filter(isEstActive);
  return { projects: ps.length, run: ps.filter((p) => p.status !== 'done').length, done: ps.filter((p) => p.status === 'done').length, estCount: act.length, estSupply: act.reduce((a, e) => a + estSupply(e), 0), billed: sums.reduce((a, s) => a + s.billed, 0), paid: sums.reduce((a, s) => a + s.paid, 0), due: sums.reduce((a, s) => a + s.due, 0) };
}
/** KPI 카드를 누르면 보이는 목록(구포털 planShowList): pjt·est·bill·due — 각 행은 {id, badge, tone, title, meta, right, href} */
export function homeRows(kind, projects, estimates, settlements) {
  const ps = sortProjects(projects || []);
  if (kind === 'pjt') return ps.map((p) => ({ id: p.id, badge: STATUS[p.status] || '진행중', tone: p.status === 'done' ? 'green' : 'blue', title: (p.code ? '[' + p.code + '] ' : '') + (p.name || '(이름없음)'), meta: [p.site, p.client].filter(Boolean).join(' · ') + (p.type ? ' · ' + String(p.type).toUpperCase() : ''), right: pjtSummary(p.id, estimates, settlements).billed, href: '#/plan/projects/' + p.id }));
  if (kind === 'est') return (estimates || []).filter(isEstActive).map((e) => ({ id: e.id, badge: '견적', tone: 'blue', title: e.title || '(제목없음)', meta: (e.no || '') + (e.client && e.client.company ? ' · ' + e.client.company : ''), right: estSupply(e), href: '#/plan/est/' + e.id }));
  if (kind === 'bill') return (settlements || []).filter((s) => s.docType === 'invoice' && s.status !== 'void').map((s) => ({ id: s.id, badge: '청구', tone: 'amber', title: s.no || '(번호없음)', meta: (s.recipient && s.recipient.company ? s.recipient.company : '') + (s.baseMonth ? ' · ' + s.baseMonth : ''), right: T(s.total) || T(s.amount), href: '#/plan/billing/' + s.id }));
  if (kind === 'due') return ps.map((p) => ({ p, s: pjtSummary(p.id, estimates, settlements) })).filter((x) => x.s.due > 0).map((x) => ({ id: x.p.id, badge: '미수', tone: 'red', title: (x.p.code ? '[' + x.p.code + '] ' : '') + (x.p.name || ''), meta: '청구 ' + Math.round(x.s.billed).toLocaleString('ko-KR') + ' · 완결 ' + Math.round(x.s.done).toLocaleString('ko-KR'), right: x.s.due, href: '#/plan/projects/' + x.p.id }));
  return [];
}
export const HOME_TITLES = { pjt: '프로젝트', est: '유효 견적', bill: '청구 내역', due: '미수금 현황' };
const dayDiff = (a, b) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000);
/** 챙길 일(신규): ① 지급요청일이 지났는데 완결(수금)되지 않은 청구서 — 지난 날수 ② 지급일이 지났거나 withinDays 안으로 다가온데 지급완료되지 않은 지급예정서. 지급일이 없는 것은 제외, 오래 지난 것부터 */
export function homeTodo(settlements, today, withinDays) {
  const n = withinDays == null ? 7 : withinDays; const act = (settlements || []).filter((s) => s.status !== 'void' && s.status !== 'done' && /^\d{4}-\d{2}-\d{2}$/.test(String(s.payDate || '')));
  const row = (s) => ({ id: s.id, no: s.no || '', who: (s.recipient && s.recipient.company) || '', payDate: s.payDate, days: dayDiff(today, s.payDate), total: T(s.total) || T(s.amount) });
  const overdue = act.filter((s) => s.docType === 'invoice' && s.payDate < today).map(row).sort((a, b) => b.days - a.days);
  const payments = act.filter((s) => s.docType === 'payment' && dayDiff(s.payDate, today) <= n).map(row).sort((a, b) => b.days - a.days);
  return { overdue, payments, overdueTotal: overdue.reduce((a, r) => a + r.total, 0), paymentsTotal: payments.reduce((a, r) => a + r.total, 0) };
}
/** 이번 달 발행 요약(신규): 발행일이 그 달인 유효 청구서·지급예정서의 건수와 합계금액 */
export function homeMonth(settlements, ym) {
  const m = (settlements || []).filter((s) => s.status !== 'void' && String(s.issueDate || '').startsWith(ym)); const sum = (kind) => { const l = m.filter((s) => s.docType === kind); return { count: l.length, total: l.reduce((a, s) => a + (T(s.total) || T(s.amount)), 0) }; };
  return { invoice: sum('invoice'), payment: sum('payment') };
}
