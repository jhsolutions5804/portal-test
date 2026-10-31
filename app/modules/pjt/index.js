/* PJT 관리(통합 새 모듈) — 설계서 docs/pjt-design.md. Ph2·Ph4·경량PJT를 한 모듈로 합친다.
 * 지금 새 화면은 "출역·공수"(근태·공수 탭) 하나다 — 구포털 PJT 메뉴에서 프로젝트를 고르면 그 아래 "👷 출역·공수 (새)" 탭으로 열린다(legacy/frame.js 의 nativeSubs, modules/index.js hostNative). 프로젝트는 화면 안에서 고르지 않는다. 나머지 탭은 만들면서 구포털 항목을 하나씩 교체한다.
 * 저장 형식은 구포털 그대로(출역 { checks }, 공수 { md }, 날짜별 문서) — 영업기획의 공수 연동·팀별 노무비가 읽는다. 경로는 adapter.js, 규칙은 attendance.js. */
import { db, functions, httpsCallable, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, deleteField, query, where, documentId, serverTimestamp } from '../../core/firebase.js?v=20261031d';
import { esc, toast } from '../../core/ui.js?v=20261031d';
import { confirmDialog } from '../../core/dialog.js?v=20261031d';
import { pathsFor, featuresOf, defaultMandayOf, isDateKey } from './adapter.js?v=20261031d';
import { applyManday, applyAdjust, applyAllManday, toggleCheck, toggleAll, canWorkOn, hasManday, cumulativeByWorker, recentTotals, monthSheet, appToday, shiftDate, clampManday } from './attendance.js?v=20261031d';
import { visibleProjects } from './projects.js?v=20261031d';
import { loadHolidays } from '../../shared/holidays.js?v=20261031d';
import { attendHtml, dayWorkers } from './attend-view.js?v=20261031d';
import { normalizeDay, stateAt, cellState, keyOf, stagesOf } from './progress.js?v=20261031d';
import { structureFor, planSave } from './structure-store.js?v=20261031d';
import { toRuntime, diffStructure, hasChanges, impactOf, validateStructure, setPpt, setFeature, addStage, removeStage, moveStage, toggleInstall, addGroup, renameGroup, removeGroup, addItems, removeItem, parseItemList } from './structure.js?v=20261031d';
import { progressHtml } from './progress-view.js?v=20261031d';
import { diffText } from './structure-view.js?v=20261031d';
import { activeWorkersForDate } from './attendance.js?v=20261031d';
import { buildDeck, loadPptxGen } from './progress-ppt.js?v=20261031d';
import { buildWeekly } from './weekly-ppt.js?v=20261031d';
import { boxFromGesture, normalizeSizes, cleanBox, withPoint, withoutPoint, remapByOrder, unmatchedKeys, snapToTuesday, weekNo, weekRange } from './layout.js?v=20261031d';
import { fileToDataUrl, imageInfo } from './image-tools.js?v=20261031d';
import { layoutEditorHtml } from './layout-view.js?v=20261031d';
import { scheduleHtml } from './schedule-view.js?v=20261031d';
import { reportHtml } from './report-view.js?v=20261031d';
import { runReportLog } from '../../shared/pjt-log.js?v=20261031d';
import { isDirty, openPopup, closePopup, createPopupHistory } from './report-popup.js?v=20261031d'; // 공사일보 폰 폭 팝업(대표님 2026-10-19)
import { homeHtml } from './home-view.js?v=20261031d';
import { settingsHtml } from './settings-view.js?v=20261031d';
import { formOf as settingsFormOf, buildData as settingsBuild, changedFields, endText, parseDefaultManday } from './settings.js?v=20261031d';
import { dday, monthMandayTotal, latestReports } from './home.js?v=20261031d';
import { calcAll } from './progress.js?v=20261031d';
import { fromStored, toStored, totalOf, attendanceSummary, autoContent, docHtml, docTitle, isLegacyDoc, dateText, WORK_SHIFTS, authorLabel, normalizeEquip, withEditor } from './report.js?v=20261031d';
import { itemsForKey, buildDoc, formOf, detectCat, addDays, weekDays, isKey } from './schedule.js?v=20261031d';

export { mountRoster } from './roster-index.js?v=20261031d';
export { mountEnded } from './overview-index.js?v=20261031d';
export { mountTeam } from './team-index.js?v=20261031d';
import { mountOverview, notifyPjtChanged } from './overview-index.js?v=20261031d';
import { installFilesDock as installDock } from './files-drawer.js?v=20261031d';
import { syncWithNote } from './daily-note.js?v=20261031d';
import { logHtml } from './log-view.js?v=20261031d';
import { createLogPanel } from './log-panel.js?v=20261031d';
import { monthlyHtml, printHtml } from './monthly-view.js?v=20261031d';
import { ckParseNames, ckRowsFrom, ckCheck, ckMove, ckPayload, ckDirty } from './closeout.js?v=20261031d';
import { hasMoney as lgHasMoney, hasPersonal as lgHasPersonal, friendlyError as lgFriendlyError } from '../../shared/pjt-log.js?v=20261031d';
import { printWithTitle } from '../../shared/print-title.js?v=20261031d';
export const manifest = { id: 'pjt', order: 40, title: 'PJT 관리', icon: '🏗️', defaultHash: '#/pjt/attend', perm: (me) => !!me && me.admin === true };
export async function mount(root) { root.innerHTML = '<div class="jh-empty">PJT 화면은 구포털 틀 안의 메뉴로 열립니다.</div>'; }
const pushHash = (h) => { if (location.hash === h) return; try { history.replaceState(null, '', h); } catch (e) { location.hash = h; } };

/** 프로젝트 목록 읽기(구포털 틀의 loadPjtDyn 과 같은 규칙): 종료되지 않은 프로젝트 전부(참여자 지정 포함) — 모든 프로젝트가 pjt_registry 문서 하나씩이다 */
async function loadDyn() {
  const dyn = { registry: [] };
  try { const s = await getDocs(collection(db, 'pjt_registry')); const arr = []; s.forEach((d) => { const x = d.data(); if (x.status !== 'ended') arr.push(Object.assign({}, x, { id: d.id, name: x.name || 'PJT' })); }); arr.sort((a, b) => ((a.createdAt && a.createdAt.seconds) || 0) - ((b.createdAt && b.createdAt.seconds) || 0)); dyn.registry = arr; } catch (e) { /* 권한 없음 */ }
  return dyn;
}
const uniq = (a) => [...new Set(a)];

/** PJT 자료 패널(SharePoint 파일 패널)을 셸의 오른쪽 도킹 영역에 설치한다 — 로그인 뒤 한 번(boot.js → modules/index.js installShellDocks). 서버 함수 filesAct 만 부르고(읽기 전용), 패널 코드 자체는 Firebase 를 모른다. */
export function installFilesDock(host, me) { return installDock(host, me, { callFiles: async (payload) => (await httpsCallable(functions, 'filesAct')(payload)).data }); }

