import { auth, getDoc, db, orderBy, limit, collection, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, deleteField, query, where, serverTimestamp } from '../../core/firebase.js?v=20261012i';
import { confirmDialog } from '../../core/dialog.js?v=20261012i';
import { holidayName } from '../../shared/holidays.js?v=20261012i';
import { esc, toast } from '../../core/ui.js?v=20261012i';
import { salNormalize, salRegenerate, salSetField, salSetTenure, salEditCell, appStatusOf, joinInterview, splitInterview, interviewCalendar, prefillFromApplicant, resumePrintHtml, NEW_EVAL, buildEval, evalLatestRegular, buildStepInput, hcMove, hcMonthRange, hcValidate, hcExpandLeaves, hcResignPlan, rrqFindWorker, resignPrintHtml, NEW_INTERVIEW, buildInterview, latestInterview, JOB_HOME_BASE, jobCompose, jobFormOf, buildJob, normalizeOpt, buildChange, salaryEvents, historyEvent, leaveRows, kstToday, WP_FIELDS, buildEdit, stepNow, NEW_FORM, buildNew, newWorkerId, buildResign, linkCandidate } from './logic.js?v=20261012i';
import { listHtml, tableHtml, leaveHtml, changeHtml, postingsHtml, interviewsHtml, resignReqHtml, calendarHtml, evalsHtml, applicantsHtml, salaryHtml } from './view.js?v=20261012i';

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

/** 인사 변동(새 화면) — 직급·소속 변경(이력·호봉 초기화·포털 반영)과 변동 현황 */
export async function mountChange(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { today: kstToday(), chWorkers: [], chEvents: [], chSalary: {}, chSel: (route.segs && route.segs[0]) || '', chForm: { rank: '', dept: '', date: kstToday(), reason: '' }, chType: 'all', chOnlySel: false };
  root.innerHTML = '<div class="jh-hr"><div id="c-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#c-body');
  const load = async () => {
    const ws = await getDocs(collection(db, 'workers')); const list = []; ws.forEach((d) => { const x = Object.assign({ id: d.id }, d.data()); if (x.status !== 'resigned') list.push(x); });
    list.sort((a, b) => String(a.empNo || 'zzz').localeCompare(String(b.empNo || 'zzz'))); const events = []; const salary = {};
    await Promise.all(list.map(async (w) => {
      try { const hs = await getDocs(collection(db, 'workers/' + w.id + '/history')); hs.forEach((d) => { const h = d.data(); const e = historyEvent(w, h, fmtTs(h.changedAt)); if (e) events.push(e); }); } catch (e) { /* 이력이 없거나 못 읽으면 건너뜀 */ }
      try { const as = await getDocs(collection(db, 'annual_contracts/' + w.id + '/contracts')); const cs = []; as.forEach((d) => cs.push(d.data())); const r = salaryEvents(w, cs); r.events.forEach((e) => events.push(e)); if (r.current) salary[w.id] = r.current; } catch (e) { /* 연봉계약서 없음 */ }
    }));
    st.chWorkers = list; st.chEvents = events; st.chSalary = salary;
  };
  try { await load(); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const select = (id) => { st.chSel = id; const w = st.chWorkers.find((x) => x.id === id); st.chForm = { rank: w ? w.rank || '' : '', dept: w ? w.dept || '' : '', date: st.today, reason: '' }; };
  const paint = () => { body.innerHTML = changeHtml(st); };
  root.onchange = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (t.matches('[data-c-sel]')) { select(t.value); paint(); return; }
    if (t.matches('[data-c-f]')) { st.chForm[t.getAttribute('data-c-f')] = t.value; if (['rank', 'dept'].includes(t.getAttribute('data-c-f'))) paint(); return; }
    if (t.matches('[data-c-type]')) { st.chType = t.value; paint(); return; }
    if (t.matches('[data-c-only]')) { st.chOnlySel = t.checked; paint(); }
  };
  root.oninput = (ev) => { const t = ev.target; if (t instanceof Element && t.matches('[data-c-f]')) st.chForm[t.getAttribute('data-c-f')] = t.value; };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element) || !t.closest('[data-c-act="save"]')) return;
    const w = st.chWorkers.find((x) => x.id === st.chSel); const r = buildChange(w, st.chForm, st.today); if (!r.ok) { toast(r.errors[0]); return; }
    const ok = await confirmDialog({ title: '인사 변동 저장', body: (w.name || '') + '님: ' + r.label + ' (시행일 ' + r.history.effectiveDate + ')' + (r.stepReset ? '. 직급 변경으로 호봉이 1호봉으로 초기화됩니다.' : '.'), confirmLabel: '저장' }); if (!ok.ok) return;
    try {
      await setDoc(doc(db, 'workers', w.id), Object.assign({}, r.patch, { updatedAt: serverTimestamp() }), { merge: true });
      await addDoc(collection(db, 'workers/' + w.id + '/history'), Object.assign({}, r.history, { changedAt: serverTimestamp() }));
      if (r.portal) { try { await updateDoc(doc(db, 'portal_users', r.portal.uid), r.portal.fields); } catch (e) { toast('저장했지만 포털 계정 정보는 갱신하지 못했습니다: ' + ((e && e.message) || '')); } }
      toast('인사 변동을 저장했습니다.' + (r.stepReset ? ' 호봉을 1호봉으로 초기화했습니다.' : '')); const keep = w.id; await load(); select(keep); paint();
    } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); }
  };
  if (st.chSel) select(st.chSel); paint();
}

