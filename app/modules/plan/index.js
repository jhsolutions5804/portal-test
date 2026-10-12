import { db, collection, getDocs, addDoc, updateDoc, setDoc, deleteDoc, doc, serverTimestamp } from '../../core/firebase.js?v=20261013s';
import { toast } from '../../core/ui.js?v=20261013s';
import { confirmDialog } from '../../core/dialog.js?v=20261013s';
import { compNew, compToForm, compBuild, fmtTel, fmtTelBlur } from './logic.js?v=20261013s';
import { companiesListHtml, companyFormHtml } from './view.js?v=20261013s';
import { projNew, projToForm, projectBuild } from './projects.js?v=20261013s';
import { projectsListHtml, projectDetailHtml, projectFormHtml } from './projects-view.js?v=20261013s';

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
    const es = t.closest('[data-pj-est]'); if (es) { openLegacy('est', 'openEst', [es.getAttribute('data-pj-est'), st.sel]); return; }
    const se = t.closest('[data-pj-set]'); if (se) { openLegacy('settle', 'openSettle', [se.getAttribute('data-pj-set'), st.sel]); return; }
    const a = t.closest('[data-pj-act]'); if (!a) return; const act = a.getAttribute('data-pj-act');
    if (act === 'list') { show('list', ''); return; }
    if (act === 'new') { st.sel = ''; st.form = projNew(); show('form', ''); return; }
    if (act === 'edit') { const p = st.projects.find((x) => x.id === st.sel); if (!p) return; st.form = projToForm(p); show('form'); return; }
    if (act === 'cancel') { show(st.sel ? 'detail' : 'list'); return; }
    if (act === 'new-est') { openLegacy('est', 'newEst', [st.sel]); return; }
    if (act === 'new-set') { openLegacy('settle', 'newSettle', [st.sel]); return; }
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
export const mountCompanies = (root, route, ctx) => mountCompaniesView(root, route, ctx, 'all');
export const mountPartners = (root, route, ctx) => mountCompaniesView(root, route, ctx, 'partners');
/** 모듈 규약상의 기본 진입점 — 실제 화면은 옛 화면 틀(legacy/frame.js)이 사이드바와 함께 위 구역 함수를 직접 부른다. 주소가 #/plan/partners 면 협력사, 그 밖에는 거래처 */
export const mount = (root, route, ctx) => ((route && route.segs && route.segs[0]) === 'partners' ? mountPartners(root, route, ctx) : mountCompanies(root, route, ctx));   // 기본 진입점 — 프로젝트 화면은 mountProjects(구역 'projects')