/** 출역·공수(근태·공수 탭): 프로젝트 아래의 탭 — 주소 #/pjt/<프로젝트>/attend/<날짜>. 틀(legacy/frame.js)이 route.segs 를 [프로젝트, 날짜]로 넘긴다 */
export async function mountAttend(root, route, ctx) {
  root.onclick = null; root.onchange = null; root.onkeydown = null;
  const me = (ctx && ctx.me) || {}; const segs = (route && route.segs) || [];
  const guest = !(me.admin || (me.perms && me.perms.pjt)); const leaderIds = Array.isArray(me.teamLeaderIds) ? me.teamLeaderIds : [];
  const st = { projects: [], proj: '', date: isDateKey(segs[1]) ? segs[1] : appToday(), roster: [], masters: {}, resigned: {}, att: [], md: {}, recent: [], panel: 'sheet', sheet: null, sheetByDay: null, cum: null, cumDocs: null, month: { y: 0, m: 0 }, me: { guest, teamLeaderIds: leaderIds }, teamMasterIds: new Set(leaderIds), readonly: guest && !leaderIds.length, manage: !guest, busy: false };
  root.innerHTML = '<div id="pa-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#pa-body');
  const paint = () => { const y = window.scrollY; body.innerHTML = attendHtml(st); window.scrollTo(0, y); };
  const P = () => pathsFor(st.proj); const feat = () => ({ defaultManday: defaultMandayOf(st.projDoc) });   // 출역 체크 시 자동 공수는 프로젝트 문서의 설정값(모든 프로젝트 같은 코드)
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
    const gd = t.closest('[data-pa-goday]'); if (gd) { await goDate(gd.getAttribute('data-pa-goday')); return; }   // 이달 공수 달력의 날짜 → 그 날짜의 출역·공수 입력
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
  const st = { projects: [], proj: '', label: '', date: isDateKey(segs[1]) ? segs[1] : appToday(), structure: null, items: [], projDoc: null, days: {}, states: {}, open: new Set(), editMode: false, isToday: true, ready: false, loadingNote: '', readonly: guest && !leaderIds.length, busy: false, canEditStructure: !!me.admin, editor: null, layoutEd: null, weekly: null, features: {} };
  root.innerHTML = '<div id="pg-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#pg-body');
  // 넓은 화면(1000px 이상)이면 섹터 카드 옆에 체크표를 둔다 — 폭이 바뀌면 다시 그린다
  const mq = window.matchMedia ? window.matchMedia('(min-width: 1000px)') : null; st.wide = mq ? mq.matches : true; if (root.__pgMqOff) root.__pgMqOff(); if (mq && mq.addEventListener) { const onMq = (e) => { st.wide = e.matches; if (!st.editor && !st.layoutEd && st.ready) paint(); }; mq.addEventListener('change', onMq); root.__pgMqOff = () => mq.removeEventListener('change', onMq); }
  const paint = () => { const y = window.scrollY; st.features = st.structData ? featuresOf(st.structData.features) : {}; body.innerHTML = progressHtml(st); window.scrollTo(0, y); if (st.layoutEd) bindOverlay(); };
  try { await Promise.race([loadHolidays(), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* 공휴일을 못 불러오면 날짜 표시만 빠진다 */ }
  try { st.projects = visibleProjects(me, await loadDyn()); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy');
  st.proj = st.projects.some((p) => p.key === segs[0]) ? segs[0] : ''; if (!st.proj) { paint(); return; }
  const P = pathsFor(st.proj); const pr = st.projects.find((p) => p.key === st.proj); st.label = pr.label; st.projDoc = pr.doc;
  const recompute = () => { st.isToday = st.date === appToday(); const S = st.structure; st.states = {}; S.groups.forEach((g) => { st.states[g.id] = stateAt(st.days, st.date, g.id); }); };
  // 날짜별 공정 체크는 컬렉션 하나(progress_days)를 한 번에 읽는다
  const loadDays = async () => { if (st.daysLoaded) return; try { const snap = await getDocs(collection(db, P.progress.days)); snap.forEach((x) => { st.days[x.id] = normalizeDay(x.data()); }); } catch (e) { /* 아직 체크가 없는 프로젝트 */ } st.daysLoaded = true; };
  // 구조(섹터·품목·단계)는 프로젝트 문서의 progressStructure 하나에서 읽는다
  const loadStructure = async () => { const ps = await getDoc(doc(db, P.settings.col, P.settings.id)); st.projDoc = ps.exists() ? Object.assign({ id: P.settings.id }, ps.data()) : (pr.doc || {}); const r = structureFor(st.projDoc); st.structData = r.S; st.structure = toRuntime(r.S, st.label, stagesOf); };
  const openDefault = () => { st.open = new Set(); const S = st.structure; if (S.groups.length === 1) { st.open.add(S.groups[0].id); return; } const first = S.groups.find((g) => { const c = (st.states[g.id] || {}).merged || {}; const n = g.items.reduce((s, it) => s + S.leafCols.filter((col) => c[keyOf(it.id, col)]).length, 0); return n > 0 && n < g.items.length * S.leafCols.length; }) || S.groups[0]; if (first) st.open.add(first.id); };
  try { await loadStructure(); await loadDays(); recompute(); openDefault(); st.ready = true; } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  paint();
  const goDate = async (d) => { if (!isDateKey(d)) return; st.date = d; pushHash('#/pjt/' + st.proj + '/progress/' + d); st.ready = false; paint(); try { await loadDays(); } catch (e) { toast('불러오기 실패: ' + ((e && e.message) || '')); } recompute(); st.ready = true; paint(); };
  const toggle = async (gid, itemId, col) => {
    if (st.busy || st.readonly) return; const key = keyOf(itemId, col); const cs = cellState(st.states[gid], key, st.isToday, st.editMode); if (!cs.canToggle) return; const on = !cs.done; st.busy = true;
    try {
      // 그날 문서에 그 칸 하나만 병합 저장한다 — 다른 사람이 동시에 체크한 칸을 덮어쓰지 않는다
      await setDoc(doc(db, P.progress.days, st.date), { groups: { [gid]: { [key]: on ? true : deleteField() } }, updatedAt: serverTimestamp() }, { merge: true });
      const cur = Object.assign({}, st.days[st.date] || {}); const m = Object.assign({}, cur[gid] || {}); if (on) m[key] = true; else delete m[key]; cur[gid] = m; st.days[st.date] = cur; recompute();
      try { const A = calcAll(st.structure, st.states); await updateDoc(doc(db, P.settings.col, P.settings.id), { progress: Math.round(A.pct * 10) / 10 }); } catch (e) { /* 프로젝트 목록의 진행률 갱신 실패는 체크 저장을 막지 않는다 */ }
    } catch (e) { toast('저장 실패: ' + ((e && (e.code || e.message)) || '')); }
    st.busy = false; paint();
  };
  // ── 공정 구조 설정(섹터·품목·단계 편집) — 모든 프로젝트 같은 편집기. 편집 중 구조(st.editor.S)는 저장 전까지 아무것도 쓰지 않는다 ──
  const cloneS = (o) => JSON.parse(JSON.stringify(o));
  const openEditor = () => { if (!st.canEditStructure) return; st.editor = { S: cloneS(st.structData), orig: cloneS(st.structData), open: new Set(st.structData.groups.length === 1 ? [st.structData.groups[0].id] : []), }; paint(); };
  const apply = (r) => { if (r.error) { toast(r.error); return false; } st.editor.S = r.S; if (r.added && r.skipped && r.skipped.length) toast('이미 있어 건너뜀: ' + r.skipped.join(', ')); if (r.bad && r.bad.length) toast('쓸 수 없는 이름 건너뜀(_ / . # $ [ ] 금지): ' + r.bad.join(', ')); return true; };
  const keepFocus = () => paint();
  const saveStructure = async () => {
    const E = st.editor; const v = validateStructure(E.S); if (!v.ok) { toast(v.errors[0]); return; } const d = diffStructure(E.orig, E.S); if (!hasChanges(d)) { toast('변경 내용이 없습니다.'); return; }
    const merged = {}; Object.keys(st.states).forEach((g) => { merged[g] = st.states[g].merged; }); const imp = impactOf(E.orig, d, merged);
    const ok = await confirmDialog({ title: '공정 구조 저장', body: diffText(d) + (imp.cells ? '\n\n지워지는 단계·품목에 이미 체크된 ' + imp.cells + '칸은 기록은 남지만 더 이상 공정율에 세지 않습니다.' : '') + '\n\n저장하면 영업기획의 청구서 공정 연동도 이 구조를 씁니다. 저장할까요?', confirmLabel: '저장' }); if (!ok.ok) return;
    st.busy = true; try {
      const writes = planSave(P, E.S, me.name || ''); for (const w of writes) { const ref = doc(db, w.col, w.id); const data = w.data ? Object.fromEntries(Object.entries(w.data).map(([k, x]) => [k, x === 'TS' ? serverTimestamp() : x])) : null;
        if (w.op === 'delete') await deleteDoc(ref); else if (w.op === 'update') await updateDoc(ref, data); else await setDoc(ref, data, w.merge ? { merge: true } : undefined); }
      // 방금 쓴 값을 그대로 화면 상태에 반영한다(다시 읽지 않아도 같은 결과 — 쓰기 직후 읽기 지연에도 흔들리지 않음)
      st.projDoc = Object.assign({}, st.projDoc, { progressStructure: E.S });
      const rs = structureFor(st.projDoc); st.structData = rs.S; st.structure = toRuntime(rs.S, st.label, stagesOf); recompute(); st.editor = null; st.open = new Set(); openDefault(); toast('공정 구조를 저장했습니다.');
    } catch (e) { toast('저장 실패: ' + ((e && (e.code || e.message)) || '')); }
    st.busy = false; paint();
  };
  const editorClick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element) || !st.editor) return; const E = st.editor; const q = (a) => t.closest('[' + a + ']'); let el;
    if ((el = q('data-st-up'))) { apply(moveStage(E.S, el.getAttribute('data-st-up'), -1)); keepFocus(); return; } if ((el = q('data-st-down'))) { apply(moveStage(E.S, el.getAttribute('data-st-down'), 1)); keepFocus(); return; }
    if ((el = q('data-st-sdel'))) { apply(removeStage(E.S, el.getAttribute('data-st-sdel'))); keepFocus(); return; }
    if ((el = q('data-st-gopen'))) { const id = el.getAttribute('data-st-gopen'); if (E.open.has(id)) E.open.delete(id); else E.open.add(id); keepFocus(); return; }
    if ((el = q('data-st-gdel'))) { const id = el.getAttribute('data-st-gdel'); const g = E.S.groups.find((x) => x.id === id); if (g && g.items.length) { const ok = await confirmDialog({ title: '섹터 삭제', body: g.name + ' 섹터와 품목 ' + g.items.length + '개를 삭제할까요? (저장 전에는 아무것도 지워지지 않습니다)', confirmLabel: '삭제' }); if (!ok.ok) return; } apply(removeGroup(E.S, id)); keepFocus(); return; }
    if ((el = q('data-st-idel'))) { const [g, id] = el.getAttribute('data-st-idel').split('|'); apply(removeItem(E.S, g, id)); keepFocus(); return; }
    if ((el = q('data-st-iadd'))) { const gid = el.getAttribute('data-st-iadd'); const ta = body.querySelector('[data-st-itext="' + gid + '"]'); const names = parseItemList(ta ? ta.value : ''); if (!names.length) { toast('추가할 품목을 입력하세요.'); return; } const r = addItems(E.S, gid, names); if (apply(r)) { toast(r.added.length + '개 추가'); keepFocus(); } return; }
    if ((el = q('data-st-act'))) { const act = el.getAttribute('data-st-act');
      if (act === 'add-stage') { const inp = body.querySelector('[data-st-newstage]'); if (apply(addStage(E.S, inp ? inp.value : ''))) keepFocus(); return; }
      if (act === 'add-group') { const inp = body.querySelector('[data-st-newgroup]'); const r = addGroup(E.S, inp ? inp.value : ''); if (apply(r)) { const g = r.S.groups[r.S.groups.length - 1]; E.open.add(g.id); keepFocus(); } return; }
      if (act === 'cancel') { if (hasChanges(diffStructure(E.orig, E.S))) { const ok = await confirmDialog({ title: '편집 닫기', body: '저장하지 않은 변경이 사라집니다. 닫을까요?', confirmLabel: '닫기' }); if (!ok.ok) return; } st.editor = null; paint(); return; }
      if (act === 'save') await saveStructure(); }
  };
  const editorChange = (ev) => { const t = ev.target; if (!(t instanceof Element) || !st.editor) return; const E = st.editor;
    if (t.hasAttribute('data-st-inst')) { apply(toggleInstall(E.S, t.getAttribute('data-st-inst'), t.checked)); keepFocus(); return; }
    if (t.hasAttribute('data-st-feat')) { apply(setFeature(E.S, t.getAttribute('data-st-feat'), t.checked)); keepFocus(); return; }
    if (t.hasAttribute('data-st-ppt')) { apply(setPpt(E.S, t.getAttribute('data-st-ppt'), t.value)); keepFocus(); return; }
    if (t.hasAttribute('data-st-gname')) { if (!apply(renameGroup(E.S, t.getAttribute('data-st-gname'), t.value))) keepFocus(); else keepFocus(); } };

  // ── 선택 기능: 장비 배치도(도면 매핑)·주간 공정회의 PPT — 프로젝트 설정에서 켜고 끈다(Ph2 기본 켜짐). 모든 프로젝트 같은 동작 ──
  const feat = () => featuresOf((st.structData || {}).features);
  const readImg = (ctx && ctx.readImage) || fileToDataUrl, imgInfo = (ctx && ctx.imageInfo) || imageInfo;
  const loadLayoutDoc = async (gid) => { try { const s = await getDoc(doc(db, P.progress.layouts, gid)); return s.exists() ? s.data() : { points: {} }; } catch (e) { return { points: {} }; } };
  const srcOf = (gid, d) => (d && d.image) || null;   // 도면 이미지는 배치도 문서의 image 에 둔다(모든 프로젝트 같은 방식)
  const lyGroup = () => { const E = st.layoutEd; return st.structure.groups.find((x) => x.id === E.gid) || st.structure.groups[0]; };
  const ensureLayout = async (gid) => { const E = st.layoutEd; if (E.docs[gid]) return; const d = await loadLayoutDoc(gid); E.docs[gid] = d; E.src[gid] = srcOf(gid, d); };
  const openLayout = async () => { if (!st.canEditStructure || !feat().layoutMap) return; const g0 = st.structure.groups[0]; if (!g0) return; st.layoutEd = { gid: g0.id, cur: 0, zoom: 1, docs: {}, src: {} }; paint(); await ensureLayout(g0.id); paint(); };
  const saveLayoutDoc = async (gid, mutate) => {   // 방금 읽은 최신 문서에서 한 가지만 바꿔 문서 전체를 쓴다(구포털과 같은 방식 — 다른 좌표·이미지는 그대로)
    const ref = doc(db, P.progress.layouts, gid); const snap = await getDoc(ref); const latest = snap.exists() ? snap.data() : { points: {} }; const next = mutate(Object.assign({ points: {} }, latest)); await setDoc(ref, Object.assign({}, next, { updatedAt: serverTimestamp() }));
    st.layoutEd.docs[gid] = next; st.layoutEd.src[gid] = srcOf(gid, next);
  };
  const placeBox = async (s0, end, size) => {
    const E = st.layoutEd; if (!E || st.busy) return; const g = lyGroup(); const cur = g.items[E.cur]; if (!cur) return; const dc = E.docs[g.id] || { points: {} };
    const r = boxFromGesture(s0, end, size, dc.points, g.items.map((i) => i.id), E.cur); if (r.error) { toast(r.error); return; } const box = cleanBox(r.box); if (!box) { toast('박스가 너무 작거나 도면 밖입니다.'); return; }
    st.busy = true; try { await saveLayoutDoc(g.id, (d) => withPoint(d, cur.id, box)); if (E.cur < g.items.length - 1) E.cur++; } catch (e) { toast('저장 실패: ' + ((e && (e.code || e.message)) || '')); } st.busy = false; paint();
  };
  const bindOverlay = () => {
    const ov = body.querySelector('[data-ly-over]'); if (!ov) return; let start = null, dragEl = null; const pos = (e) => { const r = ov.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; };
    ov.onpointerdown = (e) => { start = pos(e); dragEl = document.createElement('div'); dragEl.className = 'jh-pjt__lmdrag'; ov.appendChild(dragEl); try { ov.setPointerCapture(e.pointerId); } catch (x) { /* 지원하지 않는 환경 */ } e.preventDefault(); };
    ov.onpointermove = (e) => { if (!start || !dragEl) return; const c = pos(e); dragEl.style.left = Math.min(start.x, c.x) + 'px'; dragEl.style.top = Math.min(start.y, c.y) + 'px'; dragEl.style.width = Math.abs(c.x - start.x) + 'px'; dragEl.style.height = Math.abs(c.y - start.y) + 'px'; };
    ov.onpointerup = async (e) => { if (!start) return; const c = pos(e); const s0 = { x: start.x, y: start.y }; start = null; if (dragEl) { dragEl.remove(); dragEl = null; } await placeBox(s0, { x: c.x, y: c.y }, { w: c.w, h: c.h }); };
  };
  const layoutClick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element) || !st.layoutEd) return; const E = st.layoutEd; let el;
    if ((el = t.closest('[data-ly-g]'))) { E.gid = el.getAttribute('data-ly-g'); E.cur = 0; E.zoom = 1; await ensureLayout(E.gid); paint(); return; }
    if ((el = t.closest('[data-ly-eq]'))) { E.cur = Number(el.getAttribute('data-ly-eq')); paint(); return; }
    if (!(el = t.closest('[data-ly-act]'))) return; const act = el.getAttribute('data-ly-act'); const g = lyGroup(); const dc = E.docs[g.id] || { points: {} }; const cur = g.items[E.cur];
    if (act === 'close') { st.layoutEd = null; paint(); return; } if (act === 'zin') { E.zoom = Math.min(4, Math.round((E.zoom + 0.25) * 100) / 100); paint(); return; } if (act === 'zout') { E.zoom = Math.max(0.5, Math.round((E.zoom - 0.25) * 100) / 100); paint(); return; } if (act === 'zreset') { E.zoom = 1; paint(); return; }
    const run = async (fn, okMsg) => { st.busy = true; try { await fn(); if (okMsg) toast(okMsg); } catch (e) { toast('저장 실패: ' + ((e && (e.code || e.message)) || '')); } st.busy = false; paint(); };
    if (act === 'del') { if (!cur || !(dc.points || {})[cur.id]) { toast('선택한 품목에 지울 좌표가 없습니다.'); return; } const ok = await confirmDialog({ title: '좌표 삭제', body: cur.name + ' 좌표를 삭제할까요?', confirmLabel: '삭제' }); if (!ok.ok) return; await run(() => saveLayoutDoc(g.id, (d) => withoutPoint(d, cur.id))); return; }
    if (act === 'delall') { const n = Object.keys(dc.points || {}).length; if (!n) { toast('이 섹터엔 매핑된 좌표가 없습니다.'); return; } const ok = await confirmDialog({ title: '좌표 전체 삭제', body: (g.name || '전체') + ' 섹터에 매핑된 좌표 ' + n + '개를 전부 삭제할까요? 되돌릴 수 없습니다.', confirmLabel: '전체 삭제' }); if (!ok.ok) return; await run(() => saveLayoutDoc(g.id, (d) => Object.assign({}, d, { points: {} })), '좌표를 전부 삭제했습니다.'); return; }
    if (act === 'norm') { const nz = normalizeSizes(dc.points); if (!nz) { toast('보정하려면 박스가 2개 이상 있어야 합니다.'); return; } const ok = await confirmDialog({ title: '크기 일괄 보정', body: '박스 ' + Object.keys(nz.points).length + '개를 모두 같은 크기(' + (nz.w * 100).toFixed(1) + '% × ' + (nz.h * 100).toFixed(1) + '%)로 맞춥니다. 각 박스의 중심 위치는 그대로입니다.', confirmLabel: '보정' }); if (!ok.ok) return; await run(() => saveLayoutDoc(g.id, (d) => Object.assign({}, d, { points: nz.points })), '보정했습니다.'); return; }
    if (act === 'remap') { const rm = remapByOrder(dc.points, g.items); if (!rm.pairs.length) { toast('맞출 좌표가 없습니다.'); return; } const ok = await confirmDialog({ title: '좌표 번호 맞추기', body: '맞지 않는 좌표 ' + rm.pairs.length + '개의 번호를 품목 번호에 순서대로 맞춥니다(예: ' + rm.pairs.slice(0, 3).map((p) => p[0] + ' → ' + p[1]).join(', ') + '). 번호 순서가 같을 때만 맞는 방법입니다. 맞춘 뒤 도면에서 위치를 확인하세요.', confirmLabel: '맞추기' }); if (!ok.ok) return; await run(() => saveLayoutDoc(g.id, (d) => Object.assign({}, d, { points: remapByOrder(d.points, g.items).points })), '번호를 맞췄습니다.'); return; }
    if (act === 'rmimg') { const ok = await confirmDialog({ title: '올린 도면 이미지 지우기', body: '올린 이미지를 지웁니다(좌표는 그대로). 다시 올려야 도면이 보입니다.', confirmLabel: '지우기' }); if (!ok.ok) return; await run(() => saveLayoutDoc(g.id, (d) => { const o = Object.assign({}, d); delete o.image; return o; })); }
  };
  const layoutChange = async (ev) => {
    const t = ev.target; if (!(t instanceof Element) || !t.hasAttribute('data-ly-file') || !st.layoutEd) return; const f = t.files && t.files[0]; if (!f) return; const g = lyGroup(); st.busy = true;
    try { const url = await readImg(f); await saveLayoutDoc(g.id, (d) => Object.assign({}, d, { image: url })); toast('도면 이미지를 올렸습니다.'); } catch (e) { toast((e && e.message) || '이미지를 올리지 못했습니다.'); } st.busy = false; paint();
  };
  // 주간 공정회의 PPT: 화요일 기준 한 주(수~화) — 선택한 날짜가 속한 주의 화요일과 그 전주 화요일의 누적을 비교한다
  const makeWeekly = async () => {
    if (st.busy || !st.weekly) return; st.busy = true; toast('주간 공정회의 PPT를 만드는 중...');
    try {
      const Pptx = await loadPptxGen(); const S = st.structure; const tue = snapToTuesday(st.weekly.date), wr = weekRange(tue); const today = appToday(); await loadDays(tue);
      const stNow = {}, stLast = {}; S.groups.forEach((g) => { stNow[g.id] = stateAt(st.days, tue, g.id); stLast[g.id] = stateAt(st.days, wr.last, g.id); });
      const layouts = {}, images = {}; await Promise.all(S.groups.map(async (g) => { const d = await loadLayoutDoc(g.id); layouts[g.id] = d; const src = srcOf(g.id, d); if (!src) return; const info = await imgInfo(src); if (info && info.exists) images[g.id] = Object.assign({ w: info.w, h: info.h }, src.indexOf('data:') === 0 ? { data: src.slice(5) } : { path: src }); }));
      const pres = new Pptx(); const no = weekNo(tue); const meta = { client: (S.ppt && S.ppt.client) || '', label: st.label, title: (S.ppt && S.ppt.title) || '', unit: S.unit || '대' };
      const r = buildWeekly(pres, meta, S, { no, from: wr.from, to: wr.to }, stNow, stLast, layouts, images); await pres.writeFile({ fileName: r.fileName }); toast('"' + r.fileName + '" 다운로드를 시작했습니다.');
    } catch (e) { toast('PPT를 만들지 못했습니다: ' + ((e && e.message) || '')); }
    st.busy = false; paint();
  };
  // 공정표 PPT: 지금 보고 있는 날짜 기준. 날짜 문서가 없는 옛 체크(경량 품목의 현재 상태)는 "기준일에 새로 체크한 것"으로 세지 않도록, 전일 대비는 날짜별 문서의 변화만 쓴다
  const makePpt = async () => {
    if (st.busy) return; st.busy = true; toast('공정표 PPT를 만드는 중...');
    try {
      const Pptx = await loadPptxGen(); const S = st.structure; const states = {};
      S.groups.forEach((g) => { const cur = st.states[g.id] || {}; states[g.id] = { merged: cur.merged || {}, todayOnly: cur.todayOnly || {}, pastOnly: cur.pastOnly || {} }; });
      const pres = new Pptx(); const meta = { client: (S.ppt && S.ppt.client) || '', label: st.label, title: (S.ppt && S.ppt.title) || '', unit: S.unit || '대', isToday: st.isToday };
      const r = buildDeck(pres, meta, S, states, st.date); await pres.writeFile({ fileName: r.fileName }); toast('"' + r.fileName + '" 다운로드를 시작했습니다.');
    } catch (e) { toast('PPT를 만들지 못했습니다: ' + ((e && e.message) || '')); }
    st.busy = false;
  };
  root.onclick = async (ev) => {
    if (st.editor) { await editorClick(ev); return; }
    if (st.layoutEd) { await layoutClick(ev); return; }
    const t = ev.target; if (!(t instanceof Element)) return;
    const ck = t.closest('[data-pg-ck]'); if (ck) { const [g, it, col] = ck.getAttribute('data-pg-ck').split('|'); await toggle(g, it, col); return; }
    const op = t.closest('[data-pg-open]'); if (op) { const id = op.getAttribute('data-pg-open'); st.open = st.open.has(id) ? new Set() : new Set([id]); paint(); return; }
    const a = t.closest('[data-pg-act]'); if (!a) return; const act = a.getAttribute('data-pg-act');
    if (act === 'prev') await goDate(shiftDate(st.date, -1)); else if (act === 'next') await goDate(shiftDate(st.date, 1)); else if (act === 'today') await goDate(appToday()); else if (act === 'edit') { st.editMode = !st.editMode; paint(); } else if (act === 'structure') openEditor(); else if (act === 'ppt') await makePpt(); else if (act === 'layout') await openLayout(); else if (act === 'weekly') { st.weekly = st.weekly ? null : { date: snapToTuesday(st.date) }; paint(); } else if (act === 'weekly-make') await makeWeekly();
  };
  root.onchange = async (ev) => { if (st.editor) { editorChange(ev); return; } if (st.layoutEd) { await layoutChange(ev); return; } const t = ev.target; if (t instanceof Element && t.hasAttribute('data-pg-wdate') && st.weekly) { st.weekly.date = t.value; paint(); return; } if (t instanceof Element && t.hasAttribute('data-pg-date')) await goDate(t.value); };
}

