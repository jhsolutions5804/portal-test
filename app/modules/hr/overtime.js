/* 초과근로 현황 — 구포털(hr)의 "초과근로수당" 탭 중 월별 전체 현황·직원별 조회·전자결재 자동연동(1단계)과 초과근로 입력·수정(3단계)을 옮겼다.
 * 출퇴근 달력(관리자 근태 수정)은 attendance.js(2단계).
 * 데이터: overtime(기록: date·name·rank·workerId·hours·amount·rate·reason·yearMonth), edoc_overtime(전자결재 초과근로 신청 — 승인된 건을 overtime 으로 한 번씩 반영).
 * 화면·네트워크 없이 시험할 수 있는 순수 함수만 둔다. */
import { annualSalary } from './offer.js?v=20261031c';
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

/** 수당 = 시간당 통상임금 × 시간 (원 단위 반올림) */
export const otAmount = (rate, hours) => Math.round((Number(rate) || 0) * (Number(hours) || 0));
export const OT_MAX_HOURS = 24;
export const otNewForm = (today) => ({ id: '', date: today || '', workerId: '', hours: '', reason: '' });
/** 저장된 기록 → 수정 양식(workerId 가 없는 옛 기록은 이름으로 근로자를 찾는다) */
export function otFormFromRecord(r, workers) { const w = (workers || []).find((x) => x.id === r.workerId) || (workers || []).find((x) => x.name === r.name); return { id: r.id, date: r.date || '', workerId: (w && w.id) || r.workerId || '', hours: String(r.hours == null ? '' : r.hours), reason: r.reason || '' }; }
/** 입력·수정 저장 내용. 연봉계약서(통상임금)가 없으면 수당 0원 — 호출한 쪽에서 확인을 받는다(noWage). 시간은 0 초과 24 이하 */
export function buildOvertime(form, worker, wage) {
  const f = form || {}; const errors = []; const hours = parseFloat(f.hours);
  if (!isDate(f.date)) errors.push('날짜를 입력해 주세요.'); if (!worker) errors.push('직원을 선택해 주세요.');
  if (!(hours > 0)) errors.push('시간을 입력해 주세요.'); else if (hours > OT_MAX_HOURS) errors.push('시간은 24시간 이하로 입력해 주세요.');
  if (errors.length) return { ok: false, errors };
  const rate = wage ? Number(wage.rate) || 0 : 0; return { ok: true, errors: [], noWage: !wage, data: { date: f.date, name: worker.name || '', rank: worker.rank || '', workerId: worker.id, hours, amount: otAmount(rate, hours), rate, reason: String(f.reason || '').trim(), yearMonth: f.date.slice(0, 7) } };
}