/** 공고 관리(새 화면) — job_postings 등록·수정·마감/게시·삭제. 홈페이지가 open 공고만 읽어 보여 준다 */
export async function mountPostings(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { jobs: [], jf: null };
  root.innerHTML = '<div class="jh-hr"><div id="j-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#j-body');
  const load = async () => { const s = await getDocs(collection(db, 'job_postings')); const l = []; s.forEach((d) => { const x = d.data(); l.push(Object.assign({ id: d.id }, x, { createdMs: x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : 0 })); }); st.jobs = l; };
  try { await load(); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const preview = () => { if (!st.jf) return; const c = jobCompose(normalizeOpt(st.jf.o)); [['career', c.career], ['education', c.education], ['empType', c.empType], ['workTime', c.workTime]].forEach(([k, v]) => { const e = body.querySelector('#jp-pv-' + k); if (e) e.textContent = '홈페이지 표시: ' + (v || '(선택 없음)'); }); };
  const paint = () => { body.innerHTML = postingsHtml(st); preview(); };
  const openForm = (id) => { const j = id ? st.jobs.find((x) => x.id === id) : null; if (id && !j) return; const r = jobFormOf(j); st.jf = { id: id || '', f: r.f, o: r.o }; paint(); };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const pg = t.closest('[data-j-page]'); if (pg) { const [file, id] = pg.getAttribute('data-j-page').split(':'); window.open(JOB_HOME_BASE + '/' + file + (id ? '?job=' + encodeURIComponent(id) : ''), '_blank', 'noopener'); return; }
    if (t.closest('[data-j-new]')) { openForm(''); return; }
    const ed = t.closest('[data-j-edit]'); if (ed) { openForm(ed.getAttribute('data-j-edit')); return; }
    const tg = t.closest('[data-j-toggle]'); if (tg) { const j = st.jobs.find((x) => x.id === tg.getAttribute('data-j-toggle')); if (!j) return; const next = j.status === 'open' ? 'closed' : 'open'; const ok = await confirmDialog({ title: next === 'open' ? '공고 게시' : '공고 마감', body: '「' + (j.title || '') + '」 공고를 ' + (next === 'open' ? '게시' : '마감 처리') + '합니다.', confirmLabel: next === 'open' ? '게시' : '마감 처리' }); if (!ok.ok) return; try { await updateDoc(doc(db, 'job_postings', j.id), { status: next, updatedAt: serverTimestamp() }); toast(next === 'open' ? '게시했습니다.' : '마감 처리했습니다.'); await load(); paint(); } catch (e) { toast('처리하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const dl = t.closest('[data-j-del]'); if (dl) { const j = st.jobs.find((x) => x.id === dl.getAttribute('data-j-del')); if (!j) return; const ok = await confirmDialog({ title: '공고 삭제', body: '「' + (j.title || '') + '」 공고를 삭제합니다. 홈페이지에서도 사라지고 되돌릴 수 없습니다(이미 접수된 지원서는 그대로 유지됩니다).', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, 'job_postings', j.id)); toast('삭제했습니다.'); await load(); paint(); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const ch = t.closest('[data-j-chip]'); if (ch && st.jf) { const [g, val] = ch.getAttribute('data-j-chip').split(':'); const o = st.jf.o; if (g === 'career') o.careerType = val; else if (g === 'edu') o.eduLevel = val; else if (g === 'emp') { const s = new Set(o.emp || []); if (s.has(val)) s.delete(val); else s.add(val); o.emp = [...s]; } paint(); return; }
    const a = t.closest('[data-j-act]'); if (!a || !st.jf) return;
    if (a.getAttribute('data-j-act') === 'cancel') { st.jf = null; paint(); return; }
    const r = buildJob(st.jf.f, st.jf.o); if (!r.ok) { toast(r.errors[0]); return; }
    try { const data = Object.assign({}, r.data, { updatedAt: serverTimestamp() }); if (st.jf.id) await setDoc(doc(db, 'job_postings', st.jf.id), data, { merge: true }); else await addDoc(collection(db, 'job_postings'), Object.assign(data, { createdAt: serverTimestamp() })); toast('저장했습니다.'); st.jf = null; await load(); paint(); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); }
  };
  root.oninput = (ev) => { const t = ev.target; if (!(t instanceof Element) || !st.jf) return; if (t.matches('[data-j-f]')) { st.jf.f[t.getAttribute('data-j-f')] = t.value; return; } if (t.matches('[data-j-o]') && t.tagName === 'INPUT') { st.jf.o[t.getAttribute('data-j-o')] = t.value; preview(); } };
  root.onchange = (ev) => { const t = ev.target; if (!(t instanceof Element) || !st.jf) return; if (t.matches('[data-j-f]')) { st.jf.f[t.getAttribute('data-j-f')] = t.value; return; } if (t.matches('[data-j-o]')) { st.jf.o[t.getAttribute('data-j-o')] = t.value; paint(); return; } if (t.matches('[data-j-oc]')) { st.jf.o[t.getAttribute('data-j-oc')] = t.checked; paint(); } };
  paint();
}

/** 근로자 면담(새 화면) — interviews/{근로자}/records. 재직자 목록(최근 면담)과 근로자별 이력·신규 기록·삭제 */
export async function mountInterviews(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { today: kstToday(), ivWorkers: [], ivLatest: {}, ivSel: '', ivForm: NEW_INTERVIEW(kstToday()), ivRecords: [] };
  root.innerHTML = '<div class="jh-hr"><div id="i-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#i-body');
  const loadList = async () => {
    const ws = await getDocs(collection(db, 'workers')); const list = []; ws.forEach((d) => { const x = Object.assign({ id: d.id }, d.data()); if (x.status !== 'resigned') list.push(x); });
    list.sort((a, b) => String(a.empNo || '').localeCompare(String(b.empNo || ''))); const latest = {};
    await Promise.all(list.map(async (w) => { try { const s = await getDocs(query(collection(db, 'interviews/' + w.id + '/records'), orderBy('date', 'desc'), limit(1))); latest[w.id] = s.empty ? null : s.docs[0].data(); } catch (e) { latest[w.id] = null; } }));
    st.ivWorkers = list; st.ivLatest = latest;
  };
  const loadRecords = async (wid) => { const s = await getDocs(query(collection(db, 'interviews/' + wid + '/records'), orderBy('date', 'desc'))); const l = []; s.forEach((d) => { const x = d.data(); l.push(Object.assign({ id: d.id }, x, { createdMs: x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : 0 })); }); st.ivRecords = l; };
  try { await loadList(); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = interviewsHtml(st); };
  const open = async (wid) => { st.ivSel = wid; st.ivForm = NEW_INTERVIEW(st.today); st.ivRecords = []; try { await loadRecords(wid); } catch (e) { toast('이력을 불러오지 못했습니다: ' + ((e && e.message) || '')); } paint(); };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const o = t.closest('[data-i-open]'); if (o) { await open(o.getAttribute('data-i-open')); return; }
    const a = t.closest('[data-i-act]');
    if (a && a.getAttribute('data-i-act') === 'back') { st.ivSel = ''; await loadList(); paint(); return; }
    if (a && a.getAttribute('data-i-act') === 'save') { const r = buildInterview(st.ivForm, st.today); if (!r.ok) { toast(r.errors[0]); return; } try { await addDoc(collection(db, 'interviews/' + st.ivSel + '/records'), Object.assign({}, r.data, { createdAt: serverTimestamp() })); toast('면담을 기록했습니다.'); st.ivForm = NEW_INTERVIEW(st.today); await loadRecords(st.ivSel); paint(); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const d = t.closest('[data-i-del]'); if (d) { const ok = await confirmDialog({ title: '면담 기록 삭제', body: '이 면담 기록을 삭제합니다. 되돌릴 수 없습니다.', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, 'interviews/' + st.ivSel + '/records', d.getAttribute('data-i-del'))); toast('삭제했습니다.'); await loadRecords(st.ivSel); paint(); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } }
  };
  root.oninput = (ev) => { const t = ev.target; if (t instanceof Element && t.matches('[data-i-f]')) st.ivForm[t.getAttribute('data-i-f')] = t.value; };
  root.onchange = (ev) => { const t = ev.target; if (!(t instanceof Element)) return; if (t.matches('[data-i-f]')) st.ivForm[t.getAttribute('data-i-f')] = t.value; if (t.matches('[data-i-fc]')) st.ivForm[t.getAttribute('data-i-fc')] = t.checked; };
  paint(); if (route.segs && route.segs[0]) await open(route.segs[0]);
}