/** 일정(일정 탭): 프로젝트 아래의 탭 — 주소 #/pjt/<프로젝트>/schedule/<날짜>. 모든 프로젝트 같은 화면·같은 문서 형식(저장 경로만 다름: Ph2 user_schedules = 포털 홈 통합 캘린더와 공유, Ph4 ph4_schedules, 경량 pjt_registry/<id>/schedules).
 *  등록·수정·삭제·완료는 관리자·PJT 담당 계정만(GUEST 는 조회만 — 구포털과 같음). */
export async function mountSchedule(root, route, ctx) {
  root.onclick = null; root.onchange = null; root.onkeydown = null; root.oninput = null;
  const me = (ctx && ctx.me) || {}; const segs = (route && route.segs) || []; const guest = !(me.admin || (me.perms && me.perms.pjt));
  const today = appToday(); const date0 = isDateKey(segs[1]) ? segs[1] : today; const [y0, m0] = date0.split('-').map(Number);
  const st = { projects: [], proj: '', label: '', items: [], date: date0, today, view: 'month', month: { y: y0, m: m0 - 1 }, form: null, ready: false, manage: !guest, readonly: guest, busy: false };
  root.innerHTML = '<div id="sc-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#sc-body');
  const paint = () => { const y = window.scrollY; body.innerHTML = scheduleHtml(st); window.scrollTo(0, y); };
  try { await Promise.race([loadHolidays(), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* 공휴일 없이 주말만 표시 */ }
  try { st.projects = visibleProjects(me, await loadDyn()); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy'); st.proj = st.projects.some((p) => p.key === segs[0]) ? segs[0] : ''; if (!st.proj) { paint(); return; }
  const P = pathsFor(st.proj); st.label = st.projects.find((p) => p.key === st.proj).label;
  const load = async () => { const snap = await getDocs(collection(db, P.schedules)); st.items = []; snap.forEach((d) => st.items.push(Object.assign({ id: d.id }, d.data()))); };
  try { await load(); st.ready = true; } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">일정을 불러오지 못했습니다: ' + esc((e && (e.code || e.message)) || '') + '</div>'; return; }
  paint();
  const go = (d) => { if (!isKey(d)) return; st.date = d; const [y, m] = d.split('-').map(Number); st.month = { y, m: m - 1 }; pushHash('#/pjt/' + st.proj + '/schedule/' + d); };
  const readForm = () => { if (!st.form) return; body.querySelectorAll('[data-sc-f]').forEach((el) => { st.form[el.getAttribute('data-sc-f')] = el.value; }); const td = body.querySelector('[data-sc-todo]'); if (td) st.form.isTodo = td.checked; };
  const openForm = (u, key) => { st.form = Object.assign(formOf(u, key || st.date), { catTouched: !!u }); if (!u) st.form.reg = me.name || ''; st.form.tag = u ? st.form.tag : 'admin'; paint(); };
  const save = async () => {
    readForm(); const r = buildDoc(st.form, { today: st.date }); if (r.error) { toast(r.error); return; } if (st.busy) return; st.busy = true; const id = st.form.id;
    try {
      if (id) { await setDoc(doc(db, P.schedules, id), Object.assign({}, r.data, { savedAt: serverTimestamp() }), { merge: true }); st.items = st.items.map((x) => (x.id === id ? Object.assign({}, x, r.data) : x)); }
      else { const ref = await addDoc(collection(db, P.schedules), Object.assign({}, r.data, { savedAt: serverTimestamp(), createdAt: serverTimestamp() })); st.items.push(Object.assign({ id: ref.id }, r.data)); }
      go(r.data.sdate); st.form = null; toast(id ? '수정했습니다.' : '등록했습니다.');
    } catch (e) { toast('저장 실패: ' + ((e && (e.code || e.message)) || '')); }
    st.busy = false; paint();
  };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; let el;
    if ((el = t.closest('[data-sc-view]'))) { readForm(); st.view = el.getAttribute('data-sc-view') === 'two' ? 'two' : 'month'; paint(); return; }
    if ((el = t.closest('[data-sc-nav]'))) { readForm(); const v = el.getAttribute('data-sc-nav'); if (v === 'today') go(st.today); else { const n = Number(v); if (st.view === 'month') { let { y, m } = st.month; m += n; if (m > 11) { m = 0; y++; } if (m < 0) { m = 11; y--; } st.month = { y, m }; const dd = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); const cur = Number(st.date.slice(8)); st.date = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(Math.min(cur, dd)).padStart(2, '0'); pushHash('#/pjt/' + st.proj + '/schedule/' + st.date); } else go(addDays(st.date, n * 14)); } paint(); return; }
    if ((el = t.closest('[data-sc-day]'))) { readForm(); st.date = el.getAttribute('data-sc-day'); pushHash('#/pjt/' + st.proj + '/schedule/' + st.date); paint(); return; }
    if ((el = t.closest('[data-sc-new]')) && st.manage) { openForm(null, el.getAttribute('data-sc-new')); return; }
    if ((el = t.closest('[data-sc-edit]')) && st.manage) { const u = st.items.find((x) => x.id === el.getAttribute('data-sc-edit')); if (u) openForm(u); return; }
    if ((el = t.closest('[data-sc-del]')) && st.manage) { const id = el.getAttribute('data-sc-del'); const u = st.items.find((x) => x.id === id); const ok = await confirmDialog({ title: '일정 삭제', body: '"' + ((u && u.text) || '') + '" 일정을 삭제할까요?', confirmLabel: '삭제' }); if (!ok.ok) return;
      try { await deleteDoc(doc(db, P.schedules, id)); st.items = st.items.filter((x) => x.id !== id); toast('삭제했습니다.'); } catch (e) { toast('삭제 실패: ' + ((e && (e.code || e.message)) || '')); } paint(); return; }
    if ((el = t.closest('[data-sc-cat]'))) { readForm(); st.form.tag = el.getAttribute('data-sc-cat'); st.form.catTouched = true; paint(); return; }
    if ((el = t.closest('[data-sc-act]'))) { const a = el.getAttribute('data-sc-act'); if (a === 'cancel') { st.form = null; paint(); } else if (a === 'save') await save(); }
  };
  root.onchange = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (t.hasAttribute('data-sc-todo')) { readForm(); if (st.form.isTodo) Object.assign(st.form, { sh: '00', sm: '00', eh: '24', em: '00' }); paint(); return; }
    if (t.hasAttribute('data-sc-done') && st.manage) { const id = t.getAttribute('data-sc-done'); const done = t.checked; const u = st.items.find((x) => x.id === id); if (u) u.done = done;
      try { await setDoc(doc(db, P.schedules, id), { done, doneUpdatedAt: serverTimestamp() }, { merge: true }); } catch (e) { if (u) u.done = !done; toast('완료 처리 실패: ' + ((e && (e.code || e.message)) || '')); } paint(); }
  };
  root.oninput = (ev) => {   // 내용을 쓰는 동안 분류를 자동 추정(사용자가 분류를 직접 고르기 전까지)
    const t = ev.target; if (!(t instanceof Element) || !st.form || !t.hasAttribute('data-sc-f') || t.getAttribute('data-sc-f') !== 'text' || st.form.catTouched) return; const tag = detectCat(t.value); st.form.tag = tag;
    body.querySelectorAll('[data-sc-cat]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-sc-cat') === tag))); const h = body.querySelector('[data-sc-hint]'); if (h) h.textContent = tag === 'admin' ? '' : '자동 추정: ' + (TAG_LABEL_OF[tag] || '') + ' (다르면 위에서 눌러 바꾸세요)';
  };
}
/** 이력(이력 탭): 프로젝트 아래의 탭 — 주소 #/pjt/<프로젝트>/log. 변경·결정·요청을 프로젝트별로 남기고 기한 있는 요청을 놓치지 않게 한다(설계 docs/pjt-log-design.md).
 *  저장·읽기는 모두 서버 함수 pjtLogAct 로만 한다(참여자 판정은 서버) — 이 화면은 Firestore 의 pjt_log 를 직접 읽지 않는다. 시험·확장을 위해 호출 함수를 ctx.callLog 로 바꿀 수 있다. */
