/* PJT 관리(통합 새 모듈) — 설계서 docs/pjt-design.md. Ph2·Ph4·경량PJT를 한 모듈로 합친다.
 * 지금 새 화면은 "출역·공수"(근태·공수 탭) 하나다 — 구포털 PJT 메뉴에서 프로젝트를 고르면 그 아래 "👷 출역·공수 (새)" 탭으로 열린다(legacy/frame.js 의 nativeSubs, modules/index.js hostNative). 프로젝트는 화면 안에서 고르지 않는다. 나머지 탭은 만들면서 구포털 항목을 하나씩 교체한다.
 * 저장 형식은 구포털 그대로(출역 { checks }, 공수 { md }, 날짜별 문서) — 영업기획의 공수 연동·팀별 노무비가 읽는다. 경로는 adapter.js, 규칙은 attendance.js. */
import { db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteField, query, where, documentId, serverTimestamp } from '../../core/firebase.js?v=20261013zj';
import { esc, toast } from '../../core/ui.js?v=20261013zj';
import { confirmDialog } from '../../core/dialog.js?v=20261013zj';
import { pathsFor, featuresOf, isDateKey } from './adapter.js?v=20261013zj';
import { applyManday, applyAdjust, applyAllManday, toggleCheck, toggleAll, canWorkOn, hasManday, cumulativeByWorker, recentTotals, monthSheet, appToday, shiftDate, clampManday } from './attendance.js?v=20261013zj';
import { visibleProjects } from './projects.js?v=20261013zj';
import { loadHolidays } from '../../shared/holidays.js?v=20261013zj';
import { attendHtml, dayWorkers } from './attend-view.js?v=20261013zj';
import { fixedStructure, lightStructure, normalizeDayFixed, normalizeDayLight, stateAt, lightState, cellState, toggledDayChecks, lightItemStages, lightProgress, daysThrough, PROGRESS_START, keyOf } from './progress.js?v=20261013zj';
import { progressHtml } from './progress-view.js?v=20261013zj';

export const manifest = { id: 'pjt', order: 40, title: 'PJT 관리', icon: '🏗️', defaultHash: '#/pjt/attend', perm: (me) => !!me && me.admin === true };
export async function mount(root) { root.innerHTML = '<div class="jh-empty">PJT 화면은 구포털 틀 안의 메뉴로 열립니다.</div>'; }
const pushHash = (h) => { if (location.hash === h) return; try { history.replaceState(null, '', h); } catch (e) { location.hash = h; } };

/** 프로젝트 정보 읽기(구포털 틀의 loadPjtDyn 과 같은 규칙): 고정 PJT 종료 여부·참여자 지정, 경량 PJT 목록 */
async function loadDyn() {
  const dyn = { ended: {}, settings: {}, registry: [] };
  for (const k of ['p4ph2', 'p4ph4']) { try { const s = await getDoc(doc(db, 'pjt_settings', k)); const x = s.exists() ? s.data() : null; dyn.ended[k] = !!x && x.status === 'ended'; dyn.settings[k] = { participants: x ? (x.participants || null) : null }; } catch (e) { /* 권한 없음 — 종료 아님·지정 없음으로 본다 */ } }
  try { const s = await getDocs(collection(db, 'pjt_registry')); const arr = []; s.forEach((d) => { const x = d.data(); if (x.status !== 'ended') arr.push({ id: d.id, name: x.name || 'PJT', participants: x.participants || null, createdAt: x.createdAt }); }); arr.sort((a, b) => ((a.createdAt && a.createdAt.seconds) || 0) - ((b.createdAt && b.createdAt.seconds) || 0)); dyn.registry = arr; } catch (e) { /* 권한 없음 */ }
  return dyn;
}
const uniq = (a) => [...new Set(a)];

