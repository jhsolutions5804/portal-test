import { db, collection, getDocs, getDoc, query, where, documentId, addDoc, updateDoc, setDoc, deleteDoc, doc, serverTimestamp, writeBatch } from '../../core/firebase.js?v=20261014s';
import { toast } from '../../core/ui.js?v=20261014s';
import { confirmDialog } from '../../core/dialog.js?v=20261014s';
import { compNew, compToForm, compBuild, fmtTel, fmtTelBlur, kstToday } from './logic.js?v=20261014s';
import { companiesListHtml, companyFormHtml } from './view.js?v=20261014s';
import { getLinkPjt, projNew, projToForm, projectBuild } from './projects.js?v=20261014s';
import { projectsListHtml, projectDetailHtml, projectFormHtml } from './projects-view.js?v=20261014s';
import { uiState, pushHash } from './ui.js?v=20261014s';
import { itemAmt, blankItem, itemSetQty, itemSetPrice, itemSetAmount, applySupplyEdit, draftTotals, newDraft, draftFromEstimate, buildEstimate, closePatch, reopenPatch, estGroup, sortEstimates } from './estimates.js?v=20261014s';
import { estimatesListHtml, estimateDetailHtml, estimateFormHtml, itemRowHtml } from './estimates-view.js?v=20261014s';
import { estDocHtml } from './estimate-doc.js?v=20261014s';
import { sortProjects } from './projects.js?v=20261014s';
import { linkPlan, donePatch, undonePatch, voidPatch, doneConfirm, undoneConfirm, doneToast, projectBalance, acctMonthInput } from './settlements.js?v=20261014s';
import { settlementsListHtml, settlementDetailHtml } from './settlements-view.js?v=20261014s';
import { settleDocPage } from './settlement-doc.js?v=20261014s';
import { teamLaborHtml } from './teamlabor-view.js?v=20261014s';
import { homeHtml } from './home-view.js?v=20261014s';
import { closingHtml, closingPrintHtml } from './closing-view.js?v=20261014s';
import { setProgressOverrides } from './progress.js?v=20261014s';
import { toProfile } from '../../shared/pjt-structure.js?v=20261014s';
import { acctHtml } from './acct-view.js?v=20261014s';
import { contractsListHtml, contractFormHtml, contractDetailHtml } from './contracts-view.js?v=20261014s';
import { contractDocPage } from './contract-doc.js?v=20261014s';
import { flattenContracts, nextContractNo, newContract, validateContract, upsertContract, issueBlockers, changeFrom } from './contracts.js?v=20261014s';
import { reconcileExpenses, missingToJson, tagTableCsv } from './acct-reconcile.js?v=20261014s';
import { shiftYm, closingCsv } from './closing.js?v=20261014s';
import { shiftMonth, monthRange, rosterEntry, aggregateMandays, parseTeamRate, ratePatch, rateSaveMessage } from './teamlabor.js?v=20261014s';
import { issueFormHtml, qtyBlocksHtml, totalsHtml, manualRowHtml, mandayRowsHtml, mandayInfoHtml, progressBlocksHtml } from './issue-view.js?v=20261014s';
import { accumulateDays, applyProgress as applyProgressChecks, setProgressZone, toggleProgressDeposit, setProgressBill } from './progress.js?v=20261014s';
import { progressProfile, mandaySource, monthDays, sumMandayDays, duplicateSources, applyMandayFetch, setMandayInput, setMandayForPjt, setRateForPjtValue, setMandayBaseRate, newIssueDraft, formatMoneyInput, togglePjt, toggleEst, setQty, setQtyAmount, setSupplyOverride, setVatOverride, resetTotals, buildSettlement, itemSetQty as isItemQty, itemSetPrice as isItemPrice, itemSetAmount as isItemAmount, blankItem as isBlank } from './issue.js?v=20261014s';

/** 영업기획(플랫폼 기본 모듈): 구포털 기획(gihoek)을 탭 하나씩 새 화면으로 옮기는 중. 관리자 전용 — 데이터는 gihoek_* 컬렉션 그대로.
 *  사이드바는 옛 화면 틀(legacy/frame.js)이 그린다 — 이 모듈은 틀 안의 구역(거래처·협력사)을 그리는 함수만 내보내고 modules/index.js 가 hostNative 로 연결한다. */
export const manifest = { id: 'plan', order: 10, title: '영업기획', icon: '🧭', defaultHash: '#/plan/home', perm: (me) => !!me && me.admin === true };