/** 휴직/퇴직 원서(새 화면) — 전자결재 edoc_resign 을 읽어 목록·상세·원서 출력. 결재 처리는 전자결재에서. 승인된 퇴직원서의 인사 캘린더 퇴사 일정 반영은 기존대로 인사 홈·캘린더를 열 때 처리된다 */
export async function mountResignReq(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { today: kstToday(), rrDocs: [], rrKind: 'all', rrStat: 'active', rrSel: (route.segs && route.segs[0]) || '' };
  root.innerHTML = '<div class="jh-hr"><div id="r-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#r-body');
  try { const s = await getDocs(query(collection(db, 'edoc_resign'), orderBy('createdAt', 'desc'))); const l = []; s.forEach((d) => { const x = d.data(); l.push(Object.assign({ id: d.id }, x, { filed: fmtTs(x.createdAt).replace(/\./g, '-'), approvalLine: (x.approvalLine || []).map((a) => Object.assign({}, a, { approvedDate: a.approvedAt ? fmtTs(a.approvedAt).replace(/\./g, '-') : '' })) })); }); st.rrDocs = l; }
  catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '<br>전자결재 문서 열람은 관리자 권한이 필요합니다.</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = resignReqHtml(st); };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const k = t.closest('[data-r-kind]'); if (k) { st.rrKind = k.getAttribute('data-r-kind'); paint(); return; }
    const s2 = t.closest('[data-r-stat]'); if (s2) { st.rrStat = s2.getAttribute('data-r-stat'); paint(); return; }
    const o = t.closest('[data-r-open]'); if (o) { st.rrSel = o.getAttribute('data-r-open'); paint(); const f = body.querySelector('.jh-hr__line'); if (f) f.scrollIntoView({ block: 'center' }); return; }
    const a = t.closest('[data-r-act]'); if (!a) return; const act = a.getAttribute('data-r-act');
    if (act === 'close') { st.rrSel = ''; paint(); return; }
    if (act === 'print') {
      const d = st.rrDocs.find((x) => x.id === st.rrSel); if (!d) return; const win = window.open('', '_blank'); if (!win) { toast('팝업이 차단되어 출력 창을 열 수 없습니다. 팝업을 허용한 뒤 다시 시도해 주세요.'); return; }
      win.document.write('<p style="font-family:sans-serif;padding:24px;">문서를 준비하는 중...</p>'); let w = null; try { const ws = []; (await getDocs(collection(db, 'workers'))).forEach((x) => ws.push(Object.assign({ id: x.id }, x.data()))); w = rrqFindWorker(ws, d); } catch (e) { /* 명부를 못 읽어도 원서는 출력 */ }
      win.document.open(); win.document.write(resignPrintHtml(d, w, d.filed, st.today)); win.document.close();
    }
  };
  paint();
}

