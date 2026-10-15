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
