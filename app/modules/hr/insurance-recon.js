/* 월별 4대보험 대조표 — 순수 계산 함수(저장 없음). 시험: tests/hr-insurance-recon.test.mjs · 대기열 1-3-17 "4대보험 신고 보조 툴 + 월별 보험료 대조" 1단계. 서버 저장소 functions/insurance-recon.js 와 같은 계산(앱에서 쓰려고 옮김 — 한쪽을 고치면 다른 쪽도 같이 고칠 것).
 * 급여명세서 근로자 공제 합(회사 월 합계)과 공단 고지금액(근로자+사업주 합)을 월별로 맞춰, 사업주 실부담·미납·급증·이상 비율을 찾는다. 개인별 값은 받지도 돌려주지도 않는다(회사 월 합계만).
 * 입력 { payslips: { 'YYYY-MM': { count, gross, pension, health, ltcare, employ } }, bills: { 'YYYY-MM': { pension, health, ltcare, unpaid } }, offset?, jumpFactor?, ratioTol?, employRate?, employTol? }
 * bills 의 월 = 고지월, payslips 의 월 = 급여 귀속월, 고지월 = 급여월 + offset(정수, 기본 0). 연금·건강·장기요양은 사업주·근로자 동률이라 고지의 절반이 근로자분이어야 한다. */
const amt = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
const isM = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const shift = (m, k) => { const [y, mo] = m.split('-').map(Number); const t = y * 12 + (mo - 1) + k; return Math.floor(t / 12) + '-' + String(t % 12 + 1).padStart(2, '0'); };
const rate4 = (x) => Math.round(x * 10000) / 10000;
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const opt = (v, d) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : d);
function cleanMap(src, keys) { const out = {}; Object.keys(obj(src)).forEach((m) => { if (!isM(m)) return; const o = {}; keys.forEach((k) => { o[k] = amt(obj(src[m])[k]); }); out[m] = o; }); return out; }
function emptyResult() { return { rows: [], totals: { monthsCompared: 0, gross: 0, employee: 0, bill: 0, employerByBill: 0, employeeShareOfGross: null, billHalfShareOfGross: null, unpaid: 0 } }; }
function comp(employee, bill) {
  const e = employee === null ? null : employee, b = bill === null ? null : bill; const parity = b === null ? null : Math.round(b / 2);
  return { bill: b, employee: e, employerByBill: e === null || b === null ? null : b - e, employerParity: parity, gap: e === null || parity === null ? null : e - parity, ratio: e === null || b === null || b <= 0 ? null : rate4(e / b) };
}
function reconcile(input) {
  const i = obj(input); if (!Object.keys(i).length) return emptyResult();
  const offset = Number.isInteger(i.offset) ? i.offset : 0; const jumpFactor = opt(i.jumpFactor, 1.8), ratioTol = opt(i.ratioTol, 0.1), employRate = opt(i.employRate, 0.009), employTol = opt(i.employTol, 0.05);
  const ps = cleanMap(i.payslips, ['count', 'gross', 'pension', 'health', 'ltcare', 'employ']); const bs = cleanMap(i.bills, ['pension', 'health', 'ltcare', 'unpaid']);
  const months = Array.from(new Set(Object.keys(ps).concat(Object.keys(bs).map((bm) => shift(bm, -offset))))).sort();
  const rows = []; let lastBill = null; const T = { monthsCompared: 0, gross: 0, employee: 0, bill: 0, employerByBill: 0, unpaid: 0 };
  months.forEach((month) => {
    const p = ps[month] || null; const billMonth = shift(month, offset); const b = bs[billMonth] || null; const flags = [];
    const pension = comp(p ? p.pension : null, b ? b.pension : null), health = comp(p ? p.health : null, b ? b.health : null), ltcare = comp(p ? p.ltcare : null, b ? b.ltcare : null);
    const expected = p ? Math.round(p.gross * employRate) : null; const employ = { employee: p ? p.employ : null, expected, diff: p ? p.employ - expected : null };
    if (p && !b) flags.push('noBill'); if (!p && b) flags.push('noPayslip');
    if (p && b) { if (pension.ratio !== null && Math.abs(pension.ratio - 0.5) > ratioTol) flags.push('pensionRatioOff'); if (health.ratio !== null && Math.abs(health.ratio - 0.5) > ratioTol) flags.push('healthRatioOff'); }
    if (p && p.gross > 0 && Math.abs(employ.diff) > Math.max(10, expected * employTol)) flags.push('employOff');
    if (b && b.unpaid > 0) flags.push('unpaid');
    if (b && lastBill && ((lastBill.pension > 0 && b.pension > lastBill.pension * jumpFactor) || (lastBill.health + lastBill.ltcare > 0 && b.health + b.ltcare > (lastBill.health + lastBill.ltcare) * jumpFactor))) flags.push('jump');
    if (b) lastBill = b;
    if (p && b) { T.monthsCompared++; T.gross += p.gross; T.employee += p.pension + p.health + p.ltcare; T.bill += b.pension + b.health + b.ltcare; }
    if (b) T.unpaid += b.unpaid;
    rows.push({ month, billMonth, payslip: p ? { count: p.count, gross: p.gross } : null, bill: b ? { pension: b.pension, health: b.health, ltcare: b.ltcare } : null, pension, health, ltcare, employ, unpaid: b ? b.unpaid : null, flags });
  });
  T.employerByBill = T.bill - T.employee; T.employeeShareOfGross = T.gross > 0 ? rate4(T.employee / T.gross) : null; T.billHalfShareOfGross = T.gross > 0 ? rate4(T.bill / 2 / T.gross) : null;
  return { rows, totals: T };
}
export { reconcile };
