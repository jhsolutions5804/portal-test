/* 퇴직금 정산 — 구포털(hr) 계산을 그대로 옮겼다. 화면·네트워크 없이 시험할 수 있는 순수 함수만 둔다.
 * 1일 평균임금 = (퇴직 전 3개월: 기본근로수당+고정연장+고정야간+주휴수당+상여금) ÷ 그 기간 일수 — 특별성과급·특근수당 제외, 정기상여·연차수당 가산 없음
 * 평균임금 < 통상임금이면 통상임금(1일 = 통상시급×8) 적용 · 계속근로 1년 미만 0원 · 퇴직금 = 적용 1일 평균임금 × 30 × (재직일수 ÷ 365)
 * ⚠️ 자동 산정 결과는 참고용이다 — 실제 지급 전 노무사 또는 관할 고용센터에 확인한다. */
import { annualSalary } from './offer.js?v=20261012m';
export const rtWon = (n) => Math.round(Number(n) || 0).toLocaleString('ko-KR');
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const daysInMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
/** payslips: [{month:'YYYY-MM', basic, fixedOt, fixedNight, weekly, bonus}], contracts: 연봉계약서 목록(최근 계약일 기준 통상임금 비교) */
export function retireCalc(worker, retireDate, payslips, contracts) {
  const w = worker || {}; const hireDate = w.hireDate || '';
  if (!hireDate) return { ok: false, error: '이 근로자의 최초입사일이 명부에 없습니다. 근로자 명부에서 입사일을 먼저 입력해 주세요.' };
  if (!isDate(retireDate)) return { ok: false, error: '퇴직일을 입력해 주세요.' };
  const serviceDays = Math.floor((Date.parse(retireDate + 'T00:00:00Z') - Date.parse(hireDate.slice(0, 10) + 'T00:00:00Z')) / 86400000);
  if (!(serviceDays > 0)) return { ok: false, error: '퇴직일이 입사일보다 빠릅니다. 날짜를 확인해 주세요.' };
  const retireYM = retireDate.slice(0, 7);
  const pays = (payslips || []).filter((p) => p.month && p.month < retireYM).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 3);
  let includedTotal = 0, periodDays = 0;
  const rows = pays.map((p) => { const base = (Number(p.basic) || 0) + (Number(p.fixedOt) || 0) + (Number(p.fixedNight) || 0) + (Number(p.weekly) || 0); const bonus = Number(p.bonus) || 0; const inc = base + bonus; const dim = daysInMonth(p.month); includedTotal += inc; periodDays += dim; return { month: p.month, base, bonus, inc, dim }; });
  const avgDaily = periodDays > 0 ? includedTotal / periodDays : 0;
  let ordDaily = 0, hasAnnual = false; const list = (contracts || []).slice();
  if (list.length) { hasAnnual = true; list.sort((a, b) => String(b.contractDate || b.id || '').localeCompare(String(a.contractDate || a.id || ''))); const a0 = list[0]; const sal = annualSalary(Number(a0.hourly) || 0); const ordHourly = (sal.basic + sal.fixedOt + sal.fixedNight + sal.weekly) / 209; ordDaily = ordHourly * 8; }
  const appliedDaily = Math.max(avgDaily, ordDaily); const substituted = ordDaily > avgDaily && ordDaily > 0; const under1y = serviceDays < 365;
  const severance = under1y ? 0 : Math.round(appliedDaily * 30 * (serviceDays / 365));
  const yLabel = Math.floor(serviceDays / 365) + '년 ' + Math.floor((serviceDays % 365) / 30) + '개월';
  const warns = []; if (pays.length < 3) warns.push('퇴직 전 급여명세서가 ' + pays.length + '개월치만 있어, 있는 만큼만 평균에 반영했습니다.'); if (!hasAnnual) warns.push('연봉계약서가 없어 통상임금 비교를 건너뛰었습니다.'); if (under1y) warns.push('계속근로기간 1년 미만으로, 법정 퇴직금은 발생하지 않습니다(0원).');
  return { ok: true, rows, includedTotal, periodDays, avgDaily, ordDaily, hasAnnual, appliedDaily, substituted, under1y, severance, serviceDays, yLabel, warns, hireDate, retireDate,
    record: { wid: w.id || '', name: w.name || '', dept: w.dept || '', rank: w.rank || '', hireDate, retireDate, serviceDays, includedTotal, periodDays, avgDaily, ordDaily, appliedDaily, substituted, under1y, severance, months: rows.map((r) => r.month) } };
}
/** 저장한 정산 내역을 퇴직일 최신순으로 */
export const retireRecordsSorted = (list) => (list || []).slice().sort((a, b) => String(b.id || b.retireDate || '').localeCompare(String(a.id || a.retireDate || '')));