/** 이력(이력 탭): 프로젝트 아래의 탭 — 주소 #/pjt/<프로젝트>/log. 변경·결정·요청을 프로젝트별로 남기고 기한 있는 요청을 놓치지 않게 한다(설계 docs/pjt-log-design.md).
 *  읽기·쓰기는 모두 서버 함수 pjtLogAct 로만(참여자 판정은 서버) — Firestore 의 pjt_log 를 직접 읽지 않는다. 호출 함수는 ctx.callLog 로 바꿀 수 있다(시험). */
export async function mountLog(root, route, ctx) {
  root.onclick = null; root.onchange = null; root.onkeydown = null; root.oninput = null;
  const me = (ctx && ctx.me) || {}; const segs = (route && route.segs) || [];
  root.innerHTML = '<div id="lg-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#lg-body');
  let projects = [];
  try { projects = visibleProjects(me, await loadDyn()); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy'); const pr = projects.find((p) => p.key === segs[0]);
  if (!pr) { body.innerHTML = logHtml({ proj: '' }); return; }
  const panel = createLogPanel(body, { proj: pr.key, label: pr.label, me: { uid: me.uid || '' }, callLog: ctx && ctx.callLog });   // 상태·이벤트·서버 호출은 패널 부품이 맡는다(프로젝트 홈 3단째와 같은 부품)
  await panel.ready;
}
/** 월간 보고서(프로젝트 아래 탭, 현장 층 — 금액 없음): 월을 고르고 "만들기"를 누르면 서버(monthlyReportAct)가 공정·출역·공수·공사일보를 직접 읽어 계산해 저장하고, 이 화면은 결과를 그린다. 설계 docs/monthly-report-design.md.
 *  읽기·쓰기는 모두 서버 함수로만(참여자 판정은 서버) — Firestore 의 pjt_monthly 를 직접 읽지 않는다. 호출 함수는 ctx.callMonthly 로 바꿀 수 있다(시험). */
