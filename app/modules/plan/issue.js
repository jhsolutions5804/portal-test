/* 영업기획 정산서 발행 — 순수 규칙(화면·네트워크 없이 시험 가능). 구포털 기획(gihoek)의 발행 계산을 그대로 옮겼다.
 * 방식: 직접 입력(manual), 수량 정산(qty), 공수 연동(manday, 지급예정서), 공정 연동(progress, 청구서) — 구포털의 정산서 발행 4방식을 모두 옮겼다.
 * 번호: yymm + 세 자리, 청구서·지급예정서 따로 센다(구포털은 "개수 + 1" 이라 삭제 뒤 같은 번호가 다시 나올 수 있어 "가장 큰 번호 + 1" 로 한다 — 빈 번호가 없으면 결과는 같다). */
import { itemAmt, getLinkPjt } from './projects.js?v=20261020c';
import { setProgressOverrides, getProgProfile, isTrackable, zoneGuess, calcProgressRow, toggleProgressEst, setProgressZone, toggleProgressDeposit, setProgressBill, applyProgress, progressLine } from './progress.js?v=20261020c';
import { num, blankItem, itemSetQty, itemSetPrice, itemSetAmount, partySnap, suppliers, clients, DEFAULT_ISSUER } from './estimates.js?v=20261020c';
export { num, blankItem, itemSetQty, itemSetPrice, itemSetAmount, suppliers, clients, setProgressOverrides, getProgProfile, isTrackable, zoneGuess, calcProgressRow, toggleProgressEst, setProgressZone, toggleProgressDeposit, setProgressBill, applyProgress };
export const SUPPORTED = { invoice: ['progress', 'manual', 'qty'], payment: ['manday', 'manual', 'qty'] };   // 새 화면에서 계산하는 방식
export const METHOD_OPTIONS = { invoice: [['progress', '공정 연동 (반입·설치 자동)'], ['qty', '수량 정산 (견적 품목별)'], ['manual', '직접 입력']], payment: [['manday', '공수 연동'], ['qty', '수량 정산 (견적 품목별)'], ['manual', '직접 입력']] };
export const isSupported = (docType, method) => (SUPPORTED[docType] || []).includes(method);
export const NOTES_MAX = 2000;   // 특이사항 최대 글자 수(견적 특기사항과 같음)
/** 금액 입력칸 서식: 숫자만 남겨 천 단위 쉼표를 붙인다. allowNeg 이면 맨 앞의 - 또는 −(유니코드 마이너스)를 부호로 인정한다(네고·할인 줄). '-'만 입력한 중간 상태는 그대로 둔다 */
export function formatMoneyInput(v, allowNeg) { const s = String(v == null ? '' : v).replace(/[−–]/g, '-'); const neg = !!allowNeg && /^\s*-/.test(s); const raw = s.replace(/[^0-9]/g, ''); return (neg ? '-' : '') + (raw ? Number(raw).toLocaleString('ko-KR') : ''); }
const DATE = /^\d{4}-\d{2}-\d{2}$/, MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
/** 지급예정일이 비었을 때(지급예정서): 기준월의 익월 말일, 토·일이면 금요일(구포털 defaultPayDate) */
export function defaultPayDate(baseMonth) {
  const [y, m] = String(baseMonth).split('-').map(Number); const d = new Date(y, m + 1, 0); const dow = d.getDay();
  if (dow === 6) d.setDate(d.getDate() - 1); else if (dow === 0) d.setDate(d.getDate() - 2);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
/** 새 발행 초안(구포털 newSettle): 기준월·발행일은 오늘(한국 시간), 발신자는 제이에이치솔루션(없으면 첫 발행처), 수신자는 비어 있음 */
export function newIssueDraft(o) {
  const x = o || {}; const sup = suppliers(x.companies); const today = x.today || ''; const kind = x.docType === 'payment' ? 'payment' : 'invoice';
  return { docType: kind, pjtId: x.pjtId || '', pjtIds: x.pjtId ? [x.pjtId] : [], method: kind === 'payment' && x.pjtId ? 'manday' : 'manual', baseMonth: today.slice(0, 7), issueDate: today, payDate: '',
    senderId: ((sup.find((c) => c.company === DEFAULT_ISSUER) || sup[0]) || {}).id || '', recipientId: '', senderContact: '', recipientContact: '', estIds: [], qtyInput: {}, qtyAmt: {}, supplyOverride: null, vatOverride: null, manualItems: [blankItem(), blankItem()], notes: '', mandayRate: null, mandayInput: null, mandayAuto: null, mandayBreakdown: {}, mandayOverride: {}, mandayRateOverride: {}, mandayMonth: '', estZone: {}, prog: {}, eqs: {}, deposit: {}, billOverride: {} };
}
/** 프로젝트 다중 선택(구포털 toggleSettlePjt): 최소 1개, 바뀌면 선택된 견적 중 빠진 프로젝트의 것은 해제. 반환: 오류 문구 또는 '' */
export function togglePjt(d, pid, estimates) {
  d.pjtIds = Array.isArray(d.pjtIds) ? d.pjtIds.filter(Boolean) : (d.pjtId ? [d.pjtId] : []); const i = d.pjtIds.indexOf(pid);
  if (i < 0) d.pjtIds.push(pid); else d.pjtIds.splice(i, 1);   // 모두 해제하면 프로젝트 없는 정산서(공정·공수 연동은 프로젝트가 있어야 하므로 직접 입력으로 바꾼다)
  d.pjtId = d.pjtIds[0] || ''; if (!d.pjtIds.length && needsProject(d.method)) d.method = 'manual';
  d.estIds = (d.estIds || []).filter((id) => { const e = (estimates || []).find((x) => x.id === id); return e && (d.pjtIds.length ? d.pjtIds.includes(e.pjtId) : !e.pjtId); }); return '';
}
/** 프로젝트가 있어야 쓸 수 있는 정산 방식(공정 연동은 섹터·장비 추적, 공수 연동은 프로젝트의 공수 출처) */
export const needsProject = (method) => method === 'progress' || method === 'manday';
/** 선택한 프로젝트의 유효 견적(수량 정산에서 고를 수 있는 견적) */
export function pickableEstimates(d, estimates, projects) {
  const ids = (d.pjtIds || [d.pjtId]).filter(Boolean); const ok = d.method === 'progress' ? ids.filter((pid) => isTrackable((projects || []).find((p) => p.id === pid))) : ids;
  return (estimates || []).filter((e) => (ids.length ? ok.includes(e.pjtId) : !e.pjtId) && e.status !== 'void' && e.status !== 'closed');   // 프로젝트를 고르지 않으면 프로젝트 없는 견적만
}
/** 공정 연동에서 제외되는 프로젝트(섹터·장비 자동추적 연동이 없는 프로젝트)의 이름 */
export const progressExcluded = (d, projects) => (d.pjtIds || [d.pjtId]).filter((pid) => !isTrackable((projects || []).find((p) => p.id === pid))).map((pid) => { const p = (projects || []).find((x) => x.id === pid); return p ? p.code : pid; });
/** 공정 연동의 섹터 목록: 대표(첫) 프로젝트의 공정 프로파일(구포털 getProgProfile) */
export const progressProfile = (d, projects) => getProgProfile((projects || []).find((p) => p.id === d.pjtId));
export function toggleEst(d, id, projects, estimates) {
  if (d.method === 'progress') { const prof = progressProfile(d, projects); const e = (estimates || []).find((x) => x.id === id); toggleProgressEst(d, id, zoneGuess(e && e.title, prof.zones), prof.zones); return; }
  const i = d.estIds.indexOf(id); if (i < 0) { d.estIds.push(id); d.qtyInput[id] = d.qtyInput[id] || {}; d.qtyAmt[id] = d.qtyAmt[id] || {}; } else d.estIds.splice(i, 1); }
/* ── 수량 정산 ── */
/** 기청구 수량: 이미 발행된(폐기 아닌) 청구서에서 그 견적 품목에 정산한 수량 합(구포털 priorQty) */
export const priorQty = (settlements, estId, idx) => (settlements || []).filter((s) => s.status !== 'void' && s.docType === 'invoice' && s.perItem && s.perItem[estId] && s.perItem[estId][idx]).reduce((a, s) => a + (s.perItem[estId][idx].qty || 0), 0);
export const qtyValue = (d, estId, idx) => (d.qtyInput[estId] && d.qtyInput[estId][idx] != null ? d.qtyInput[estId][idx] : 0);
export function qtyAmount(d, estId, idx, it) { const o = d.qtyAmt[estId] && d.qtyAmt[estId][idx]; if (o != null) return o; return Math.round(qtyValue(d, estId, idx) * ((it && it.price) || 0)); }
export function setQty(d, estId, idx, v) { d.qtyInput[estId] = d.qtyInput[estId] || {}; d.qtyInput[estId][idx] = Math.max(0, num(v)); if (d.qtyAmt[estId]) delete d.qtyAmt[estId][idx]; }
export function setQtyAmount(d, estId, idx, v) { d.qtyAmt[estId] = d.qtyAmt[estId] || {}; d.qtyAmt[estId][idx] = Math.max(0, num(v)); }
/** 선택 견적 품목 안의 한 행: 단가·총 수량·기청구·이번 수량·금액·잔여 */
export function qtyRow(d, e, idx, settlements) { const it = (e.items || [])[idx]; const prior = priorQty(settlements, e.id, idx); return { name: it.name, price: it.price || 0, total: it.qty || 0, prior, remain: (it.qty || 0) - prior, qty: qtyValue(d, e.id, idx), amount: qtyAmount(d, e.id, idx, it) }; }
/* ── 공수 연동(지급예정서) ── */
export const TEAM_RATE = 190000;   // 기술인력 단가 기본값(원/공수) — 구포털 그대로
const round1 = (n) => Math.round(n * 10) / 10;
/** 프로젝트의 공수 출처: 연동된 PJT관리 프로젝트의 자기 공수표(pjt_registry/<id>/manday)와 자기 명부(pjt_registry/<id>/workers) — 월간 공수·팀별 노무비와 같은 출처이고 모든 프로젝트가 같은 규칙이다. 연동이 없으면 null */
export function mandaySource(project) {
  const key = getLinkPjt(project); if (!key || key === 'none' || key === 'auto') return null;
  return { id: key, dayCol: 'pjt_registry/' + key + '/manday', rosterCol: 'pjt_registry/' + key + '/workers' };
}
/** 기준월의 모든 날짜(YYYY-MM-DD) */
export function monthDays(baseMonth) { const [y, m] = String(baseMonth).split('-').map(Number); const last = new Date(y, m, 0).getDate(); return Array.from({ length: last }, (_, i) => y + '-' + String(m).padStart(2, '0') + '-' + String(i + 1).padStart(2, '0')); }
/** 하루치 공수 문서들의 md 맵을 합산: 근로자 명부(idSet)에 있는 사람만 더하고(없으면 제외분으로 따로 셈), 명부를 못 읽었으면(null) 전부 더한다 */
export function sumMandayDays(mdMaps, idSet) { let sum = 0, ignored = 0; (mdMaps || []).forEach((md) => Object.keys(md || {}).forEach((wid) => { const v = Number(md[wid]) || 0; if (!idSet || idSet.has(wid)) sum += v; else ignored += v; })); return { sum: round1(sum), ignored: round1(ignored) }; }
/** 같은 공수 출처를 가리키는 프로젝트 묶음(둘 이상 합치면 같은 값이 중복 집계될 수 있어 경고) — 반환: [[프로젝트 id…], …] */
export function duplicateSources(pjtIds, projects) {
  const map = {}; (pjtIds || []).forEach((pid) => { const src = mandaySource((projects || []).find((p) => p.id === pid)); if (src) (map[src.dayCol] = map[src.dayCol] || []).push(pid); }); return Object.values(map).filter((g) => g.length > 1);
}
export const mdBaseRate = (d) => (d.mandayRate != null ? d.mandayRate : TEAM_RATE);
export const mdForPjt = (d, pid) => (d.mandayOverride && d.mandayOverride[pid] != null ? d.mandayOverride[pid] : (d.mandayBreakdown && d.mandayBreakdown[pid] != null ? d.mandayBreakdown[pid] : 0));
export const rateForPjt = (d, pid) => (d.mandayRateOverride && d.mandayRateOverride[pid] != null ? d.mandayRateOverride[pid] : mdBaseRate(d));
export const mdSingle = (d) => (d.mandayInput != null ? d.mandayInput : (d.mandayAuto || 0));
const multi = (d) => (d.pjtIds && d.pjtIds.length ? d.pjtIds : [d.pjtId]).length > 1;
export const setMandayInput = (d, v) => { d.mandayInput = num(v); };
export const setMandayForPjt = (d, pid, v) => { d.mandayOverride = d.mandayOverride || {}; d.mandayOverride[pid] = num(v); };
export const setRateForPjtValue = (d, pid, v) => { d.mandayRateOverride = d.mandayRateOverride || {}; d.mandayRateOverride[pid] = Math.round(num(v)) || 0; };
export const setMandayBaseRate = (d, v) => { d.mandayRate = Math.round(num(v)) || TEAM_RATE; };
/** 공수 불러오기 결과 반영(구포털 fetchManday): 프로젝트별 공수(소수 첫째 자리 반올림)·합계, 직접 고친 값은 초기화, 불러온 기준월을 기억 */
export function applyMandayFetch(d, breakdown) { const b = {}; let grand = 0; Object.keys(breakdown || {}).forEach((pid) => { b[pid] = round1(breakdown[pid]); grand += b[pid]; }); d.mandayBreakdown = b; d.mandayOverride = {}; d.mandayAuto = round1(grand); d.mandayInput = d.mandayAuto; d.mandayMonth = d.baseMonth; return d.mandayAuto; }
export function mandaySummary(d) {
  const ids = d.pjtIds && d.pjtIds.length ? d.pjtIds : [d.pjtId];
  if (ids.length > 1) { const total = ids.reduce((s, pid) => s + mdForPjt(d, pid), 0); return { multi: true, md: total, amount: ids.reduce((s, pid) => s + Math.round(mdForPjt(d, pid) * rateForPjt(d, pid)), 0) }; }
  return { multi: false, md: mdSingle(d), amount: Math.round(mdSingle(d) * mdBaseRate(d)) };
}
/** 이미 발행된(폐기 아닌) 공수 연동 지급예정서의 공수 합 — 구포털은 참고로만 보여 주고 이번 금액에서 빼지 않는다 */
export const priorManday = (settlements) => (settlements || []).filter((s) => s.status !== 'void' && s.docType === 'payment' && s.method === 'manday').reduce((a, s) => a + (s.mandayUsed || 0), 0);
/* ── 합계 ── */
export function autoSupply(d, estimates, projects, settlements) {
  if (d.method === 'manual') return d.manualItems.reduce((s, it) => s + itemAmt(it), 0);
  if (d.method === 'qty') return d.estIds.reduce((s, id) => { const e = (estimates || []).find((x) => x.id === id); if (!e) return s; return s + (e.items || []).reduce((a, it, idx) => a + qtyAmount(d, id, idx, it), 0); }, 0);
  if (d.method === 'manday') return mandaySummary(d).amount;
  if (d.method === 'progress') { const zones = progressProfile(d, projects).zones; return d.estIds.reduce((s, id) => { const e = (estimates || []).find((x) => x.id === id); return e ? s + calcProgressRow(d, e, zones, settlements).thisBill : s; }, 0); }
  return 0;
}
export const effSupply = (d, estimates, projects, settlements) => (d.supplyOverride != null ? d.supplyOverride : autoSupply(d, estimates, projects, settlements));
export const effVat = (d, estimates, projects, settlements) => (d.vatOverride != null ? d.vatOverride : Math.round(effSupply(d, estimates, projects, settlements) * 0.1));
export const setSupplyOverride = (d, v) => { d.supplyOverride = Math.max(0, num(v)); };
export const setVatOverride = (d, v) => { d.vatOverride = Math.max(0, num(v)); };
export const resetTotals = (d) => { d.supplyOverride = null; d.vatOverride = null; };
export const issueTotals = (d, estimates, projects, settlements) => { const supply = effSupply(d, estimates, projects, settlements), vat = effVat(d, estimates, projects, settlements); return { supply, vat, total: supply + vat, auto: autoSupply(d, estimates, projects, settlements), overridden: d.supplyOverride != null || d.vatOverride != null }; };
/** 정산서 내역(lines)(구포털 settleLines): 직접 입력은 이름이 있는 줄만, 수량 정산은 수량 또는 금액이 있는 품목만 */
export function issueLines(d, estimates, projects, settlements) {
  if (d.method === 'manual') return d.manualItems.filter((i) => (i.name || '').trim()).map((i) => ({ name: i.name.trim(), spec: i.spec || '', qty: i.qty || 0, price: i.price || 0, amount: Math.round(itemAmt(i)) }));
  if (d.method === 'qty') { const lines = []; d.estIds.forEach((id) => { const e = (estimates || []).find((x) => x.id === id); if (!e) return; (e.items || []).forEach((it, idx) => { const q = qtyValue(d, id, idx); const amt = qtyAmount(d, id, idx, it); if (q > 0 || amt > 0) lines.push({ name: it.name, spec: (it.spec || '') + ' · 수량 ' + q, qty: q, price: it.price || 0, amount: amt }); }); }); return lines; }
  if (d.method === 'progress') { const zones = progressProfile(d, projects).zones; return d.estIds.map((id) => (estimates || []).find((x) => x.id === id)).filter(Boolean).map((e) => progressLine(d, e, zones, settlements)); }
  if (d.method === 'manday') {
    const ids = d.pjtIds && d.pjtIds.length ? d.pjtIds : [d.pjtId];
    if (ids.length > 1) return ids.map((pid) => { const p = (projects || []).find((x) => x.id === pid); const md = mdForPjt(d, pid), r = rateForPjt(d, pid); return { name: d.baseMonth + ' 기술인력 투입 (' + (p ? p.code : pid) + ')', spec: '공수 ' + md + ' × ' + Math.round(r).toLocaleString('ko-KR') + '원', qty: md, price: r, amount: Math.round(md * r) }; });
    const md = mdSingle(d), rate = mdBaseRate(d); return [{ name: d.baseMonth + ' 기술인력 투입', spec: '공수 ' + md, qty: md, price: rate, amount: Math.round(md * rate) }];
  }
  return [];
}
/** 새 정산서 번호: yymm + 세 자리, 같은 구분(청구서/지급예정서) 안에서 그 달 가장 큰 번호 + 1 */
export function nextSettleNo(settlements, docType, issueDate) {
  const yymm = String(issueDate).slice(2, 4) + String(issueDate).slice(5, 7); let max = 0;
  (settlements || []).forEach((s) => { const no = String(s.no || ''); if (s.docType === docType && no.startsWith(yymm) && /^\d+$/.test(no.slice(4))) max = Math.max(max, parseInt(no.slice(4), 10)); });
  return yymm + String(max + 1).padStart(3, '0');
}
/** 발행 저장 계획(구포털 publishSettle). 금액이 0이면 오류, 수신자가 없으면 확인 요청(warnings). 프로젝트별 몫(perPjtAmount)은 여러 프로젝트를 묶을 때 각 프로젝트 상세의 누계에 자기 몫만 반영되게 한다 */
export function buildSettlement(d, o) {
  const x = o || {}; const estimates = x.estimates || [], me = x.me || {}; const errors = [], warnings = [];
  if (!isSupported(d.docType, d.method)) return { ok: false, errors: ['이 정산 방식은 아직 옛 발행 화면에서 발행합니다.'], warnings };
  const sup = effSupply(d, estimates, x.projects, x.settlements); if (!(sup > 0)) errors.push('정산 금액이 없습니다.');
  if (!DATE.test(String(d.issueDate || ''))) errors.push('발행일을 입력하세요.'); if (!MONTH.test(String(d.baseMonth || ''))) errors.push('기준월을 입력하세요.'); if (d.payDate && !DATE.test(d.payDate)) errors.push('지급일 형식이 올바르지 않습니다.');
  const pjtIds = Array.isArray(d.pjtIds) ? d.pjtIds.filter(Boolean) : (d.pjtId ? [d.pjtId] : []);   // 프로젝트 없이 발행하는 정산서는 빈 목록
  const notes = String(d.notes || '').trim(); if (notes.length > NOTES_MAX) errors.push('특이사항은 ' + NOTES_MAX.toLocaleString('ko-KR') + '자 이내로 입력해 주세요.');
  if (errors.length) return { ok: false, errors, warnings };
  if (!d.recipientId) warnings.push('수신자(거래처)가 선택되지 않았습니다. 그래도 발행할까요?');
  if (d.method === 'manday' && d.mandayMonth && d.mandayMonth !== d.baseMonth) warnings.push('불러온 공수의 기준월(' + d.mandayMonth + ')과 정산서 기준월(' + d.baseMonth + ')이 다릅니다. 그래도 발행할까요?');
  const no = nextSettleNo(x.settlements, d.docType, d.issueDate); const comp = (id) => (x.companies || []).find((c) => c.id === id) || null;
  const perEst = {}, perItem = {};
  if (d.method === 'progress') { const zones = progressProfile(d, x.projects).zones; d.estIds.forEach((eid) => { const e = estimates.find((y) => y.id === eid); if (e) perEst[eid] = calcProgressRow(d, e, zones, x.settlements).thisBill; }); }
  if (d.method === 'qty') d.estIds.forEach((eid) => { const e = estimates.find((y) => y.id === eid); if (!e) return; perItem[eid] = {}; let es = 0; (e.items || []).forEach((it, idx) => { const q = qtyValue(d, eid, idx), amt = qtyAmount(d, eid, idx, it); if (q > 0 || amt > 0) { perItem[eid][idx] = { qty: q, amount: amt }; es += amt; } }); perEst[eid] = es; });
  const perPjtAmount = {}; let mandayUsed = 0;
  if (d.method === 'manday') mandayUsed = pjtIds.length > 1 ? pjtIds.reduce((s, pid) => s + mdForPjt(d, pid), 0) : mdSingle(d);
  if (d.method === 'manday' && pjtIds.length > 1) pjtIds.forEach((pid) => { perPjtAmount[pid] = Math.round(mdForPjt(d, pid) * rateForPjt(d, pid)); });
  else if ((d.method === 'qty' || d.method === 'progress') && pjtIds.length > 1) { pjtIds.forEach((pid) => { perPjtAmount[pid] = 0; }); Object.keys(perEst).forEach((eid) => { const e = estimates.find((y) => y.id === eid); if (!e) return; perPjtAmount[e.pjtId] = (perPjtAmount[e.pjtId] || 0) + (perEst[eid] || 0); }); } else if (d.pjtId) perPjtAmount[d.pjtId] = sup;   // 프로젝트 없는 정산서는 프로젝트별 몫을 두지 않는다
  const vat = effVat(d, estimates, x.projects, x.settlements); let payDate = d.payDate || ''; if (d.docType === 'payment' && !payDate && d.baseMonth) payDate = defaultPayDate(d.baseMonth);
  const acctMonth = (payDate || d.issueDate || d.baseMonth || '').slice(0, 7);
  const payload = { pjtId: d.pjtId, pjtIds, perPjtAmount, no, docType: d.docType, method: d.method, baseMonth: d.baseMonth, issueDate: d.issueDate, payDate, acctMonth,
    senderId: d.senderId || '', sender: partySnap(comp(d.senderId), d.senderContact) || {}, recipientId: d.recipientId || '', recipient: partySnap(comp(d.recipientId), d.recipientContact) || {},
    estIds: d.estIds || [], perEst, perItem, mandayUsed, lines: issueLines(d, estimates, x.projects, x.settlements), supply: sup, vat, total: sup + vat, amount: sup, status: 'active', author: me.name || '', authorUid: me.uid || '', notes };
  return { ok: true, errors: [], warnings, id: 'set_' + (x.now || Date.now()), no, payload, message: (d.docType === 'invoice' ? '대금청구서' : '지급예정서') + ' ' + no + ' 발행' };
}
/** 저장된 정산서로 발행 초안을 되짚어 만든다(점검·대조용): 직접 입력은 내역을 품목으로, 수량 정산은 perItem 의 수량·금액으로 */
export function draftFromSettlement(s) {
  const d = { notes: s.notes || '', docType: s.docType, pjtId: s.pjtId, pjtIds: s.pjtIds || [s.pjtId], method: s.method, baseMonth: s.baseMonth, issueDate: s.issueDate, payDate: s.payDate || '', senderId: s.senderId || '', recipientId: s.recipientId || '', senderContact: (s.sender && s.sender.contact) || '', recipientContact: (s.recipient && s.recipient.contact) || '', estIds: (s.estIds || []).slice(), qtyInput: {}, qtyAmt: {}, supplyOverride: null, vatOverride: null, manualItems: [], mandayRate: null, mandayInput: null, mandayAuto: null, mandayBreakdown: {}, mandayOverride: {}, mandayRateOverride: {}, mandayMonth: '', estZone: {}, prog: {}, eqs: {}, deposit: {}, billOverride: {} };
  if (s.method === 'manual') d.manualItems = (s.lines || []).map((l) => ({ name: l.name, spec: l.spec || '', qty: l.qty, price: l.price, amount: l.amount }));
  if (s.method === 'manday') { const ids = s.pjtIds || [s.pjtId]; if (ids.length > 1) { d.mandayOverride = {}; d.mandayRateOverride = {}; ids.forEach((pid, i) => { const l = (s.lines || [])[i] || {}; d.mandayOverride[pid] = l.qty; d.mandayRateOverride[pid] = l.price; }); } else { const l = (s.lines || [])[0] || {}; d.mandayInput = s.mandayUsed != null ? s.mandayUsed : l.qty; d.mandayRate = l.price; } }
  if (s.method === 'progress') { d.billOverride = {}; Object.keys(s.perEst || {}).forEach((eid) => { d.billOverride[eid] = s.perEst[eid]; }); }
  if (s.method === 'qty') Object.keys(s.perItem || {}).forEach((eid) => { d.qtyInput[eid] = {}; d.qtyAmt[eid] = {}; Object.keys(s.perItem[eid]).forEach((idx) => { d.qtyInput[eid][idx] = s.perItem[eid][idx].qty; d.qtyAmt[eid][idx] = s.perItem[eid][idx].amount; }); });
  return d;
}
