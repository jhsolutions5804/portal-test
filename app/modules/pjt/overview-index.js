/* PJT 전체 홈(주소 #/pjt/home)과 종료 PJT(#/pjt/ended) — 새 화면. 규칙은 overview.js, 표시는 overview-view.js.
 * 프로젝트를 만들거나 종료·재개·삭제하면 메뉴의 프로젝트 칩도 바뀌어야 하므로 'jh:pjt-changed' 알림을 보낸다(legacy/frame.js 가 받아 칩을 다시 읽는다). */
import { db, collection, doc, getDocs, setDoc, addDoc, deleteDoc, deleteField, serverTimestamp } from '../../core/firebase.js?v=20261014s';
import { esc, toast } from '../../core/ui.js?v=20261014s';
import { confirmDialog } from '../../core/dialog.js?v=20261014s';
import { canAccessProject } from '../../shared/pjt-access.js?v=20261014s';
import { loadHolidays, holidayName } from '../../shared/holidays.js?v=20261014s';
import { pathsFor } from './adapter.js?v=20261014s';
import { appToday } from './attendance.js?v=20261014s';
import { visibleProjects } from './projects.js?v=20261014s';
import { structureFor } from './structure-store.js?v=20261014s';
import { toRuntime } from './structure.js?v=20261014s';
import { normalizeDay, stateAt, calcAll, stagesOf } from './progress.js?v=20261014s';
import { attendanceSummary } from './report.js?v=20261014s';
import { dowOf } from './schedule.js?v=20261014s';
import { overviewHtml, endedHtml } from './overview-view.js?v=20261014s';
import { blockDays, blockLabel, colorOf, groupByDay, legendOf, totalManday, newProjectData, deleteConfirmed, endedSorted, shiftMonth } from './overview.js?v=20261014s';
import { weeklyPng } from './overview-png.js?v=20261014s';
const ts = (d) => (d.createdAt && d.createdAt.seconds) || 0;
/** 프로젝트가 바뀌었음을 메뉴(legacy/frame.js)에 알리고, 메뉴가 칩을 다시 읽을 때까지 기다린다 */
export async function notifyPjtChanged() { const waits = []; try { window.dispatchEvent(new CustomEvent('jh:pjt-changed', { detail: { waits } })); await Promise.all(waits); } catch (e) { /* 알림 실패는 화면 동작을 막지 않는다 */ } }
async function readRegistry() { const s = await getDocs(collection(db, 'pjt_registry')); const all = []; s.forEach((d) => all.push(Object.assign({}, d.data(), { id: d.id, name: d.data().name || 'PJT' }))); return all; }
/** 프로젝트 하나의 통계: 공정율(날짜별 체크 전체), 누적 공수, 오늘 출역 인원 — 늦게 계산되므로 카드가 먼저 그려진다 */
async function loadStats(p, today) {
  const P = pathsFor(p.key); const out = {};
  try { const sr = structureFor(p.doc); const S = toRuntime(sr.S, p.label, stagesOf); const days = {}; try { (await getDocs(collection(db, P.progress.days))).forEach((x) => { days[x.id] = normalizeDay(x.data()); }); } catch (e) { /* 체크가 아직 없음 */ } const states = {}; S.groups.forEach((g) => { states[g.id] = stateAt(days, today, g.id); }); out.pct = calcAll(S, states).pct; } catch (e) { /* 공정율 계산 실패 → "—" */ }
  try { const mds = []; let md0 = {}; (await getDocs(collection(db, P.manday))).forEach((x) => { const m = x.data().md || {}; mds.push(m); if (x.id === today) md0 = m; }); out.total = totalManday(mds); let checks = []; try { (await getDocs(collection(db, P.attendance))).forEach((x) => { if (x.id === today) checks = x.data().checks || []; }); } catch (e) { /* 출역 없음 */ } out.headcount = attendanceSummary(checks, md0, null).headcount; } catch (e) { /* 공수 읽기 실패 → "—" */ }
  return out;
}
export async function mountOverview(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null; root.onkeydown = null;
  const me = (ctx && ctx.me) || {}; const today = appToday(); const t0 = today.split('-').map(Number);
  const st = { admin: !!me.admin, today, ready: false, err: '', projects: [], stats: {}, items: [], view: 'weekly', offset: 0, y: t0[0], m: t0[1] - 1, sel: '', form: null, msg: '', busy: false };
  root.innerHTML = '<div id="ov-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#ov-body');
  const paint = () => { const y = window.scrollY; body.innerHTML = overviewHtml(st); window.scrollTo(0, y); };
  const makePng = (ctx && ctx.makePng) || weeklyPng; const savePng = (ctx && ctx.savePng) || ((url, name) => { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); });
  try { await Promise.race([loadHolidays(), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* 공휴일 없이 표시 */ }
  const load = async () => {
    const all = await readRegistry(); const active = all.filter((x) => x.status !== 'ended').sort((a, b) => ts(a) - ts(b)); st.projects = visibleProjects(me, { registry: active });
    const per = await Promise.all(st.projects.map(async (p) => { const items = []; try { (await getDocs(collection(db, pathsFor(p.key).schedules))).forEach((d) => items.push(Object.assign({}, d.data(), { id: d.id, pjtKey: p.key, pjtName: p.label }))); } catch (e) { /* 이 프로젝트 일정은 못 읽음 */ } return items; })); st.items = [].concat.apply([], per);
  };
  try { await load(); st.ready = true; } catch (e) { st.err = '불러오지 못했습니다: ' + ((e && (e.code || e.message)) || ''); }
  body.removeAttribute('aria-busy'); paint();
  if (st.ready) { st.projects.forEach((p) => { loadStats(p, today).then((s) => { st.stats[p.key] = s; if (body.isConnected) paint(); }); }); }   // 통계는 프로젝트마다 따로 도착하는 대로 채운다
  const go = (h) => { location.hash = h; };
  const create = async () => {
    const r = newProjectData(st.form); if (r.error) { st.msg = r.error; paint(); return; }
    st.busy = true; st.msg = ''; paint();
    try { const ref = await addDoc(collection(db, 'pjt_registry'), Object.assign({}, r.data, { createdAt: serverTimestamp() })); st.form = null; await notifyPjtChanged(); toast('프로젝트를 만들었습니다. 설정에서 참여 부서·개인을, 공정 탭에서 구조를 정해 주세요.'); st.busy = false; go('#/pjt/' + encodeURIComponent(ref.id) + '/settings'); return; }
    catch (err) { st.msg = '만들지 못했습니다: ' + ((err && (err.code || err.message)) || ''); }
    st.busy = false; paint();
  };
  const png = () => {
    const days = blockDays(today, st.offset); const map = groupByDay(st.items, days); const keys = st.projects.map((p) => p.key);
    try { const url = makePng({ days, map, label: blockLabel(days, st.offset), today, legend: legendOf(map, st.projects).map((p) => ({ label: p.label, color: colorOf(keys, p.key) })), holiday: holidayName, colorOf: (k) => colorOf(keys, k), dow: dowOf }); savePng(url, 'PJT주간일정_' + days[0] + '.png'); } catch (e) { toast('이미지 저장 중 오류가 났습니다: ' + ((e && e.message) || '')); }
  };
  root.onclick = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; let el;
    if ((el = t.closest('[data-ov-set]'))) { go('#/pjt/' + encodeURIComponent(el.getAttribute('data-ov-set')) + '/settings'); return; }
    if ((el = t.closest('[data-ov-sched]'))) { go('#/pjt/' + encodeURIComponent(el.getAttribute('data-ov-sched')) + '/schedule'); return; }
    if ((el = t.closest('[data-ov-open]'))) { go('#/pjt/' + encodeURIComponent(el.getAttribute('data-ov-open')) + '/home'); return; }
    if ((el = t.closest('[data-ov-view]'))) { st.view = el.getAttribute('data-ov-view'); paint(); return; }
    if ((el = t.closest('[data-ov-shift]'))) { const d = +el.getAttribute('data-ov-shift'); if (st.view === 'monthly') { const n = shiftMonth(st.y, st.m, d); st.y = n.y; st.m = n.m; st.sel = ''; } else st.offset += d; paint(); return; }
    if (t.closest('[data-ov-today]')) { st.offset = 0; st.y = t0[0]; st.m = t0[1] - 1; st.sel = st.view === 'monthly' ? today : ''; paint(); return; }
    if (t.closest('[data-ov-png]')) { png(); return; }
    if ((el = t.closest('[data-ov-day]'))) { st.sel = el.getAttribute('data-ov-day'); paint(); return; }
    if (t.closest('[data-ov-new]')) { st.form = { name: '', code: '', site: '', client: '', contractor: '', partner: '', content: '', item: '', qty: '', startDate: '' }; st.msg = ''; paint(); return; }
    if (t.closest('[data-ov-cancel]')) { st.form = null; st.msg = ''; paint(); return; }
    if (t.closest('[data-ov-create]') && !st.busy) { create(); }
  };
  root.oninput = (ev) => { const t = ev.target; if (t instanceof Element && t.hasAttribute('data-ov-f') && st.form) st.form[t.getAttribute('data-ov-f')] = t.value; };
  root.onkeydown = (ev) => { const t = ev.target; if (ev.key === 'Enter' && t instanceof Element && t.matches('article[data-ov-open]')) go('#/pjt/' + encodeURIComponent(t.getAttribute('data-ov-open')) + '/home'); };
}
/** 종료 PJT: 내가 열 수 있는 종료된 프로젝트. 재개·완전삭제는 관리자(완전삭제는 프로젝트 이름을 다시 입력해야 한다) */
export async function mountEnded(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null; root.onkeydown = null;
  const me = (ctx && ctx.me) || {}; const st = { admin: !!me.admin, ready: false, err: '', list: [], busy: false };
  root.innerHTML = '<div id="ed-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#ed-body'); const paint = () => { body.innerHTML = endedHtml(st); };
  const load = async () => { st.list = endedSorted((await readRegistry()).filter((x) => x.status === 'ended' && canAccessProject(me, x))); };
  try { await load(); st.ready = true; } catch (e) { st.err = '불러오지 못했습니다: ' + ((e && (e.code || e.message)) || ''); }
  body.removeAttribute('aria-busy'); paint();
  const find = (id) => st.list.find((x) => x.id === id);
  const resume = async (id) => { const d = find(id); if (!d || !st.admin) return; const ok = await confirmDialog({ title: '프로젝트 재개', body: '"' + d.name + '" 프로젝트를 다시 진행 중으로 되돌립니다. 위 메뉴의 프로젝트 목록에 다시 나타납니다.', confirmLabel: '재개' }); if (!ok.ok) return; st.busy = true; paint(); try { await setDoc(doc(db, 'pjt_registry', id), { status: 'active', endedAt: deleteField() }, { merge: true }); await notifyPjtChanged(); await load(); toast('재개했습니다.'); } catch (err) { toast('재개하지 못했습니다: ' + ((err && (err.code || err.message)) || '')); } st.busy = false; paint(); };
  const remove = async (id) => {
    const d = find(id); if (!d || !st.admin) return;
    const ok = await confirmDialog({ title: '프로젝트 완전삭제', body: '"' + d.name + '" 프로젝트를 완전히 삭제합니다.\n프로젝트 정보 자체가 지워져 복구할 수 없습니다(이미 입력된 공정·출역·공수·일정·공사일보 기록은 저장소에 남지만 이 화면에서는 볼 수 없게 됩니다).\n삭제하려면 아래에 프로젝트 이름을 그대로 입력하세요.', confirmLabel: '완전삭제', variant: 'danger', reason: { label: '프로젝트 이름', placeholder: d.name, required: true } }); if (!ok.ok) return;
    if (!deleteConfirmed(d.name, ok.reason)) { toast('입력한 이름이 프로젝트 이름과 달라 삭제하지 않았습니다.'); return; }
    st.busy = true; paint(); try { await deleteDoc(doc(db, 'pjt_registry', id)); await notifyPjtChanged(); await load(); toast('삭제했습니다.'); } catch (err) { toast('삭제하지 못했습니다: ' + ((err && (err.code || err.message)) || '')); } st.busy = false; paint();
  };
  root.onclick = async (ev) => { const t = ev.target; if (!(t instanceof Element) || st.busy) return; let el; if ((el = t.closest('[data-ov-resume]'))) await resume(el.getAttribute('data-ov-resume')); else if ((el = t.closest('[data-ov-del]'))) await remove(el.getAttribute('data-ov-del')); };
}