/** 인사 캘린더(새 화면) — 지정 담당자(hr_calendar_access/config 의 emails)만. 일정 등록·수정·삭제, 연차 표시(읽기), 승인된 퇴직원서의 퇴사 일정 자동 반영(1분 간격) */
let lastResignSync = 0;
export async function mountCalendar(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const today = kstToday(); const st = { today, hcYm: today.slice(0, 7), hcSel: today, hcEvents: [], hcLeaves: {}, hcLeaveOn: true, hcLeaveErr: false, hcOk: false, hcForm: null };
  root.innerHTML = '<div class="jh-hr"><div id="h-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#h-body'); const me = String((auth.currentUser && auth.currentUser.email) || '').toLowerCase();
  const syncResign = async () => {
    if (Date.now() - lastResignSync < 60000) return; lastResignSync = Date.now();
    try { const ds = await getDocs(collection(db, 'edoc_resign')); const docs = []; ds.forEach((d) => docs.push(Object.assign({ id: d.id }, d.data()))); const existing = {};
      await Promise.all(docs.filter((d) => (d.leaveKind || '퇴직') === '퇴직').map(async (d) => { try { const sn = await getDoc(doc(db, 'hr_calendar_events', 'resign_' + d.id)); if (sn.exists()) existing['resign_' + d.id] = sn.data(); } catch (e) { /* 없음 */ } }));
      const plan = hcResignPlan(docs, existing); const now = new Date().toISOString();
      for (const u of plan.upserts) await setDoc(doc(db, 'hr_calendar_events', u.id), Object.assign({}, u.data, { createdAt: (existing[u.id] || {}).createdAt || now, createdBy: (existing[u.id] || {}).createdBy || me, updatedAt: now, updatedBy: me }));
      for (const id of plan.deletes) await deleteDoc(doc(db, 'hr_calendar_events', id));
    } catch (e) { /* 전자결재 문서를 읽을 권한이 없으면 조용히 건너뜀 */ }
  };
  const load = async () => {
    const { a, b } = hcMonthRange(st.hcYm); const s = await getDocs(query(collection(db, 'hr_calendar_events'), where('date', '>=', a), where('date', '<=', b))); const l = []; s.forEach((d) => l.push(Object.assign({ id: d.id }, d.data()))); st.hcEvents = l;
    st.hcLeaves = {}; st.hcLeaveErr = false; try { const back = new Date(a + 'T00:00:00Z'); back.setUTCDate(back.getUTCDate() - 45); const from = back.toISOString().slice(0, 10); const ss = await getDocs(query(collection(db, 'company_schedules'), where('sdate', '>=', from), where('sdate', '<=', b))); const sc = []; ss.forEach((d) => sc.push(d.data())); st.hcLeaves = hcExpandLeaves(sc, a, b, (ds) => !!holidayName(ds)); } catch (e) { st.hcLeaveErr = true; }
  };
  try {
    let emails = []; try { const cfg = await getDoc(doc(db, 'hr_calendar_access', 'config')); emails = ((cfg.exists() && cfg.data().emails) || []).map((x) => String(x).toLowerCase()); } catch (e) { emails = []; }
    st.hcOk = !!me && emails.includes(me); if (st.hcOk) { await syncResign(); await load(); }
  } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = calendarHtml(st); };
  const reload = async () => { try { await load(); } catch (e) { toast('불러오지 못했습니다: ' + ((e && e.message) || '')); } paint(); };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const mv = t.closest('[data-hc-move]'); if (mv) { const n = Number(mv.getAttribute('data-hc-move')); if (n === 0) { st.hcYm = st.today.slice(0, 7); st.hcSel = st.today; } else { st.hcYm = hcMove(st.hcYm, n); st.hcSel = st.hcYm === st.today.slice(0, 7) ? st.today : ''; } st.hcForm = null; await reload(); return; }
    const ed = t.closest('[data-hc-edit]'); if (ed) { const e = st.hcEvents.find((x) => x.id === ed.getAttribute('data-hc-edit')); if (e) { st.hcForm = Object.assign({}, e); paint(); } return; }
    const ad = t.closest('[data-hc-add]'); if (ad) { st.hcForm = { id: '', type: 'interview', title: '', person: '', date: ad.getAttribute('data-hc-add'), time: '', endTime: '', note: '' }; paint(); const f0 = body.querySelector('[data-hc-f]'); if (f0) f0.scrollIntoView({ block: 'center' }); return; }
    const sl = t.closest('[data-hc-sel]'); if (sl) { st.hcSel = sl.getAttribute('data-hc-sel'); paint(); return; }
    const a = t.closest('[data-hc-act]'); if (!a || !st.hcForm) return; const act = a.getAttribute('data-hc-act');
    if (act === 'cancel') { st.hcForm = null; paint(); return; }
    if (act === 'delete') { const ok = await confirmDialog({ title: '일정 삭제', body: '이 일정을 삭제합니다.', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, 'hr_calendar_events', st.hcForm.id)); toast('삭제했습니다.'); st.hcForm = null; await reload(); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    if (act === 'save') {
      const r = hcValidate(st.hcForm); if (!r.ok) { toast(r.errors[0]); return; }
      try { const now = new Date().toISOString(); const old = st.hcForm.id ? (st.hcEvents.find((x) => x.id === st.hcForm.id) || {}) : {}; const ref = st.hcForm.id ? doc(db, 'hr_calendar_events', st.hcForm.id) : doc(collection(db, 'hr_calendar_events'));
        await setDoc(ref, Object.assign({}, r.data, { createdAt: old.createdAt || now, createdBy: old.createdBy || me, updatedAt: now, updatedBy: me }));
        toast('저장했습니다.'); if (r.data.date.slice(0, 7) !== st.hcYm) st.hcYm = r.data.date.slice(0, 7); st.hcSel = r.data.date; st.hcForm = null; await reload(); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); }
    }
  };
  root.oninput = (ev) => { const t = ev.target; if (t instanceof Element && t.matches('[data-hc-f]') && st.hcForm) st.hcForm[t.getAttribute('data-hc-f')] = t.value; };
  root.onchange = (ev) => { const t = ev.target; if (!(t instanceof Element)) return; if (t.matches('[data-hc-f]') && st.hcForm) { st.hcForm[t.getAttribute('data-hc-f')] = t.value; return; } if (t.matches('[data-hc-leave]')) { st.hcLeaveOn = t.checked; paint(); } };
  paint();
}