export async function mountMonthly(root, route, ctx) {
  root.onclick = null; root.onchange = null; root.onkeydown = null; root.oninput = null;
  const me = (ctx && ctx.me) || {}; const segs = (route && route.segs) || [];
  const callM = (ctx && ctx.callMonthly) || (async (payload) => (await httpsCallable(functions, 'monthlyReportAct')(payload)).data);
  const st = { projects: [], proj: '', label: '', loading: true, error: '', months: null, ym: '', report: null, reportLoading: false, canEdit: false, busy: false, msg: '', notesDraft: null, ck: null, ckRows: null, today: new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10) };
  root.innerHTML = '<div id="mr-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#mr-body');
  const paint = () => { const y = window.scrollY; body.innerHTML = monthlyHtml(st); window.scrollTo(0, y); };
  try { st.projects = visibleProjects(me, await loadDyn()); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy'); const pr = st.projects.find((p) => p.key === segs[0]); if (!pr) { paint(); return; }
  st.proj = pr.key; st.label = pr.label; st.ym = st.today.slice(0, 7);
  let seq = 0;   // 달을 빠르게 바꿀 때 늦게 온 이전 달 응답이 화면을 덮지 않게 요청 번호로 가린다
  const loadReport = async () => {
    const my = ++seq, ym = st.ym; st.reportLoading = true; st.report = null; st.notesDraft = null; paint();
    try { const r = await callM({ action: 'get', pjtId: st.proj, ym }); if (my !== seq) return; st.report = r.exists ? r.report : null; st.canEdit = r.canEdit === true; st.error = ''; }
    catch (e) { if (my !== seq) return; st.error = lgFriendlyError(e); }
    st.reportLoading = false; paint();
  };
  const loadList = async () => { try { const r = await callM({ action: 'list', pjtId: st.proj }); st.months = r.months || []; st.canEdit = r.canEdit === true; st.error = ''; } catch (e) { st.error = lgFriendlyError(e); st.months = st.months || []; } st.loading = false; };
  await loadList(); await loadReport();
  /* 마감 체크리스트(설계 §3-4) — 프로젝트 단위 데이터라 달을 바꿔도 다시 부르지 않는다. 편집은 PJT 권한자·관리자만(서버가 다시 막는다)이라 권한자일 때만 불러온다 */
  const ckBlank = (state, o) => Object.assign({ state, items: [], version: 0, updatedByName: '', error: '' }, o || {});
  const loadCk = async () => { if (!st.canEdit) return; st.ck = ckBlank('loading'); st.ckRows = null; paint(); try { const r = await callM({ action: 'closeoutGet', pjtId: st.proj }); st.ck = ckBlank('ok', { items: Array.isArray(r.items) ? r.items : [], version: Number.isInteger(r.version) ? r.version : 0, updatedByName: typeof r.updatedByName === 'string' ? r.updatedByName : '' }); } catch (e) { st.ck = ckBlank('error', { error: lgFriendlyError(e) }); } paint(); };
  await loadCk();
  const ckCur = () => (Array.isArray(st.ckRows) ? st.ckRows.map((r) => Object.assign({}, r)) : ckRowsFrom(st.ck && st.ck.items));
  const act = async (fn, okMsg) => { if (st.busy) return; st.busy = true; st.msg = ''; paint(); try { await fn(); if (okMsg) st.msg = okMsg; } catch (e) { st.msg = lgFriendlyError(e); } st.busy = false; paint(); };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (t.closest('[data-mr-gen]')) { const ym = st.ym; return act(async () => { const r = await callM({ action: 'generate', pjtId: st.proj, ym }); if (st.ym === ym) { st.report = r.report; st.notesDraft = null; } await loadList(); }, '만들었습니다.'); }
    if (t.closest('[data-mr-print]')) { if (!st.report) return; const w = window.open('', '_blank'); if (!w) { toast('팝업이 차단되었습니다.'); return; } w.document.write(printHtml(st.report, st.label)); w.document.close(); return; }
    if (t.closest('[data-mr-save]')) {
      const dr = st.notesDraft || {}; const cur = st.report && st.report.notes || {}; const notes = { remarks: dr.remarks != null ? dr.remarks : (cur.remarks || ''), nextPlan: dr.nextPlan != null ? dr.nextPlan : (cur.nextPlan || '') };
      if (lgHasMoney(notes.remarks) || lgHasPersonal(notes.remarks) || lgHasMoney(notes.nextPlan) || lgHasPersonal(notes.nextPlan)) { st.msg = '금액·단가·전화번호·메일 주소는 적지 않습니다.'; paint(); return; }
      const ym = st.ym; return act(async () => { await callM({ action: 'saveNotes', pjtId: st.proj, ym, notes }); if (st.ym === ym) { const r = await callM({ action: 'get', pjtId: st.proj, ym }); st.report = r.exists ? r.report : st.report; } st.notesDraft = null; }, '저장했습니다.');
    }
  if (!st.ck || st.ck.state !== 'ok' || st.busy) return;
  const at = (a) => { const b = t.closest('[' + a + ']'); const i = b ? Number(b.getAttribute(a)) : NaN; return Number.isInteger(i) ? i : -1; };
  if (t.closest('[data-ck-seed]')) { const box = body.querySelector('[data-ck-names]'); const names = ckParseNames(box ? box.value : ''); if (!names.length) { st.msg = '항목 이름을 한 줄에 하나씩 적어 주세요.'; paint(); return; } st.msg = ''; st.ckRows = names.map((name) => ({ id: '', name, doneDate: '', assignee: '', memo: '' })); paint(); return; }
  if (t.closest('[data-ck-add]')) { const rows = ckCur(); rows.push({ id: '', name: '', doneDate: '', assignee: '', memo: '' }); st.ckRows = rows; paint(); return; }
  let i = at('data-ck-up'); if (i >= 0) { st.ckRows = ckMove(ckCur(), i, -1); paint(); return; }
  i = at('data-ck-down'); if (i >= 0) { st.ckRows = ckMove(ckCur(), i, 1); paint(); return; }
  i = at('data-ck-today'); if (i >= 0) { const rows = ckCur(); if (rows[i]) { rows[i].doneDate = st.today; st.ckRows = rows; paint(); } return; }
  i = at('data-ck-del'); if (i >= 0) { const rows = ckCur(); if (rows[i]) { rows.splice(i, 1); st.ckRows = rows; paint(); } return; }
  if (t.closest('[data-ck-save]')) {
  const rows = ckCur(); const err = ckCheck(rows, st.today); if (err) { st.msg = err; paint(); return; } if (!ckDirty(rows, st.ck.items)) return;
  return act(async () => { const r = await callM({ action: 'closeoutSave', pjtId: st.proj, items: ckPayload(rows) }); st.ck = ckBlank('ok', { items: Array.isArray(r.items) ? r.items : [], version: Number.isInteger(r.version) ? r.version : 0, updatedByName: typeof r.updatedByName === 'string' ? r.updatedByName : '' }); st.ckRows = null; }, '저장했습니다. 이미 만든 보고서에 반영하려면 "다시 만들기"를 누르세요.');
  }
  };
  root.onchange = async (ev) => { const t = ev.target; if (!(t instanceof Element) || !t.hasAttribute('data-mr-ym')) return; st.ym = t.value; st.msg = ''; await loadReport(); };
  root.oninput = (ev) => {   // 직접 입력 칸: 쓰는 동안 금액 안내를 서버 호출 없이 바로 갱신(입력칸은 다시 그리지 않아 커서가 유지된다)
    const t = ev.target; if (t instanceof Element && t.hasAttribute('data-ck-f')) { // 마감 체크리스트 입력 — 서버 호출·다시 그리기 없이 안내와 저장 버튼만 갱신(커서 유지)
  if (!st.ck || st.ck.state !== 'ok') return; const i = Number(t.getAttribute('data-ck-i')), f = t.getAttribute('data-ck-f'); if (!Number.isInteger(i) || ['name', 'doneDate', 'assignee', 'memo'].indexOf(f) === -1) return;
  const rows = ckCur(); if (!rows[i]) return; rows[i][f] = t.value; st.ckRows = rows; const err = ckCheck(rows, st.today);
  const hint = body.querySelector('[data-ck-hint]'); if (hint) { hint.textContent = err; if (err) hint.removeAttribute('hidden'); else hint.setAttribute('hidden', ''); }
  const sv = body.querySelector('[data-ck-save]'); if (sv) { if (err || st.busy || !ckDirty(rows, st.ck.items)) sv.setAttribute('disabled', ''); else sv.removeAttribute('disabled'); } return; }
  if (!(t instanceof Element) || !t.hasAttribute('data-mr-notes')) return; const cur = st.report && st.report.notes || {};
    st.notesDraft = Object.assign({ remarks: cur.remarks || '', nextPlan: cur.nextPlan || '' }, st.notesDraft || {}); st.notesDraft[t.getAttribute('data-mr-notes')] = t.value;
    const bad = lgHasMoney(st.notesDraft.remarks) || lgHasPersonal(st.notesDraft.remarks) || lgHasMoney(st.notesDraft.nextPlan) || lgHasPersonal(st.notesDraft.nextPlan);
    const hint = body.querySelector('[data-mr-hint]'); if (hint) { hint.textContent = bad ? '금액·단가·전화번호·메일 주소는 적지 않습니다.' : ''; if (bad) hint.removeAttribute('hidden'); else hint.setAttribute('hidden', ''); }
    const sv = body.querySelector('[data-mr-save]'); if (sv) { if (bad || st.busy) sv.setAttribute('disabled', ''); else sv.removeAttribute('disabled'); }
  };
}
const TAG_LABEL_OF = { edu: '교육', meeting: '회의', in: '반입', fcu: '설치', off: '휴무', safety: '안전', quality: '품질', admin: '기타' };

