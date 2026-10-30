/* 영업기획 견적 — 순수 규칙(화면·네트워크 없이 시험 가능). 구포털 기획(gihoek)의 견적 규칙을 그대로 옮기고, 개정 이력 비교를 새로 더했다.
 * 번호: 새 견적 EST-<연도>-<세 자리>, 개정은 <기준 번호>-r<N>. 개정본을 발행하면 원본은 자동으로 폐기(void)되고 replacedBy 에 개정본 번호가 남는다.
 * 종결(closed)은 정산이 끝난 견적으로 유효 견적 집계에서 빠진다. 거래처·담당자 정보는 견적서에 그대로 복사(스냅샷)해 저장한다. */
import { itemAmt, estSupply, estTotal, isEstActive, estTag, sortProjects } from './projects.js?v=20261031a';
import { sanitizeCalc } from './estimate-calc.js?v=20261031a'; // 순환 import: estimate-calc.js 도 itemSetAmount 를 가져온다. 둘 다 function 선언이라 호이스팅되어 안전하며, 로드 순서를 뒤집어도 같은 결과임을 tests/estimate-calc-save.test.mjs 가 확인한다
export { estSupply, estTotal, isEstActive, estTag, itemAmt };
export const EST_PAGE_SIZE = 10;
export const VAT_RATE = 0.1;
export const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return Number.isNaN(n) ? 0 : n; };
export const blankItem = () => ({ name: '', spec: '', qty: 1, price: 0, amount: 0, remark: '' });
export const CALC_ROWS_MAX = 300; // 견적 하나에 저장하는 산식 행 수 상한(Firestore 문서 1MB 한도 대비, 셀 120자·행 60개·항목 100개의 이론 최대치를 막는다)
/** 항목 복사에 산식 표(calc)를 붙인다 — 정리된 표가 있을 때만 키를 만든다(산식을 안 쓴 기존 견적은 문서 모양이 그대로). 저장된 표는 알려진 칸만 새 객체로 복사해 읽는다 */
const withCalc = (target, src) => { const c = sanitizeCalc(src && src.calc); if (c) target.calc = c; return target; };
/** 품목 입력 연동(구포털 onQty·onPrice·onAmt): 수량·단가를 바꾸면 금액 = 수량×단가(반올림), 금액을 바꾸면 단가 = 금액÷수량(수량이 0이면 금액 그대로) */
export function itemSetQty(it, v) { it.qty = num(v); it.amount = Math.round(it.qty * it.price); return it; }
export function itemSetPrice(it, v) { it.price = num(v); it.amount = Math.round(it.qty * it.price); return it; }
export function itemSetAmount(it, v) { it.amount = num(v); it.price = it.qty > 0 ? Math.round(it.amount / it.qty) : it.amount; return it; }
/** 공급가액을 직접 고치면 차액을 마지막 품목에 반영(구포털 onSupplyEdit) */
export function applySupplyEdit(items, v) {
  if (!items || !items.length) return false; const X = num(v); const others = items.slice(0, -1).reduce((s, it) => s + itemAmt(it), 0); const last = items[items.length - 1];
  last.amount = X - others; last.price = last.qty > 0 ? Math.round(last.amount / last.qty) : last.amount; return true;
}
export function draftTotals(items) { const supply = (items || []).reduce((s, it) => s + itemAmt(it), 0); const vat = Math.round(supply * VAT_RATE); return { supply, vat, total: supply + vat }; }

