/* 내 팀 공수표 — 새 화면(메뉴 "내 팀 공수표"). 팀장은 관리자가 지정한 자기 팀(portal_users.teamLeaderIds), 관리자는 전체 팀. 읽기 + 관리자 팀 단가 수정.
 * 공수는 모든 프로젝트(종료 포함)의 pjt_registry/<id>/{workers,manday} 를 마스터 id 로 합산한다(구포털은 옛 저장 위치를 함께 읽어 통일 뒤 이중 집계될 수 있었다).
 * 팀 단가 저장은 두 문서를 한 번에: master_worker_private/<팀장>.teamRate(관리자 전용, 영업기획·집계가 읽음) + team_rates/<팀장>(관리자 + 그 팀 팀장만 조회). */
import { db, doc, getDoc, writeBatch, serverTimestamp } from '../../core/firebase.js?v=20261031f';
import { toast } from '../../core/ui.js?v=20261031f';
import { confirmDialog } from '../../core/dialog.js?v=20261031f';
import { loadHolidays } from '../../shared/holidays.js?v=20261031f';
import { appToday } from './attendance.js?v=20261031f';
import { aggregateMonth } from './roster-tools.js?v=20261031f';
import { loadBase, loadRows } from './month-data.js?v=20261031f';
import { shiftMonth, monthLabel } from './overview.js?v=20261031f';
import { teamsOf, teamView, parseRate, calendarOf, won } from './team.js?v=20261031f';
import { teamHtml } from './team-view.js?v=20261031f';
import { sheetPng } from './team-png.js?v=20261031f';
export async function mountTeam(root, route, ctx) {
  root.onclick = null; const me = (ctx && ctx.me) || {}; const t0 = appToday().split('-').map(Number);
  const ids = Array.isArray(me.teamLeaderIds) ? me.teamLeaderIds.filter((x) => typeof x === 'string' && x) : [];
  const st = { allowed: !!(me.admin || ids.length), admin: !!me.admin, who: (me.name || '') + (me.rank ? ' ' + me.rank : '') + (me.admin ? ' · 관리자 (전체 팀)' : ' · 팀 ' + ids.length + '개'), y: t0[0], m: t0[1] - 1, seq: 0, ready: false, err: '', failed: [], view: [], sheet: null, base: null };
  root.innerHTML = '<div id="tm-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#tm-body'); const paint = () => { const y = window.scrollY; body.innerHTML = teamHtml(st); window.scrollTo(0, y); };
  if (!st.allowed) { body.removeAttribute('aria-busy'); paint(); return; }
  const makePng = (ctx && ctx.makePng) || sheetPng; const savePng = (ctx && ctx.savePng) || ((url, name) => { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); });
  const rateOf = async (lid) => { try { const r = await getDoc(doc(db, 'team_rates', lid)); if (r.exists() && r.data().teamRate != null) return { rate: Number(r.data().teamRate) || 0, err: false }; return { rate: null, err: false }; } catch (e) { return { rate: null, err: true }; } };   // 단가는 관리자·그 팀 팀장만 읽을 수 있어 실패할 수 있다
  const load = async () => {
    const seq = ++st.seq; st.ready = false; paint(); const failed = [];
    try {
      if (!st.base) { st.base = await loadBase(null); failed.push.apply(failed, st.base.failed); }   // 프로젝트 목록·명단·마스터는 달을 옮겨도 다시 읽지 않는다
      failed.push.apply(failed, await loadRows(st.base.projects, st.y, st.m));
      const T = teamsOf(st.base.masters, { admin: st.admin, teamIds: ids }); T.missing.forEach((id) => failed.push('팀장 정보(' + id + ')'));
      const rates = {}; await Promise.all(T.teams.map(async (t) => { rates[t.leader.id] = await rateOf(t.leader.id); }));
      if (seq !== st.seq) return;   // 그 사이 다른 달을 골랐으면 이전 결과는 버린다
      st.teams = T.teams; st.rates = rates; st.agg = aggregateMonth(st.base.projects, st.base.masters); st.failed = failed; st.view = teamView(T.teams, st.agg, rates); st.ready = true;
    } catch (e) { if (seq !== st.seq) return; st.err = '불러오지 못했습니다: ' + ((e && (e.code || e.message)) || ''); }
    body.removeAttribute('aria-busy'); paint();
  };
  try { await Promise.race([loadHolidays(), new Promise((r) => setTimeout(r, 1200))]); } catch (e) { /* 공휴일 없이 */ }
  await load();
  const editRate = async (ti) => {
    const v = st.view[ti]; if (!v || !st.admin) return; const t = v.t;
    const ok = await confirmDialog({ title: t.leader.name + ' 팀 단가', body: '이 팀의 단가(원/공수)를 입력하세요. 영업기획 > 팀별 노무비와 같은 값입니다.' + (t.rate == null ? '' : '\n현재: ' + won(t.rate) + '원'), confirmLabel: '저장', reason: { label: '단가(원/공수)', placeholder: t.rate == null ? '예: 180,000' : String(t.rate), required: true } }); if (!ok.ok) return;
    const rate = parseRate(ok.reason); if (!rate) { toast('단가는 숫자로 입력해 주세요.'); return; }
    try { const b = writeBatch(db); b.set(doc(db, 'master_worker_private', t.leader.id), { teamRate: rate }, { merge: true }); b.set(doc(db, 'team_rates', t.leader.id), { teamRate: rate, updatedAt: serverTimestamp() }, { merge: true }); await b.commit(); st.rates[t.leader.id] = { rate, err: false }; st.view = teamView(st.teams, st.agg, st.rates); toast('팀 단가를 저장했습니다.'); paint(); }
    catch (err) { toast('저장 실패: ' + ((err && (err.code || err.message)) || '')); }
  };
  const png = () => {
    const v = st.view[st.sheet.ti]; const x = v && v.people[st.sheet.pi]; if (!x) return; const weeks = calendarOf(st.y, st.m, x.byDate);
    try { savePng(makePng({ title: x.m.name + '님 ' + monthLabel(st.y, st.m) + ' 공수표', chips: Object.keys(x.byPjt).map((pn) => ({ label: pn + ' ' + x.byPjt[pn].toFixed(1) })), weeks, total: x.total }), (x.m.name || '') + '_' + st.y + String(st.m + 1).padStart(2, '0') + '_공수표.png'); } catch (e) { toast('이미지 저장 중 오류가 났습니다: ' + ((e && e.message) || '')); }
  };
  root.onclick = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; let el;
    if ((el = t.closest('[data-tm-shift]'))) { const n = shiftMonth(st.y, st.m, +el.getAttribute('data-tm-shift')); st.y = n.y; st.m = n.m; st.sheet = null; load(); return; }
    if ((el = t.closest('[data-tm-sheet]'))) { const [ti, pi] = el.getAttribute('data-tm-sheet').split('|').map(Number); st.sheet = { ti, pi }; paint(); return; }
    if (t.closest('[data-tm-close]')) { st.sheet = null; paint(); return; }
    if (t.closest('[data-tm-png]')) { png(); return; }
    if ((el = t.closest('[data-tm-rate]'))) { editRate(+el.getAttribute('data-tm-rate')); }
  };
}
