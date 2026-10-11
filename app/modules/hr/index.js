import { db, collection, getDocs, doc, setDoc, addDoc, updateDoc, serverTimestamp } from '../../core/firebase.js?v=20261011x';
import { esc, toast } from '../../core/ui.js?v=20261011x';
import { kstToday, WP_FIELDS, buildEdit, stepNow } from './logic.js?v=20261011x';
import { listHtml, tableHtml } from './view.js?v=20261011x';

/** 인사(플랫폼 기본 모듈): 근로자 명부 새 화면. 인사총무 틀 안의 구역으로만 열린다(modules/index.js 의 hostNative). 구포털 인사 화면은 그대로 두고 하나씩 옮기는 중이다. 관리자 전용 */
export const manifest = { id: 'hr', order: 21, title: '인사', icon: '👥', defaultHash: '#/hr/workers', perm: (me) => !!me && me.admin === true };
const FORM_KEYS = ['name', 'empNo', 'dept', 'rank', 'empType', 'job', 'phone', 'email', 'address', 'bankAccount', 'hireDate'];
const toForm = (w) => { const f = {}; FORM_KEYS.forEach((k) => { f[k] = w[k] == null ? '' : String(w[k]); }); f.step = stepNow(w) == null ? '' : String(stepNow(w)); f.reason = ''; return f; };
const fmtTs = (ts) => { const d = ts && ts.toDate ? ts.toDate() : ts ? new Date(ts) : null; return d && !Number.isNaN(d.getTime()) ? d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0') : '-'; };
export const mountWorkers = (root, route, ctx) => mount(root, route, ctx, { base: '#/hr/workers' });
export async function mount(root, route, ctx, opts) {
  const BASE = (opts && opts.base) || '#/hr/workers'; const openId = (route.segs && route.segs[0]) || '';
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { today: kstToday(), workers: [], contracts: {}, view: 'active', q: '', sel: null };
  root.innerHTML = '<div class="jh-hr"><div id="w-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#w-body');
  const load = async () => {
    const [ws, ps] = await Promise.all([getDocs(collection(db, 'workers')), getDocs(collection(db, 'worker_private')).catch(() => null)]);
    const priv = new Map(); if (ps) ps.forEach((d) => priv.set(d.id, d.data()));
    const list = []; ws.forEach((d) => list.push(Object.assign({ id: d.id }, d.data(), priv.get(d.id) || {}))); st.workers = list;
    const end = (snap) => { let last = ''; snap.forEach((c) => { const e = (c.data() || {}).endDate || ''; if (e > last) last = e; }); return { end: last, n: snap.size }; };
    await Promise.all(list.map(async (w) => { try { const [a, b] = await Promise.all([getDocs(collection(db, 'labor_contracts/' + w.id + '/contracts')), getDocs(collection(db, 'annual_contracts/' + w.id + '/contracts'))]); const l = end(a), n = end(b); st.contracts[w.id] = { laborEnd: l.end, laborN: l.n, annualEnd: n.end, annualN: n.n }; } catch (e) { st.contracts[w.id] = { laborEnd: '', laborN: 0, annualEnd: '', annualN: 0 }; } }));
  };
  try { await load(); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = listHtml(st); };
  const open = (id) => { const w = st.workers.find((x) => x.id === id); if (!w) return; st.sel = { id, orig: w, form: toForm(w), history: null }; if (st.workers.find((x) => x.id === id) && isRes(w) && st.view !== 'resigned') st.view = 'resigned'; paint(); const f = body.querySelector('[data-w-f]'); if (f) f.scrollIntoView({ block: 'center' }); };
  const isRes = (w) => w.status === 'resigned';
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const v = t.closest('[data-w-view]'); if (v) { st.view = v.getAttribute('data-w-view'); st.sel = null; paint(); return; }
    const o = t.closest('[data-w-open]'); if (o) { open(o.getAttribute('data-w-open')); return; }
    const a = t.closest('[data-w-act]'); if (!a || !st.sel) return; const act = a.getAttribute('data-w-act');
    if (act === 'close') { st.sel = null; paint(); return; }
    if (act === 'history') {
      try { const s = await getDocs(collection(db, 'workers/' + st.sel.id + '/history')); const h = []; s.forEach((d) => { const x = d.data(); h.push(Object.assign({}, x, { date: fmtTs(x.changedAt), ms: x.changedAt && x.changedAt.toMillis ? x.changedAt.toMillis() : 0 })); }); h.sort((p, q) => q.ms - p.ms); st.sel.history = h; paint(); } catch (e) { toast('이력을 불러오지 못했습니다: ' + ((e && e.message) || '')); } return;
    }
    if (act === 'save') {
      const sel = st.sel; const res = buildEdit(sel.orig, sel.form, { others: st.workers });
      if (!res.ok) { toast(res.errors[0]); return; }
      try {
        const id = sel.id; const stamp = { updatedAt: serverTimestamp() };
        await setDoc(doc(db, 'workers', id), Object.assign({}, res.pub, stamp), { merge: true });
        const changedPriv = {}; ['address', 'bankAccount'].forEach((k) => { if ((res.priv[k] || '') !== (sel.orig[k] || '')) changedPriv[k] = res.priv[k]; });
        if (Object.keys(changedPriv).length) await setDoc(doc(db, 'worker_private', id), Object.assign({}, changedPriv, sel.orig.portalUid ? { portalUid: sel.orig.portalUid } : {}), { merge: true });
        if (res.history) await addDoc(collection(db, 'workers/' + id + '/history'), Object.assign({}, res.history, { changedAt: serverTimestamp() }));
        if (res.portal) { try { await updateDoc(doc(db, 'portal_users', res.portal.uid), res.portal.fields); } catch (e) { toast('저장했지만 포털 계정 정보는 갱신하지 못했습니다: ' + ((e && e.message) || '')); } }
        toast(res.stepReset ? '저장했습니다. 직급이 바뀌어 호봉을 1로 초기화했습니다.' : '저장했습니다.'); st.sel = null; await load(); paint();
      } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); }
    }
  };
  root.oninput = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (t.matches('[data-w-f]') && st.sel) { st.sel.form[t.getAttribute('data-w-f')] = t.value; return; }
    if (t.matches('[data-w-q]')) { st.q = t.value; const tb = body.querySelector('#w-table'); if (tb) tb.innerHTML = tableHtml(st); }
  };
  root.onchange = (ev) => { const t = ev.target; if (t instanceof Element && t.matches('[data-w-f]') && st.sel) { st.sel.form[t.getAttribute('data-w-f')] = t.value; if (t.getAttribute('data-w-f') === 'hireDate') paint(); } };
  paint(); if (openId) open(openId);
}