/** 공사일보(공사일보 탭): 프로젝트 아래의 탭 — 주소 #/pjt/<프로젝트>/report/<날짜>. 모든 프로젝트 같은 양식·같은 화면.
 *  저장은 날짜 키 문서 하나(Ph2 daily_report_docs, Ph4 ph4_reports, 경량 pjt_registry/<id>/reports)에 구포털 일보 필드와 경량 일보 필드를 함께 담는다. 옛 형식 일보는 조회·인쇄만 되고 "새 양식으로 편집"하면 이어서 고칠 수 있다.
 *  경량 프로젝트는 저장하면 전자결재 업무일지도 서버 함수가 만든다(구포털 경량과 같음 — Ph2·Ph4 도 같게 할지는 대표님 결정 D10). */
let rpHist = null; // 공사일보 뒤로 가기 처리(폰 폭 팝업) — 다시 열 때 이전 것을 떼어 리스너가 겹치지 않게
export async function mountReport(root, route, ctx) {
  if (rpHist) rpHist.detach();
  root.onclick = null; root.onchange = null; root.onkeydown = null; root.oninput = null;
  const me = (ctx && ctx.me) || {}; const segs = (route && route.segs) || []; const guest = !(me.admin || (me.perms && me.perms.pjt)); const today = appToday(); const date0 = isDateKey(segs[1]) ? segs[1] : today; const [y0, m0] = date0.split('-').map(Number);
  const st = { projects: [], proj: '', label: '', date: date0, today, month: { y: y0, m: m0 - 1 }, dates: new Set(), form: null, exists: false, editing: false, ready: false, manage: !guest, readonly: guest, busy: false, preview: false, equipHistory: [], ctx: {}, popup: false, snap: '' };
  root.innerHTML = '<div id="rp-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#rp-body');
  const paint = () => { const y = window.scrollY; body.innerHTML = reportHtml(st); window.scrollTo(0, y); };
  /** 팝업을 닫기 전 확인 — 입력 중이면 확인창(확인창 결과는 객체라 ok.ok 로 읽는다). 닫아도 되면 true, 취소면 onCancel 을 부르고 false */
  const askClose = async (onCancel) => { readForm(); if (isDirty(st)) { const ok = await confirmDialog({ title: '작성 중인 내용', body: '저장하지 않은 내용이 있습니다. 닫으면 사라집니다.', confirmLabel: '닫기', variant: 'danger' }); if (!ok || !ok.ok) { if (onCancel) onCancel(); return false; } } return true; };
  const hist = createPopupHistory(window, { narrow: () => window.matchMedia('(max-width: 599px)').matches, close: () => { closePopup(st); paint(); }, requestClose: async (cancel) => { if (await askClose(cancel)) { closePopup(st); paint(); } } }); rpHist = hist; hist.attach(); // 뒤로 가기 = 팝업만 닫기
  try { await Promise.race([loadHolidays(), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* 공휴일 없이 주말만 표시 */ }
  try { st.projects = visibleProjects(me, await loadDyn()); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy'); st.proj = st.projects.some((p) => p.key === segs[0]) ? segs[0] : ''; if (!st.proj) { paint(); return; }
  const P = pathsFor(st.proj); const pr = st.projects.find((p) => p.key === st.proj); st.label = pr.label;
  const loadStructureR = async () => { const ps = await getDoc(doc(db, P.settings.col, P.settings.id)); const pd = ps.exists() ? ps.data() : (pr.doc || {}); const r = structureFor(pd); st.structure = toRuntime(r.S, st.label, stagesOf); st.client = (r.S.ppt && r.S.ppt.client) || ''; st.ctx = { site: st.label, client: st.client, dateKey: st.date }; };
  const loadList = async () => { const snap = await getDocs(collection(db, P.reports)); st.dates = new Set(); const eq = new Set(); snap.forEach((d) => { if (isKey(d.id)) st.dates.add(d.id); String((d.data() || {}).equip || '').split(',').forEach((e) => { const t = e.trim(); if (t && t !== '—') eq.add(t); }); }); st.equipHistory = [...eq]; };   // (사용 안 함 — 장비는 지게차·크레인 중 하나)
  const readDay = async (date) => { const [a, m] = await Promise.all([getDoc(doc(db, P.attendance, date)), getDoc(doc(db, P.manday, date))]); return { checks: a.exists() ? (a.data().checks || []) : [], md: m.exists() ? (m.data().md || {}) : {} }; };
  const activeIds = async (date) => { try { const [rs, ms] = await Promise.all([getDocs(collection(db, P.roster)), getDocs(collection(db, 'master_workers'))]); const resigned = {}; ms.forEach((d) => { const x = d.data(); if (x.resigned) resigned[d.id] = { resigned: true, resignedDate: x.resignedDate || '' }; }); const roster = []; rs.forEach((d) => roster.push(Object.assign({ id: d.id }, d.data()))); return activeWorkersForDate(roster, resigned, date).map((w) => w.id); } catch (e) { return null; } };
  const attSummary = async (date) => { const d = await readDay(date); return attendanceSummary(d.checks, d.md, await activeIds(date)); };
  const newChecks = async (date) => { try { const s = await getDoc(doc(db, P.progress.days, date)); return normalizeDay(s.exists() ? s.data() : {}); } catch (e) { return {}; } };
  const loadDay0 = async () => {
    st.logged = null; st.logBusy = false; // 하루를 다시 읽으면(날짜 이동·취소·처음) "이력에 올림" 표시를 비운다 — 이미 올렸는지는 서버가 안다(두 번 눌러도 1건)
    st.preview = false; st.editing = false; st.ctx = Object.assign({}, st.ctx, { dateKey: st.date }); const s = await getDoc(doc(db, P.reports, st.date)); st.exists = s.exists();
    if (s.exists()) { st.form = fromStored(s.data()); if (!st.form.author) st.form.author = authorLabel(me); return; }   // 작성자는 로그인 계정에서(이미 쓴 일보는 쓴 사람 그대로)
    const [att, nc] = await Promise.all([attSummary(st.date), newChecks(st.date)]);   // 저장된 일보가 없으면 그날의 공정 체크와 출역·공수로 미리 채운다
    st.form = { legacy: false, author: authorLabel(me), checkIn: '', checkOut: '', shift: '', equipText: '', content: autoContent(st.structure, nc), tomorrow: '', headcount: att.headcount, manday: att.manday, mandayTotal: att.mandayTotal, equip: [], eqNo: {}, eqHrs: {}, note: '' };
  };
  const loadDay = async () => { await loadDay0(); st.snap = JSON.stringify(st.form); }; // 하루를 읽은 직후의 폼을 기준으로 저장 — 닫을 때 입력 중인 내용이 있는지 비교(날짜 이동·취소·처음 열기 모두 이 감싸개를 거친다)
  try { await loadStructureR(); await loadList(); await loadDay(); st.ready = true; } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && (e.code || e.message)) || '') + '</div>'; return; }
  paint();
  const go = async (d) => { if (!isKey(d)) return; st.date = d; const [y, m] = d.split('-').map(Number); st.month = { y, m: m - 1 }; pushHash('#/pjt/' + st.proj + '/report/' + d); st.ready = false; paint(); try { await loadDay(); } catch (e) { toast('불러오기 실패: ' + ((e && (e.code || e.message)) || '')); } st.ready = true; paint(); };
  const readForm = () => { const f = st.form; if (!f || f.legacy) return; body.querySelectorAll('[data-rp-f]').forEach((el) => { const k = el.getAttribute('data-rp-f'); if (k === 'manday') f.manday = parseFloat(el.value) || 0; else if (/^(ci|co)[HM]$/.test(k)) f['_' + k] = el.value; else f[k] = el.value; });
    if (f._ciH !== undefined) { f.checkIn = f._ciH && f._ciM ? f._ciH + ':' + f._ciM : (f._ciH ? f._ciH + ':00' : ''); f.checkOut = f._coH && f._coM ? f._coH + ':' + f._coM : (f._coH ? f._coH + ':00' : ''); }
    body.querySelectorAll('[data-rp-eqno]').forEach((el) => { (f.eqNo = f.eqNo || {})[el.getAttribute('data-rp-eqno')] = el.value; });   // 장비마다 차량번호
    body.querySelectorAll('[data-rp-eqhrs]').forEach((el) => { (f.eqHrs = f.eqHrs || {})[el.getAttribute('data-rp-eqhrs')] = el.value; });   // 장비마다 사용 시간(시간)
    f.shift = ''; };
  const printDoc = (html, title) => {
    let pa = document.getElementById('pjt-print-area'); if (pa) pa.remove(); pa = document.createElement('div'); pa.id = 'pjt-print-area'; pa.innerHTML = '<style>@media screen{#pjt-print-area{display:none}}@media print{body>*:not(#pjt-print-area){display:none!important}#pjt-print-area{display:block!important}}@page{size:A4;margin:18mm}</style>' + html; document.body.appendChild(pa);
    const pr = printWithTitle(title, { onDone: () => { const x = document.getElementById('pjt-print-area'); if (x) x.remove(); } }); if (!pr.ok) toast('인쇄를 시작하지 못했습니다.');
  };
  const defaultSync = async (d) => { const call = httpsCallable(functions, 'edocAct'); return call({ action: 'syncDaily', pjtId: P.id, date: st.date, title: st.label + ' 공사일보 (' + dateText(st.date) + ')', pjtName: st.label, todayWork: d.content || '', tomorrowWork: d.tomorrow || '', issue: d.note || '' }); };
  const save = async () => {
    readForm(); if (st.busy) return; st.busy = true;
    try {
      if (st.exists) st.form.editors = withEditor(st.form.editors, st.form.author, authorLabel(me), new Date().toISOString());   // 이미 있는 일보를 최초 작성자가 아닌 사람이 고치면 수정자로 기록
      const doc0 = toStored(st.form, st.ctx); await setDoc(doc(db, P.reports, st.date), Object.assign({}, doc0, { updatedAt: serverTimestamp(), savedAt: serverTimestamp() }), { merge: true }); st.dates.add(st.date); st.exists = true; st.editing = false; st.form.legacy = false; toast('저장했습니다.');   // 저장하면 다시 인쇄 미리보기 모양으로
      const note = await syncWithNote(doc0.content, () => (ctx && ctx.syncDaily ? ctx.syncDaily(doc0) : defaultSync(doc0))); if (note) toast('저장했습니다. ' + note);   // 모든 프로젝트가 저장하면 전자결재 업무일지도 만든다 — 연동 실패는 일보 저장을 막지 않고, 결과(상신·임시저장·실패 이유)는 화면에 알린다(C3: 이전에는 조용히 넘어가 원인을 알 수 없었음)
    } catch (e) { toast('저장 실패: ' + ((e && (e.code || e.message)) || '')); }
    st.busy = false; paint();
  };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; let el;
    if ((el = t.closest('[data-rp-day]'))) { openPopup(st); await go(el.getAttribute('data-rp-day')); hist.open(); return; } // 폰 폭에서는 날짜를 누르면 그날 공사일보가 팝업으로 뜬다 — 이 화면의 pushHash 는 replaceState 라 기록이 안 쌓이므로 폰 폭이면 기록을 한 단계 쌓아 뒤로 가기가 팝업만 닫게 한다
    if ((el = t.closest('[data-rp-nav]'))) { const v = el.getAttribute('data-rp-nav'); if (v === 'today') { await go(st.today); return; } let { y, m } = st.month; m += Number(v); if (m > 11) { m = 0; y++; } if (m < 0) { m = 11; y--; } st.month = { y, m }; paint(); return; }
    if ((el = t.closest('[data-rp-hc]')) && st.manage) { readForm(); st.form.headcount = Math.max(0, (parseInt(st.form.headcount, 10) || 0) + Number(el.getAttribute('data-rp-hc'))); paint(); return; }
    if ((el = t.closest('[data-rp-equip]')) && st.manage) { readForm(); const v = el.getAttribute('data-rp-equip'); st.form.equip = st.form.equip.indexOf(v) !== -1 ? st.form.equip.filter((x) => x !== v) : st.form.equip.concat([v]); paint(); return; }   // 지게차·크레인은 둘 다 고를 수 있다(다시 누르면 해제)
    if ((el = t.closest('[data-rp-rmeq]')) && st.manage) { readForm(); const v = el.getAttribute('data-rp-rmeq'); st.form.equip = st.form.equip.filter((x) => x !== v); paint(); return; }
    if (!(el = t.closest('[data-rp-act]'))) return; const act = el.getAttribute('data-rp-act');
    if (act === 'tolog' && st.manage) { // 공사일보 특이사항 → 이력(서버가 저장된 일보를 읽어 만든다 — 조회 화면에서만 나온다)
      if (st.logBusy || st.logged) return; const cat = st.logCat || '현장 이슈';
      const ok = await confirmDialog({ title: '이력으로 올리기', body: '이 날의 특이사항을 프로젝트 이력에 \'' + cat + '\' 분류로 올립니다.\n올린 뒤에는 분류를 바꿀 수 없습니다. 금액·연락처가 들어 있으면 올라가지 않습니다.', confirmLabel: '올리기' }); if (!ok || !ok.ok) return;
      st.logBusy = true; paint();
      const callLog = (ctx && ctx.callLog) || (async (payload) => (await httpsCallable(functions, 'pjtLogAct')(payload)).data);
      const r = await runReportLog(callLog, { pjtId: st.proj, date: st.date, category: cat });
      st.logBusy = false; if (r.ok) st.logged = r.logged; toast(r.msg); paint(); return;
    }
    if (act === 'closepop') { if (!(await askClose())) return; if (!hist.closeByButton()) { closePopup(st); paint(); } return; } // 확인을 거친 뒤 — 쌓아 둔 기록이 있으면 되돌리고(닫기는 popstate 가 처리) 없으면 직접 닫는다
  if (act === 'closeprev') { st.preview = false; paint(); return; } if (act === 'preview') { readForm(); st.preview = true; paint(); return; } if (act === 'print') { readForm(); printDoc(docHtml(st.form, st.ctx), docTitle(st.date, st.label)); return; }
    if (act === 'upgrade' && st.manage) { st.form.legacy = false; st.form.equipText = ''; st.editing = true; paint(); return; }
    if (act === 'edit' && st.manage) { st.editing = true; paint(); return; }   // 작성 완료된 일보: [수정]을 눌러야 수정 화면
    if (act === 'cancel-edit') { await loadDay(); st.editing = false; paint(); return; }   // 고치던 내용을 버리고 저장된 일보를 다시 보여 준다
    if (act === 'addeq' && st.manage) { readForm(); const inp = body.querySelector('[data-rp-eqin]'); const v = inp ? inp.value.trim() : ''; if (v && st.form.equip.indexOf(v) === -1) st.form.equip.push(v); paint(); return; } if (act === 'save' && st.manage) { await save(); return; }
    if (act === 'att' && st.manage) { readForm(); const a = await attSummary(st.date); st.form.headcount = a.headcount; st.form.manday = a.manday; st.form.mandayTotal = a.mandayTotal; toast('출역·공수에서 불러왔습니다(' + a.headcount + '명, 합계 ' + a.mandayTotal + '공수).'); paint(); return; }
    if (act === 'auto' && st.manage) { readForm(); const text = autoContent(st.structure, await newChecks(st.date)); if (!text) { toast('이 날짜에 체크된 공정 항목이 없습니다.'); return; } if (st.form.content.trim()) { const ok = await confirmDialog({ title: '자동 채우기', body: '금일 작업에 쓴 내용을 공정 체크 내용으로 바꿉니다. 바꿀까요?', confirmLabel: '바꾸기' }); if (!ok.ok) return; } st.form.content = text; paint(); }
  };
  root.onchange = (ev) => { const t = ev.target; if (t instanceof Element && t.hasAttribute('data-rp-logcat')) { st.logCat = t.value; return; } if (!(t instanceof Element) || !t.hasAttribute('data-rp-shiftsel') || !st.manage) return; readForm(); const sh = WORK_SHIFTS.find((x) => x.name === t.value); if (sh) { st.form.checkIn = sh.from; st.form.checkOut = sh.to; delete st.form._ciH; delete st.form._ciM; delete st.form._coH; delete st.form._coM; } paint(); };   // 근무시간 구분(드롭박스) → 시작·종료 시간 채우기(그 뒤 시·분 직접 수정 가능)
  root.onkeydown = (ev) => { const t = ev.target; if (ev.key === 'Enter' && t instanceof Element && t.hasAttribute('data-rp-eqin')) { ev.preventDefault(); const b = body.querySelector('[data-rp-act="addeq"]'); if (b) b.click(); } };
  root.oninput = (ev) => { const t = ev.target; if (!(t instanceof Element) || t.getAttribute('data-rp-f') !== 'manday') return; const tot = body.querySelector('[data-rp-total]'); const hc = body.querySelector('[data-rp-hc-val]'); if (tot && hc) tot.textContent = totalOf(parseInt(hc.textContent, 10) || 0, parseFloat(t.value) || 0).toFixed(1); };
}