/** 담당자 스냅샷(구포털 ctSnap)과 거래처 스냅샷 */
export const ctSnap = (c, name) => { const ct = ((c && c.contacts) || []).find((x) => x.name === name) || {}; return { contact: name || '', contactTel: ct.tel || '', contactEmail: ct.email || '' }; };
export const partySnap = (c, contactName) => (c ? Object.assign({ company: c.company, ceo: c.ceo || '', bizno: c.bizno || '', tel: c.tel || '', email: c.email || '', address: c.address || '' }, ctSnap(c, contactName)) : null);
const byKo = (a, b) => String(a.company || '').localeCompare(String(b.company || ''), 'ko');
export const suppliers = (companies) => (companies || []).filter((c) => c.roleSupplier).sort(byKo);
export const clients = (companies) => (companies || []).filter((c) => c.roleClient).sort(byKo);
export const DEFAULT_ISSUER = '제이에이치솔루션';
const defIssuer = (companies) => { const sup = suppliers(companies); return ((sup.find((c) => c.company === DEFAULT_ISSUER) || sup[0]) || {}).id || ''; };

/** 새 견적 초안(구포털 newEst): 프로젝트는 지정한 것(없으면 목록 첫 프로젝트), 수신처는 첫 수신처, 발행처는 제이에이치솔루션(없으면 첫 발행처), 작성자는 로그인한 사람 */
export function newDraft(o) {
  const x = o || {}; const me = x.me || {}; const projects = sortProjects(x.projects || []);
  return { editId: null, no: null, pjtId: x.pjtId || (projects[0] && projects[0].id) || '', title: '', date: x.today || '', clientId: ((clients(x.companies)[0]) || {}).id || '', issuerId: defIssuer(x.companies), issuerContact: '', clientContact: '', notes: '',
    authorDept: me.rank || '', authorName: me.name || '', authorEmail: me.email || '', items: [blankItem(), blankItem()] };
}
/** 개정 초안(구포털 editEst): 원본을 복사하고 기준 번호·원본 번호를 기억한다 */
export function draftFromEstimate(e, o) {
  const x = o || {}; const me = x.me || {}; const it = e.items && e.items.length ? e.items.map((i) => withCalc({ name: i.name || '', spec: i.spec || '', qty: i.qty || 0, price: i.price || 0, amount: Math.round(itemAmt(i)), remark: i.remark || '' }, i)) : [blankItem()];
  return { editId: e.id, baseNo: e.baseNo || e.no, srcNo: e.no, srcRev: e.rev || 1, pjtId: e.pjtId, title: e.title || '', date: e.date || x.today || '', clientId: e.clientId || '', issuerId: e.issuerId || defIssuer(x.companies), issuerContact: e.issuerContact || '', clientContact: e.clientContact || '', notes: e.notes || '',
    authorDept: e.authorDept || me.rank || '', authorName: e.authorName || me.name || '', authorEmail: e.authorEmail || me.email || '', items: it };
}
/** 새 견적의 기준 번호. 구포털은 "그해 기준 번호 개수 + 1" 이었는데 중간 번호를 삭제하면 같은 번호가 다시 나올 수 있어, 그해 가장 큰 번호 + 1 로 한다(빈 번호가 없으면 결과는 같다) */
export function nextBaseNo(estimates, year) {
  let max = 0; (estimates || []).forEach((e) => { const m = /^EST-(\d{4})-(\d+)/.exec(String(e.baseNo || e.no || '')); if (m && m[1] === String(year)) max = Math.max(max, parseInt(m[2], 10)); });
  return 'EST-' + year + '-' + String(max + 1).padStart(3, '0');
}
export const estGroup = (estimates, baseNo) => (estimates || []).filter((e) => (e.baseNo || e.no) === baseNo).sort((a, b) => (a.rev || 1) - (b.rev || 1));
export const isSuperseded = (e) => !!e && e.status === 'void' && !!e.replacedBy;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** 저장 계획(구포털 saveEst): 제목·품목 1개 이상 필수, 이름이 빈 품목 줄은 버림. 개정이면 번호 = 기준 번호-r(그룹 최고 rev+1) 이고 원본을 폐기(voidPatch). 호출한 쪽이 createdAt·voidedAt(서버 시각)을 붙여 쓴다 */
export function buildEstimate(d, o) {
  const x = o || {}; const errors = []; const me = x.me || {};
  const title = String(d.title || '').trim(); if (!title) errors.push('견적 제목을 입력하세요.'); else if (title.length > 120) errors.push('견적 제목은 120자 이내로 입력해 주세요.');
  const items = (d.items || []).filter((i) => String(i.name || '').trim()).map((i) => withCalc({ name: String(i.name).trim(), spec: i.spec || '', qty: i.qty || 0, price: i.price || 0, amount: Math.round(itemAmt(i)), remark: String(i.remark || '').trim() }, i));
  if (!items.length) errors.push('품목을 1개 이상 입력하세요.'); else if (items.length > 100) errors.push('품목은 100개까지 입력할 수 있습니다.');
  if (items.some((i) => i.name.length > 120 || String(i.spec).length > 120 || i.remark.length > 200)) errors.push('품명·규격·비고가 너무 깁니다.');
  if (items.some((i) => !Number.isFinite(i.amount) || Math.abs(i.amount) > 1e13 || !Number.isFinite(i.qty) || !Number.isFinite(i.price))) errors.push('금액이 올바르지 않습니다.');
  if (items.reduce((n, i) => n + (i.calc ? i.calc.rows.length : 0), 0) > CALC_ROWS_MAX) errors.push('산식 내역이 너무 많습니다(견적 전체 ' + CALC_ROWS_MAX + '행 이하). 쓰지 않는 산식 행을 줄여 주세요.');
  if (!DATE.test(String(d.date || ''))) errors.push('작성일을 입력하세요.');
  const notes = String(d.notes || '').trim(); if (notes.length > 2000) errors.push('특기사항은 2,000자 이내로 입력해 주세요.');
  if (errors.length) return { ok: false, errors };
  const all = x.estimates || []; let no, rev, baseNo;
  if (d.editId) { baseNo = d.baseNo; const maxRev = estGroup(all, baseNo).reduce((m, e) => Math.max(m, e.rev || 1), 1); rev = maxRev + 1; no = baseNo + '-r' + rev; }
  else { no = nextBaseNo(all, d.date.slice(0, 4)); rev = 1; baseNo = no; }
  const comp = (id) => (x.companies || []).find((c) => c.id === id) || null;
  const payload = { pjtId: d.pjtId, no, baseNo, rev, status: 'active', date: d.date, title, items, authorDept: String(d.authorDept || '').trim(), authorName: String(d.authorName || '').trim(), authorEmail: String(d.authorEmail || '').trim(), authorUid: me.uid || '',
    clientId: d.clientId || '', client: partySnap(comp(d.clientId), d.clientContact), issuerId: d.issuerId || '', issuer: partySnap(comp(d.issuerId), d.issuerContact), clientContact: d.clientContact || '', issuerContact: d.issuerContact || '', notes };
  return { ok: true, errors: [], id: 'est_' + (x.now || Date.now()), no, rev, baseNo, payload, voidPatch: d.editId ? { id: d.editId, patch: { status: 'void', replacedBy: no } } : null, message: d.editId ? '개정본을 발행했습니다. (원본 폐기)' : '견적을 저장했습니다.' };
}
export const closePatch = () => ({ status: 'closed' });   // + closedAt(서버 시각)
export const reopenPatch = () => ({ status: 'active', closedAt: null });