const lst = (s) => { const l = []; s.forEach((d) => l.push(Object.assign({ id: d.id }, d.data()))); return l; };
async function mountCompaniesView(root, route, ctx, view) {
  root.onclick = null; root.oninput = null; root.onchange = null; if (root.__pcFocusOut) { root.removeEventListener('focusout', root.__pcFocusOut); root.__pcFocusOut = null; }   // focusout 은 on* 속성이 없어 addEventListener 로만 받는다
  const st = { view, companies: [], form: null, sel: '' };
  root.innerHTML = '<div id="pc-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#pc-body');
  const load = async () => { st.companies = lst(await getDocs(collection(db, 'gihoek_companies'))); };
  try { await load(); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + ((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = st.form ? companyFormHtml(st) : companiesListHtml(st); };
  const open = (id) => { const c = id ? st.companies.find((x) => x.id === id) : null; st.sel = c ? c.id : ''; st.form = c ? compToForm(c) : Object.assign(compNew(), view === 'partners' ? { roleVendor: true } : {}); paint(); };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const o = t.closest('[data-pc-open]'); if (o) { open(o.getAttribute('data-pc-open')); return; }
    const ctd = t.closest('[data-pc-ctdel]'); if (ctd && st.form) { st.form.contacts.splice(Number(ctd.getAttribute('data-pc-ctdel')), 1); paint(); return; }
    const a = t.closest('[data-pc-act]'); if (!a) return; const act = a.getAttribute('data-pc-act');
    if (act === 'new') { open(''); return; }
    if (act === 'cancel') { st.form = null; st.sel = ''; paint(); return; }
    if (act === 'ct-add' && st.form) { st.form.contacts.push({ name: '', tel: '', email: '' }); paint(); return; }
    if (act === 'save' && st.form) {
      const r = compBuild(st.form, { id: st.sel, others: st.companies }); if (!r.ok) { toast(r.errors[0]); return; }
      if (r.warnings.length) { const ok = await confirmDialog({ title: '역할 미지정', body: r.warnings[0], confirmLabel: '저장' }); if (!ok.ok) return; }
      if (r.duplicate) { const ok = await confirmDialog({ title: '같은 이름의 업체', body: '"' + r.duplicate + '" 이름의 업체가 이미 있습니다. 그래도 저장할까요?', confirmLabel: '저장' }); if (!ok.ok) return; }
      try { await setDoc(doc(db, 'gihoek_companies', r.id), r.data, { merge: true }); toast('저장했습니다.'); st.form = null; st.sel = ''; await load(); paint(); } catch (e) { toast('저장 실패: ' + ((e && (e.code || e.message)) || '')); }
      return;
    }
    if (act === 'del' && st.sel) {
      const ok = await confirmDialog({ title: '업체 삭제', body: '이 업체를 삭제할까요? (기존 견적에 저장된 정보는 유지됩니다)', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return;
      try { await deleteDoc(doc(db, 'gihoek_companies', st.sel)); toast('삭제했습니다.'); st.form = null; st.sel = ''; await load(); paint(); } catch (e) { toast('삭제 실패: ' + ((e && (e.code || e.message)) || '')); }
    }
  };
  root.oninput = (ev) => {
    const t = ev.target; if (!(t instanceof Element) || !st.form) return;
    if (t.matches('[data-pc-f]')) { st.form[t.getAttribute('data-pc-f')] = t.value; return; }
    const c = t.getAttribute('data-pc-ct'); if (c) { const [i, k] = c.split(':'); const row = st.form.contacts[Number(i)]; if (!row) return; if (k === 'tel') { t.value = fmtTel(t.value); } row[k] = t.value; }
  };
  root.onchange = (ev) => { const t = ev.target; if (!(t instanceof Element) || !st.form) return; const r = t.getAttribute('data-pc-role'); if (r) st.form[r] = t.checked; };
  root.__pcFocusOut = (ev) => { const t = ev.target; if (!(t instanceof Element) || !st.form) return; const c = t.getAttribute('data-pc-ct'); if (c && c.endsWith(':tel')) { const row = st.form.contacts[Number(c.split(':')[0])]; if (row) { row.tel = fmtTelBlur(t.value); t.value = row.tel; } } };
  root.addEventListener('focusout', root.__pcFocusOut);
  paint();
}

/** 프로젝트(허브): 목록 → 상세(요약·견적·청구·지급) → 등록·수정. 프로젝트를 저장하면 PJT관리에 현장이 자동 생성되고(연동 "자동 생성"), 기본정보 6항목은 PJT관리와 같은 값을 쓴다.
 *  견적·정산서의 작성·열기는 새 화면으로 옮기기 전까지 구포털 기획 화면이 맡는다 — 열 문서를 sessionStorage 에 적어 두고 해당 탭으로 이동하면 옛 화면이 그 문서를 연다. */
const openLegacy = (tab, fn, args) => { try { sessionStorage.setItem('jh_plan_open', JSON.stringify({ fn, args })); } catch (e) { /* 저장소를 못 써도 탭 이동은 한다 */ } location.hash = '#/plan/' + tab; };
export async function mountProjects(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { projects: [], estimates: [], settlements: [], registry: [], view: 'list', sel: '', form: null, filter: { status: 'run', q: '' }, page: { est: 1, inv: 1, pay: 1 } };
  root.innerHTML = '<div id="pj-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#pj-body');
  const load = async () => { const [a, b, c, d] = await Promise.all([getDocs(collection(db, 'gihoek_projects')), getDocs(collection(db, 'gihoek_estimates')), getDocs(collection(db, 'gihoek_settlements')), getDocs(collection(db, 'pjt_registry')).catch(() => null)]); st.projects = lst(a); st.estimates = lst(b); st.settlements = lst(c); st.registry = d ? lst(d) : []; };
  try { await load(); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + ((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = st.view === 'form' ? projectFormHtml(st) : st.view === 'detail' ? projectDetailHtml(st) : projectsListHtml(st); };
  const show = (view, id) => { st.view = view; st.sel = id || st.sel; if (view === 'detail') st.page = { est: 1, inv: 1, pay: 1 }; paint(); };
  const seg = route && route.segs && route.segs[0]; if (seg && st.projects.some((p) => p.id === seg)) { st.sel = seg; st.view = 'detail'; }
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const fl = t.closest('[data-pj-filter]'); if (fl) { st.filter.status = fl.getAttribute('data-pj-filter'); paint(); return; }
    const op = t.closest('[data-pj-open]'); if (op) { show('detail', op.getAttribute('data-pj-open')); return; }
    const pg = t.closest('[data-pj-page]'); if (pg) { const [k, n] = pg.getAttribute('data-pj-page').split(':'); st.page[k] = Number(n); paint(); return; }
    const es = t.closest('[data-pj-est]'); if (es) { location.hash = '#/plan/est/' + es.getAttribute('data-pj-est') + '/from/' + st.sel; return; }
    const se = t.closest('[data-pj-set]'); if (se) { const sd = st.settlements.find((x) => x.id === se.getAttribute('data-pj-set')); location.hash = '#/plan/' + (sd && sd.docType === 'payment' ? 'payout' : 'billing') + '/' + se.getAttribute('data-pj-set') + '/from/' + st.sel; return; }
    const a = t.closest('[data-pj-act]'); if (!a) return; const act = a.getAttribute('data-pj-act');
    if (act === 'list') { show('list', ''); return; }
    if (act === 'new') { st.sel = ''; st.form = projNew(); show('form', ''); return; }
    if (act === 'edit') { const p = st.projects.find((x) => x.id === st.sel); if (!p) return; st.form = projToForm(p); show('form'); return; }
    if (act === 'cancel') { show(st.sel ? 'detail' : 'list'); return; }
    if (act === 'new-est') { location.hash = '#/plan/est/new/' + st.sel; return; }
    if (act === 'new-inv') { location.hash = '#/plan/billing/new/' + st.sel; return; }
    if (act === 'new-pay') { location.hash = '#/plan/payout/new/' + st.sel; return; }
    if (act === 'del') {
      const p = st.projects.find((x) => x.id === st.sel); if (!p) return; const ok = await confirmDialog({ title: '프로젝트 삭제', body: '이 프로젝트를 삭제할까요? (견적·정산 데이터는 남습니다)', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return;
      try { await deleteDoc(doc(db, 'gihoek_projects', p.id)); toast('삭제했습니다.'); st.sel = ''; await load(); show('list', ''); } catch (e) { toast('삭제 실패: ' + ((e && (e.code || e.message)) || '')); } return;
    }
    if (act === 'save' && st.form) {
      const r = projectBuild(st.form, { id: st.sel }); if (!r.ok) { toast(r.errors[0]); return; }
      try {
        let link = r.link; const data = Object.assign({}, r.data);
        if (r.registry) { const ref = await addDoc(collection(db, 'pjt_registry'), Object.assign({}, r.registry, { createdAt: serverTimestamp() })); link = ref.id; }   // PJT관리에 같은 이름의 프로젝트 자동 생성
        data.linkPjt = link;
        if (r.syncPatch) { try { await updateDoc(doc(db, 'pjt_registry', link), r.syncPatch); } catch (e) { console.warn('[영업기획] 연동 PJT 동기화 실패:', e && e.message); } }   // 기본정보 6항목은 기획 ↔ PJT관리가 같은 값
        if (r.isNew) await setDoc(doc(db, 'gihoek_projects', r.id), Object.assign({}, data, { createdAt: serverTimestamp() })); else await setDoc(doc(db, 'gihoek_projects', r.id), data, { merge: true });
        toast(r.message); await load(); if (r.isNew) show('list', ''); else show('detail', r.id);
      } catch (e) { toast('저장 실패: ' + ((e && (e.code || e.message)) || '')); }
    }
  };
  root.oninput = (ev) => { const t = ev.target; if (!(t instanceof Element)) return; if (t.matches('[data-pj-f]') && st.form) { st.form[t.getAttribute('data-pj-f')] = t.value; return; } if (t.matches('[data-pj-q]')) { st.filter.q = t.value; const pos = t.selectionStart; paint(); const q = body.querySelector('[data-pj-q]'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (e) { /* 검색칸 형식에 따라 위치 지정이 안 될 수 있다 */ } } } };
  root.onchange = (ev) => { const t = ev.target; if (t instanceof Element && t.matches('[data-pj-f]') && st.form) st.form[t.getAttribute('data-pj-f')] = t.value; };
  paint();
}

/** 견적: 목록(필터·쪽 나눔) → 상세(개정 이력·비교, 종결·삭제·인쇄) → 작성·개정 발행. 주소: #/plan/est · #/plan/est/new[/프로젝트] · #/plan/est/<견적>[/from/<프로젝트>]
 *  개정본을 발행하면 원본이 폐기되고(두 문서를 한 번에 저장), 프로젝트 화면에서 들어왔으면 돌아가기가 프로젝트로 간다. */
export async function mountEstimates(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const me = (ctx && ctx.me) || {};
  const st = { estimates: [], projects: [], companies: [], view: 'list', sel: '', draft: null, filter: { pjt: '', client: '', month: '', pjtStatus: '', status: '', hideReplaced: true }, page: 1, origin: '', cmp: { a: '', b: '' } };
  const KEY = 'jh_plan_est_ui'; const saved = uiState.load(KEY) || {}; if (saved.filter) Object.assign(st.filter, saved.filter); if (saved.page) st.page = saved.page; let restoreY = saved.scroll || 0; const remember = (scroll) => uiState.save(KEY, { filter: st.filter, page: st.page, scroll: scroll || 0 });
  root.innerHTML = '<div id="es-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#es-body');
  const load = async () => { const [a, b, c] = await Promise.all([getDocs(collection(db, 'gihoek_estimates')), getDocs(collection(db, 'gihoek_projects')), getDocs(collection(db, 'gihoek_companies'))]); st.estimates = sortEstimates(lst(a)); st.projects = sortProjects(lst(b)); st.companies = lst(c).sort((x, y) => String(x.company || '').localeCompare(String(y.company || ''), 'ko')); };
  try { await load(); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + ((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = st.view === 'form' ? estimateFormHtml(st) : st.view === 'detail' ? estimateDetailHtml(st) : estimatesListHtml(st); window.scrollTo(0, st.view === 'list' ? restoreY : 0); restoreY = 0; };
  const today = () => kstToday();
  const goList = (push) => { st.view = 'list'; st.sel = ''; st.draft = null; st.origin = ''; if (push) pushHash('#/plan/est'); paint(); };
  const goDetail = (id, push) => { if (push && st.view === 'list') remember(window.scrollY || 0); st.view = 'detail'; st.sel = id; st.draft = null; st.cmp = { a: '', b: '' }; if (push) pushHash('#/plan/est/' + id + (st.origin ? '/from/' + st.origin : '')); paint(); };
  const goBack = () => { if (st.origin) { location.hash = '#/plan/projects/' + st.origin; return; } goList(true); };
  const startNew = (pjtId) => { if (!st.projects.length) { toast('먼저 프로젝트를 등록하세요.'); location.hash = '#/plan/projects'; return; } st.draft = newDraft({ projects: st.projects, companies: st.companies, me, pjtId, today: today() }); st.view = 'form'; st.sel = ''; paint(); };
  const segs = (route && route.segs) || []; const s0 = segs[0];
  if (s0 === 'new') { st.origin = segs[1] || ''; startNew(segs[1] || ''); } else if (s0 && st.estimates.some((e) => e.id === s0)) { if (segs[1] === 'from' && segs[2]) st.origin = segs[2]; st.view = 'detail'; st.sel = s0; paint(); } else paint();
  const rows = () => body.querySelector('#es-rows');
  const refreshTotals = () => { const tt = draftTotals(st.draft.items); const sp = body.querySelector('#es-supply'); if (sp && document.activeElement !== sp) sp.value = Math.round(tt.supply).toLocaleString('ko-KR'); const v = body.querySelector('#es-vat'), tot = body.querySelector('#es-total'); if (v) v.textContent = Math.round(tt.vat).toLocaleString('ko-KR') + ' 원'; if (tot) tot.textContent = Math.round(tt.total).toLocaleString('ko-KR') + ' 원'; };
  const refreshRow = (i) => { const it = st.draft.items[i]; const set = (k, v) => { const el = body.querySelector('[data-es-it="' + i + ':' + k + '"]'); if (el) el.value = Math.round(v).toLocaleString('ko-KR'); }; set('price', it.price); set('amount', itemAmt(it)); };
  const drawRows = () => { rows().innerHTML = st.draft.items.map(itemRowHtml).join(''); refreshTotals(); };
  const printEst = (e) => { const p = st.projects.find((x) => x.id === e.pjtId) || null; const w = window.open('', '_blank'); if (!w) { toast('팝업이 차단되었습니다.'); return; } w.document.write(estDocHtml(e, p)); w.document.close(); };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const pg = t.closest('[data-es-page]'); if (pg) { st.page = Number(pg.getAttribute('data-es-page').split(':')[1]); remember(0); paint(); return; }
    const op = t.closest('[data-es-open]'); if (op) { goDetail(op.getAttribute('data-es-open'), true); return; }
    const dl = t.closest('[data-es-del]'); if (dl && st.draft) { st.draft.items.splice(Number(dl.getAttribute('data-es-del')), 1); if (!st.draft.items.length) st.draft.items.push(blankItem()); drawRows(); return; }
    const a = t.closest('[data-es-act]'); if (!a) return; const act = a.getAttribute('data-es-act'); const cur = st.estimates.find((x) => x.id === st.sel);
    if (act === 'reset') { st.filter = { pjt: '', client: '', month: '', pjtStatus: '', status: '', hideReplaced: true }; st.page = 1; remember(0); paint(); return; }
    if (act === 'new') { st.origin = ''; startNew(''); return; }
    if (act === 'back') { goBack(); return; }
    if (act === 'cancel') { if (st.draft && st.draft.editId) goDetail(st.draft.editId, false); else goBack(); return; }
    if (act === 'add-row' && st.draft) { st.draft.items.push(blankItem()); drawRows(); return; }
    if (act === 'edit' && cur) { st.draft = draftFromEstimate(cur, { me, companies: st.companies, today: today() }); st.view = 'form'; paint(); return; }
    if (act === 'print' && cur) { printEst(cur); return; }
    if (act === 'close' && cur) { const ok = await confirmDialog({ title: '견적 종결', body: '이 견적서를 종결 처리할까요?\n\n종결 시 유효 견적 집계·견적 합계에서 제외됩니다.\n(정산이 완료된 견적에 사용하세요)', confirmLabel: '종결' }); if (!ok.ok) return; try { await setDoc(doc(db, 'gihoek_estimates', cur.id), Object.assign(closePatch(), { closedAt: serverTimestamp() }), { merge: true }); toast('종결 처리했습니다.'); await load(); goDetail(cur.id, false); } catch (e) { toast('실패: ' + ((e && (e.code || e.message)) || '')); } return; }
    if (act === 'reopen' && cur) { const ok = await confirmDialog({ title: '종결 취소', body: '종결을 취소하고 유효 상태로 되돌릴까요?', confirmLabel: '되돌리기' }); if (!ok.ok) return; try { await setDoc(doc(db, 'gihoek_estimates', cur.id), reopenPatch(), { merge: true }); toast('종결을 취소했습니다.'); await load(); goDetail(cur.id, false); } catch (e) { toast('실패: ' + ((e && (e.code || e.message)) || '')); } return; }
    if (act === 'del' && cur) { const g = estGroup(st.estimates, cur.baseNo || cur.no).length; const ok = await confirmDialog({ title: '견적 삭제', body: '이 견적을 삭제할까요?' + (g > 1 ? '\n(같은 견적의 다른 개정 버전은 남습니다)' : ''), confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, 'gihoek_estimates', cur.id)); toast('삭제했습니다.'); await load(); goBack(); } catch (e) { toast('삭제 실패: ' + ((e && (e.code || e.message)) || '')); } return; }
    if (act === 'save' && st.draft) {
      const r = buildEstimate(st.draft, { estimates: st.estimates, companies: st.companies, me, now: Date.now() }); if (!r.ok) { toast(r.errors[0]); return; }
      a.disabled = true;
      try {
        const data = Object.assign({}, r.payload, { createdAt: serverTimestamp() });
        if (r.voidPatch) { const batch = writeBatch(db); batch.set(doc(db, 'gihoek_estimates', r.id), data); batch.set(doc(db, 'gihoek_estimates', r.voidPatch.id), Object.assign({}, r.voidPatch.patch, { voidedAt: serverTimestamp() }), { merge: true }); await batch.commit(); }   // 개정본 저장과 원본 폐기를 한 번에
        else await setDoc(doc(db, 'gihoek_estimates', r.id), data);
        toast(r.message); await load(); if (!st.estimates.some((x) => x.id === r.id)) st.estimates.push(Object.assign({ id: r.id }, r.payload)); goDetail(r.id, true);
      } catch (e) { a.disabled = false; toast('저장 실패: ' + ((e && (e.code || e.message)) || '')); }
    }
  };
  root.oninput = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const f = t.getAttribute('data-es-f'); if (f && st.draft) { st.draft[f] = t.value; return; }
    if (t.hasAttribute('data-es-supply')) { const raw = t.value.replace(/[^0-9]/g, ''); t.value = raw ? Number(raw).toLocaleString('ko-KR') : ''; return; }
    const c = t.getAttribute('data-es-it'); if (!c || !st.draft) return; const [i, k] = c.split(':'); const it = st.draft.items[Number(i)]; if (!it) return;
    if (k === 'name' || k === 'spec' || k === 'remark') { it[k] = t.value; return; }
    if (k === 'price' || k === 'amount') { const raw = t.value.replace(/[^0-9]/g, ''); t.value = raw ? Number(raw).toLocaleString('ko-KR') : ''; }
    if (k === 'qty') itemSetQty(it, t.value); else if (k === 'price') itemSetPrice(it, t.value); else itemSetAmount(it, t.value);
    const set = (kk, v) => { if (kk === k) return; const el = body.querySelector('[data-es-it="' + i + ':' + kk + '"]'); if (el) el.value = Math.round(v).toLocaleString('ko-KR'); }; set('price', it.price); set('amount', it.amount); refreshTotals();
  };
  root.onchange = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const fk = t.getAttribute('data-es-filter'); if (fk) { st.filter[fk] = t.value; st.page = 1; remember(0); paint(); return; }
    if (t.hasAttribute('data-es-hide')) { st.filter.hideReplaced = t.checked; st.page = 1; remember(0); paint(); return; }
    const cm = t.getAttribute('data-es-cmp'); if (cm) { st.cmp[cm] = t.value; paint(); return; }
    if (t.hasAttribute('data-es-supply') && st.draft) { if (applySupplyEdit(st.draft.items, t.value)) { st.draft.items.forEach((_, i) => refreshRow(i)); const li = st.draft.items.length - 1; const el = body.querySelector('[data-es-it="' + li + ':price"]'); if (el) el.value = Math.round(st.draft.items[li].price).toLocaleString('ko-KR'); const am = body.querySelector('[data-es-it="' + li + ':amount"]'); if (am) am.value = Math.round(st.draft.items[li].amount).toLocaleString('ko-KR'); refreshTotals(); toast('마지막 품목으로 차액을 반영했습니다.'); } return; }
    const f = t.getAttribute('data-es-f'); if (f && st.draft) { st.draft[f] = t.value; if (f === 'issuerId') { st.draft.issuerContact = ''; paint(); } else if (f === 'clientId') { st.draft.clientContact = ''; paint(); } }
  };
}

/** 청구·수금(kind='invoice') / 지급·정산(kind='payment'): 목록(합계 카드·필터·쪽 나눔) → 상세(완결·완결 취소·폐기·삭제·인쇄·견적 연결·회계 계상월). 주소: #/plan/billing[/<정산서>[/from/<프로젝트>]] · #/plan/payout[...]
 *  정산서를 새로 발행하는 일(공정 자동·수량정산·공수·직접입력 계산)은 새 화면으로 옮기기 전까지 구포털 기획 화면이 맡는다 — 같은 방식으로 문서를 넘겨 연다. */
async function mountSettlementsView(root, route, ctx, kind) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const me = (ctx && ctx.me) || {};
  const st = { kind, settlements: [], projects: [], estimates: [], companies: [], draft: null, filter: { pjtId: '', client: '', month: '', status: '' }, page: 1, view: 'list', sel: '', origin: '', linkOpen: false, linkSel: {}, editAcct: false };
  const KEY = 'jh_plan_set_ui_' + kind; const saved = uiState.load(KEY) || {}; if (saved.filter) Object.assign(st.filter, saved.filter); if (saved.page) st.page = saved.page; let restoreY = saved.scroll || 0; const remember = (scroll) => uiState.save(KEY, { filter: st.filter, page: st.page, scroll: scroll || 0 });
  const base = kind === 'invoice' ? '#/plan/billing' : '#/plan/payout';
  root.innerHTML = '<div id="sl-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#sl-body');
  const load = async () => { const [a, b, c, d] = await Promise.all([getDocs(collection(db, 'gihoek_settlements')), getDocs(collection(db, 'gihoek_projects')), getDocs(collection(db, 'gihoek_estimates')), getDocs(collection(db, 'gihoek_companies'))]); st.settlements = lst(a); st.projects = sortProjects(lst(b)); st.estimates = lst(c); st.companies = lst(d).sort((x, y) => String(x.company || '').localeCompare(String(y.company || ''), 'ko'));
    const ov = {}; try { const rs = await getDocs(collection(db, 'pjt_registry')); rs.forEach((d) => { const x = d.data(); if (x.progressStructure) ov[d.id] = toProfile(x.progressStructure); }); } catch (e) { /* 구조를 못 읽으면 공정 연동은 쓸 수 없다 */ } setProgressOverrides(ov); };   // PJT 공정 구조 설정이 저장돼 있으면 청구서 공정 연동도 그 구조(섹터·장비·단계)를 쓴다
  try { await load(); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + ((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = st.view === 'issue' ? issueFormHtml(st) : st.view === 'detail' ? settlementDetailHtml(st) : settlementsListHtml(st); window.scrollTo(0, st.view === 'list' ? restoreY : 0); restoreY = 0; };
  const startIssue = (pjtId) => { st.draft = newIssueDraft({ docType: kind, pjtId: pjtId || (st.projects[0] ? st.projects[0].id : ''), companies: st.companies, today: kstToday() }); st.view = 'issue'; st.sel = ''; paint(); };
  const goList = (push) => { st.view = 'list'; st.sel = ''; st.draft = null; st.origin = ''; st.linkOpen = false; st.editAcct = false; if (push) pushHash(base); paint(); };
  const goDetail = (id, push) => { if (push && st.view === 'list') remember(window.scrollY || 0); st.view = 'detail'; st.sel = id; st.linkOpen = false; st.linkSel = {}; st.editAcct = false; if (push) pushHash(base + '/' + id + (st.origin ? '/from/' + st.origin : '')); paint(); };
  const goBack = () => { if (st.origin) { location.hash = '#/plan/projects/' + st.origin; return; } goList(true); };
  const segs = (route && route.segs) || []; const s0 = segs[0];
  if (s0 === 'new') startIssue(segs[1] || ''); else if (s0 && st.settlements.some((x) => x.id === s0)) { if (segs[1] === 'from' && segs[2]) st.origin = segs[2]; st.view = 'detail'; st.sel = s0; paint(); } else paint();
  const refreshTot = () => { const el = body.querySelector('#is-tot'); if (el) el.innerHTML = totalsHtml(st); };
  const refreshMd = () => { const r = body.querySelector('#is-mdrows'); if (r) r.innerHTML = mandayRowsHtml(st); const i = body.querySelector('#is-mdinfo'); if (i) i.innerHTML = mandayInfoHtml(st); refreshTot(); };
  const fetchProgress = async () => {
    const d = st.draft; if (!d.estIds.length) { toast('견적을 먼저 선택하세요.'); return; }
    st.busy = true; paint(); toast('공정 데이터 불러오는 중...');
    try {
      const prof = progressProfile(d, st.projects); const zoneIds = [...new Set(d.estIds.map((id) => d.estZone[id]))]; const docs = []; const linkId = getLinkPjt(st.projects.find((p) => p.id === d.pjtId));
      try { const snap = await getDocs(collection(db, 'pjt_registry/' + linkId + '/progress_days')); snap.forEach((x) => docs.push({ id: x.id, data: x.data() })); } catch (e) { /* 공정 체크를 못 읽으면 0 으로 */ }
      const [y, m] = d.baseMonth.split('-').map(Number); const endKey = y + '-' + String(m).padStart(2, '0') + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0');
      const cum = accumulateDays(docs, zoneIds, endKey); applyProgressChecks(d, cum, prof); st.busy = false; paint(); toast('반입·설치 장비번호를 반영했습니다.');
    } catch (e) { st.busy = false; paint(); toast('불러오기 실패: ' + ((e && (e.code || e.message)) || '')); }
  };
  const fetchManday = async () => {
    const d = st.draft; const dups = duplicateSources(d.pjtIds, st.projects);
    if (dups.length) { const names = dups.map((g) => g.map((pid) => { const p = st.projects.find((x) => x.id === pid); return p ? p.code : pid; }).join(' = ')).join(', '); const ok = await confirmDialog({ title: '같은 공수 출처', body: '⚠️ 다음 프로젝트들이 같은 공수 데이터로 연결되어 있어 똑같은 값이 중복 집계될 수 있습니다:\n' + names + '\n\n(프로젝트의 "연동 PJT" 설정을 확인해 주세요.)\n\n그래도 계속 불러올까요?', confirmLabel: '계속' }); if (!ok.ok) return; }
    st.busy = true; paint(); toast('공수 불러오는 중...');
    try {
      const breakdown = {}; let ignored = 0;
      for (const pid of d.pjtIds) {
        const src = mandaySource(st.projects.find((x) => x.id === pid)); if (!src) { breakdown[pid] = 0; continue; }
        let idSet = null; try { const rs = await getDocs(collection(db, src.rosterCol)); idSet = new Set(); rs.forEach((x) => idSet.add(x.id)); } catch (e) { idSet = null; }   // 명부를 못 읽으면 전부 더한다(구포털과 같음)
        const maps = []; await Promise.all(monthDays(d.baseMonth).map(async (dk) => { try { const sn = await getDoc(doc(db, src.dayCol, dk)); if (sn.exists()) maps.push(sn.data().md || {}); } catch (e) { /* 그날 문서를 못 읽으면 건너뜀 */ } }));
        const r = sumMandayDays(maps, idSet); breakdown[pid] = r.sum; ignored += r.ignored;
      }
      const auto = applyMandayFetch(d, breakdown); st.busy = false; paint(); toast('공수 ' + auto + ' 반영했습니다.' + (ignored > 0 ? ' (명부 외 ' + Math.round(ignored * 10) / 10 + ' 공수 제외)' : ''));
    } catch (e) { st.busy = false; paint(); toast('불러오기 실패: ' + ((e && (e.code || e.message)) || '')); }
  };
  const patch = async (id, data, msg, after) => { try { await setDoc(doc(db, 'gihoek_settlements', id), data, { merge: true }); toast(msg); await load(); after(); } catch (e) { toast('실패: ' + ((e && (e.code || e.message)) || '')); } };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const pg = t.closest('[data-sl-page]'); if (pg) { st.page = Number(pg.getAttribute('data-sl-page').split(':')[1]); remember(0); paint(); return; }
    const op = t.closest('[data-sl-open]'); if (op) { goDetail(op.getAttribute('data-sl-open'), true); return; }
    const ia = t.closest('[data-is-act]'); if (ia && st.draft) {
      const iact = ia.getAttribute('data-is-act'); const d = st.draft;
      if (iact === 'cancel') { goList(true); return; }
      if (iact === 'legacy') { openLegacy('settle', 'newSettleOf', [d.pjtId, d.docType, d.method]); return; }
      if (iact === 'add-row') { d.manualItems.push(isBlank()); const r = body.querySelector('#is-rows'); if (r) r.innerHTML = d.manualItems.map(manualRowHtml).join(''); refreshTot(); return; }
      if (iact === 'reset-tot') { resetTotals(d); refreshTot(); return; }
      if (iact === 'fetch-md') { await fetchManday(); return; }
      if (iact === 'fetch-prog') { await fetchProgress(); return; }
      if (iact === 'publish') {
        const r = buildSettlement(d, { settlements: st.settlements, estimates: st.estimates, projects: st.projects, companies: st.companies, me: { name: me.name, uid: me.uid }, now: Date.now() }); if (!r.ok) { toast(r.errors[0]); return; }
        for (const w of r.warnings) { const ok = await confirmDialog({ title: '발행 확인', body: w, confirmLabel: '발행' }); if (!ok.ok) return; }
        ia.disabled = true;
        try { await setDoc(doc(db, 'gihoek_settlements', r.id), Object.assign({}, r.payload, { createdAt: serverTimestamp() })); toast(r.message); await load(); /* 방금 저장한 문서가 목록에 아직 없으면(지연) 그대로 보여 준다 */ if (!st.settlements.some((x) => x.id === r.id)) st.settlements.push(Object.assign({ id: r.id }, r.payload)); st.draft = null; goDetail(r.id, true); } catch (e) { ia.disabled = false; toast('발행 실패: ' + ((e && (e.code || e.message)) || '')); }
      }
      return;
    }
    const idl = t.closest('[data-is-del]'); if (idl && st.draft) { st.draft.manualItems.splice(Number(idl.getAttribute('data-is-del')), 1); if (!st.draft.manualItems.length) st.draft.manualItems.push(isBlank()); const r = body.querySelector('#is-rows'); if (r) r.innerHTML = st.draft.manualItems.map(manualRowHtml).join(''); refreshTot(); return; }
    const a = t.closest('[data-sl-act]'); if (!a) return; const act = a.getAttribute('data-sl-act'); const cur = st.settlements.find((x) => x.id === st.sel);
    if (act === 'reset') { st.filter = { pjtId: '', client: '', month: '', status: '' }; st.page = 1; remember(0); paint(); return; }
    if (act === 'new') { startIssue(''); return; }
    if (act === 'team') { location.hash = '#/plan/teamlabor'; return; }
    if (act === 'back') { goBack(); return; }
    if (!cur) return;
    if (act === 'print') { const w = window.open('', '_blank'); if (!w) { toast('팝업이 차단되었습니다.'); return; } w.document.write(settleDocPage(cur, st.projects)); w.document.close(); return; }
    if (act === 'link-open') { st.linkOpen = true; st.linkSel = {}; paint(); return; }
    if (act === 'link-close') { st.linkOpen = false; paint(); return; }
    if (act === 'link-save') { const plan = linkPlan(cur, Object.assign({}, cur.perEstLines || {}, st.linkSel)); await patch(cur.id, plan, '견적 연결을 저장했습니다.', () => goDetail(cur.id, false)); return; }
    if (act === 'acct-edit') { st.editAcct = true; paint(); return; }
    if (act === 'acct-cancel') { st.editAcct = false; paint(); return; }
    if (act === 'acct-save') { const inp = body.querySelector('[data-sl-acct]'); const val = acctMonthInput(cur, inp ? inp.value : ''); if (val === null) { toast('형식이 올바르지 않습니다. 예: 2026-07'); return; } await patch(cur.id, { acctMonth: val }, '회계 계상월을 ' + val + '(으)로 변경했습니다.', () => goDetail(cur.id, false)); return; }
    if (act === 'done') { const c = doneConfirm(cur, projectBalance(st.settlements, cur.pjtId)); const ok = await confirmDialog({ title: c.title, body: c.body, confirmLabel: c.label }); if (!ok.ok) return; await patch(cur.id, Object.assign(donePatch(), { doneAt: serverTimestamp() }), doneToast(cur), () => goDetail(cur.id, false)); return; }
    if (act === 'undone') { const ok = await confirmDialog({ title: '완결 취소', body: undoneConfirm(cur), confirmLabel: '취소하기' }); if (!ok.ok) return; await patch(cur.id, undonePatch(), '완결을 취소했습니다.', () => goDetail(cur.id, false)); return; }
    if (act === 'void') { const ok = await confirmDialog({ title: '정산서 폐기', body: '이 정산서를 폐기할까요? 집계에서 제외됩니다.', confirmLabel: '폐기', variant: 'danger' }); if (!ok.ok) return; await patch(cur.id, Object.assign(voidPatch(), { voidedAt: serverTimestamp() }), '폐기했습니다.', goBack); return; }
    if (act === 'del') { const ok = await confirmDialog({ title: '정산서 삭제', body: '폐기된 정산서를 완전히 삭제할까요?\n이 작업은 되돌릴 수 없습니다.', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, 'gihoek_settlements', cur.id)); toast('삭제했습니다.'); await load(); goBack(); } catch (e) { toast('삭제 실패: ' + ((e && (e.code || e.message)) || '')); } }
  };
  root.oninput = (ev) => {
    const t = ev.target; if (!(t instanceof Element) || !st.draft) return; if (t.getAttribute('data-is-f') === 'notes') { st.draft.notes = t.value; return; }   // 특이사항은 입력 중에 화면을 다시 그리지 않는다(포커스 유지)
    const c = t.getAttribute('data-is-it'); if (!c) return; const [i, k] = c.split(':'); const it = st.draft.manualItems[Number(i)]; if (!it) return;
    if (k === 'name' || k === 'spec') { it[k] = t.value; return; }
    if (k === 'price' || k === 'amount') t.value = formatMoneyInput(t.value, true);   // 정산서 직접 입력은 네고·할인 줄의 마이너스 입력을 허용한다
    if (k === 'qty') isItemQty(it, t.value); else if (k === 'price') isItemPrice(it, t.value); else isItemAmount(it, t.value);
    const set = (kk, v) => { if (kk === k) return; const el = body.querySelector('[data-is-it="' + i + ':' + kk + '"]'); if (el) el.value = Math.round(v).toLocaleString('ko-KR'); }; set('price', it.price); set('amount', it.amount); refreshTot();
  };
  root.onchange = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (st.draft) {
      const d = st.draft; const pj = t.getAttribute('data-is-pjt'); if (pj) { const before = d.method; const err = togglePjt(d, pj, st.estimates); if (err) { toast(err); t.checked = true; return; } if (d.method !== before) toast('프로젝트를 선택하지 않아 정산 방식을 "직접 입력"으로 바꿨습니다.'); paint(); return; }
      const es = t.getAttribute('data-is-est'); if (es) { toggleEst(d, es, st.projects, st.estimates); paint(); return; }
      const zn = t.getAttribute('data-is-zone'); if (zn) { setProgressZone(d, zn, t.value); const pb = body.querySelector('#is-prog'); if (pb) pb.innerHTML = progressBlocksHtml(st); refreshTot(); return; }
      const dp = t.getAttribute('data-is-dep'); if (dp) { toggleProgressDeposit(d, dp); const pb = body.querySelector('#is-prog'); if (pb) pb.innerHTML = progressBlocksHtml(st); refreshTot(); return; }
      const bl = t.getAttribute('data-is-bill'); if (bl) { setProgressBill(d, bl, t.value); refreshTot(); return; }
      const q = t.getAttribute('data-is-q'); if (q) { const [eid, idx] = q.split(':'); setQty(d, eid, Number(idx), t.value); const qb = body.querySelector('#is-qty'); if (qb) qb.innerHTML = qtyBlocksHtml(st); refreshTot(); return; }
      const qa = t.getAttribute('data-is-qa'); if (qa) { const [eid, idx] = qa.split(':'); setQtyAmount(d, eid, Number(idx), t.value); const qb = body.querySelector('#is-qty'); if (qb) qb.innerHTML = qtyBlocksHtml(st); refreshTot(); return; }
      if (t.hasAttribute('data-is-supply')) { setSupplyOverride(d, t.value); refreshTot(); return; }
      if (t.hasAttribute('data-is-vat')) { setVatOverride(d, t.value); refreshTot(); return; }
      const mdv = t.getAttribute('data-is-md'); if (mdv != null) { if (mdv === '') setMandayInput(d, t.value); else setMandayForPjt(d, mdv, t.value); refreshMd(); return; }
      const mdr = t.getAttribute('data-is-mdrate'); if (mdr) { setRateForPjtValue(d, mdr, t.value); refreshMd(); return; }
      if (t.hasAttribute('data-is-rate')) { setMandayBaseRate(d, t.value); paint(); return; }
      const f = t.getAttribute('data-is-f'); if (f) { d[f] = t.value; if (f === 'senderId') d.senderContact = ''; if (f === 'recipientId') d.recipientContact = ''; if (['method', 'baseMonth', 'senderId', 'recipientId'].includes(f)) paint(); return; }
    }
    const fk = t.getAttribute('data-sl-filter'); if (fk) { st.filter[fk] = t.value; st.page = 1; remember(0); paint(); return; }
    const lk = t.getAttribute('data-sl-link'); if (lk != null) st.linkSel[lk] = t.value;
  };
}
export const mountBilling = (root, route, ctx) => mountSettlementsView(root, route, ctx, 'invoice');
export const mountPayout = (root, route, ctx) => mountSettlementsView(root, route, ctx, 'payment');

