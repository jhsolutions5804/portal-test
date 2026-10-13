/* 근로자 연명부(새 화면) — 구포털 PJT 메뉴의 "근로자 연명부" 칸. 주소 #/pjt/roster(목록) · #/pjt/roster/<근로자 id>(상세 조회).
 * 읽기만 하는 1단계: 목록(요약·필터·검색·정렬)과 상세 조회. 등록·수정·삭제·첨부·검진·교육 입력은 다음 단계에서 같은 화면에 붙인다. 규칙은 roster.js, 표시는 roster-view.js. */
import { db, collection, getDocs } from '../../core/firebase.js?v=20261014d';
import { esc } from '../../core/ui.js?v=20261014d';
import { mergePrivs, summaryOf, visibleList, rowOf, todayKey, birthFromJumin } from './roster.js?v=20261014d';
import { rosterListHtml, rosterDetailHtml } from './roster-view.js?v=20261014d';
const pushHash = (h) => { if (location.hash === h) return; try { history.replaceState(null, '', h); } catch (e) { location.hash = h; } };
const lst = (snap) => { const a = []; snap.forEach((d) => a.push({ id: d.id, data: d.data() })); return a; };
export async function mountRoster(root, route, ctx) {
  root.onclick = null; root.oninput = null; root.onchange = null;
  const me = (ctx && ctx.me) || {}; const segs = (route && route.segs) || [];
  const st = { allowed: !!(me.admin || (me.perms && me.perms.pjt)), admin: !!me.admin, ready: false, err: '', masters: [], privs: {}, accounts: [], hr: {}, filter: 'active', query: '', sortKey: null, sortDir: 1, sel: segs[0] || '', coTab: 'samsung', coSub: 'legal', reveal: new Set(), today: todayKey(), rows: [], summary: { active: 0, resigned: 0, noHealth: 0, eduLack: 0 } };
  st.accountOf = (id) => st.accounts.find((u) => u.teamLeaderIds.indexOf(id) !== -1) || null; st.hrMatch = (name, birth) => (name && birth ? st.hr[String(name).trim() + '|' + birth] || null : null);
  root.innerHTML = '<div id="ro-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div>'; const body = root.querySelector('#ro-body');
  const recompute = () => { const byId = (id) => st.masters.find((m) => m.id === id); const ctx2 = { today: st.today, masterById: byId, accountOf: st.accountOf }; st.summary = summaryOf(st.masters, st.privs, st.today); st.rows = visibleList({ masters: st.masters, privs: st.privs, filter: st.filter, query: st.query, sortKey: st.sortKey, sortDir: st.sortDir, today: st.today }).map((m) => rowOf(m, st.privs[m.id], ctx2)); };
  const paint = () => { const y = window.scrollY; const f = body.querySelector('[data-ro-q]'); const keep = f && document.activeElement === f ? f.selectionStart : -1; body.innerHTML = st.sel ? rosterDetailHtml(st) : rosterListHtml(st); window.scrollTo(0, y); if (keep >= 0) { const g = body.querySelector('[data-ro-q]'); if (g) { g.focus(); try { g.setSelectionRange(keep, keep); } catch (e) { /* 일부 입력 형식은 커서 위치를 못 정함 */ } } } };
  if (!st.allowed) { body.removeAttribute('aria-busy'); paint(); return; }
  const load = async () => {
    const [ms, info, pay, users, ws, wp] = await Promise.all([getDocs(collection(db, 'master_workers')), getDocs(collection(db, 'master_worker_info')), st.admin ? getDocs(collection(db, 'master_worker_private')).catch(() => null) : Promise.resolve(null), st.admin ? getDocs(collection(db, 'portal_users')).catch(() => null) : Promise.resolve(null), st.admin ? getDocs(collection(db, 'workers')).catch(() => null) : Promise.resolve(null), st.admin ? getDocs(collection(db, 'worker_private')).catch(() => null) : Promise.resolve(null)]);
    st.masters = lst(ms).map((x) => Object.assign({ id: x.id }, x.data)); st.privs = mergePrivs(lst(info), pay ? lst(pay) : []);
    st.accounts = []; if (users) lst(users).forEach((u) => { if (u.data.status === 'approved') st.accounts.push({ uid: u.id, name: u.data.name || '', rank: u.data.rank || '', email: u.data.email || '', teamLeaderIds: Array.isArray(u.data.teamLeaderIds) ? u.data.teamLeaderIds : [] }); });
    st.hr = {}; if (ws) { const pm = {}; if (wp) lst(wp).forEach((d) => { pm[d.id] = d.data; }); lst(ws).forEach((d) => { const w = d.data, p = pm[d.id] || {}; const b = birthFromJumin(p.juminMasked || p.jumin); if (w.name && b) st.hr[w.name + '|' + b] = { address: String(p.address || '').trim() }; }); }   // 인사 근로자 명단과 이름·생년월일로 대조(주소는 인사에서 관리)
  };
  try { await load(); st.ready = true; recompute(); } catch (e) { st.err = '불러오지 못했습니다: ' + ((e && (e.code || e.message)) || ''); }
  body.removeAttribute('aria-busy'); paint();
  root.onclick = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; let el;
    if ((el = t.closest('[data-ro-open]'))) { st.sel = el.getAttribute('data-ro-open'); st.reveal = new Set(); st.coTab = 'samsung'; st.coSub = 'legal'; pushHash('#/pjt/roster/' + encodeURIComponent(st.sel)); paint(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-ro-back]')) { st.sel = ''; pushHash('#/pjt/roster'); paint(); return; }
    if ((el = t.closest('[data-ro-filter]'))) { st.filter = el.getAttribute('data-ro-filter'); recompute(); paint(); return; }
    if ((el = t.closest('[data-ro-sort]'))) { const k = el.getAttribute('data-ro-sort'); if (st.sortKey !== k) { st.sortKey = k; st.sortDir = 1; } else if (st.sortDir === 1) st.sortDir = -1; else { st.sortKey = null; st.sortDir = 1; } recompute(); paint(); return; }
    if (t.closest('[data-ro-dir]')) { if (!st.sortKey) return; st.sortDir = -st.sortDir; recompute(); paint(); return; }
    if ((el = t.closest('[data-ro-cotab]'))) { st.coTab = el.getAttribute('data-ro-cotab'); paint(); return; }
    if ((el = t.closest('[data-ro-cosub]'))) { st.coSub = el.getAttribute('data-ro-cosub'); paint(); return; }
    if ((el = t.closest('[data-ro-pw]'))) { const k = el.getAttribute('data-ro-pw'); if (st.reveal.has(k)) st.reveal.delete(k); else st.reveal.add(k); paint(); }
  };
  root.oninput = (ev) => { const t = ev.target; if (t instanceof Element && t.hasAttribute('data-ro-q')) { st.query = t.value.trim(); recompute(); paint(); } };
  root.onchange = (ev) => { const t = ev.target; if (t instanceof Element && t.hasAttribute('data-ro-sortm')) { st.sortKey = t.value || null; if (!st.sortKey) st.sortDir = 1; recompute(); paint(); } };
}