/** 출역·공수(근태·공수 탭): 프로젝트 아래의 탭 — 주소 #/pjt/<프로젝트>/attend/<날짜>. 틀(legacy/frame.js)이 route.segs 를 [프로젝트, 날짜]로 넘긴다 */
export async function mountAttend(root, route, ctx) {
  root.onclick = null; root.onchange = null; root.onkeydown = null;
  const me = (ctx && ctx.me) || {}; const segs = (route && route.segs) || [];
  const guest = !(me.admin || (me.perms && me.perms.pjt)); const leaderIds = Array.isArray(me.teamLeaderIds) ? me.teamLeaderIds : [];
  const st = { projects: [], proj: '', date: isDateKey(segs[1]) ? segs[1] : appToday(), roster: [], masters: {}, resigned: {}, att: [], md: {}, recent: [], panel: 'sheet', sheet: null, sheetByDay: null, cum: null, cumDocs: null, month: { y: 0, m: 0 }, me: { guest, teamLeaderIds: leaderIds }, teamMasterIds: new Set(leaderIds), readonly: guest && !leaderIds.length, manage: !guest, busy: false };
  root.innerHTML = '<div id="pa-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#pa-body');
  const paint = () => { const y = window.scrollY; body.innerHTML = attendHtml(st); window.scrollTo(0, y); };
  const P = () => pathsFor(st.proj); const feat = () => featuresOf(st.proj, st.projDoc);
  try { st.projects = visibleProjects(me, await loadDyn()); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  st.proj = st.projects.some((p) => p.key === segs[0]) ? segs[0] : '';   // 프로젝트는 주소(위 메뉴에서 고른 프로젝트)로만 정한다 — 화면 안에서 바꾸지 못한다
  if (!st.proj) { paint(); return; }   // 없거나 열 수 없는 프로젝트면 입력 화면 대신 안내만
  const loadProject = async () => {
    const p = P(); st.projDoc = (st.projects.find((x) => x.key === st.proj) || {}).doc || null;
    const [rs, ms] = await Promise.all([getDocs(collection(db, p.roster)), getDocs(collection(db, 'master_workers'))]);
    st.roster = []; rs.forEach((d) => st.roster.push(Object.assign({ id: d.id }, d.data()))); st.roster.sort((a, b) => (a.order == null ? 9999 : a.order) - (b.order == null ? 9999 : b.order) || String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
    st.masters = {}; ms.forEach((d) => { st.masters[d.id] = d.data(); }); st.resigned = {}; Object.keys(st.masters).forEach((id) => { const m = st.masters[id]; if (m.resigned) st.resigned[id] = { resigned: true, resignedDate: m.resignedDate || '' }; });
    const tm = new Set(leaderIds); Object.keys(st.masters).forEach((id) => { if (st.masters[id].leaderId && leaderIds.indexOf(st.masters[id].leaderId) !== -1) tm.add(id); }); st.teamMasterIds = tm; st.sheet = null; st.sheetByDay = null; st.cum = null; st.cumDocs = null; const [dy, dm] = st.date.split('-').map(Number); st.month = { y: dy, m: dm - 1 };   // 프로젝트가 바뀌면 오른쪽 집계표·누적은 다시 읽는다(보는 달은 선택한 날짜의 달)
  };
  const readDay = async (date) => { const p = P(); const [a, m] = await Promise.all([getDoc(doc(db, p.attendance, date)), getDoc(doc(db, p.manday, date))]); return { checks: a.exists() ? (a.data().checks || []) : [], md: m.exists() ? (m.data().md || {}) : {} }; };
  const loadDay = async () => {
    const d = await readDay(st.date); st.att = d.checks; st.md = d.md; const days = Array.from({ length: 7 }, (_, i) => shiftDate(st.date, -i)); const p = P();
    const snaps = await Promise.all(days.map((k) => getDoc(doc(db, p.manday, k)).catch(() => null))); const byDay = {}; days.forEach((k, i) => { byDay[k] = snaps[i] && snaps[i].exists() ? (snaps[i].data().md || {}) : {}; }); byDay[st.date] = st.md; st.recentDays = byDay; st.recent = recentTotals(byDay, st.date, 7);
  };
  const reload = async () => { try { await loadDay(); } catch (e) { toast('불러오기 실패: ' + ((e && e.message) || '')); } paint(); };
  try { await Promise.race([loadHolidays(), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* 공휴일을 못 불러오거나 오래 걸리면 주말만 표시된다 — 현장 입력 화면이 공휴일 파일 때문에 멈추면 안 된다 */ }
  try { await loadProject(); await loadDay(); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  paint();
  // 오른쪽 탭(집계표·누적)은 입력할 때마다 문서를 다시 읽지 않고, 이미 읽은 날짜별 공수에 방금 바꾼 날을 끼워 넣어 다시 계산한다
  const recomputeSheet = () => { if (st.sheetByDay) st.sheet = monthSheet(st.roster, st.resigned, st.sheetByDay, st.month.y, st.month.m); };
  const syncCaches = () => { const [y, m] = st.date.split('-').map(Number); if (st.sheetByDay && y === st.month.y && m - 1 === st.month.m) { st.sheetByDay[st.date] = st.md; recomputeSheet(); } if (st.cumDocs) st.cumDocs[st.date] = st.md; };   // 월별 누적은 화면을 그릴 때 이 날짜별 값으로 계산한다
  const loadSheet = async () => {
    const { y, m } = st.month; const pad = (n) => String(n).padStart(2, '0'); const p = P(); st.sheet = null; if (st.panel === 'sheet') paint();
    try { const snap = await getDocs(query(collection(db, p.manday), where(documentId(), '>=', y + '-' + pad(m + 1) + '-01'), where(documentId(), '<=', y + '-' + pad(m + 1) + '-31'))); const byDay = {}; snap.forEach((d) => { byDay[d.id] = (d.data().md) || {}; }); byDay[st.date] = (st.date.slice(0, 7) === y + '-' + pad(m + 1)) ? st.md : byDay[st.date]; st.sheetByDay = byDay; recomputeSheet(); } catch (e) { toast('집계표를 불러오지 못했습니다: ' + ((e && e.message) || '')); }
    if (st.panel === 'sheet') paint();
  };
  const loadCum = async () => { st.cumDocs = null; if (st.panel === 'cum') paint(); try { const snap = await getDocs(collection(db, P().manday)); const docs = {}; snap.forEach((d) => { docs[d.id] = (d.data().md) || {}; }); docs[st.date] = st.md; st.cumDocs = docs; } catch (e) { toast('불러오지 못했습니다: ' + ((e && e.message) || '')); } if (st.panel === 'cum') paint(); };
  if (st.panel === 'sheet') loadSheet();   // 처음 열면 오른쪽에 이달 공수 집계표가 바로 보인다
  /** 한 번의 변경: 그날의 최신 문서를 읽어 → 규칙대로 고쳐 → 바뀐 문서만 저장(구포털처럼 문서를 통째로 쓰되, 방금 읽은 최신 값에서 한 사람만 고친다) */
  const edit = async (fn) => {
    if (st.busy) return; st.busy = true;
    try {
      const raw = await readDay(st.date); const norm = { checks: uniq(raw.checks.concat(Object.keys(raw.md).filter((k) => (raw.md[k] || 0) > 0))), md: raw.md };   // 옛 기록의 "공수만 있는 날"은 출역으로 본다
      const after = await fn(norm); if (!after) { st.busy = false; return; }
      const p = P(); const sameC = JSON.stringify(after.checks) === JSON.stringify(raw.checks), sameM = JSON.stringify(after.md) === JSON.stringify(raw.md);
      if (!sameC) await setDoc(doc(db, p.attendance, st.date), { checks: after.checks, updatedAt: serverTimestamp() });
      if (!sameM) await setDoc(doc(db, p.manday, st.date), { md: after.md, updatedAt: serverTimestamp() });
      st.att = after.checks; st.md = after.md; if (st.recentDays) { st.recentDays[st.date] = st.md; st.recent = recentTotals(st.recentDays, st.date, 7); } syncCaches();
    } catch (e) { toast('저장 실패: ' + ((e && (e.code || e.message)) || '')); }
    st.busy = false; paint();
  };
  const targets = () => dayWorkers(st).filter((w) => canWorkOn(st.me, w, st.teamMasterIds) && !st.readonly).map((w) => w.id);
  const can = (id) => { const w = st.roster.find((x) => x.id === id); return !!w && canWorkOn(st.me, w, st.teamMasterIds) && !st.readonly; };
  const goDate = async (d) => { if (!isDateKey(d)) return; st.date = d; pushHash('#/pjt/' + st.proj + '/attend/' + d); await reload(); const [y, m] = d.split('-').map(Number); if (y !== st.month.y || m - 1 !== st.month.m) { st.month = { y, m: m - 1 }; st.sheet = null; st.sheetByDay = null; if (st.panel === 'sheet') await loadSheet(); } else if (st.cumDocs) { st.cumDocs[d] = st.md; } };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const tog = t.closest('[data-pa-tog]'); if (tog) { const id = tog.getAttribute('data-pa-tog'); if (!can(id)) return;
      await edit(async (n) => { const on = n.checks.indexOf(id) !== -1; if (!on) return toggleCheck(n.checks, n.md, id, feat().defaultManday);
        if (hasManday(n.md, id)) { const ok = await confirmDialog({ title: '출역 해제', body: '공수 ' + n.md[id] + '도 함께 지워집니다. 해제할까요?', confirmLabel: '해제' }); if (!ok.ok) return null; }
        const c = n.checks.filter((x) => x !== id); const md = Object.assign({}, n.md); delete md[id]; return { checks: c, md }; }); return; }
    const adj = t.closest('[data-pa-adj]'); if (adj) { const [id, d] = adj.getAttribute('data-pa-adj').split(':'); if (!can(id)) return; await edit((n) => applyAdjust(n.checks, n.md, id, Number(d))); return; }
    const end = t.closest('[data-pa-end]'); if (end && st.manage) { const id = end.getAttribute('data-pa-end'); const w = st.roster.find((x) => x.id === id); const ok = await confirmDialog({ title: '투입 종료', body: (w ? w.name : id) + '을(를) 이 프로젝트 투입에서 종료할까요? 명단에서 지우지 않으며 지금까지의 출역·공수는 그대로 남습니다.', confirmLabel: '투입 종료' }); if (!ok.ok) return;
      try { await setDoc(doc(db, P().roster, id), { active: false, endedDate: st.date }, { merge: true }); if (w) { w.active = false; w.endedDate = st.date; } recomputeSheet(); toast('투입을 종료했습니다.'); } catch (e) { toast('저장 실패: ' + ((e && (e.code || e.message)) || '')); } paint(); return; }
    const rej = t.closest('[data-pa-rejoin]'); if (rej && st.manage) { const id = rej.getAttribute('data-pa-rejoin'); const w = st.roster.find((x) => x.id === id); try { await setDoc(doc(db, P().roster, id), { active: true, endedDate: '' }, { merge: true }); if (w) { w.active = true; w.endedDate = ''; } toast('다시 투입했습니다.'); } catch (e) { toast('저장 실패: ' + ((e && (e.code || e.message)) || '')); } paint(); return; }
    const tab = t.closest('[data-pa-tab]'); if (tab) { st.panel = tab.getAttribute('data-pa-tab'); paint(); if (st.panel === 'sheet' && !st.sheet) await loadSheet(); if (st.panel === 'cum' && !st.cumDocs) await loadCum(); return; }
    const a = t.closest('[data-pa-act]'); if (!a) return; const act = a.getAttribute('data-pa-act');
    if (act === 'prev') { await goDate(shiftDate(st.date, -1)); return; } if (act === 'next') { await goDate(shiftDate(st.date, 1)); return; } if (act === 'today') { await goDate(appToday()); return; }
    if (act === 'all') { const ids = targets(); if (!ids.length) return;
      await edit(async (n) => { const allOn = ids.every((id) => n.checks.indexOf(id) !== -1); if (allOn && ids.some((id) => hasManday(n.md, id))) { const ok = await confirmDialog({ title: '전체 출역 해제', body: '공수가 입력된 사람도 있습니다. 해제하면 그 공수도 함께 지워집니다. 해제할까요?', confirmLabel: '해제' }); if (!ok.ok) return null; } return toggleAll(n.checks, n.md, ids, feat().defaultManday); }); return; }
    if (act === 'bulk') { const inp = body.querySelector('[data-pa-bulk]'); const raw = inp ? inp.value.trim() : ''; if (raw === '') { toast('적용할 공수값을 입력해 주세요.'); return; } const ids = targets(); if (!ids.length) return; const v = clampManday(raw); await edit((n) => applyAllManday(n.checks, n.md, ids, v)); toast('전원 공수를 ' + v + '(으)로 적용했습니다.'); return; }
    if (act === 'mprev' || act === 'mnext') { let { y, m } = st.month; m += act === 'mnext' ? 1 : -1; if (m > 11) { m = 0; y++; } if (m < 0) { m = 11; y--; } st.month = { y, m }; st.sheetByDay = null; await loadSheet(); return; }
    if (act === 'add' && st.manage) { const s = body.querySelector('[data-pa-addsel]'); const id = s ? s.value : ''; if (!id) { toast('투입할 인원을 선택해 주세요.'); return; } const m = st.masters[id]; if (!m) return;
      try { const order = st.roster.reduce((mx, w) => Math.max(mx, w.order || 0), 0) + 1; const data = { id, name: m.name, role: '', birth: m.birth || '', masterId: id, order, active: true }; await setDoc(doc(db, P().roster, id), Object.assign({}, data, { createdAt: serverTimestamp() })); st.roster.push(data); recomputeSheet(); toast(m.name + ' 님을 투입했습니다.'); } catch (e) { toast('저장 실패: ' + ((e && (e.code || e.message)) || '')); } paint(); }
  };
  root.onchange = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (t.hasAttribute('data-pa-date')) { await goDate(t.value); return; }
    const md = t.getAttribute('data-pa-md'); if (md) { if (!can(md)) { paint(); return; } const raw = t.value.trim(); await edit((n) => applyManday(n.checks, n.md, md, raw)); }
  };
  root.onkeydown = (ev) => { const t = ev.target; if (ev.key === 'Enter' && t instanceof Element && (t.hasAttribute('data-pa-md') || t.hasAttribute('data-pa-bulk'))) { ev.preventDefault(); if (t.hasAttribute('data-pa-bulk')) { const b = root.querySelector('[data-pa-act="bulk"]'); if (b) b.click(); } else t.blur(); } };
}

/** 공정(공정 탭): 프로젝트 아래의 탭 — 주소 #/pjt/<프로젝트>/progress/<날짜>. 모든 프로젝트가 같은 화면·같은 규칙이다.
 *  저장은 구포털과 같은 형식: Ph2·Ph4 는 progress_checks_<날짜>/<섹터> { checks }, 경량은 pjt_registry/<id>/progress_checks/<날짜> { 키: true } + 품목의 현재 상태(items.stages)·공사일보용 item_checks·프로젝트 진행률(progress). */
export async function mountProgress(root, route, ctx) {
  root.onclick = null; root.onchange = null; root.onkeydown = null;
  const me = (ctx && ctx.me) || {}; const segs = (route && route.segs) || [];
  const guest = !(me.admin || (me.perms && me.perms.pjt)); const leaderIds = Array.isArray(me.teamLeaderIds) ? me.teamLeaderIds : [];
  const st = { projects: [], proj: '', label: '', date: isDateKey(segs[1]) ? segs[1] : appToday(), structure: null, items: [], projDoc: null, days: {}, states: {}, open: new Set(), editMode: false, isToday: true, ready: false, loadingNote: '', readonly: guest && !leaderIds.length, busy: false };
  root.innerHTML = '<div id="pg-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#pg-body');
  const paint = () => { const y = window.scrollY; body.innerHTML = progressHtml(st); window.scrollTo(0, y); };
  try { await Promise.race([loadHolidays(), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* 공휴일을 못 불러오면 날짜 표시만 빠진다 */ }
  try { st.projects = visibleProjects(me, await loadDyn()); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  st.proj = st.projects.some((p) => p.key === segs[0]) ? segs[0] : ''; if (!st.proj) { paint(); return; }
  const P = pathsFor(st.proj); const pr = st.projects.find((p) => p.key === st.proj); st.label = pr.label; st.projDoc = pr.doc; const zones = P.progress.model === 'zones';   // 저장 경로만 다르다(섹터별 문서 / 날짜별 문서 하나) — 화면·규칙은 모든 프로젝트 같다
  const recompute = () => { st.isToday = st.date === appToday(); const S = st.structure; st.states = {}; S.groups.forEach((g) => { st.states[g.id] = zones ? stateAt(st.days, st.date, g.id, st.proj) : lightState(st.days, st.date, st.items, st.isToday); }); };
  const loadDays = async () => {
    if (zones) {
      const start = PROGRESS_START[st.proj] || '2026-06-17'; const need = daysThrough(start, st.date).filter((d) => !st.days[d]); let done = 0;
      for (let i = 0; i < need.length; i += 25) { const part = need.slice(i, i + 25); await Promise.all(part.map(async (d) => { try { const snap = await getDocs(collection(db, P.progress.checks(d))); const docs = []; snap.forEach((x) => docs.push({ id: x.id, data: x.data() })); st.days[d] = normalizeDayFixed(docs); } catch (e) { st.days[d] = {}; } })); done += part.length; st.loadingNote = '공정 이력 불러오는 중... ' + done + '/' + need.length; if (!st.ready) { paint(); } }
    } else if (!st.daysLoaded) { try { const snap = await getDocs(collection(db, P.progress.checks)); snap.forEach((x) => { st.days[x.id] = normalizeDayLight(x.data()); }); } catch (e) { /* 날짜별 문서가 없는 프로젝트 — 현재 상태만으로 본다 */ } st.daysLoaded = true; }
  };
  const loadStructure = async () => {
    if (zones) { st.structure = fixedStructure(st.proj); return; }
    const [ps, is] = await Promise.all([getDoc(doc(db, P.settings.col, P.settings.id)), getDocs(collection(db, P.progress.items))]); st.projDoc = ps.exists() ? Object.assign({ id: P.settings.id }, ps.data()) : pr.doc; st.items = []; is.forEach((d) => st.items.push(Object.assign({ id: d.id }, d.data()))); st.structure = lightStructure(st.projDoc, st.items);
  };
  const openDefault = () => { st.open = new Set(); const S = st.structure; if (S.groups.length === 1) { st.open.add(S.groups[0].id); return; } const first = S.groups.find((g) => { const c = (st.states[g.id] || {}).merged || {}; const n = g.items.reduce((s, it) => s + S.leafCols.filter((col) => c[keyOf(it.id, col)]).length, 0); return n > 0 && n < g.items.length * S.leafCols.length; }) || S.groups[0]; if (first) st.open.add(first.id); };
  try { await loadStructure(); await loadDays(); recompute(); openDefault(); st.ready = true; } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  paint();
  const goDate = async (d) => { if (!isDateKey(d)) return; st.date = d; pushHash('#/pjt/' + st.proj + '/progress/' + d); st.ready = false; paint(); try { await loadDays(); } catch (e) { toast('불러오기 실패: ' + ((e && e.message) || '')); } recompute(); st.ready = true; paint(); };
  const toggle = async (gid, itemId, col) => {
    if (st.busy || st.readonly) return; const S = st.structure; const key = keyOf(itemId, col); const cs = cellState(st.states[gid], key, st.isToday, st.editMode); if (!cs.canToggle) return; const on = !cs.done; st.busy = true;
    try {
      if (zones) {
        const ref = doc(db, P.progress.checks(st.date), gid); const snap = await getDoc(ref); const latest = snap.exists() ? ((snap.data() || {}).checks || {}) : {}; const checks = toggledDayChecks(latest, key, on);
        await setDoc(ref, { checks, updatedAt: serverTimestamp() }); st.days[st.date] = Object.assign({}, st.days[st.date] || {}, { [gid]: checks });
      } else {
        const ref = doc(db, P.progress.checks, st.date); const item = st.items.find((x) => x.id === itemId); if (!item) { st.busy = false; return; }
        if (on) await setDoc(ref, { [key]: true }, { merge: true }); else { try { await updateDoc(ref, { [key]: deleteField() }); } catch (e) { /* 문서·필드가 없으면 무시 */ } }
        const stages = lightItemStages(item.stages, col, on); await updateDoc(doc(db, P.progress.items, itemId), { stages }); item.stages = stages;   // 품목의 현재 상태(구포털 공사일보·옛 화면과 호환)
        if (st.isToday) { const cref = doc(db, P.progress.itemChecks, st.date); if (on) await setDoc(cref, { [itemId]: { [col]: true } }, { merge: true }); else { try { await updateDoc(cref, { [itemId + '.' + col]: deleteField() }); } catch (e) { /* 없으면 무시 */ } } }
        const cur = st.days[st.date] || {}; const m = Object.assign({}, cur[''] || {}); if (on) m[key] = true; else delete m[key]; st.days[st.date] = { '': m };
        st.structure = lightStructure(st.projDoc, st.items); const stagesBy = {}; st.items.forEach((x) => { stagesBy[x.id] = x.stages || {}; }); try { await updateDoc(doc(db, P.settings.col, P.settings.id), { progress: lightProgress(st.structure, stagesBy) }); } catch (e) { /* 진행률 갱신 실패는 체크 저장을 막지 않는다 */ }
      }
      recompute();
    } catch (e) { toast('저장 실패: ' + ((e && (e.code || e.message)) || '')); }
    st.busy = false; paint();
  };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    const ck = t.closest('[data-pg-ck]'); if (ck) { const [g, it, col] = ck.getAttribute('data-pg-ck').split('|'); await toggle(g, it, col); return; }
    const op = t.closest('[data-pg-open]'); if (op) { const id = op.getAttribute('data-pg-open'); if (st.open.has(id)) st.open.delete(id); else st.open.add(id); paint(); return; }
    const a = t.closest('[data-pg-act]'); if (!a) return; const act = a.getAttribute('data-pg-act');
    if (act === 'prev') await goDate(shiftDate(st.date, -1)); else if (act === 'next') await goDate(shiftDate(st.date, 1)); else if (act === 'today') await goDate(appToday()); else if (act === 'edit') { st.editMode = !st.editMode; paint(); }
  };
  root.onchange = async (ev) => { const t = ev.target; if (t instanceof Element && t.hasAttribute('data-pg-date')) await goDate(t.value); };
}
