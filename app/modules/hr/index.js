import { db, collection, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, deleteField, query, where, serverTimestamp } from '../../core/firebase.js?v=20261011z';
import { confirmDialog } from '../../core/dialog.js?v=20261011z';
import { esc, toast } from '../../core/ui.js?v=20261011z';
import { leaveRows, kstToday, WP_FIELDS, buildEdit, stepNow, NEW_FORM, buildNew, newWorkerId, buildResign, linkCandidate } from './logic.js?v=20261011z';
import { listHtml, tableHtml, leaveHtml } from './view.js?v=20261011z';

/** 인사(플랫폼 기본 모듈): 근로자 명부 새 화면. 인사총무 틀 안의 구역으로만 열린다(modules/index.js 의 hostNative). 구포털 인사 화면은 그대로 두고 하나씩 옮기는 중이다. 관리자 전용 */
export const manifest = { id: 'hr', order: 21, title: '인사', icon: '👥', defaultHash: '#/hr/workers', perm: (me) => !!me && me.admin === true };
const FORM_KEYS = ['name', 'empNo', 'dept', 'rank', 'empType', 'job', 'phone', 'email', 'address', 'bankAccount', 'hireDate'];
const toForm = (w) => { const f = {}; FORM_KEYS.forEach((k) => { f[k] = w[k] == null ? '' : String(w[k]); }); f.step = stepNow(w) == null ? '' : String(stepNow(w)); f.reason = ''; return f; };
const fmtTs = (ts) => { const d = ts && ts.toDate ? ts.toDate() : ts ? new Date(ts) : null; return d && !Number.isNaN(d.getTime()) ? d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0') : '-'; };
export const mountWorkers = (root, route, ctx) => mount(root, route, ctx, { base: '#/hr/workers' });
export async function mount(root, route, ctx, opts) {
  const BASE = (opts && opts.base) || '#/hr/workers'; const openId = (route.segs && route.segs[0]) || '';
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { today: kstToday(), workers: [], contracts: {}, view: 'active', q: '', sel: null, reg: null };
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
    const a0 = t.closest('[data-w-act]'); const act0 = a0 && a0.getAttribute('data-w-act');
    if (act0 === 'reg-new') { st.sel = null; st.reg = { form: NEW_FORM() }; paint(); const f0 = body.querySelector('[data-w-rf]'); if (f0) f0.scrollIntoView({ block: 'center' }); return; }
    if (act0 === 'reg-cancel') { st.reg = null; paint(); return; }
    if (act0 === 'reg-save' && st.reg) {
      const r = buildNew(st.reg.form, st.workers, { today: st.today }); if (!r.ok) { toast(r.errors[0]); return; }
      try {
        const id = newWorkerId(crypto.getRandomValues(new Uint8Array(8))); await setDoc(doc(db, 'workers', id), Object.assign({}, r.pub, { updatedAt: serverTimestamp() })); await setDoc(doc(db, 'worker_private', id), r.priv, { merge: true });
        let linked = ''; try { const us = await getDocs(query(collection(db, 'portal_users'), where('name', '==', r.pub.name))); const c = linkCandidate(us.docs.map((d) => Object.assign({ id: d.id }, d.data())), r.pub.name); if (c.state === 'one') { await updateDoc(doc(db, 'workers', id), { portalUid: c.user.id }); await setDoc(doc(db, 'worker_private', id), { portalUid: c.user.id }, { merge: true }); await updateDoc(doc(db, 'portal_users', c.user.id), { workerId: id, empNo: r.empNo }); linked = ' 포털 계정과 연동했습니다.'; } } catch (e) { /* 연동 실패는 등록에 영향 없음 */ }
        toast('등록했습니다. 사원번호 ' + r.empNo + '.' + linked); st.reg = null; await load(); paint();
      } catch (e) { toast('등록하지 못했습니다: ' + ((e && e.message) || '')); }
      return;
    }
    const a = a0; if (!a || !st.sel) return; const act = a.getAttribute('data-w-act');
    if (act === 'resign') { const rr = buildResign(st.sel.form.resignDate || st.today); if (!rr.ok) { toast(rr.error); return; } const ok = await confirmDialog({ title: '퇴직 처리', body: (st.sel.orig.name || '') + '님을 ' + rr.patch.resignDate + ' 자로 퇴직 처리합니다. 명부에서 지워지지 않고 "퇴직"으로 표시됩니다.', confirmLabel: '퇴직 처리' }); if (!ok.ok) return; try { await setDoc(doc(db, 'workers', st.sel.id), Object.assign({}, rr.patch, { updatedAt: serverTimestamp() }), { merge: true }); toast('퇴직 처리했습니다.'); st.sel = null; await load(); paint(); } catch (e) { toast('처리하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    if (act === 'unresign') { const ok = await confirmDialog({ title: '재직 복구', body: (st.sel.orig.name || '') + '님을 재직 상태로 되돌립니다.', confirmLabel: '복구' }); if (!ok.ok) return; try { await setDoc(doc(db, 'workers', st.sel.id), { status: 'active', resignDate: deleteField(), updatedAt: serverTimestamp() }, { merge: true }); toast('재직 상태로 복구했습니다.'); st.view = 'active'; st.sel = null; await load(); paint(); } catch (e) { toast('처리하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    if (act === 'delete') { const ok = await confirmDialog({ title: '명부에서 삭제', body: (st.sel.orig.name || '') + '님을 명부에서 삭제합니다(개인정보 문서 포함). 계약서 자료는 남습니다. 되돌릴 수 없습니다.', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, 'workers', st.sel.id)); try { await deleteDoc(doc(db, 'worker_private', st.sel.id)); } catch (e) { /* 개인정보 문서가 없어도 계속 */ } toast('삭제했습니다.'); st.sel = null; await load(); paint(); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    if (act === 'link') { try { const nm = st.sel.orig.name; const us = await getDocs(query(collection(db, 'portal_users'), where('name', '==', nm))); const c = linkCandidate(us.docs.map((d) => Object.assign({ id: d.id }, d.data())), nm); if (c.state !== 'one') { toast(c.message); return; } await updateDoc(doc(db, 'workers', st.sel.id), { portalUid: c.user.id }); await setDoc(doc(db, 'worker_private', st.sel.id), { portalUid: c.user.id }, { merge: true }); await updateDoc(doc(db, 'portal_users', c.user.id), { workerId: st.sel.id, empNo: st.sel.orig.empNo || c.user.empNo || '' }); toast('"' + nm + '" 포털 계정과 연동했습니다.'); st.sel = null; await load(); paint(); } catch (e) { toast('연동하지 못했습니다: ' + ((e && e.message) || '')); } return; }
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
    if (t.matches('[data-w-rf]') && st.reg) { st.reg.form[t.getAttribute('data-w-rf')] = t.value; return; }
    if (t.matches('[data-w-q]')) { st.q = t.value; const tb = body.querySelector('#w-table'); if (tb) tb.innerHTML = tableHtml(st); }
  };
  root.onchange = (ev) => { const t = ev.target; if (t instanceof Element && t.matches('[data-w-rf]') && st.reg) { st.reg.form[t.getAttribute('data-w-rf')] = t.value; if (t.getAttribute('data-w-rf') === 'hireDate') paint(); return; } if (t instanceof Element && t.matches('[data-w-f]') && st.sel) { st.sel.form[t.getAttribute('data-w-f')] = t.value; if (t.getAttribute('data-w-f') === 'hireDate') paint(); } };
  paint(); if (openId) open(openId);
}

/** 연차 현황(새 화면) — 근로자 명부 + 전자결재 연차신청서. 읽기 전용(등록·수정·사용촉진은 기존 화면) */
export async function mountLeaves(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { today: kstToday(), workers: [], docs: [], leaveAll: false, leaveRows: [], leaveSel: (route.segs && route.segs[0]) || '' };
  root.innerHTML = '<div class="jh-hr"><div id="l-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#l-body');
  try {
    const [ws, ls] = await Promise.all([getDocs(collection(db, 'workers')), getDocs(collection(db, 'edoc_leave'))]);
    ws.forEach((d) => st.workers.push(Object.assign({ id: d.id }, d.data()))); ls.forEach((d) => st.docs.push(Object.assign({ id: d.id }, d.data())));
  } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const calc = () => { st.leaveRows = leaveRows(st.workers, st.docs, st.today, st.leaveAll); };
  const paint = () => { calc(); body.innerHTML = leaveHtml(st); };
  root.onclick = (ev) => { const t = ev.target; if (!(t instanceof Element)) return; const o = t.closest('[data-l-open]'); if (o) { st.leaveSel = o.getAttribute('data-l-open'); paint(); const k = body.querySelector('.jh-kpi'); if (k) k.scrollIntoView({ block: 'center' }); return; } if (t.closest('[data-l-close]')) { st.leaveSel = ''; paint(); } };
  root.onchange = (ev) => { const t = ev.target; if (t instanceof Element && t.matches('[data-l-all]')) { st.leaveAll = t.checked; paint(); } };
  paint();
}