/** 프로젝트 홈: 프로젝트를 고르면 처음 보이는 새 화면(주소 #/pjt/<프로젝트> 또는 #/pjt/<프로젝트>/home). 요약 카드(공정율·D+·이달 공수·오늘 출역)·오늘 일정·공사일보·바로가기·기본정보 — 모든 프로젝트 같은 형식.
 *  느린 계산(공정율: Ph2·Ph4 는 날짜별 컬렉션을 하나씩 읽음)은 화면을 먼저 보여 준 뒤 채운다. */
export async function mountHome(root, route, ctx) {
  if (!(((route && route.segs) || [])[0])) return mountOverview(root, route, ctx);   // 프로젝트를 고르지 않은 PJT 홈(#/pjt/home) = 전체 홈(통합 일정 달력·프로젝트 목록·신규 프로젝트)
  root.onclick = null; root.onchange = null;
  const me = (ctx && ctx.me) || {}; const segs = (route && route.segs) || []; const today = appToday(); const [ty, tm] = today.split('-').map(Number);
  const st = { projects: [], proj: '', label: '', today, date: today, month: { y: ty, m: tm - 1 }, doc: null, unit: '대', ready: false, schedules: [], reports: [], reportDates: new Set(), features: {} };   // 홈 = 월 캘린더 + 고른 날짜의 일정(요약 카드 없음)
  root.innerHTML = '<div id="hm-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#hm-body'); const paint = () => { const y = window.scrollY; body.innerHTML = homeHtml(st); window.scrollTo(0, y); };
  try { await Promise.race([loadHolidays(), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* 공휴일 없이 표시 */ }
  try { st.projects = visibleProjects(me, await loadDyn()); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy'); st.proj = st.projects.some((p) => p.key === segs[0]) ? segs[0] : ''; if (!st.proj) { paint(); return; }
  const P = pathsFor(st.proj); const pr = st.projects.find((p) => p.key === st.proj); st.label = pr.label;
  try {
    const ps = await getDoc(doc(db, P.settings.col, P.settings.id)); st.doc = ps.exists() ? ps.data() : (pr.doc || {});
    const sr = structureFor(st.doc); st.unit = sr.S.unit || '대'; st.features = featuresOf(sr.S.features);
    const [ss, rr] = await Promise.all([getDocs(collection(db, P.schedules)), getDocs(collection(db, P.reports))]);
    st.schedules = []; ss.forEach((d) => st.schedules.push(Object.assign({ id: d.id }, d.data()))); const rdocs = []; rr.forEach((d) => rdocs.push({ id: d.id, data: d.data() })); st.reports = latestReports(rdocs, 3); st.reportDates = new Set(rdocs.map((d) => d.id)); st.ready = true;
  } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && (e.code || e.message)) || '') + '</div>'; return; }
  paint();
  root.onclick = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; let el;
    if ((el = t.closest('[data-hm-day]'))) { st.date = el.getAttribute('data-hm-day'); paint(); return; }
    if ((el = t.closest('[data-hm-nav]'))) { const v = el.getAttribute('data-hm-nav'); if (v === 'today') { st.date = today; st.month = { y: ty, m: tm - 1 }; } else { let { y, m } = st.month; m += Number(v); if (m > 11) { m = 0; y++; } if (m < 0) { m = 11; y--; } st.month = { y, m }; const dd = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); st.date = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(Math.min(Number(st.date.slice(8)), dd)).padStart(2, '0'); } paint(); }
  };
}

