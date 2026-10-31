/* 급여명세서 계산 — 구포털(hr) psCalcAll 과 근태 집계(psFetchAttendanceData)·야간/주휴/휴일 수당·여비교통비를 그대로 옮긴 순수 함수.
 * 화면·네트워크 없이 시험할 수 있다. 기준(구포털과 같음):
 *  · 기본근로수당 금액은 시급×173.8h(연봉계약서 산식), 초과/부족 판정은 그 달 소정근로시간(평일×8h, 공휴일 제외) 대비 실근무+유급휴가
 *  · 충족하면 초과분 × 시급 × 1.5 = 연장근로수당, 못 채우면 부족분 × 시급을 기본근로수당에서 차감
 *  · 야간근로수당 = 22:00~06:00 실근무 × 시급 × 0.5, 주휴수당 = 시급×8×(그 주 소정근로일 개근한 주 수), 휴일근로수당 = 8h 이내 ×1.5 + 초과 ×2.0
 *  · 4대보험: 국민연금 4.5% · 건강보험 3.545% · 장기요양 건강보험료×12.81% · 고용보험 0.9%, 소득세 간이세액표(공제대상 가족·자녀·원천징수 비율 반영) + 지방소득세 10%(10원 미만 절사)
 *  · 지급계(4대보험 산정 기준) = 급여 + 상여 + 특별성과급 + 특근수당 + 기술수당, 여비교통비는 실비변상이라 제외하고 실수령에만 더한다 */
import { annualSalary } from './offer.js?v=20261031h';
import { monthlyStandardHours } from '../../shared/worktime.js?v=20261031h';
import { computeLeaveHoursForMonth } from '../../shared/leave-hours.js?v=20261031h';
import { lookupIncomeTax, localIncomeTax } from '../../shared/tax-table.js?v=20261031h';
const pad = (n) => String(n).padStart(2, '0');
const N = (v) => Number(v || 0) || 0;
export const PS_DOC_VER = 'v7';   // 급여명세서 양식 v7(2026-10-13~): 4대보험 요율을 급여 월의 법정 요율로 계산·표기(payslip-doc.js). 근로·연봉계약서는 v6 그대로
export const PS_TRAVEL_PER_DAY = { personal_near: 10000, personal_far: 20000, company_car: 10000 };
export const PS_LONGTRIP_WEEKLY_MAX = 5;
export const PS_TRAVEL_LABEL = { personal_near: '🚗 개인차량 · 40km 이내 (1만원/일)', personal_far: '🚗 개인차량 · 40km 초과 (2만원/일)', company_car: '🚙 회사차량 (거리무관 1만원/일)', longtrip: '🚄 지방장기출장 · 왕복KTX 실비' };
/** 4대보험 근로자 부담 요율(법정, 적용 시작 월 기준). 장기요양은 근로자 건강보험료에 곱하는 비율.
 *  2025: 국민연금 4.5%·건강 3.545%·장기요양 12.95% / 2026: 국민연금 4.75%·건강 3.595%·장기요양 13.14%(국민연금 매년 0.5%p↑, 건강·장기요양은 고시) / 고용보험 0.9%.
 *  첫 줄(~2024)은 이식 이전 구포털이 쓰던 값 — 오래된 월을 다시 만들 때 그대로 재현하려고 남겨 둔다. ※ 국민연금 기준소득월액 상·하한·단수 처리는 공단 고지서와 대조해 보완한다(docs/statutory-alignment.md). */
export const PS_PAY_FACTOR = 8 * 5 * 4.345 + 8 * 4.345;   // 월 환산 시간 208.56 (contract-v7.js PAY_FACTOR 와 같은 값)
export const INSURANCE_RATES = [
  { from: '2000-01', label: '2024년까지(구포털 이식 값)', pension: 0.045, health: 0.03545, ltcare: 0.1281, employ: 0.009 },
  { from: '2025-01', label: '2025년', pension: 0.045, health: 0.03545, ltcare: 0.1295, employ: 0.009 },
  { from: '2026-01', label: '2026년', pension: 0.0475, health: 0.03595, ltcare: 0.1314, employ: 0.009 },
];
export function insuranceRates(month) { const m = /^\d{4}-\d{2}$/.test(month || '') ? month : '9999-12'; let r = INSURANCE_RATES[0]; INSURANCE_RATES.forEach((x) => { if (x.from <= m) r = x; }); return r; }
/** 급여 지급일: 기준월의 다음 달 말일 */
export function psPayDate(month) { if (!/^\d{4}-\d{2}$/.test(month || '')) return ''; const [y, m] = month.split('-').map(Number); const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1; return ny + '-' + pad(nm) + '-' + pad(new Date(ny, nm, 0).getDate()); }
/** 근로소득 간이세액표(소득세법 시행령 별표 2, 2026-03-01 지급분부터 시행하는 2026.2.27 개정판) 조회 — 월급여(비과세·학자금 제외) × 공제대상 가족 수 × 8~20세 자녀 수 × 원천징수 비율. 옛 근사식(부양가족 1인 5구간)을 대체한다(대기열 1-3, 2026-10-23).
 * opts: { family(본인 포함, 기본 1) · children(8~20세 자녀 수, 기본 0) · rate(80|100|120, 기본 100) · payMonth('YYYY-MM' 급여월 — 자녀 공제액의 개정판을 가른다) } — 자세한 규칙은 shared/tax-table.js */