/** 인사평가(새 화면) — evaluations/{근로자}/records. 재직자 목록(호봉 직접 수정·최근 정기평가), 근로자별 평가 작성(정기·수시, 초안/확정)·확정 처리·삭제 */
export async function mountEvals(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { today: kstToday(), evWorkers: [], evLatest: {}, evSel: '', evForm: NEW_EVAL(), evRecords: [] };
  root.innerHTML = '<div class="jh-hr"><div id="e-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#e-body');
  const recsOf = async (wid) => { const s = await getDocs(collection(db, 'evaluations/' + wid + '/records')); const l = []; s.forEach((d) => { const x = d.data(); l.push(Object.assign({ id: d.id }, x, { createdMs: x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : 0 })); }); return l; };
  const loadList = async () => {
    const ws = await getDocs(collection(db, 'workers')); const list = []; ws.forEach((d) => { const x = Object.assign({ id: d.id }, d.data()); if (x.status !== 'resigned') list.push(x); }); list.sort((a, b) => String(a.empNo || '').localeCompare(String(b.empNo || ''))); const latest = {};
    await Promise.all(list.map(async (w) => { try { latest[w.id] = evalLatestRegular(await recsOf(w.id)); } catch (e) { latest[w.id] = null; } })); st.evWorkers = list; st.evLatest = latest;
  };
  try { await loadList(); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = evalsHtml(st); };
  const open = async (wid) => { st.evSel = wid; st.evForm = NEW_EVAL(); st.evRecords = []; try { st.evRecords = await recsOf(wid); } catch (e) { toast('이력을 불러오지 못했습니다: ' + ((e && e.message) || '')); } paint(); };
  const save = async (confirmed) => { const r = buildEval(st.evForm, confirmed); if (!r.ok) { toast(r.errors[0]); return; } try { await addDoc(collection(db, 'evaluations/' + st.evSel + '/records'), Object.assign({}, r.data, { createdAt: serverTimestamp(), confirmedAt: confirmed ? serverTimestamp() : null })); toast(confirmed ? '확정 저장했습니다.' : '초안으로 저장했습니다.'); st.evForm = NEW_EVAL(); st.evRecords = await recsOf(st.evSel); paint(); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); } };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const o = t.closest('[data-e-open]'); if (o) { await open(o.getAttribute('data-e-open')); return; }
    const ty = t.closest('[data-e-type]'); if (ty) { st.evForm.type = ty.getAttribute('data-e-type'); paint(); return; }
    const gr = t.closest('[data-e-grade]'); if (gr) { st.evForm.grade = gr.getAttribute('data-e-grade'); paint(); return; }
    const cf = t.closest('[data-e-confirm]'); if (cf) { try { await updateDoc(doc(db, 'evaluations/' + st.evSel + '/records', cf.getAttribute('data-e-confirm')), { status: 'confirmed', confirmedAt: serverTimestamp() }); toast('확정 처리했습니다.'); st.evRecords = await recsOf(st.evSel); paint(); } catch (e) { toast('확정 처리하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const dl = t.closest('[data-e-del]'); if (dl) { const ok = await confirmDialog({ title: '평가 기록 삭제', body: '이 평가 기록을 삭제합니다. 되돌릴 수 없습니다.', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, 'evaluations/' + st.evSel + '/records', dl.getAttribute('data-e-del'))); toast('삭제했습니다.'); st.evRecords = await recsOf(st.evSel); paint(); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const a = t.closest('[data-e-act]'); if (!a) return; const act = a.getAttribute('data-e-act');
    if (act === 'back') { st.evSel = ''; try { await loadList(); } catch (e) { /* 목록은 이전 값 유지 */ } paint(); } else if (act === 'draft') await save(false); else if (act === 'confirm') await save(true);
  };
  root.oninput = (ev) => { const t = ev.target; if (t instanceof Element && t.matches('[data-e-f]')) st.evForm[t.getAttribute('data-e-f')] = t.value; };
  root.onchange = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; if (t.matches('[data-e-f]')) { st.evForm[t.getAttribute('data-e-f')] = t.value; return; }
    if (t.matches('[data-e-step]')) { const r = buildStepInput(t.value); if (!r.ok) { toast(r.error); return; } try { await setDoc(doc(db, 'workers', t.getAttribute('data-e-step')), r.patch, { merge: true }); toast('호봉을 저장했습니다.'); await loadList(); paint(); } catch (e) { toast('호봉을 저장하지 못했습니다: ' + ((e && e.message) || '')); } }
  };
  paint(); if (route.segs && route.segs[0]) await open(route.segs[0]);
}