/** 프로젝트에 속하지 않는 견적(견적서 프로젝트 선택의 '해당 없음', pjtId 는 빈 문자열)을 목록 필터에서 가리키는 값 */
export const NO_PJT = '__none';
/** 목록 필터 선택지: 실제 쓰인 값만(현장명=연결 프로젝트, 거래처, 발행월) — 구포털 estFilterOptions */
export function estFilterOptions(estimates, projects) {
  const pjt = new Map(), cl = new Set(), mo = new Set();
  (estimates || []).forEach((e) => { const p = (projects || []).find((x) => x.id === e.pjtId); if (p) pjt.set(p.id, p.code || p.name || '(이름없음)'); else pjt.set(e.pjtId || NO_PJT, e.pjtId ? '삭제된 PJT' : '해당 없음'); if (e.client && e.client.company) cl.add(e.client.company); if (e.date && e.date.length >= 7) mo.add(e.date.slice(0, 7)); });
  return { pjtOptions: Array.from(pjt.entries()).sort((a, b) => a[1].localeCompare(b[1], 'ko')), clientOptions: Array.from(cl).sort((a, b) => a.localeCompare(b, 'ko')), monthOptions: Array.from(mo).sort((a, b) => b.localeCompare(a)) };
}
/** 목록 필터(구포털 estFilteredList). f: pjt·client·month·pjtStatus('run'|'done')·status('active'|'closed'|'void')·hideReplaced(개정 전 버전 숨김) */
export function filterEstimates(estimates, projects, f) {
  const o = f || {};
  return (estimates || []).filter((e) => {
    if (o.pjt && (o.pjt === NO_PJT ? !!e.pjtId : e.pjtId !== o.pjt)) return false; if (o.client && !(e.client && e.client.company === o.client)) return false; if (o.month && !String(e.date || '').startsWith(o.month)) return false;
    if (o.status) { const st = e.status === 'void' ? 'void' : e.status === 'closed' ? 'closed' : 'active'; if (st !== o.status) return false; }
    if (o.pjtStatus) { const p = (projects || []).find((x) => x.id === e.pjtId); const ps = p ? (p.status === 'done' ? 'done' : 'run') : null; if (ps !== o.pjtStatus) return false; }
    if (o.hideReplaced && isSuperseded(e)) return false;
    return true;
  });
}
/** 견적 정렬: 날짜 최신순 → 만든 순서 최신순(구포털 목록 순서) */
export const sortEstimates = (list) => (list || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0)));