export async function mountSettings(root, route, ctx) {
  root.onclick = null; root.oninput = null;
  const me = (ctx && ctx.me) || {}; const segs = (route && route.segs) || [];
  const st = { projects: [], proj: '', label: '', admin: !!me.admin, doc: null, form: {}, ended: false, ready: false, busy: false, msg: '', msgBad: false, mandayText: '' };
  root.innerHTML = '<div id="se-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#se-body'); let pptEl = null;   // 참여자 지정 화면은 한 번만 만들고, 다시 그릴 때는 같은 요소를 옮겨 붙인다(다시 불러오지 않고 고르던 내용도 유지)
  const paint = () => { const y = window.scrollY; if (pptEl && pptEl.parentNode) pptEl.parentNode.removeChild(pptEl); body.innerHTML = settingsHtml(st); window.scrollTo(0, y); const ph = body.querySelector('[data-ppt-host]'); if (ph && st.ready && st.admin && st.proj) { if (pptEl) ph.replaceWith(pptEl); else { pptEl = ph; mountPpt(ph); } } };
  try { st.projects = visibleProjects(me, await loadDyn()); } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  body.removeAttribute('aria-busy'); st.proj = st.projects.some((p) => p.key === segs[0]) ? segs[0] : ''; if (!st.proj) { paint(); return; }
  const P = pathsFor(st.proj); st.label = st.projects.find((p) => p.key === st.proj).label; if (!st.admin) { paint(); return; }
  const ref = doc(db, P.settings.col, P.settings.id);
  const load = async () => { const s = await getDoc(ref); st.doc = s.exists() ? s.data() : {}; st.form = settingsFormOf(st.doc); st.ended = st.doc.status === 'ended'; st.mandayText = defaultMandayOf(st.doc) == null ? '' : String(defaultMandayOf(st.doc)); };
  const mountPpt = (box) => { Promise.resolve().then(async () => { const mp = (ctx && ctx.mountParticipants) || (await import('../../shared/pjt-participants.js?v=20261031d')).mountParticipants; await mp(box, { db, id: P.settings.id, me: { uid: me.uid } }); }).catch((e) => { box.innerHTML = '<div class="jh-field__hint">참여자 지정 구역을 불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; }); };
  try { await load(); st.ready = true; } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">설정을 불러오지 못했습니다: ' + esc((e && (e.code || e.message)) || '') + '</div>'; return; }
  paint();
  const readForm = () => { body.querySelectorAll('[data-st-f]').forEach((el) => { st.form[el.getAttribute('data-st-f')] = el.value; }); };
  const say = (t, bad) => { st.msg = t; st.msgBad = !!bad; };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; const el = t.closest('[data-st-act]'); if (!el || st.busy) return; const act = el.getAttribute('data-st-act');
    if (act === 'save') {
      readForm(); const r = settingsBuild(st.form); if (r.error) { say(r.error, true); paint(); return; } const ch = changedFields(st.doc, st.form); if (!ch.length) { say('바뀐 내용이 없습니다.', false); paint(); return; }
      st.busy = true; try { await setDoc(ref, Object.assign({}, r.data, { updatedAt: serverTimestamp() }), { merge: true }); st.doc = Object.assign({}, st.doc, r.data); st.form = settingsFormOf(st.doc); say('저장했습니다 (' + ch.join('·') + ')', false); toast('저장했습니다.'); } catch (e) { say('저장 실패: ' + ((e && (e.code || e.message)) || ''), true); }
      st.busy = false; paint(); return;
    }
    if (act === 'savemd') {
      const inp = body.querySelector('[data-st-md]'); const r = parseDefaultManday(inp ? inp.value : ''); st.mandayText = inp ? inp.value : ''; if (r.error) { toast(r.error); return; }
      st.busy = true; try { await setDoc(ref, { defaultManday: r.value, updatedAt: serverTimestamp() }, { merge: true }); st.doc = Object.assign({}, st.doc, { defaultManday: r.value }); st.mandayText = r.value == null ? '' : String(r.value); toast(r.value == null ? '자동 공수를 해제했습니다.' : '자동 공수를 ' + r.value + '로 저장했습니다.'); } catch (e) { toast('저장 실패: ' + ((e && (e.code || e.message)) || '')); }
      st.busy = false; paint(); return;
    }
    if (act === 'end') {
      const toEnded = !st.ended; const ok = await confirmDialog({ title: toEnded ? '프로젝트 종료' : '프로젝트 재개', body: endText(st.ended, st.label), confirmLabel: toEnded ? '종료' : '재개' }); if (!ok.ok) return;
      st.busy = true; try { await setDoc(ref, { status: toEnded ? 'ended' : 'active', updatedAt: serverTimestamp(), endedAt: toEnded ? serverTimestamp() : deleteField() }, { merge: true }); await notifyPjtChanged(); st.ended = toEnded; st.doc = Object.assign({}, st.doc, { status: toEnded ? 'ended' : 'active' }); toast(toEnded ? '종료 처리했습니다.' : '재개 처리했습니다.'); if (toEnded) { st.busy = false; pushHash('#/pjt/home'); return; } } catch (e) { toast('처리 실패: ' + ((e && (e.code || e.message)) || '')); }
      st.busy = false; paint();
    }
  };
}
