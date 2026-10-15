/* 자체 인력 인건비 — 프로젝트별 배분 (대표님 확정 2026-10-15: "월급으로 나가니까 그냥 급여로 따진다").
 * 규칙(순수 계산, 화면·네트워크 없음):
 *   직원 한 명의 그 달 급여(총지급액, 현장 직원은 전표 5110 현장노무비)를 그 달 프로젝트별 공수 비율로 나눈다.
 *   프로젝트 P 의 자체 인건비 = Σ(직원, 월) 급여 × 공수(직원, P, 월) ÷ 공수(직원, 모든 프로젝트, 월).
 *   - 연차·휴일처럼 공수가 없는 날도 급여는 그대로 — 월급 전액을 공수 비율로 나눈다(날짜 단위 보정 없음).
 *   - 그 달 공수가 0 인 직원의 급여는 어느 프로젝트에도 배분하지 않는다(간접비로 남는다 — unallocated 로 따로 돌려준다).
 *   - 같은 직원·월의 급여 전표가 여러 장이면(정정 등) 합산한다. 소수점은 마지막에 원 단위로 반올림한다(프로젝트별 합이 총액과 1원 차이날 수 있다).
 * 입력:
 *   payroll: [{ worker: '직원 키(이름 또는 id)', month: 'YYYY-MM', amount: 총지급액 }]
 *   manday:  [{ worker, month: 'YYYY-MM', pjt: '프로젝트 id', md: 공수 }]   (일자별 공수는 호출하는 쪽이 월로 합쳐 넘기거나 monthOf 로 넘긴다) */
const NUM = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const keyOf = (w, m) => String(w) + '|' + String(m);
export const monthOf = (date) => String(date || '').slice(0, 7);

/** 배분 계산. 돌려주는 값: { byPjt: { 프로젝트: 원 }, unallocated: 원, detail: [{ worker, month, pjt, amount }] } */
export function allocateOwnLabor(payroll, manday) {
  const pay = new Map(); (payroll || []).forEach((p) => { if (!p) return; const k = keyOf(p.worker, p.month); pay.set(k, (pay.get(k) || 0) + NUM(p.amount)); });
  const md = new Map(); (manday || []).forEach((m) => { if (!m) return; const v = NUM(m.md); if (!(v > 0)) return; const k = keyOf(m.worker, m.month); const cur = md.get(k) || new Map(); cur.set(m.pjt, (cur.get(m.pjt) || 0) + v); md.set(k, cur); });
  const byPjt = {}; let unallocated = 0; const detail = [];
  for (const [k, amount] of pay) {
    if (!(amount > 0)) continue; const cur = md.get(k); const [worker, month] = k.split('|');
    const total = cur ? [...cur.values()].reduce((a, b) => a + b, 0) : 0;
    if (!(total > 0)) { unallocated += amount; continue; }
    for (const [pjt, v] of cur) { const part = amount * v / total; byPjt[pjt] = (byPjt[pjt] || 0) + part; detail.push({ worker, month, pjt, amount: part }); }
  }
  Object.keys(byPjt).forEach((p) => { byPjt[p] = Math.round(byPjt[p]); });
  return { byPjt, unallocated: Math.round(unallocated), detail: detail.map((d) => Object.assign({}, d, { amount: Math.round(d.amount) })) };
}
/** 한 프로젝트의 자체 인건비(원). 기간(from~to, YYYY-MM)이 있으면 그 달 범위만 — 프로젝트 전체 누계가 기본 */
export function ownLaborOf(pjt, payroll, manday, range) {
  const r = range || {}; const inR = (m) => (!r.from || m >= r.from) && (!r.to || m <= r.to);
  const res = allocateOwnLabor((payroll || []).filter((p) => p && inR(p.month)), (manday || []).filter((m) => m && inR(m.month)));
  return res.byPjt[pjt] || 0;
}
/** 급여 전표 → payroll 입력. 현장 직원(5110 현장노무비)의 payslip 전표만 쓴다 — 간접(6010 판관비)·다른 종류 전표는 제외 */
export function payrollFromEntries(entries) {
  const out = [];
  (entries || []).forEach((e) => {
    if (!e || !e.source || e.source.kind !== 'payslip') return; const m = /^(\d{4}-\d{2})\s+급여\s+(.+?)(\s+\(현장\))?$/.exec(String(e.memo || '')); const month = m ? m[1] : monthOf(e.date);
    (e.lines || []).filter((l) => l && l.account === '5110' && l.side === 'D').forEach((l) => out.push({ worker: String(l.partner || (m && m[2]) || '').trim(), month, amount: NUM(l.amount) }));
  });
  return out.filter((p) => p.worker && p.month);
}
