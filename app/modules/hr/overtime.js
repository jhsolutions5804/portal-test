/* 초과근로 현황 — 구포털(hr)의 "초과근로수당" 탭 중 월별 전체 현황·직원별 조회·전자결재 자동연동을 옮겼다(1단계).
 * 출퇴근 달력(관리자 근태 수정)과 초과근로 입력·수정은 2·3단계에서 옮긴다.
 * 데이터: overtime(기록: date·name·rank·workerId·hours·amount·rate·reason·yearMonth), edoc_overtime(전자결재 초과근로 신청 — 승인된 건을 overtime 으로 한 번씩 반영).
 * 화면·네트워크 없이 시험할 수 있는 순수 함수만 둔다. */
import { annualSalary } from './offer.js?v=20261012q';
const pad = (n) => String(n).padStart(2, '0');
export const otYm = (y, m) => y + '-' + pad(m);
export function otMoveMonth(y, m, delta) { const d = new Date(y, m - 1 + delta, 1); return { y: d.getFullYear(), m: d.getMonth() + 1 }; }
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
/** 전자결재 초과근로 → overtime 기록. 문서 번호를 그대로 쓰는 고정 번호(edoc_<신청서 번호>)라 같은 신청서는 몇 번을 반영해도 한 건이다 */
export function otSyncPlan(edocDocs) {
  const items = [], skipped = [];
  (edocDocs || []).forEach((p) => {
    if (!(p && p.status === 'approved' && !p.linkedToOvertime)) return;
    if (!isDate(p.date)) { skipped.push({ id: p.id, reason: '날짜가 올바르지 않아 건너뜀' }); return; }
    items.push({ id: p.id, otId: 'edoc_' + p.id, record: { date: p.date, name: p.name || '', rank: p.rank || '', workerId: p.workerId || '', hours: Number(p.hours) || 0, amount: Number(p.amount) || 0, rate: Number(p.rate) || 0, reason: p.reason || '', yearMonth: p.date.slice(0, 7), edocId: p.id } });
  });
  return { items, skipped };
}
/** 연봉계약서(최근) → 통상임금: 시간당 = (기본+고정연장+고정야간+주휴)÷209 반올림 */
export function otWage(contract, workerId) {
  if (!contract) return null; const hourly = Number(contract.hourly || 0); const sal = annualSalary(hourly);
  return Object.assign({ rate: Math.round((sal.basic + sal.fixedOt + sal.fixedNight + sal.weekly) / 209), hourly, empType: contract.empType || 'field', workerId: workerId || '', wageType: contract.wageType || '', fixedOTContract: Number(contract.fixedOT || 0) }, sal);
}
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
/** 월별 전체 현황: 직원별 합계(이름 가나다순)·총 시간·총 수당·날짜별 내역 */
export function otSummary(rows) {
  const totals = {}; (rows || []).forEach((r) => { const t = totals[r.name] || (totals[r.name] = { hours: 0, amount: 0, rank: r.rank || '' }); t.hours += Number(r.hours || 0); t.amount += Number(r.amount || 0); });
  const names = Object.keys(totals).sort((a, b) => a.localeCompare(b, 'ko')); const round = (x) => Math.round(x * 100) / 100;
  return { totals, names, totalHours: round(names.reduce((s, n) => s + totals[n].hours, 0)), totalAmount: names.reduce((s, n) => s + totals[n].amount, 0), rows: (rows || []).slice().sort(byDate) };
}
export function otPerson(rows, name) { const mine = (rows || []).filter((r) => r.name === name).sort(byDate); return { rows: mine, totalHours: Math.round(mine.reduce((s, r) => s + Number(r.hours || 0), 0) * 100) / 100, totalAmount: mine.reduce((s, r) => s + Number(r.amount || 0), 0) }; }
