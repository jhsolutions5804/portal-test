import { db, collection, getDocs, setDoc, deleteDoc, doc } from '../../core/firebase.js?v=20261013q';
import { toast } from '../../core/ui.js?v=20261013q';
import { confirmDialog } from '../../core/dialog.js?v=20261013q';
import { compNew, compToForm, compBuild, fmtTel, fmtTelBlur } from './logic.js?v=20261013q';
import { companiesListHtml, companyFormHtml } from './view.js?v=20261013q';

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
export const mountCompanies = (root, route, ctx) => mountCompaniesView(root, route, ctx, 'all');
export const mountPartners = (root, route, ctx) => mountCompaniesView(root, route, ctx, 'partners');
/** 모듈 규약상의 기본 진입점 — 실제 화면은 옛 화면 틀(legacy/frame.js)이 사이드바와 함께 위 구역 함수를 직접 부른다. 주소가 #/plan/partners 면 협력사, 그 밖에는 거래처 */
export const mount = (root, route, ctx) => ((route && route.segs && route.segs[0]) === 'partners' ? mountPartners(root, route, ctx) : mountCompanies(root, route, ctx));