/** 팀별 노무비(기획): 월별로 팀(팀장+팀원)의 공수 × 팀 단가. 팀 단가는 관리자 전용 문서와 팀장 조회용 문서 두 곳에 저장한다 */
export async function mountTeamLabor(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const now = new Date(Date.now() + 9 * 3600000); const st = { ym: { y: now.getUTCFullYear(), m: now.getUTCMonth() }, data: null, err: '', editing: '' }; let seq = 0;
  root.innerHTML = '<div id="tl-body"></div>'; const body = root.querySelector('#tl-body'); const paint = () => { body.innerHTML = teamLaborHtml(st); };
  const load = async () => {
    const my = ++seq; st.data = null; st.err = ''; st.editing = ''; paint();
    try {
      const { lo, hi } = monthRange(st.ym); const [ms, ps] = await Promise.all([getDocs(collection(db, 'master_workers')), getDocs(collection(db, 'master_worker_private'))]);
      const masters = [], mm = {}; ms.forEach((d) => { const o = Object.assign({ id: d.id }, d.data()); masters.push(o); mm[d.id] = o; }); const rate = {}; ps.forEach((d) => { const v = d.data(); if (v.teamRate != null) rate[d.id] = Number(v.teamRate) || 0; });
      const failed = [], roster = [];
      const pull = async (path, label, regId) => { try { const sn = await getDocs(collection(db, path)); sn.forEach((d) => roster.push(rosterEntry(d.id, d.data(), mm[d.id], label, regId))); } catch (e) { failed.push(label); } };
      const regs = []; try { const rs = await getDocs(collection(db, 'pjt_registry')); rs.forEach((d) => { const x = d.data(); if (x.status !== 'ended') regs.push({ id: d.id, name: x.name || 'PJT' }); }); } catch (e) { failed.push('프로젝트 목록'); }
      for (const rg of regs) await pull('pjt_registry/' + rg.id + '/workers', rg.name, rg.id);
      const monthDocs = async (path, label) => { try { const snap = await getDocs(query(collection(db, path), where(documentId(), '>=', lo), where(documentId(), '<=', hi))); const rows = []; snap.forEach((d) => rows.push([d.id, (d.data().md) || {}])); return rows; } catch (e) { failed.push(label + ' 공수'); return []; } };
      const rows = {}; for (const rg of regs) rows[rg.id] = await monthDocs('pjt_registry/' + rg.id + '/manday', rg.name);
      if (my !== seq) return; st.data = { masters, rate, pmap: aggregateMandays({ roster, rows, regs }), failed };
    } catch (e) { if (my !== seq) return; st.err = (e && e.message) || ''; }
    paint();
  };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; const a = t.closest('[data-tl-act]'); if (!a) return; const act = a.getAttribute('data-tl-act'); const leader = a.getAttribute('data-tl-leader');
    if (act === 'prev') { st.ym = shiftMonth(st.ym, -1); await load(); return; } if (act === 'next') { st.ym = shiftMonth(st.ym, 1); await load(); return; } if (act === 'reload') { await load(); return; }
    if (act === 'rate-edit') { st.editing = leader; paint(); return; } if (act === 'rate-cancel') { st.editing = ''; paint(); return; }
    if (act === 'rate-save' && st.data) {
      const inp = body.querySelector('[data-tl-rate]'); const v = parseTeamRate(inp ? inp.value : ''); let okPriv = false, okRate = false, err = '';
      try { await setDoc(doc(db, 'master_worker_private', leader), ratePatch(v), { merge: true }); okPriv = true; } catch (e) { err = '관리자 문서: ' + ((e && (e.code || e.message)) || ''); }
      try { await setDoc(doc(db, 'team_rates', leader), Object.assign(ratePatch(v), { updatedAt: serverTimestamp() }), { merge: true }); okRate = true; } catch (e) { err += (err ? ' / ' : '') + '팀장 조회용 문서: ' + ((e && (e.code || e.message)) || ''); }
      if (okPriv) { st.data.rate[leader] = v; st.editing = ''; paint(); } toast(rateSaveMessage(okPriv, okRate, err));
    }
  };
  await load();
}

