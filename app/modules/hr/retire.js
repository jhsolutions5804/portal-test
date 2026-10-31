/* 퇴직금 정산 — 2026-10-13 법정 기준 보정판(대표님 결정: 특별성과급 포함 · 퇴직일=마지막 근무일 다음 날 · 월중 퇴직은 일할). 화면·네트워크 없이 시험할 수 있는 순수 함수만 둔다.
 * · 입력의 "퇴직일"은 명부의 퇴직일 = 마지막 근무일. 법적 퇴직일(근로관계 종료일)은 그 다음 날이다 → 재직일수 = 마지막 근무일 − 입사일 + 1.
 * · 평균임금 산정기간 = 법적 퇴직일 이전 3개월(예: 마지막 근무일 10/15 → 퇴직일 10/16 → 7/16~10/15, 92일). 급여명세서는 달 단위라 걸친 달은 일수 비례(일할)로 근사한다.
 * · 임금총액 = 급여명세서 지급계(grossPay: 기본·연장·야간·주휴·휴일근로·상여·특별성과급·특근·기술수당 …, 실비변상 여비교통비 제외). 지급계가 없는 옛 명세서는 구성 항목을 합산한다.
 * · 연간 상여·연차수당(3개월 밖에 지급된 몫)은 입력받아 × 3/12 를 가산한다.
 * · 평균임금 < 통상임금이면 통상임금(1일 = 통상시급×8; 연봉계약서 기본·연장·야간·주휴 + 기술수당) · 계속근로 1년 미만 0원 · 퇴직금 = 적용 1일 평균임금 × 30 × (재직일수 ÷ 365)
 * · 퇴직금은 퇴직 후 14일 이내 지급(근로기준법 제36조), 지연 시 연 20% 지연이자 — 지급기한을 함께 안내한다.
 * ⚠️ 자동 산정 결과는 참고용이다 — 실제 지급 전 노무사 또는 관할 고용센터에 확인한다(docs/statutory-alignment.md). */