/** 채용 지원자(새 화면) — recruit_applicants 목록·상태·면접 일정(인사 캘린더 자동 등록)·이력서 보기/인쇄·명부 등록 이동·삭제 */
export async function mountApplicants(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { apList: [], apFilter: 'all', apSel: (route.segs && route.segs[0]) || '' };
  root.innerHTML = '<div class="jh-hr"><div id="a-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#a-body'); const me = String((auth.currentUser && auth.currentUser.email) || '').toLowerCase();
  const dt = (ts) => { const d = ts && ts.toDate ? ts.toDate() : ts ? new Date(ts) : null; return d && !Number.isNaN(d.getTime()) ? d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : '-'; };
  const load = async () => { const s = await getDocs(query(collection(db, 'recruit_applicants'), orderBy('createdAt', 'desc'))); const l = []; s.forEach((d) => { const x = d.data(); l.push(Object.assign({ id: d.id }, x, { created: dt(x.createdAt) })); }); st.apList = l; };
  try { await load(); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = applicantsHtml(st); };
  const calSync = async (a, v) => {   // 면접 일정을 인사 캘린더에 반영(성공 여부)
    try { const c = interviewCalendar(a, v); const ref = doc(db, 'hr_calendar_events', c.id); if (c.remove) { await deleteDoc(ref); return true; } let old = {}; try { const sn = await getDoc(ref); if (sn.exists()) old = sn.data(); } catch (e) { /* 새 일정 */ } const now = new Date().toISOString(); await setDoc(ref, Object.assign({}, c.data, { createdAt: old.createdAt || now, createdBy: old.createdBy || me, updatedAt: now, updatedBy: me })); return true; } catch (e) { return false; }
  };
  const setInterview = async (a, v) => { try { await updateDoc(doc(db, 'recruit_applicants', a.id), { interviewAt: v }); a.interviewAt = v; } catch (e) { toast('면접일을 저장하지 못했습니다: ' + ((e && e.message) || '')); return; } const ok = await calSync(a, v); if (!ok) toast('면접일은 저장됐지만 인사 캘린더에는 반영하지 못했습니다(캘린더 접근 권한을 확인해 주세요).'); else toast(v ? '면접 일정을 인사 캘린더에 등록했습니다.' : '면접 일정을 해제했습니다.'); paint(); };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const f = t.closest('[data-a-filter]'); if (f) { st.apFilter = f.getAttribute('data-a-filter'); paint(); return; }
    const o = t.closest('[data-a-open]'); if (o) { st.apSel = o.getAttribute('data-a-open'); paint(); return; }
    const dl = t.closest('[data-a-del]'); if (dl) { const a = st.apList.find((x) => x.id === dl.getAttribute('data-a-del')); if (!a) return; const ok = await confirmDialog({ title: '지원자 삭제', body: "'" + (a.name || '(이름 없음)') + "' 지원자를 삭제합니다. 이력서 내용과 면접 일정이 함께 삭제되며 되돌릴 수 없습니다." + (appStatusOf(a) === 'pass' ? ' ※ 합격 처리된 지원자입니다.' : ''), confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return;
      try { await deleteDoc(doc(db, 'recruit_applicants', a.id)); } catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || '')); return; } const cal = await calSync(a, ''); st.apList = st.apList.filter((x) => x.id !== a.id); st.apSel = ''; paint(); toast(cal ? '삭제했습니다.' : '지원자는 삭제됐지만 인사 캘린더의 면접 일정은 지우지 못했습니다. 인사 캘린더에서 직접 확인해 주세요.'); return; }
    const a2 = t.closest('[data-a-act]'); if (!a2) return; const act = a2.getAttribute('data-a-act'); const a = st.apList.find((x) => x.id === st.apSel); if (act === 'back') { st.apSel = ''; paint(); return; } if (!a) return;
    if (act === 'roster') { try { sessionStorage.setItem('jh_roster_prefill', JSON.stringify(prefillFromApplicant(a))); } catch (e) { /* 저장소를 못 쓰면 빈 양식으로 열림 */ } location.hash = '#/hr/workers'; return; }
    if (act === 'print') { const win = window.open('', '_blank'); if (!win) { toast('팝업이 차단되어 출력 창을 열 수 없습니다. 팝업을 허용한 뒤 다시 시도해 주세요.'); return; } win.document.write(resumePrintHtml(a)); win.document.close(); }
  };
  root.onchange = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (t.matches('[data-a-status]')) { const a = st.apList.find((x) => x.id === t.getAttribute('data-a-status')); if (!a) return; try { await updateDoc(doc(db, 'recruit_applicants', a.id), { status: t.value }); a.status = t.value; toast('상태를 바꿨습니다.'); paint(); } catch (e) { toast('상태를 바꾸지 못했습니다: ' + ((e && e.message) || '')); } return; }
    const idD = t.getAttribute('data-a-ivd'), idT = t.getAttribute('data-a-ivt'); const id = idD || idT; if (!id) return; const a = st.apList.find((x) => x.id === id); if (!a) return;
    const row = t.closest('tr'); const d = (row.querySelector('[data-a-ivd]') || {}).value || ''; const tm = (row.querySelector('[data-a-ivt]') || {}).value || '';
    if (!d) { if (a.interviewAt) await setInterview(a, ''); return; }   // 날짜를 지우면 면접 일정 해제(이미 등록된 경우만)
    const v = joinInterview(d, tm); if (!v) return; await setInterview(a, v);   // 날짜·시간이 모두 올바를 때만 저장
  };
  paint();
}