/** 영업기획 홈: 요약 카드(프로젝트·유효 견적·총 청구액·미수금)를 누르면 목록, 연체 청구·지급 임박(챙길 일), 이번 달 발행, 바로가기 */
export async function mountHome(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { projects: [], estimates: [], settlements: [], open: '', today: kstToday() };
  root.innerHTML = '<div id="hm-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#hm-body');
  try { const [a, b, c] = await Promise.all([getDocs(collection(db, 'gihoek_projects')), getDocs(collection(db, 'gihoek_estimates')), getDocs(collection(db, 'gihoek_settlements'))]); st.projects = sortProjects(lst(a)); st.estimates = lst(b); st.settlements = lst(c); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + ((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy'); const paint = () => { body.innerHTML = homeHtml(st); }; paint();
  root.onclick = (ev) => { const t = ev.target; if (!(t instanceof Element)) return; const k = t.closest('[data-hm-kpi]'); if (k) { const v = k.getAttribute('data-hm-kpi'); st.open = st.open === v ? '' : v; paint(); } };
}

/** 월말 마감(신규): 한 달의 청구·수금·지급 요약, 마감 전 점검 항목(연체·지급 전·수신자 없음·견적 종결 후보 등), 프로젝트별 월 요약, CSV 내려받기·인쇄. 조회 전용 — 저장하는 데이터는 없다 */
export async function mountClosing(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { projects: [], estimates: [], settlements: [], ym: kstToday().slice(0, 7), open: '', today: kstToday() };
  root.innerHTML = '<div id="cl-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#cl-body');
  try { const [a, b, c] = await Promise.all([getDocs(collection(db, 'gihoek_projects')), getDocs(collection(db, 'gihoek_estimates')), getDocs(collection(db, 'gihoek_settlements'))]); st.projects = sortProjects(lst(a)); st.estimates = lst(b); st.settlements = lst(c); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + ((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy'); const paint = () => { body.innerHTML = closingHtml(st); }; paint();
  root.onclick = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; const ck = t.closest('[data-cl-ck]'); if (ck) { const k = ck.getAttribute('data-cl-ck'); st.open = st.open === k ? '' : k; paint(); return; }
    const a = t.closest('[data-cl-act]'); if (!a) return; const act = a.getAttribute('data-cl-act');
    if (act === 'prev') { st.ym = shiftYm(st.ym, -1); st.open = ''; paint(); } else if (act === 'next') { st.ym = shiftYm(st.ym, 1); st.open = ''; paint(); }
    else if (act === 'print') { const w = window.open('', '_blank'); if (!w) { toast('팝업이 차단되었습니다.'); return; } w.document.write(closingPrintHtml(st)); w.document.close(); }
    else if (act === 'csv') { const link = document.createElement('a'); link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(closingCsv(st.ym, st.projects, st.settlements)); link.download = '월말마감_' + st.ym + '.csv'; document.body.appendChild(link); link.click(); link.remove(); toast(st.ym + ' 정산서 목록을 내려받았습니다.'); }
  };
}

/** 비용장부 대조(재무회계 이관): 구포털 기획의 비용장부(gihoek_expenses)를 재무회계 전표(ledger_entries)와 건마다 대조해 일치·날짜 어긋남·중복 의심·없음으로 나누고, 없는 건은 재무회계 가져오기 JSON, 프로젝트 표시는 대조표 CSV 로 내려받게 한다. 조회 전용 — 저장하는 데이터는 없다 */
export async function mountAcct(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { rows: [], projects: [], filter: { status: '', month: '', cat: '', pay: '' }, page: 1, opts: { credit: false, dup: false }, jsonCount: 0 };
  root.innerHTML = '<div id="ac-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#ac-body');
  try { const [a, b, c] = await Promise.all([getDocs(collection(db, 'gihoek_expenses')), getDocs(collection(db, 'ledger_entries')), getDocs(collection(db, 'gihoek_projects'))]); st.projects = sortProjects(lst(c)); st.rows = reconcileExpenses(lst(a), lst(b)); }
  catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + ((e && e.message) || '') + ' (재무회계 전표를 읽을 권한이 있어야 합니다)</div>'; return; }
  const recount = () => { st.jsonCount = missingToJson(st.rows, { excludeCredit: !st.opts.credit, includeDup: st.opts.dup }).entries.length; };
  body.removeAttribute('aria-busy'); const paint = () => { recount(); body.innerHTML = acctHtml(st); }; paint();
  const download = (name, mime, text) => { const link = document.createElement('a'); link.href = 'data:' + mime + ';charset=utf-8,' + encodeURIComponent(text); link.download = name; document.body.appendChild(link); link.click(); link.remove(); };
  root.onclick = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; const pg = t.closest('[data-ac-page]'); if (pg) { st.page = Number(pg.getAttribute('data-ac-page').split(':')[1]); paint(); return; }
    const a = t.closest('[data-ac-act]'); if (!a) return; const act = a.getAttribute('data-ac-act');
    if (act === 'reset') { st.filter = { status: '', month: '', cat: '', pay: '' }; st.page = 1; paint(); }
    else if (act === 'json') { const r = missingToJson(st.rows, { excludeCredit: !st.opts.credit, includeDup: st.opts.dup }); if (!r.entries.length) { toast('내려받을 전표가 없습니다.'); return; } download('비용장부_이관_가져오기.json', 'application/json', r.json); toast(r.entries.length + '건을 내려받았습니다. 재무회계 > 가져오기에서 확인 후 반영하세요.'); }
    else if (act === 'tags') { download('비용장부_프로젝트표시_대조표.csv', 'text/csv', tagTableCsv(st.rows, st.projects)); toast('프로젝트 표시 대조표를 내려받았습니다.'); }
  };
  root.onchange = (ev) => { const t = ev.target; if (!(t instanceof Element)) return; const fk = t.getAttribute('data-ac-filter'); if (fk) { st.filter[fk] = t.value; st.page = 1; paint(); return; } const op = t.getAttribute('data-ac-opt'); if (op) { st.opts[op] = t.checked; paint(); } };
}