import { annualSalary } from './offer.js?v=20261031h';
import { lpDay, lpEvalWorker } from './leave-promo.js?v=20261031h';
export const rtWon = (n) => Math.round(Number(n) || 0).toLocaleString('ko-KR');
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const T = (s) => Date.parse(s + 'T00:00:00Z'); const ymd = (ms) => new Date(ms).toISOString().slice(0, 10); const DAY = 86400000;
export const rtAddDays = (s, n) => ymd(T(s) + n * DAY);
/** 월 더하기(말일은 그 달 말일로 맞춤: 5/31 − 3개월 = 2/28) */
export function rtAddMonths(s, n) { const [y, m, d] = s.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); t.setUTCDate(Math.min(d, last)); return t.toISOString().slice(0, 10); }
const dim = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const NUM = (v) => Number(v) || 0;
/** 명세서 한 달의 임금총액(퇴직금 기준): 지급계가 있으면 지급계, 없으면 구성 항목 합 */
export function rtGross(p) { const x = p || {}; if (x.grossPay != null && x.grossPay !== '' && Number.isFinite(Number(x.grossPay))) return NUM(x.grossPay); return NUM(x.basic) + NUM(x.fixedOt) + NUM(x.fixedNight) + NUM(x.weekly) + NUM(x.holidayPay) + NUM(x.bonus) + NUM(x.specialBonus) + NUM(x.extraPay) + NUM(x.techAllowance); }
/** payslips: [{month:'YYYY-MM', grossPay…}], contracts: 연봉계약서 목록, opt: { bonus12, leave12 }(퇴직 전 12개월 중 3개월 밖에 지급한 연간 상여·연차수당 합계) */
export function retireCalc(worker, lastWorkDay, payslips, contracts, opt) {
  const w = worker || {}; const hireDate = String(w.hireDate || '').slice(0, 10);
  if (!hireDate) return { ok: false, error: '이 근로자의 최초입사일이 명부에 없습니다. 근로자 명부에서 입사일을 먼저 입력해 주세요.' };
  if (!isDate(lastWorkDay)) return { ok: false, error: '퇴직일(마지막 근무일)을 입력해 주세요.' };
  if (!isDate(hireDate)) return { ok: false, error: '근로자 명부의 입사일 형식이 올바르지 않습니다.' };
  const legalRetire = rtAddDays(lastWorkDay, 1); const serviceDays = Math.round((T(legalRetire) - T(hireDate)) / DAY);
  if (!(T(lastWorkDay) >= T(hireDate))) return { ok: false, error: '퇴직일이 입사일보다 빠릅니다. 날짜를 확인해 주세요.' };
  const periodStart = rtAddMonths(legalRetire, -3); const periodDays = Math.round((T(legalRetire) - T(periodStart)) / DAY); const lastDay = lastWorkDay;
  const byMonth = {}; (payslips || []).forEach((p) => { if (p && p.month) byMonth[p.month] = p; });
  const months = []; for (let cur = periodStart.slice(0, 7); cur <= lastDay.slice(0, 7); cur = rtAddMonths(cur + '-01', 1).slice(0, 7)) months.push(cur);
  let includedTotal = 0; const missing = []; const rows = months.slice().reverse().map((mo) => {
    const mStart = mo + '-01', mEnd = mo + '-' + String(dim(mo)).padStart(2, '0'); const a = Math.max(T(periodStart), T(mStart)), b = Math.min(T(lastDay), T(mEnd)); const overlap = Math.max(0, Math.round((b - a) / DAY) + 1); const p = byMonth[mo];
    if (!p) { missing.push(mo); return { month: mo, gross: 0, overlap, dim: dim(mo), part: 0, has: false, full: overlap === dim(mo) }; }
    const gross = rtGross(p); const part = overlap === dim(mo) ? gross : gross * overlap / dim(mo); includedTotal += part;
    return { month: mo, gross, bonus: NUM(p.bonus), overlap, dim: dim(mo), part, has: true, full: overlap === dim(mo), tech: NUM(p.techAllowance) };
  });
  const o = opt || {}; const bonus12 = NUM(o.bonus12), leave12 = NUM(o.leave12); const addon = (bonus12 + leave12) * 3 / 12;
  const avgDaily = periodDays > 0 ? (includedTotal + addon) / periodDays : 0;
  let ordDaily = 0, hasAnnual = false; const list = (contracts || []).slice();
  if (list.length) { hasAnnual = true; list.sort((a, b) => String(b.contractDate || b.id || '').localeCompare(String(a.contractDate || a.id || ''))); const a0 = list[0]; const sal = annualSalary(Number(a0.hourly) || 0); const latest = rows.find((r) => r.has && r.tech > 0); const tech = latest ? latest.tech : 0; ordDaily = ((sal.basic + sal.fixedOt + sal.fixedNight + sal.weekly + tech) / 209) * 8; }
  const appliedDaily = Math.max(avgDaily, ordDaily); const substituted = ordDaily > avgDaily && ordDaily > 0; const under1y = serviceDays < 365;
  const severance = under1y ? 0 : Math.round(appliedDaily * 30 * (serviceDays / 365));
  const yLabel = Math.floor(serviceDays / 365) + '년 ' + Math.floor((serviceDays % 365) / 30) + '개월'; const payDeadline = rtAddDays(legalRetire, 14);
  const warns = [];
  if (missing.length) warns.push('급여명세서가 없는 달이 있어 있는 만큼만 평균에 반영했습니다: ' + missing.slice().reverse().join(', ') + (missing.includes(lastDay.slice(0, 7)) ? ' (퇴직월 급여명세서는 퇴직 정산 전에 먼저 작성해 두세요)' : ''));
  if (rows.some((r) => r.has && !r.full)) warns.push('퇴직일이 월 중간이라 걸친 달은 일수 비례(일할)로 계산했습니다 — 실제 일별 급여와 다를 수 있습니다.');
  if (!hasAnnual) warns.push('연봉계약서가 없어 통상임금 비교를 건너뛰었습니다.'); if (under1y) warns.push('계속근로기간 1년 미만으로, 법정 퇴직금은 발생하지 않습니다(0원).');
  return { ok: true, rows, includedTotal, addon, bonus12, leave12, periodStart, periodDays, avgDaily, ordDaily, hasAnnual, appliedDaily, substituted, under1y, severance, serviceDays, yLabel, warns, missing, hireDate, retireDate: lastWorkDay, legalRetire, payDeadline,
    record: { wid: w.id || '', name: w.name || '', dept: w.dept || '', rank: w.rank || '', hireDate, retireDate: lastWorkDay, legalRetireDate: legalRetire, periodStart, serviceDays, includedTotal, addon, periodDays, avgDaily, ordDaily, appliedDaily, substituted, under1y, severance, payDeadline, months: rows.map((r) => r.month) } };
}
/** 저장한 정산 내역을 퇴직일 최신순으로 */
export const retireRecordsSorted = (list) => (list || []).slice().sort((a, b) => String(b.id || b.retireDate || '').localeCompare(String(a.id || a.retireDate || '')));

/** 퇴직 시 미사용 연차 정산(참고용) — 법적 퇴직일 기준 연차 현황(구간별 부여·사용·잔여)에서 잔여일 × 통상일급.
 *  연차사용촉진 절차를 이행한 구간(2차 지정통보 완료 또는 사용계획 회신 완료)은 미사용 연차가 소멸해 수당 지급 의무가 없을 수 있어 대상에서 뺀다(상태는 그대로 보여 준다).
 *  ⚠️ 퇴직 시 미사용 연차수당의 법적 처리(퇴직금 평균임금 3/12 가산 대상 여부, 회계연도 기준 부여분의 정산 방식)는 노무사 확인이 필요하다 — 결과는 "연차수당 합계" 입력에 넣어 볼 수 있는 참고 값이다. */
export function retireLeavePay(worker, legalRetire, leaves, recs, ordDaily) {
  const w = worker || {}; const today = lpDay(legalRetire); if (!today || !w.hireDate) return { ok: false, reason: '입사일 또는 퇴직일이 없어 계산할 수 없습니다.' };
  const ev = lpEvalWorker(w, today, leaves || [], recs || []); if (ev.skip) return { ok: false, reason: ev.skip };
  const rows = ev.list.map((e) => { const exempt = !!(e.r2 || e.state === 'replied' || e.state === 'done'); return { cat: e.p.cat, title: e.p.title || e.p.cat, granted: e.granted, used: e.used, remain: e.remain, exempt, label: e.label, payDays: exempt ? 0 : e.remain }; });
  const days = rows.reduce((s, x) => s + x.payDays, 0); const perDay = NUM(ordDaily) > 0 ? NUM(ordDaily) : 0;
  return { ok: true, rows, days, perDay, hasPerDay: perDay > 0, amount: Math.round(days * perDay) };
}
