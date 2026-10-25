/* 4대보험 월별 대조 입출력(대기열 1-3-17 1단계) — 급여명세서 회사 월 합계를 읽고, 공단 고지금액(회사 월 합계)을 저장·삭제한다. 파이어베이스 함수는 밖에서 주입(시험: tests/hr-insurance-io.test.mjs).
 * 개인별 값은 합계에 더하기만 하고 어디에도 남기지 않는다. 고지금액은 insurance_bills/{귀속월} 에 관리자만 쓴다(보안 규칙 validBill 과 같은 기준). */
export const BILL_MAX = 1000000000; // 10억 — 보안 규칙과 같은 상한
export const isMonth = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || ''));
const N = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const LABEL = { pension: '국민연금', health: '건강보험', ltcare: '장기요양', unpaid: '미납액' };
/** 입력 칸 → 저장 값. 쉼표·공백·"원"은 지우고, 정수 0~10억만 받는다. 연금·건강·장기요양은 꼭 입력(고지 없으면 0), 미납액은 비우면 0 */
export function billPatch(v) {
  const errors = []; const data = {}; const x = v || {};
  ['pension', 'health', 'ltcare', 'unpaid'].forEach((k) => {
    const raw = String(x[k] == null ? '' : x[k]).replace(/[,\s원]/g, '');
    if (raw === '') { if (k === 'unpaid') data[k] = 0; else errors.push(LABEL[k] + ' 금액을 입력해 주세요(고지가 없으면 0).'); return; }
    if (!/^\d+$/.test(raw)) { errors.push(LABEL[k] + '은 숫자(원 단위 정수)만 입력해 주세요.'); return; }
    const n = Number(raw); if (n > BILL_MAX) { errors.push(LABEL[k] + '이 너무 큽니다(10억 원 이하).'); return; } data[k] = n;
  });
  return errors.length ? { ok: false, errors } : { ok: true, errors: [], data };
}
export function makeInsuranceIo(fb) {
  const { db, doc, getDocs, collection, setDoc, deleteDoc, serverTimestamp } = fb;
  const whoOf = (by) => { const w = String(by || '').trim().toLowerCase(); if (!w) throw new Error('작업하는 사람의 이메일을 알 수 없습니다. 다시 로그인해 주세요.'); return w; };
  /** 급여명세서 회사 월 합계 { 'YYYY-MM': { count, gross, pension, health, ltcare, employ } } — 직원 전원(퇴사자 포함)의 명세서를 읽어 더한다 */
  async function loadSlipTotals() {
    const ws = await getDocs(collection(db, 'workers')); const ids = []; ws.forEach((d) => ids.push(d.id)); const out = {};
    for (const id of ids) { const s = await getDocs(collection(db, 'payslips/' + id + '/months')); s.forEach((d) => { if (!isMonth(d.id)) return; const x = d.data() || {}; const t = (out[d.id] = out[d.id] || { count: 0, gross: 0, pension: 0, health: 0, ltcare: 0, employ: 0 }); t.count++; t.gross += N(x.grossPay); t.pension += N(x.pension); t.health += N(x.health); t.ltcare += N(x.ltcare); t.employ += N(x.employ); }); }
    return out;
  }
  /** 공단 고지금액 { 'YYYY-MM': { pension, health, ltcare, unpaid, updatedBy } } */
  async function loadBills() { const s = await getDocs(collection(db, 'insurance_bills')); const out = {}; s.forEach((d) => { if (!isMonth(d.id)) return; const x = d.data() || {}; out[d.id] = { pension: N(x.pension), health: N(x.health), ltcare: N(x.ltcare), unpaid: N(x.unpaid), updatedBy: x.updatedBy || '' }; }); return out; }
  async function load() { const [payslips, bills] = await Promise.all([loadSlipTotals(), loadBills()]); return { payslips, bills }; }
  /** 저장 — 같은 달은 전체 교체(규칙이 정해진 칸만 허용). 값이 이상하면 저장하지 않고 이유와 함께 예외 */
  async function saveBill(ym, vals, by) {
    if (!isMonth(ym)) throw new Error('월 형식이 올바르지 않습니다(예: 2026-09).'); const who = whoOf(by); const r = billPatch(vals); if (!r.ok) throw new Error(r.errors[0]);
    await setDoc(doc(db, 'insurance_bills', ym), Object.assign({ ym }, r.data, { updatedAt: serverTimestamp(), updatedBy: who })); return r.data;
  }
  async function deleteBill(ym) { if (!isMonth(ym)) throw new Error('월 형식이 올바르지 않습니다(예: 2026-09).'); await deleteDoc(doc(db, 'insurance_bills', ym)); }
  return { loadSlipTotals, loadBills, load, saveBill, deleteBill };
}
