import { db, auth, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from '../../core/firebase.js?v=20261011q';
import { esc, toast } from '../../core/ui.js?v=20261011q';
import { confirmDialog } from '../../core/dialog.js?v=20261011q';
import { GTYPES, GKEYS, kstToday, formToDoc, docToForm, newDefaults, SEED } from './logic.js?v=20261011q';
import { tabsHtml, homeHtml, listHtml, tableHtml } from './view.js?v=20261011q';

/** 총무(플랫폼 기본 모듈): 임대·차량·자산·갱신 일정을 한 곳에서. 관리자 전용 — 데이터는 general_* 컬렉션(보안 규칙에서 관리자 전용으로 잠가야 한다) */
export const manifest = { id: 'general', order: 25, title: '총무', icon: '🗂️', defaultHash: '#/general/home', perm: (me) => !!me && me.admin === true };
const strRow = (r) => { const o = {}; Object.keys(r || {}).forEach((k) => { o[k] = r[k] == null ? '' : String(r[k]); }); return o; };
export async function mount(root, route, ctx) {
  const want = route.segs[0]; const tab = want === 'home' || GKEYS.includes(want) ? want : 'home'; const openId = route.segs[1] || '';
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { data: {}, today: kstToday(), q: '', onlyActive: true, edit: null, seed: { lease: SEED.lease.length, vehicle: SEED.vehicle.length, asset: SEED.asset.length, renewal: SEED.renewal.length } };
  root.innerHTML = '<div class="jh-general">' + tabsHtml(tab) + '<div id="g-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#g-body'); const need = tab === 'home' ? GKEYS : [tab];
  const load = async () => { await Promise.all(need.map(async (k) => { const s = await getDocs(collection(db, GTYPES[k].coll)); const arr = []; s.forEach((d) => arr.push(Object.assign({ id: d.id }, d.data()))); arr.sort((a, b) => String(GTYPES[k].label(a)).localeCompare(String(GTYPES[k].label(b)), 'ko')); st.data[k] = arr; })); };
  try { await load(); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '<br>보안 규칙에 총무 컬렉션(관리자 허용)이 반영되었는지 확인해 주세요.</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = tab === 'home' ? homeHtml(st) : listHtml(st, tab); if (st.edit) { const e = body.querySelector('[data-gf]'); if (e && st.edit.fresh) { st.edit.fresh = false; e.scrollIntoView({ block: 'center' }); } } };
  const openEdit = (type, id) => {
    const d = id ? (st.data[type] || []).find((x) => x.id === id) : null; const T = GTYPES[type]; if (id && !d) return;
    st.edit = { type, id: id || '', isNew: !id, fresh: true, vals: d ? docToForm(type, d) : newDefaults(type), rows: d && T.log ? (d[T.log.k] || []).map(strRow) : [] }; paint();
  };
  const reloadSoft = async () => { await load(); };
  const uidNow = () => (auth.currentUser && auth.currentUser.uid) || '';
  const newLogRow = () => {
    const e = st.edit; const L = GTYPES[e.type].log; const r = {}; const num = (s) => Number(String(s || '').replace(/[,\s원]/g, '')) || 0;
    L.cols.forEach((c) => { r[c.k] = ''; if (c.t === 'date' && c.req) r[c.k] = st.today; if (c.t === 'ym') r[c.k] = st.today.slice(0, 7); if (c.t === 'select' && c.req) r[c.k] = c.o[0]; });
     if (e.type === 'lease') r.amount = String(num(e.vals.rent) + num(e.vals.vat) || '');
    return r;
  };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const go = t.closest('[data-g-go]'); if (go) { location.hash = '#/general/' + go.getAttribute('data-g-go') + '/' + go.getAttribute('data-g-id'); return; }
    if (t.closest('[data-g-add]')) { openEdit(tab, ''); return; }
    const op = t.closest('[data-g-open]'); if (op && !t.closest('input,select,button,textarea')) { openEdit(tab, op.getAttribute('data-g-open')); return; }
    if (t.closest('[data-g-logadd]')) { st.edit.rows.push(newLogRow()); paint(); return; }
    const ld = t.closest('[data-g-logdel]'); if (ld) { st.edit.rows.splice(Number(ld.getAttribute('data-g-logdel')), 1); paint(); return; }
    if (t.closest('[data-g-seed]')) {
      const arr = SEED[tab] || []; if (!arr.length) return; const ok = await confirmDialog({ title: '엑셀 기준 첫 목록 넣기', body: '월간 손익계산서 엑셀·지하111호 입금내역에서 확인된 ' + arr.length + '건을 ' + GTYPES[tab].title + ' 목록에 넣습니다. 넣은 뒤 각 항목을 열어 내용을 확인·수정하세요.', confirmLabel: '넣기' }); if (!ok.ok) return;
      try { for (const d of arr) await addDoc(collection(db, GTYPES[tab].coll), Object.assign({}, d, { createdAt: serverTimestamp(), createdBy: uidNow(), updatedAt: serverTimestamp() })); toast(arr.length + '건을 넣었습니다.'); await reloadSoft(); paint(); } catch (e) { toast('넣지 못했습니다: ' + ((e && e.message) || '')); } return;
    }
    const act = t.closest('[data-g-act]'); if (!act || !st.edit) return; const a = act.getAttribute('data-g-act'); const e = st.edit; const T = GTYPES[e.type];
    if (a === 'cancel') { st.edit = null; if (openId) history.replaceState(history.state, '', '#/general/' + tab); paint(); return; }
    if (a === 'delete') { const ok = await confirmDialog({ title: T.title + ' 항목 삭제', body: '"' + T.label(e.vals) + '" 항목과 그 이력을 지웁니다. 되돌릴 수 없습니다.', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, T.coll, e.id)); toast('삭제했습니다.'); st.edit = null; await reloadSoft(); paint(); } catch (er) { toast('삭제하지 못했습니다: ' + ((er && er.message) || '')); } return; }
    if (a === 'save') {
      const res = formToDoc(e.type, e.vals, e.rows); if (res.errors.length) { toast(res.errors[0]); return; }
      try { if (e.isNew) await addDoc(collection(db, T.coll), Object.assign({}, res.doc, { createdAt: serverTimestamp(), createdBy: uidNow(), updatedAt: serverTimestamp() })); else await updateDoc(doc(db, T.coll, e.id), Object.assign({}, res.doc, { updatedAt: serverTimestamp(), updatedBy: uidNow() })); toast('저장했습니다.'); st.edit = null; await reloadSoft(); paint(); } catch (er) { toast('저장하지 못했습니다: ' + ((er && er.message) || '')); }
    }
  };
  root.oninput = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (t.matches('[data-gf]') && st.edit) { st.edit.vals[t.getAttribute('data-gf')] = t.value; return; }
    if (t.matches('[data-gl]') && st.edit) { const [i, k] = t.getAttribute('data-gl').split(':'); if (st.edit.rows[Number(i)]) st.edit.rows[Number(i)][k] = t.value; return; }
    if (t.matches('[data-g-q]')) { st.q = t.value; const tb = body.querySelector('#g-table'); if (tb) tb.innerHTML = tableHtml(st, tab); }
  };
  root.onchange = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (t.matches('[data-g-active]')) { st.onlyActive = t.checked; const tb = body.querySelector('#g-table'); if (tb) tb.innerHTML = tableHtml(st, tab); return; }
    root.oninput(ev);
  };
  paint(); if (openId && tab !== 'home') openEdit(tab, openId);
}