/** 개정 비교(신규): prev → next. 품목은 품명+규격이 같은 것끼리 짝지어(같은 이름이 여럿이면 순서대로) 추가·삭제·변경을 알려 준다 */
export function compareEstimates(a, b) {
  const A = (a && a.items) || [], B = (b && b.items) || []; const key = (i) => String(i.name || '').trim() + '\u0001' + String(i.spec || '').trim(); const used = new Set(); const rows = [];
  const snap = (i) => ({ qty: Number(i.qty) || 0, price: Number(i.price) || 0, amount: Math.round(itemAmt(i)), remark: i.remark || '' });
  B.forEach((nb) => { const ia = A.findIndex((na, idx) => !used.has(idx) && key(na) === key(nb)); if (ia < 0) { rows.push({ status: 'added', name: nb.name, spec: nb.spec || '', before: null, after: snap(nb), changes: [] }); return; }
    used.add(ia); const before = snap(A[ia]), after = snap(nb); const changes = ['qty', 'price', 'amount', 'remark'].filter((k) => before[k] !== after[k]); rows.push({ status: changes.length ? 'changed' : 'same', name: nb.name, spec: nb.spec || '', before, after, changes }); });
  A.forEach((na, idx) => { if (!used.has(idx)) rows.push({ status: 'removed', name: na.name, spec: na.spec || '', before: snap(na), after: null, changes: [] }); });
  const sa = estSupply(a || {}), sb = estSupply(b || {}); const ta = estTotal(a || {}), tb = estTotal(b || {});
  const cnt = (s) => rows.filter((r) => r.status === s).length;
  return { rows, supply: { from: sa, to: sb, delta: sb - sa }, total: { from: ta, to: tb, delta: tb - ta }, title: { from: (a && a.title) || '', to: (b && b.title) || '', changed: ((a && a.title) || '') !== ((b && b.title) || '') }, notes: { from: (a && a.notes) || '', to: (b && b.notes) || '', changed: ((a && a.notes) || '') !== ((b && b.notes) || '') },
    summary: { added: cnt('added'), removed: cnt('removed'), changed: cnt('changed'), same: cnt('same') }, identical: !rows.some((r) => r.status !== 'same') && sa === sb && !((a && a.title) !== (b && b.title)) && ((a && a.notes) || '') === ((b && b.notes) || '') };
}