/** 협력사 위탁(하도급) 계약서(신규): 작성·수정(작성 중) → 양쪽 서명 후 서면 발급 기록 → 변경 계약서·폐기. 계약서는 협력사 문서(gihoek_companies/<협력사>)의 contracts 배열에 저장한다(새 컬렉션 없음) */
export async function mountContracts(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null; root.onkeydown = null;
  const me = (ctx && ctx.me) || {}; const base = '#/plan/contracts'; const segs = (route && route.segs) || [];
  const st = { companies: [], projects: [], contracts: [], view: 'list', sel: '', form: null, filter: { partner: '', status: '' }, today: kstToday() };
  root.innerHTML = '<div id="ct-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#ct-body');
  const load = async () => { const [a, b] = await Promise.all([getDocs(collection(db, 'gihoek_companies')), getDocs(collection(db, 'gihoek_projects'))]); st.companies = lst(a).sort((x, y) => String(x.company || '').localeCompare(String(y.company || ''), 'ko')); st.projects = sortProjects(lst(b)); st.contracts = flattenContracts(st.companies); };
  try { await load(); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + ((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = st.view === 'form' ? contractFormHtml(st) : st.view === 'detail' ? contractDetailHtml(st) : contractsListHtml(st); window.scrollTo(0, 0); };
  const goList = (push) => { st.view = 'list'; st.sel = ''; st.form = null; if (push) pushHash(base); paint(); };
  const goDetail = (id, push) => { st.view = 'detail'; st.sel = id; st.form = null; if (push) pushHash(base + '/' + id); paint(); };
  const openForm = (c, push) => { st.view = 'form'; st.form = JSON.parse(JSON.stringify(c)); if (push) pushHash(base + (c.no ? '/' + c.id + '/edit' : '/new')); paint(); };
  const blank = () => { const issuers = st.companies.filter((c) => c.roleSupplier); const iss = issuers.find((c) => c.company === '제이에이치솔루션') || issuers[0]; return newContract({ issuer: iss, partner: null, today: st.today }); };
  const cur = () => st.contracts.find((x) => x.id === st.sel);
  const write = async (partnerId, list) => { await setDoc(doc(db, 'gihoek_companies', partnerId), { contracts: list }, { merge: true }); };
  const persist = async (k) => { const partner = st.companies.find((c) => c.id === k.partnerId); const clean = Object.assign({}, k); delete clean.partnerName; clean.updatedAt = new Date().toISOString(); clean.author = me.name || ''; clean.authorUid = me.uid || '';
    const old = st.contracts.find((x) => x.id === k.id); await write(k.partnerId, upsertContract(partner.contracts, clean)); if (old && old.partnerId !== k.partnerId) { const op = st.companies.find((c) => c.id === old.partnerId); if (op) await write(op.id, (op.contracts || []).filter((x) => x.id !== k.id)); } await load();
    const np = st.companies.find((c) => c.id === k.partnerId); if (np && !(np.contracts || []).some((x) => x.id === clean.id && x.updatedAt === clean.updatedAt)) { np.contracts = upsertContract(np.contracts, clean); st.contracts = flattenContracts(st.companies); } };   // 방금 저장한 계약서가 읽기에 아직 없으면 그대로 보여 준다
  if (segs[0] === 'new') openForm(blank(), false); else if (segs[0] && st.contracts.some((x) => x.id === segs[0])) { if (segs[1] === 'edit' && st.contracts.find((x) => x.id === segs[0]).status === 'draft') openForm(st.contracts.find((x) => x.id === segs[0]), false); else goDetail(segs[0], false); } else paint();
  const setPath = (f, path, val) => { const p = path.split('.'); let o = f; while (p.length > 1) o = o[p.shift()]; o[p[0]] = val; };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; const row = t.closest('[data-ct-open]'); if (row) { goDetail(row.getAttribute('data-ct-open'), true); return; }
    const a = t.closest('[data-ct-act]'); if (!a) return; const act = a.getAttribute('data-ct-act'); const k = cur();
    if (act === 'new') { openForm(blank(), true); return; } if (act === 'list') { goList(true); return; }
    if (act === 'cancel') { if (st.form && st.form.no) goDetail(st.form.id, true); else goList(true); return; }
    if (act === 'edit' && k && k.status === 'draft') { openForm(k, true); return; }
    if (act === 'print' && k) { const w = window.open('', '_blank'); if (!w) { toast('팝업이 차단되었습니다.'); return; } const p = st.projects.find((x) => x.id === k.pjtId); w.document.write(contractDocPage(k, { projectName: p ? p.code + ' ' + (p.name || '') : '' })); w.document.close(); return; }
    if (act === 'change' && k && k.status === 'issued') { openForm(changeFrom(k, st.today, Date.now()), true); return; }
    if (act === 'save' && st.form) {
      const f = st.form; const v = validateContract(f); if (!v.ok) { toast(v.errors[0]); return; }
      const partner = st.companies.find((c) => c.id === f.partnerId), issuer = st.companies.find((c) => c.id === f.issuerId); const sn = (c) => ({ company: c.company || '', ceo: c.ceo || '', bizno: c.bizno || '', address: c.address || '', tel: c.tel || '' });
      f.partner = sn(partner); f.issuer = sn(issuer); if (!f.no) f.no = nextContractNo(st.contracts, st.today);
      a.disabled = true; try { await persist(f); toast('계약서 ' + f.no + '를 저장했습니다.'); goDetail(f.id, true); } catch (e) { a.disabled = false; toast('저장 실패: ' + ((e && (e.code || e.message)) || '')); } return;
    }
    if (!k) return;
    if (act === 'issue' && k.status === 'draft') {
      const q = (n) => { const el = body.querySelector('[data-ci="' + n + '"]'); return el ? el.value : ''; }; const c2 = Object.assign({}, k, { issuerSignedDate: q('issuerSignedDate'), partnerSignedDate: q('partnerSignedDate'), issuedDate: q('issuedDate') });
      const r = issueBlockers(c2, st.today); if (r.blockers.length) { toast(r.blockers[0] + (r.blockers.length > 1 ? ' 외 ' + (r.blockers.length - 1) + '건' : '')); return; }
      for (const wn of r.warnings) { const ok = await confirmDialog({ title: '서면 발급 시기', body: wn + '\n그래도 발급으로 기록할까요?', confirmLabel: '기록' }); if (!ok.ok) return; }
      c2.status = 'issued'; try { await persist(c2); toast('서면 발급으로 기록했습니다.'); goDetail(k.id, false); } catch (e) { toast('저장 실패: ' + ((e && (e.code || e.message)) || '')); } return;
    }
    if (act === 'void' && k.status !== 'void') { const ok = await confirmDialog({ title: '계약서 폐기', body: k.no + ' 계약서를 폐기할까요? 폐기해도 기록은 남습니다.', confirmLabel: '폐기', tone: 'danger' }); if (!ok.ok) return; try { await persist(Object.assign({}, k, { status: 'void' })); toast('폐기했습니다.'); goDetail(k.id, false); } catch (e) { toast('저장 실패: ' + ((e && (e.code || e.message)) || '')); } return; }
    if (act === 'delete' && k.status === 'draft') { const ok = await confirmDialog({ title: '계약서 삭제', body: (k.no || '') + ' 작성 중 계약서를 삭제할까요? 되돌릴 수 없습니다.', confirmLabel: '삭제', tone: 'danger' }); if (!ok.ok) return; try { const p = st.companies.find((c) => c.id === k.partnerId); await write(p.id, (p.contracts || []).filter((x) => x.id !== k.id)); await load(); p.contracts = (p.contracts || []).filter((x) => x.id !== k.id); st.contracts = flattenContracts(st.companies); toast('삭제했습니다.'); goList(true); } catch (e) { toast('삭제 실패: ' + ((e && (e.code || e.message)) || '')); } }
  };
  root.onkeydown = (ev) => { if (ev.key !== 'Enter') return; const t = ev.target; if (!(t instanceof Element)) return; const row = t.closest('[data-ct-open]'); if (row) goDetail(row.getAttribute('data-ct-open'), true); };
  root.oninput = (ev) => { const t = ev.target; if (!(t instanceof Element) || !st.form) return; const key = t.getAttribute('data-cf'); if (!key || t.tagName === 'SELECT' || t.type === 'checkbox') return;
    if (key === 'supply' || key === 'vatOverride') { const raw = t.value.replace(/[^0-9]/g, ''); t.value = raw ? Number(raw).toLocaleString('ko-KR') : ''; setPath(st.form, key, key === 'vatOverride' && raw === '' ? null : Number(raw || 0)); const tot = body.querySelector('[data-cf="vatOverride"]'); const hint = tot && tot.closest('.jh-field') && tot.closest('.jh-field').querySelector('.jh-field__hint'); if (hint) { const sup = st.form.supply, vat = st.form.vatOverride != null ? st.form.vatOverride : Math.round(sup * 0.1); hint.textContent = '합계 ' + (sup + vat).toLocaleString('ko-KR') + '원'; } return; }
    setPath(st.form, key, t.value); };
  root.onchange = (ev) => { const t = ev.target; if (!(t instanceof Element)) return;
    const fk = t.getAttribute('data-ct-filter'); if (fk) { st.filter[fk] = t.value; paint(); return; }
    const key = t.getAttribute('data-cf'); if (!key || !st.form) return;
    if (key === 'materials.provided') { st.form.materials.provided = t.checked; const sy = window.scrollY; paint(); window.scrollTo(0, sy); return; }
    if (t.tagName === 'SELECT') setPath(st.form, key, t.value); };
}
export const mountCompanies = (root, route, ctx) => mountCompaniesView(root, route, ctx, 'all');
export const mountPartners = (root, route, ctx) => mountCompaniesView(root, route, ctx, 'partners');
/** 모듈 규약상의 기본 진입점 — 실제 화면은 옛 화면 틀(legacy/frame.js)이 사이드바와 함께 위 구역 함수를 직접 부른다. 주소가 #/plan/partners 면 협력사, 그 밖에는 거래처 */
export const mount = (root, route, ctx) => ((route && route.segs && route.segs[0]) === 'partners' ? mountPartners(root, route, ctx) : mountCompanies(root, route, ctx));   // 기본 진입점 — 프로젝트 화면은 mountProjects(구역 'projects')