/** 급여테이블(새 화면) — company_settings/salaryTable. 표준 시급 호봉표(내규용), 저장해도 급여명세서 계산에는 영향 없음 */
export async function mountSalary(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { sal: null };
  root.innerHTML = '<div class="jh-hr"><div id="s-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#s-body');
  try { const sn = await getDoc(doc(db, 'company_settings', 'salaryTable')); st.sal = salNormalize(sn.exists() ? sn.data() : null); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = salaryHtml(st); };
  root.onchange = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (t.matches('[data-s-field]')) { st.sal = salSetField(st.sal, t.getAttribute('data-s-field'), t.value); paint(); return; }
    if (t.matches('[data-s-tenure]')) { st.sal = salSetTenure(st.sal, t.getAttribute('data-s-tenure'), t.value); paint(); return; }
    if (t.matches('[data-s-cell]')) { const [tid, key] = t.getAttribute('data-s-cell').split('|'); st.sal = salEditCell(st.sal, tid, key, t.value); paint(); }
  };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; const a = t.closest('[data-s-act]'); if (!a) return; const act = a.getAttribute('data-s-act');
    if (act === 'regen') { const ok = await confirmDialog({ title: '표 다시 생성', body: '직접 수정한 값을 포함해 전체 표를 표준공식 기준으로 다시 계산합니다.', confirmLabel: '다시 생성' }); if (!ok.ok) return; st.sal = salRegenerate(st.sal, true); paint(); return; }
    if (act === 'save') { try { await setDoc(doc(db, 'company_settings', 'salaryTable'), st.sal); toast('저장했습니다.'); } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || '')); } }
  };
  paint();
}
