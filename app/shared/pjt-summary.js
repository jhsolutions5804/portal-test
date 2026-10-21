/* 프로젝트 청구·지급 요약 — 순수 계산(영업기획과 인사평가가 함께 쓴다, 설계: 모듈끼리 직접 참조하지 않고 공용으로 둔다).
 * 청구 누계 = 청구서(invoice, 폐기 제외), 지급 누계 = 지급예정서(payment, 폐기 제외), 손익 = 청구 − 지급, 미수금 = 청구 − 완결된 청구.
 * 여러 프로젝트를 합산한 정산서는 perPjtAmount(프로젝트별 몫)가 있으면 그 값, 없으면 pjtIds 가 둘 이상일 때 균등 분배. */
const NUM = (v) => Number(v) || 0;
export const itemAmt = (it) => { const x = it || {}; return x.amount != null ? x.amount : NUM(x.qty) * NUM(x.price); };
export const estSupply = (e) => ((e && e.items) || []).reduce((s, i) => s + itemAmt(i), 0);
export const estTotal = (e) => { const s = estSupply(e); return s + Math.round(s * 0.1); };   // 합계 = 공급가액 + 부가세 10%
export const isEstActive = (e) => !!e && e.status !== 'void' && e.status !== 'closed';
export const setActive = (s) => !!s && s.status !== 'void';
export function settleAmountForPjt(s, pid) {
  const x = s || {}; if (x.perPjtAmount && x.perPjtAmount[pid] != null) return x.perPjtAmount[pid];
  if (x.pjtIds && x.pjtIds.length > 1) return NUM(x.amount) / x.pjtIds.length; return NUM(x.amount);
}
export const settleBelongsToPjt = (s, pid) => !!s && (s.pjtId === pid || !!(s.pjtIds && s.pjtIds.includes(pid)));
const sumSet = (settlements, pid, pick) => (settlements || []).filter((s) => settleBelongsToPjt(s, pid) && pick(s)).reduce((a, s) => a + settleAmountForPjt(s, pid), 0);
/** 프로젝트 하나의 요약: 견적(유효 견적 공급가액 합)·청구·지급·완결·미수금·손익 */
export function pjtSummary(pid, estimates, settlements) {
  const est = (estimates || []).filter((e) => e.pjtId === pid && isEstActive(e)).reduce((s, e) => s + estSupply(e), 0);
  const billed = sumSet(settlements, pid, (s) => s.docType === 'invoice' && s.status !== 'void'), paid = sumSet(settlements, pid, (s) => s.docType === 'payment' && s.status !== 'void'), done = sumSet(settlements, pid, (s) => s.docType === 'invoice' && s.status === 'done');
  return { est, billed, paid, done, due: billed - done, profit: billed - paid };
}
/** 프로젝트 실투입비와 마진율(%) — 프로젝트마다 따로 (대표님 확정 2026-10-15).
 *  실투입비 = ① 지급 누계(정산서 지급예정서 — 협력사 외주·노무, 팀 공수 × 단가로 발행되므로 노무비는 여기 이미 들어 있다. 따로 또 빼면 이중 차감)
 *           + ② 직접비(재무회계 전표 중 이 프로젝트로 표시된 현장 원가 5xxx 줄. 지급예정서에서 만든 전표는 ①과 같은 돈이라 뺀다)
 *           + ③ 자체 인력 인건비(자사 직원 급여를 프로젝트 공수 비율로 배분한 값).
 *  실현 마진율 = (완결한 청구 − 프로젝트 원가) ÷ 완결한 청구 × 100 — 프로젝트 매출은 청구서를 완결 처리한 것만 센다(대표님 2026-10-21), 완결 정보(done)가 없거나 0 이하이면 청구(billed)로 대신 계산하지 않고 null(대신 계산하면 규칙이 조용히 깨진다). 목표 마진율(targetMargin)은 프로젝트 문서에 프로젝트마다 입력한다.
 *  영업기획 프로젝트 화면이 계산·표시하고, 인사평가(수시평가)는 이 값을 읽기만 한다. 전표로 통일한다: 비용장부와 전표를 함께 쓰지 않는다(이중 계상 방지). */
export function pjtCost(summary, parts) {
  const s = summary || {}, p = parts || {}; const paid = NUM(s.paid), direct = NUM(p.direct), ownLabor = NUM(p.ownLabor);
  return { paid, direct, ownLabor, total: paid + direct + ownLabor };
}
export function pjtMargin(summary, opts) {
  const s = summary || {}, o = opts || {}; const done = typeof s.done === 'number' && s.done > 0 ? s.done : 0; if (!(done > 0)) return { target: null, actual: null, diff: null, cost: pjtCost(s, o) };
  const cost = pjtCost(s, o); const actual = Math.round((done - cost.total) / done * 1000) / 10;
  const t = o.target === '' || o.target == null ? NaN : Number(o.target); const target = isFinite(t) ? t : null;
  return { target, actual, diff: target == null ? null : Math.round((actual - target) * 10) / 10, cost };
}
