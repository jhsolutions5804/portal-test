/* 근로자 연명부 도구 — 주소 #/pjt/roster/_manday(월간 공수 보기) · #/pjt/roster/_migrate(기존 인원 마이그레이션). 연명부 진입(roster-index.js)이 넘겨준다.
 * 모든 프로젝트(종료된 것 포함)의 명단·공수는 pjt_registry/<id>/… 에서 읽는다. 마이그레이션 쓰기 순서: 마스터·새 명단 문서 → 공수·출역 기록의 id 이전 → 옛 명단 문서 삭제(맨 마지막, 중간에 멈춰도 다시 실행할 수 있게). */
import { db, collection, doc, getDocs, writeBatch, deleteField } from '../../core/firebase.js?v=20261031f';
import { toast } from '../../core/ui.js?v=20261031f';
import { confirmDialog } from '../../core/dialog.js?v=20261031f';
import { loadBase, loadRows } from './month-data.js?v=20261031f';
import { pathsFor } from './adapter.js?v=20261031f';
import { appToday } from './attendance.js?v=20261031f';
import { aggregateMonth, migrationGroups, planMigration, planMerge, planLink, unknownGroups, rekeyMd, rekeyChecks, visibleInMonth } from './roster-tools.js?v=20261031f';
import { loadProgressPct } from './progress-stat.js?v=20261031f';
import { shiftMonth } from './overview.js?v=20261031f';
import { mandayHtml, migrateHtml } from './roster-tools-view.js?v=20261031f';
export async function mountRosterTools(root, route, ctx, mode) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const me = (ctx && ctx.me) || {}; const t0 = appToday().split('-').map(Number);
  const st = { mode, allowed: !!(me.admin || (me.perms && me.perms.pjt)), admin: !!me.admin, canEdit: !!(me.admin || (me.perms && me.perms.pjt)), ready: false, err: '', failed: [], y: t0[0], m: t0[1] - 1, seq: 0, projects: [], shown: [], prog: {}, masters: {}, agg: null, sheet: '', groups: [], form: null, msg: '', busy: false };
  root.innerHTML = '<div id="rt-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#rt-body');
  const paint = () => { const y = window.scrollY; body.innerHTML = (st.mode === '_manday' ? mandayHtml : migrateHtml)(st); window.scrollTo(0, y); };
  if (!st.allowed) { body.removeAttribute('aria-busy'); paint(); return; }
  /** 프로젝트(종료 포함) 중 내가 열 수 있는 것 + 각 프로젝트의 명단, 마스터 명부(공용 불러오기) */
  const loadBaseSt = async () => { const r = await loadBase(me); st.projects = r.projects; st.masters = r.masters; return r.failed; };
  const loadMonth = async () => {
    const seq = ++st.seq; st.ready = false; paint(); const failed = st.baseFailed.slice(); failed.push.apply(failed, await loadRows(st.projects, st.y, st.m));
    if (seq !== st.seq) return;   // 그 사이 달을 바꾼 경우 이전 결과는 버린다
    st.failed = failed; st.shown = st.projects.filter((p) => visibleInMonth(p, st.y, st.m, (p.rows || []).length > 0));   // 종료된 프로젝트는 종료한 달까지만 보인다
    st.agg = aggregateMonth(st.shown, st.masters); st.ready = true; paint();
    st.shown.forEach((p) => { if (st.prog[p.key] === undefined) { st.prog[p.key] = 'wait'; loadProgressPct(p.doc || { id: p.key }, p.name, appToday()).then((v) => { st.prog[p.key] = v; if (body.isConnected) paint(); }); } });   // 프로젝트별 진행률은 늦게 도착하는 대로 채운다
  };
  const loadMigrate = async () => { st.ready = false; paint(); st.baseFailed = await loadBaseSt(); st.failed = st.baseFailed.slice(); st.groups = migrationGroups(st.projects, st.masters); st.ready = true; paint(); };
  try { st.baseFailed = await loadBaseSt(); body.removeAttribute('aria-busy'); if (mode === '_manday') await loadMonth(); else { st.failed = st.baseFailed.slice(); st.groups = migrationGroups(st.projects, st.masters); st.ready = true; paint(); } } catch (e) { body.removeAttribute('aria-busy'); st.err = '불러오지 못했습니다: ' + ((e && (e.code || e.message)) || ''); paint(); }
  /** 옛 직원 id 의 공수·출역 기록을 마스터 id 로 옮긴다(그 프로젝트의 날짜 문서 전체를 훑는다) → 쓸 작업 목록 */
  const rekeyOps = async (rk) => {
    const P = pathsFor(rk.pjtKey); const ops = [];
    (await getDocs(collection(db, P.manday))).forEach((d) => { const md = d.data().md; const nm = rekeyMd(md, rk.from, rk.to); if (nm) ops.push({ ref: doc(db, P.manday, d.id), data: { md: { [rk.from]: deleteField(), [rk.to]: nm[rk.to] } } }); });
    (await getDocs(collection(db, P.attendance))).forEach((d) => { const nc = rekeyChecks(d.data().checks, rk.from, rk.to); if (nc) ops.push({ ref: doc(db, P.attendance, d.id), data: { checks: nc } }); });
    return ops;
  };
  const commit = async (ops) => { for (let i = 0; i < ops.length; i += 400) { const b = writeBatch(db); ops.slice(i, i + 400).forEach((o) => { if (o.del) b.delete(o.ref); else b.set(o.ref, o.data, { merge: o.merge !== false }); }); await b.commit(); } };
  const apply = async (plan, masterWrite) => {
    const first = []; if (masterWrite) { first.push({ ref: doc(db, 'master_workers', plan.masterId), data: plan.master }); if (plan.rate) first.push({ ref: doc(db, 'master_worker_private', plan.masterId), data: { dailyRate: plan.rate } }); }
    plan.workerSets.forEach((w) => first.push({ ref: doc(db, pathsFor(w.pjtKey).roster, w.id), data: w.data }));
    await commit(first);   // ① 마스터·새 명단 문서
    let moved = 0; for (const rk of plan.rekeys) { const ops = await rekeyOps(rk); moved += ops.length; await commit(ops); }   // ② 공수·출역 기록의 id 이전
    await commit(plan.workerDeletes.map((w) => ({ ref: doc(db, pathsFor(w.pjtKey).roster, w.id), del: true })));   // ③ 옛 명단 문서는 맨 마지막에 삭제
    return moved;
  };
  const register = async () => {
    const g = st.groups.find((x) => x.name === st.form.name); if (!g) return; const plan = planMigration(g, { name: g.name, birth: st.form.birth, leaderId: st.form.leaderId, rate: st.admin ? st.form.rate : '' }, st.masters);
    if (plan.error) { st.msg = plan.error; paint(); return; }
    if (plan.warnBirths.length) { const ok = await confirmDialog({ title: '확인', body: '생년월일이 서로 다른 항목이 있습니다 (' + plan.warnBirths.join(', ') + ').\n같은 사람으로 묶어 등록할까요?', confirmLabel: '같은 사람으로 등록' }); if (!ok.ok) return; }
    st.busy = true; st.msg = ''; paint();
    try { const moved = await apply(plan, true); st.form = null; await loadBaseSt().then((f) => { st.baseFailed = f; }); st.groups = migrationGroups(st.projects, st.masters); toast(g.name + '님을 마스터로 등록했습니다.' + (moved ? ' (공수·출역 기록 ' + moved + '건의 ID를 바꿨습니다)' : '')); } catch (err) { st.msg = '마이그레이션 실패: ' + ((err && (err.code || err.message)) || '') + ' — 다시 눌러 이어서 진행할 수 있습니다.'; }
    st.busy = false; paint();
  };
  const merge = async (name, masterId) => {
    const g = st.groups.find((x) => x.name === name); if (!g) return; const plan = planMerge(g, masterId, st.masters, st.projects); if (plan.error) { toast(plan.error); return; }
    const mm = st.masters[masterId]; const ok = await confirmDialog({ title: '같은 사람으로 합치기', body: name + '님의 명단 항목 ' + g.items.length + '개(' + g.items.map((i) => i.pjtName).join(', ') + ')를 마스터 "' + mm.name + '"(' + (mm.birth || '생년월일 없음') + ')로 합칩니다.\n옛 id 의 공수·출역 기록도 마스터 id 로 바뀌고, 옛 명단 문서는 삭제됩니다.', confirmLabel: '합치기' }); if (!ok.ok) return;
    st.busy = true; paint();
    try { const moved = await apply(plan, false); await loadBaseSt().then((f) => { st.baseFailed = f; }); st.groups = migrationGroups(st.projects, st.masters); toast(name + '님을 마스터로 합쳤습니다.' + (moved ? ' (공수·출역 기록 ' + moved + '건의 ID를 바꿨습니다)' : '')); } catch (err) { toast('합치기 실패: ' + ((err && (err.code || err.message)) || '') + ' — 다시 눌러 이어서 진행할 수 있습니다.'); }
    st.busy = false; paint();
  };
  const link = async (key) => {
    const [pk, id] = key.split('|'); const sel = [...root.querySelectorAll('[data-rt-link-sel]')].find((x) => x.getAttribute('data-rt-link-sel') === key); const mid = sel ? sel.value : ''; const g = unknownGroups(st.agg.unknown).find((x) => x.pjtKey === pk && x.id === id); const plan = planLink(g, mid, st.masters, st.projects.find((p) => p.key === pk));
    if (plan.error) { toast(plan.error); return; } const mm = st.masters[mid];
    const ok = await confirmDialog({ title: '근로자에게 연결', body: g.pjt + '의 직원 id "' + id + '" 공수 기록 ' + g.count + '건(' + g.total.toFixed(1) + '공수, ' + g.first + (g.last !== g.first ? ' ~ ' + g.last : '') + ')을 "' + mm.name + '"' + (mm.birth ? '(' + mm.birth + ')' : '') + '님으로 연결합니다.\n이 프로젝트의 모든 달의 공수·출역 기록 id 가 바뀌고, 합계와 영업기획 집계에 들어갑니다.', confirmLabel: '연결' }); if (!ok.ok) return;
    st.busy = true; paint();
    try { const moved = await apply({ masterId: mid, workerSets: plan.workerSets, rekeys: plan.rekeys, workerDeletes: [] }, false); toast('연결했습니다. (공수·출역 기록 ' + moved + '건의 ID를 바꿨습니다)'); await loadMonth(); } catch (err) { toast('연결 실패: ' + ((err && (err.code || err.message)) || '') + ' — 다시 눌러 이어서 진행할 수 있습니다.'); }
    st.busy = false; paint();
  };
  root.onclick = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; let el;
    if ((el = t.closest('[data-rt-link]')) && !st.busy) { link(el.getAttribute('data-rt-link')); return; }
    if ((el = t.closest('[data-rt-shift]'))) { const n = shiftMonth(st.y, st.m, +el.getAttribute('data-rt-shift')); st.y = n.y; st.m = n.m; st.sheet = ''; loadMonth(); return; }
    if (t.closest('[data-rt-reload]')) { if (st.mode === '_manday') loadMonth(); else loadMigrate(); return; }
    if ((el = t.closest('[data-rt-sheet]'))) { st.sheet = el.getAttribute('data-rt-sheet'); paint(); return; }
    if ((el = t.closest('[data-rt-open]'))) { const g = st.groups.find((x) => x.name === el.getAttribute('data-rt-open')); if (g) { st.form = { name: g.name, birth: (g.items.find((i) => i.birth) || {}).birth || '', leaderId: '', rate: '' }; st.msg = ''; paint(); } return; }
    if (t.closest('[data-rt-cancel]')) { st.form = null; st.msg = ''; paint(); return; }
    if (t.closest('[data-rt-save]') && !st.busy) { register(); return; }
    if ((el = t.closest('[data-rt-merge]')) && !st.busy) { const [n, id] = el.getAttribute('data-rt-merge').split('|'); merge(n, id); }
  };
  root.onchange = (ev) => { const t = ev.target; if (t instanceof Element && t.hasAttribute('data-rt-f') && st.form) st.form[t.getAttribute('data-rt-f')] = t.value; };
  root.oninput = root.onchange;
}