export function calcIncomeTax(taxable, opts) { return lookupIncomeTax(taxable, opts); }
/** 기술수당 = 근로자 명부 자격증 개수(빈 항목 제외, 옛 hasCertification 은 1개) × 자격증 1개당 단가 */
export function techAllowance(worker, perCert) { if (!worker) return 0; const certs = worker.certifications && worker.certifications.length ? worker.certifications.filter((c) => c && String(c).trim()) : (worker.hasCertification ? ['(구버전 등록분)'] : []); return certs.length * (perCert == null ? 50000 : perCert); }
/** 22:00~익일 06:00 근무시간(h) — 자정을 넘기는 근무와 새벽대 근무(03:00~11:00) 모두 처리 */
export function nightHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0; const [ih, im] = checkIn.split(':').map(Number); const [oh, om] = checkOut.split(':').map(Number); const startMin = ih * 60 + im; let endMin = oh * 60 + om; if (endMin <= startMin) endMin += 24 * 60; let mins = 0;
  for (const [ws, we] of [[-120, 360], [1320, 1800]]) { const os = Math.max(startMin, ws), oe = Math.min(endMin, we); if (oe > os) mins += oe - os; } return mins / 60;
}
function isoWeekKey(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dayNum = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - dayNum + 3); const ft = new Date(Date.UTC(t.getUTCFullYear(), 0, 4)); const wn = 1 + Math.round(((t - ft) / 86400000 - 3 + (ft.getUTCDay() + 6) % 7) / 7); return t.getUTCFullYear() + '-W' + wn; }
/** 주휴수당(근기법 55조): 그 주 소정근로일(평일, 공휴일 제외)을 모두 출근 또는 승인된 휴가로 채운 주만 인정, 1주 = 시급×8. 그 달 출퇴근 기록이 전혀 없으면 고정값(fallbackWeekly)으로 추정 */
export function weeklyHolidayPay(hourly, year, month, attDates, leaveDocs, workerName, fallbackWeekly, holidaySet) {
  if (!attDates || attDates.size === 0) return { weeklyPay: Math.round(fallbackWeekly || 0), qualifyingWeeks: null, totalWeeks: null, weekDetails: [], estimated: true };
  const covered = (ds) => (leaveDocs || []).some((lv) => (lv.status === 'approved' || lv.status === 'posted') && (lv.authorName || lv.name || '') === workerName && lv.startDate && lv.endDate && ds >= lv.startDate && ds <= lv.endDate);
  const weekMap = {}; const last = new Date(year, month, 0);
  for (let cur = new Date(year, month - 1, 1); cur <= last; cur.setDate(cur.getDate() + 1)) { const dow = cur.getDay(); const ds = cur.getFullYear() + '-' + pad(cur.getMonth() + 1) + '-' + pad(cur.getDate()); if (dow !== 0 && dow !== 6 && !(holidaySet && holidaySet.has(ds))) (weekMap[isoWeekKey(cur)] = weekMap[isoWeekKey(cur)] || []).push(ds); }
  let q = 0; const weekDetails = []; for (const [wk, dates] of Object.entries(weekMap)) { const allPresent = dates.every((d) => attDates.has(d) || covered(d)); if (allPresent) q++; weekDetails.push({ week: wk, dates, allPresent, meetsHours: true, qualifies: allPresent }); }
  return { weeklyPay: Math.round((hourly || 0) * 8 * q), qualifyingWeeks: q, totalWeeks: Object.keys(weekMap).length, weekDetails, estimated: false };
}
/** 휴일근로수당(근기법 56조 2항): 8시간 이내 ×1.5, 초과 ×2.0 — 그 시간의 정상임금 포함 총액 */
export function holidayPay(hourly, records) { if (!hourly || !records || !records.length) return { holidayPay: 0, holidayHours: 0 }; let pay = 0, hours = 0; for (const r of records) { const h = Number(r.workHours) || 0; if (h <= 0) continue; hours += h; pay += Math.round(hourly * Math.min(h, 8) * 1.5) + Math.round(hourly * Math.max(0, h - 8) * 2.0); } return { holidayPay: pay, holidayHours: hours }; }
/** 그 달 출퇴근 기록(worker_attendance_log)·휴가 문서로 급여 계산용 근태 집계 — 주말·공휴일 근무는 평일 시간에서 빼고 휴일근로로 따로 모은다 */
export function attendanceData(rows, leaveDocs, workerName, month, holidaySet) {
  const [year, mm] = String(month || '').split('-').map(Number); const out = { attHours: 0, leaveHours: 0, nightHours: 0, attDates: new Set(), leaveDocs: leaveDocs || [], holidayRecords: [], businessTrips: [] };
  (rows || []).forEach((d) => { const hrs = Number(d.workHours) || 0; if (d.date) out.attDates.add(d.date); const dow = d.date ? new Date(d.date + 'T00:00:00').getDay() : -1; const off = dow === 0 || dow === 6 || (d.date && holidaySet && holidaySet.has(d.date)); if (off) out.holidayRecords.push({ date: d.date, workHours: hrs }); else out.attHours += hrs; out.nightHours += nightHours(d.checkIn, d.checkOut); if (d.isBusinessTrip) out.businessTrips.push({ date: d.date, tripType: d.tripType || 'personal_near' }); });
  if (workerName && year && mm) out.leaveHours = computeLeaveHoursForMonth(leaveDocs || [], workerName, year, mm); return out;
}
/** 여비교통비 */
export function travelItemAmount(item) { if (!item) return 0; if (item.type === 'longtrip') return N(item.tripCount) * N(item.perTrip); const per = PS_TRAVEL_PER_DAY[item.type]; if (per !== undefined) return per * N(item.days); return N(item.amount); }
export const travelTotal = (items) => (items || []).reduce((s, it) => s + travelItemAmount(it), 0);
/** 근태의 출장 기록 → 이동유형별 여비교통비 항목(장거리는 왕복 횟수만 채우고 1회 비용은 직접 입력) */
export function travelFromTrips(trips) { const counts = {}; (trips || []).forEach((t) => { const k = t.tripType || 'personal_near'; counts[k] = (counts[k] || 0) + 1; }); return Object.keys(counts).map((type) => (type === 'longtrip' ? { type: 'longtrip', tripCount: counts[type], perTrip: 0 } : { type, days: counts[type] })); }
export function travelSet(item, field, value) { const it = Object.assign({}, item); if (field === 'type') it.type = value; else it[field] = Math.max(0, Number(value) || 0); return it; }
/** 급여 계산. in: { hourly, wageType, fixedOT, fixedNight, month, attHours, leaveHours, nightHours, attDates, leaveDocs, workerName, holidayRecords, holidaySet, bonus, specialBonus, extraPay, techAllowance, travelAllowance, dormitory, o: {직접 고친 값 basic·fixedOt·fixedNight·weekly·holidayPay·pension·health·ltcare·employ·incomeTax·localTax} } */
export function payslipCalc(inp) {
  const x = inp || {}; const o = x.o || {}; const hourly = N(x.hourly); const hasContract = hourly > 0 || x.hasContract; const ordExtra = N(x.ordinaryExtra); const rate = hourly > 0 && ordExtra > 0 ? hourly + ordExtra / PS_PAY_FACTOR : hourly; const sal0 = hasContract ? annualSalary(hourly) : { basic: 0, fixedOt: 0, fixedNight: 0, weekly: 0, total: 0 };   // rate: v7 계약서의 통상임금 포함 항목 반영 단가 = (기본+주휴+통상 포함 항목)÷208.56 — 항목이 없으면 hourly 와 같다
  const attHours = N(x.attHours), leaveHours = N(x.leaveHours), nightH = N(x.nightHours); const actual = attHours + leaveHours; const [py, pm] = String(x.month || '').split('-').map(Number); const threshold = py && pm ? monthlyStandardHours(py, pm, x.holidaySet) : 209; const diff = actual - threshold; const comp = x.wageType === 'comprehensive';
  let basicAuto = sal0.basic, otHours = 0, otPayAuto = 0, shortHours = 0, shortDeduct = 0;
  if (hourly > 0 && hasContract) { if (diff >= 0) { otHours = diff; otPayAuto = comp ? N(x.fixedOT) : Math.round(rate * otHours * 1.5); } else { shortHours = -diff; shortDeduct = Math.round(hourly * shortHours); basicAuto = Math.max(0, sal0.basic - shortDeduct); otPayAuto = comp ? N(x.fixedOT) : 0; } }
  const nightPayAuto = comp ? N(x.fixedNight) : (hourly > 0 ? Math.round(rate * nightH * 0.5) : 0);
  const wk = py && pm ? weeklyHolidayPay(rate, py, pm, x.attDates, x.leaveDocs, x.workerName, sal0.weekly, x.holidaySet) : { weeklyPay: sal0.weekly, qualifyingWeeks: null, totalWeeks: null, weekDetails: [], estimated: true };
  const hol = holidayPay(rate, x.holidayRecords); const pick = (k, auto) => (o[k] !== undefined && o[k] !== null ? Number(o[k]) : auto);
  const pBasic = pick('basic', basicAuto), pOt = pick('fixedOt', otPayAuto), pNight = pick('fixedNight', nightPayAuto), pWeekly = pick('weekly', wk.weeklyPay), pHoliday = pick('holidayPay', hol.holidayPay);
  const sal = Object.assign({}, sal0, { basic: pBasic, fixedOt: pOt, fixedNight: pNight, weekly: pWeekly, holidayPay: pHoliday, total: pBasic + pOt + pNight + pWeekly + pHoliday, isComprehensive: comp, attHours, leaveHours, nightHours: nightH, actualHours: actual, standardHours: threshold, otHours, shortHours, shortDeduct, holidayHours: hol.holidayHours, weeklyQualifyingWeeks: wk.qualifyingWeeks, weeklyTotalWeeks: wk.totalWeeks, weeklyEstimated: wk.estimated, weeklyDetails: wk.weekDetails });
  if (sal0.annual !== undefined) sal.annual = sal.total * 12;
  const bonus = N(x.bonus), specialBonus = N(x.specialBonus), extraPay = N(x.extraPay), tech = N(x.techAllowance), travel = N(x.travelAllowance); const contractItems = (Array.isArray(x.contractItems) ? x.contractItems : []).map((r) => ({ name: String((r && r.name) || '').trim(), amount: Math.max(0, Math.round(N(r && r.amount))), ordinary: !!(r && r.ordinary) })).filter((r) => r.name && r.amount > 0); const contractItemsTotal = contractItems.reduce((a, r) => a + r.amount, 0); const totalPay = sal.total + bonus + specialBonus + extraPay + tech + contractItemsTotal;   // 계약서 지급 항목(직책수당 등)은 임금이라 4대보험·소득세 기준에 들어간다
  const R = insuranceRates(x.month); const health0 = Math.round(totalPay * R.health); const inTax0 = calcIncomeTax(totalPay, { family: x.taxFamily, children: x.taxChildren, rate: x.taxRate, payMonth: x.month });
  const pension = pick('pension', Math.round(totalPay * R.pension)), health = pick('health', health0), ltcare = pick('ltcare', Math.round(health0 * R.ltcare)), employ = pick('employ', Math.round(totalPay * R.employ)), incomeTax = pick('incomeTax', inTax0), localTax = pick('localTax', localIncomeTax(inTax0));   // 지방소득세 = 소득세(자동 계산값)의 10%, 10원 미만 절사 — 소득세를 직접 고쳐도 지방소득세는 따라가지 않는다(기존 동작)
  const dormitory = N(x.dormitory); const totalDeduct = pension + health + ltcare + employ + dormitory + incomeTax + localTax;
  return { sal, bonus, specialBonus, extraPay, techAllowance: tech, travelAllowance: travel, contractItems, contractItemsTotal, ordinaryHourly: rate, totalPay, pension, health, ltcare, employ, dormitory, incomeTax, localTax, totalDeduct, netPay: totalPay - totalDeduct + travel, rates: { pension: R.pension, health: R.health, ltcare: R.ltcare, employ: R.employ } };
}
/** 저장 문서(payslips/{근로자}/months/{YYYY-MM}) — 구포털과 같은 필드 */
export function payslipRecord(w, annualData, month, payDate, bankAccount, c, travelItems, now, workDays) {
  const x = w || {}; const wd = workDays === undefined || workDays === null || workDays === '' || !Number.isFinite(Number(workDays)) ? {} : { workDays: Number(workDays) }; return Object.assign({ month, payDate, bankAccount: bankAccount || '', name: x.name || '', dept: x.dept || '', rank: x.rank || '', empNo: x.empNo || '', hourly: (annualData && annualData.hourly) || 0, empType: x.empType || 'field' }, c.sal, { bonus: c.bonus, specialBonus: c.specialBonus, extraPay: c.extraPay, techAllowance: c.techAllowance, travelAllowance: c.travelAllowance, travelItems: travelItems || [], grossPay: c.totalPay, pension: c.pension, health: c.health, ltcare: c.ltcare, employ: c.employ, dormitory: c.dormitory, incomeTax: c.incomeTax, localTax: c.localTax, totalDeduct: c.totalDeduct, netPay: c.netPay, insRates: c.rates || null, savedAt: now || new Date().toISOString(), tplVer: PS_DOC_VER }, wd, (c.contractItems && c.contractItems.length) ? { contractItems: c.contractItems, contractItemsTotal: c.contractItemsTotal } : {});   // 계약서 지급 항목이 없으면 필드 자체를 넣지 않아 기존 저장 문서와 같다
}
