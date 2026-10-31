/* 영업기획 정산서(청구서·지급예정서) — 순수 규칙(화면·네트워크 없이 시험 가능). 구포털 기획(gihoek)의 정산 목록·상세·상태 처리 규칙을 그대로 옮겼다.
 * 상태: active(유효) → done(청구서는 "완결 = 수금", 지급예정서는 "지급완료") → 취소하면 active. 폐기(void)는 집계에서 제외되고, 폐기된 정산서만 삭제할 수 있다.
 * 지급예정서가 완결되면 회계 장부의 직접비(용역비)로 반영되고 그때의 계상월은 acctMonth(없으면 지급일→발행일→기준월 순)다. */
import { setActive, settleAmountForPjt } from './projects.js?v=20261031f';
export { setActive, settleAmountForPjt };
export const SETTLE_PAGE_SIZE = 10;
export const SETTLE_LABEL = { invoice: '대금청구서', payment: '지급예정서' };
export const METHOD_LABEL = { progress: '공정 자동', qty: '수량정산', manday: '공수', manual: '직접입력' };
const T = (s) => Number(s && s.total) || 0;
/** 목록 필터(구포털 renderSettle): 구분·현장(공동 발행분 포함)·수신처·상태(done=완결, pending=완결이 아닌 것 — 폐기 포함)·발행월 */
export function filterSettlements(list, f) {
  const o = f || {};
  return (list || []).filter((s) => {
    if (o.docType && s.docType !== o.docType) return false;
    if (o.pjtId === '__none') { if (s.pjtId || (s.pjtIds && s.pjtIds.length)) return false; }   // 프로젝트 없는 정산서('해당 없음')
    else if (o.pjtId && !(s.pjtId === o.pjtId || (s.pjtIds && s.pjtIds.includes(o.pjtId)))) return false;
    if (o.client && (s.recipient && s.recipient.company) !== o.client) return false;
    if (o.status && (o.status === 'done' ? s.status !== 'done' : s.status === 'done')) return false;
    if (o.month && !String(s.issueDate || '').startsWith(o.month)) return false;
    return true;
  });
}
/** 정렬: 발행일 최신 → 번호 큰 순 → 만든 순서 최신 */
export const sortSettlements = (list) => (list || []).slice().sort((a, b) => String(b.issueDate || '').localeCompare(String(a.issueDate || '')) || String(b.no || '').localeCompare(String(a.no || '')) || (((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0)));
export function settleFilterOptions(list) {
  const clients = [...new Set((list || []).map((s) => s.recipient && s.recipient.company).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
  const months = [...new Set((list || []).map((s) => (s.issueDate && s.issueDate.length >= 7 ? s.issueDate.slice(0, 7) : null)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  return { clients, months };
}
/** 합계 카드(구포털은 청구 누계·지급예정 누계·미수금). 합계금액(total, 부가세 포함) 기준 — 유효한(폐기 아닌) 것만. 청구서는 완결=수금, 지급예정서는 완결=지급완료 */
export function settleSummary(filtered) {
  const l = filtered || []; const sum = (pick) => l.filter(pick).reduce((a, s) => a + T(s), 0);
  const inv = sum((s) => s.docType === 'invoice' && setActive(s)), pay = sum((s) => s.docType === 'payment' && setActive(s));
  const invDone = sum((s) => s.docType === 'invoice' && s.status === 'done'), payDone = sum((s) => s.docType === 'payment' && s.status === 'done');
  return { inv, pay, invDone, payDone, receivable: inv - invDone, payable: pay - payDone };
}
export const projectLabel = (s, projects) => ((s.pjtIds && s.pjtIds.length > 1) ? s.pjtIds.map((pid) => { const pp = (projects || []).find((x) => x.id === pid); return pp ? pp.code : pid; }).join('+') : ((((projects || []).find((x) => x.id === s.pjtId)) || {}).code || (s.pjtId ? '-' : '해당 없음')));
export const isMulti = (s) => !!(s && s.pjtIds && s.pjtIds.length > 1);
export const acctMonthOf = (s) => s.acctMonth || (s.payDate || s.issueDate || s.baseMonth || '').slice(0, 7);
export const validAcctMonth = (t) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(t || ''));
/** 회계 계상월 입력 처리(구포털 editAcctMonth): 비우면 지급일→발행일→기준월 로 자동, 형식이 틀리면 null */
export function acctMonthInput(s, v) { const t = String(v == null ? '' : v).trim(); if (t && !validAcctMonth(t)) return null; return t || (s.payDate || s.issueDate || s.baseMonth || '').slice(0, 7); }
/** 견적 연결은 청구서 중 직접입력·수량정산 방식에서만(공정 자동은 견적별 기청구가 자동으로 잡힘) */
export const canLinkEst = (s) => !!s && s.docType === 'invoice' && (s.method === 'manual' || s.method === 'qty');
export const linkedEstimates = (s) => Object.keys((s && s.perEst) || {}).filter((k) => s.perEst[k] > 0);
export const linkableEstimates = (s, estimates) => (estimates || []).filter((e) => e.pjtId === s.pjtId && e.status !== 'void' && e.status !== 'closed');
export const settleLinesOf = (s) => (s.lines && s.lines.length ? s.lines : [{ name: '전체 금액', amount: s.supply }]);
/** 항목별 견적 연결 저장 값(구포털 saveLinkEst): selections = { 줄 번호: 견적 id } → perEstLines(줄→견적)·perEst(견적별 합계) */
export function linkPlan(s, selections) {
  const lines = settleLinesOf(s); const perEstLines = {}, perEst = {};
  Object.keys(selections || {}).forEach((k) => { const estId = selections[k]; const idx = Number(k); if (estId && lines[idx]) { perEstLines[idx] = estId; perEst[estId] = (perEst[estId] || 0) + (Number(lines[idx].amount) || 0); } });
  return { perEst, perEstLines };
}
export const donePatch = () => ({ status: 'done' });   // + doneAt(서버 시각)
export const undonePatch = () => ({ status: 'active', doneAt: null });
export const voidPatch = () => ({ status: 'void' });   // + voidedAt(서버 시각)
/** 확인 창 문구(구포털 그대로). bal = 프로젝트 미수금(청구 − 지급, 구포털 doneSettle 의 기준) */
export function doneConfirm(s, bal) {
  if (s.docType === 'payment') return { title: '지급완료', body: '이 지급예정서를 지급완료 처리할까요?\n\n실제 송금이 완료된 경우에만 처리해주세요.\n완결 시 회계 장부의 직접비(용역비)로 자동 반영됩니다.', label: '지급완료' };
  return { title: '완결', body: bal > 0 ? '이 청구 정산을 완결 처리할까요?\n\n현재 프로젝트 미수금: ' + Math.round(bal).toLocaleString('ko-KR') + '\n(미수금이 남아 있어도 수동 완결 가능)\n\n완결 시 수금 처리되어 회계 매출로 인식됩니다.' : '이 청구 정산을 완결 처리할까요?\n\n미수금 0 — 완결 권장 상태입니다.\n완결 시 수금 처리되어 회계 매출로 인식됩니다.', label: '완결' };
}
export const undoneConfirm = (s) => (s.docType === 'invoice' ? '완결을 취소할까요?\n회계 매출 인식에서 제외됩니다.' : '지급완료를 취소할까요?\n회계 장부 직접비(용역비) 반영에서 제외됩니다.');
export const doneToast = (s) => (s.docType === 'payment' ? '지급완료 처리했습니다.' : '완결 처리했습니다.');
/** 프로젝트 기준 잔액(구포털 pjtBilled − pjtPaid): 청구 누계(금액=공급가액) − 지급 누계 */
export function projectBalance(settlements, pid) {
  const sum = (kind) => (settlements || []).filter((s) => (s.pjtId === pid || (s.pjtIds && s.pjtIds.includes(pid))) && s.docType === kind && s.status !== 'void').reduce((a, s) => a + settleAmountForPjt(s, pid), 0);
  return sum('invoice') - sum('payment');
}
