import { db, collection, getDocs, addDoc, updateDoc, setDoc, deleteDoc, doc, serverTimestamp, writeBatch } from '../../core/firebase.js?v=20261013v';
import { toast } from '../../core/ui.js?v=20261013v';
import { confirmDialog } from '../../core/dialog.js?v=20261013v';
import { compNew, compToForm, compBuild, fmtTel, fmtTelBlur, kstToday } from './logic.js?v=20261013v';
import { companiesListHtml, companyFormHtml } from './view.js?v=20261013v';
import { projNew, projToForm, projectBuild } from './projects.js?v=20261013v';
import { projectsListHtml, projectDetailHtml, projectFormHtml } from './projects-view.js?v=20261013v';
import { uiState, pushHash } from './ui.js?v=20261013v';
import { itemAmt, blankItem, itemSetQty, itemSetPrice, itemSetAmount, applySupplyEdit, draftTotals, newDraft, draftFromEstimate, buildEstimate, closePatch, reopenPatch, estGroup, sortEstimates } from './estimates.js?v=20261013v';
import { estimatesListHtml, estimateDetailHtml, estimateFormHtml, itemRowHtml } from './estimates-view.js?v=20261013v';
import { estDocHtml } from './estimate-doc.js?v=20261013v';
import { sortProjects } from './projects.js?v=20261013v';
import { linkPlan, donePatch, undonePatch, voidPatch, doneConfirm, undoneConfirm, doneToast, projectBalance, acctMonthInput } from './settlements.js?v=20261013v';
import { settlementsListHtml, settlementDetailHtml } from './settlements-view.js?v=20261013v';
import { settleDocPage } from './settlement-doc.js?v=20261013v';
import { issueFormHtml, qtyBlocksHtml, totalsHtml, manualRowHtml } from './issue-view.js?v=20261013v';
import { newIssueDraft, togglePjt, toggleEst, setQty, setQtyAmount, setSupplyOverride, setVatOverride, resetTotals, buildSettlement, itemSetQty as isItemQty, itemSetPrice as isItemPrice, itemSetAmount as isItemAmount, blankItem as isBlank } from './issue.js?v=20261013v';

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
        if (r.registry) { const ref = await addDoc(collection(db, 'pjt_registry'), Object.assign({}, r.registry, { createdAt: serverTimestamp() })); link = 'reg_' + ref.id; }   // PJT관리에 같은 이름의 경량 PJT 자동 생성
        data.linkPjt = link;
        if (r.syncPatch) { try { await updateDoc(doc(db, 'pjt_registry', link.slice(4)), r.syncPatch); } catch (e) { console.warn('[영업기획] 연동 PJT 동기화 실패:', e && e.message); } }   // 기본정보 6항목은 기획 ↔ PJT관리가 같은 값
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
  const load = async () => { const [a, b, c, d] = await Promise.all([getDocs(collection(db, 'gihoek_settlements')), getDocs(collection(db, 'gihoek_projects')), getDocs(collection(db, 'gihoek_estimates')), getDocs(collection(db, 'gihoek_companies'))]); st.settlements = lst(a); st.projects = sortProjects(lst(b)); st.estimates = lst(c); st.companies = lst(d).sort((x, y) => String(x.company || '').localeCompare(String(y.company || ''), 'ko')); };
  try { await load(); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + ((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = st.view === 'issue' ? issueFormHtml(st) : st.view === 'detail' ? settlementDetailHtml(st) : settlementsListHtml(st); window.scrollTo(0, st.view === 'list' ? restoreY : 0); restoreY = 0; };
  const startIssue = (pjtId) => { if (!st.projects.length) { toast('먼저 프로젝트를 등록하세요.'); location.hash = '#/plan/projects'; return; } st.draft = newIssueDraft({ docType: kind, pjtId: pjtId || st.projects[0].id, companies: st.companies, today: kstToday() }); st.view = 'issue'; st.sel = ''; paint(); };
  const goList = (push) => { st.view = 'list'; st.sel = ''; st.draft = null; st.origin = ''; st.linkOpen = false; st.editAcct = false; if (push) pushHash(base); paint(); };
  const goDetail = (id, push) => { if (push && st.view === 'list') remember(window.scrollY || 0); st.view = 'detail'; st.sel = id; st.linkOpen = false; st.linkSel = {}; st.editAcct = false; if (push) pushHash(base + '/' + id + (st.origin ? '/from/' + st.origin : '')); paint(); };
  const goBack = () => { if (st.origin) { location.hash = '#/plan/projects/' + st.origin; return; } goList(true); };
  const segs = (route && route.segs) || []; const s0 = segs[0];
  if (s0 === 'new') startIssue(segs[1] || ''); else if (s0 && st.settlements.some((x) => x.id === s0)) { if (segs[1] === 'from' && segs[2]) st.origin = segs[2]; st.view = 'detail'; st.sel = s0; paint(); } else paint();
  const refreshTot = () => { const el = body.querySelector('#is-tot'); if (el) el.innerHTML = totalsHtml(st); };
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
      if (iact === 'publish') {
        const r = buildSettlement(d, { settlements: st.settlements, estimates: st.estimates, companies: st.companies, me: { name: me.name, uid: me.uid }, now: Date.now() }); if (!r.ok) { toast(r.errors[0]); return; }
        if (r.warnings.length) { const ok = await confirmDialog({ title: '수신자 미선택', body: r.warnings[0], confirmLabel: '발행' }); if (!ok.ok) return; }
        ia.disabled = true;
        try { await setDoc(doc(db, 'gihoek_settlements', r.id), Object.assign({}, r.payload, { createdAt: serverTimestamp() })); toast(r.message); await load(); /* 방금 저장한 문서가 목록에 아직 없으면(지연) 그대로 보여 준다 */ if (!st.settlements.some((x) => x.id === r.id)) st.settlements.push(Object.assign({ id: r.id }, r.payload)); st.draft = null; goDetail(r.id, true); } catch (e) { ia.disabled = false; toast('발행 실패: ' + ((e && (e.code || e.message)) || '')); }
      }
      return;
    }
    const idl = t.closest('[data-is-del]'); if (idl && st.draft) { st.draft.manualItems.splice(Number(idl.getAttribute('data-is-del')), 1); if (!st.draft.manualItems.length) st.draft.manualItems.push(isBlank()); const r = body.querySelector('#is-rows'); if (r) r.innerHTML = st.draft.manualItems.map(manualRowHtml).join(''); refreshTot(); return; }
    const a = t.closest('[data-sl-act]'); if (!a) return; const act = a.getAttribute('data-sl-act'); const cur = st.settlements.find((x) => x.id === st.sel);
    if (act === 'reset') { st.filter = { pjtId: '', client: '', month: '', status: '' }; st.page = 1; remember(0); paint(); return; }
    if (act === 'new') { startIssue(''); return; }
    if (act === 'team') { openLegacy('settle', 'setSettleView', ['team']); return; }
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
    const t = ev.target; if (!(t instanceof Element) || !st.draft) return; const c = t.getAttribute('data-is-it'); if (!c) return; const [i, k] = c.split(':'); const it = st.draft.manualItems[Number(i)]; if (!it) return;
    if (k === 'name' || k === 'spec') { it[k] = t.value; return; }
    if (k === 'price' || k === 'amount') { const raw = t.value.replace(/[^0-9]/g, ''); t.value = raw ? Number(raw).toLocaleString('ko-KR') : ''; }
    if (k === 'qty') isItemQty(it, t.value); else if (k === 'price') isItemPrice(it, t.value); else isItemAmount(it, t.value);
    const set = (kk, v) => { if (kk === k) return; const el = body.querySelector('[data-is-it="' + i + ':' + kk + '"]'); if (el) el.value = Math.round(v).toLocaleString('ko-KR'); }; set('price', it.price); set('amount', it.amount); refreshTot();
  };
  root.onchange = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (st.draft) {
      const d = st.draft; const pj = t.getAttribute('data-is-pjt'); if (pj) { const err = togglePjt(d, pj, st.estimates); if (err) { toast(err); t.checked = true; return; } paint(); return; }
      const es = t.getAttribute('data-is-est'); if (es) { toggleEst(d, es); paint(); return; }
      const q = t.getAttribute('data-is-q'); if (q) { const [eid, idx] = q.split(':'); setQty(d, eid, Number(idx), t.value); const qb = body.querySelector('#is-qty'); if (qb) qb.innerHTML = qtyBlocksHtml(st); refreshTot(); return; }
      const qa = t.getAttribute('data-is-qa'); if (qa) { const [eid, idx] = qa.split(':'); setQtyAmount(d, eid, Number(idx), t.value); const qb = body.querySelector('#is-qty'); if (qb) qb.innerHTML = qtyBlocksHtml(st); refreshTot(); return; }
      if (t.hasAttribute('data-is-supply')) { setSupplyOverride(d, t.value); refreshTot(); return; }
      if (t.hasAttribute('data-is-vat')) { setVatOverride(d, t.value); refreshTot(); return; }
      const f = t.getAttribute('data-is-f'); if (f) { d[f] = t.value; if (f === 'senderId') d.senderContact = ''; if (f === 'recipientId') d.recipientContact = ''; if (['method', 'baseMonth', 'senderId', 'recipientId'].includes(f)) paint(); return; }
    }
    const fk = t.getAttribute('data-sl-filter'); if (fk) { st.filter[fk] = t.value; st.page = 1; remember(0); paint(); return; }
    const lk = t.getAttribute('data-sl-link'); if (lk != null) st.linkSel[lk] = t.value;
  };
}
export const mountBilling = (root, route, ctx) => mountSettlementsView(root, route, ctx, 'invoice');
export const mountPayout = (root, route, ctx) => mountSettlementsView(root, route, ctx, 'payment');
export const mountCompanies = (root, route, ctx) => mountCompaniesView(root, route, ctx, 'all');
export const mountPartners = (root, route, ctx) => mountCompaniesView(root, route, ctx, 'partners');
/** 모듈 규약상의 기본 진입점 — 실제 화면은 옛 화면 틀(legacy/frame.js)이 사이드바와 함께 위 구역 함수를 직접 부른다. 주소가 #/plan/partners 면 협력사, 그 밖에는 거래처 */
export const mount = (root, route, ctx) => ((route && route.segs && route.segs[0]) === 'partners' ? mountPartners(root, route, ctx) : mountCompanies(root, route, ctx));   // 기본 진입점 — 프로젝트 화면은 mountProjects(구역 'projects')
