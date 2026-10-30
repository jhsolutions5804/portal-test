/* 영업기획 월간 보고서 경영 층 컨트롤러(대기열 1-2-8, 대표님 2026-10-22 ㅇㅇ) — 시험: tests/plan-monthly-mgmt-io.test.mjs · 계산: monthly-mgmt.js · 화면: monthly-mgmt-view.js.
 * 기본 데이터(프로젝트·견적·정산서)는 한 번 읽고, 서버 마진 보고(marginAct report, 전표·급여명세서를 읽어 무거움)를 "그 달까지"와 "전달까지" 정확히 두 번 불러 그 달 원가를 낸다.
 * 서버 호출·읽기·오늘·그리기는 전부 주입한다(가짜로 시험). 규칙: ① 둘 다 와야 원가를 그린다(한쪽만으로 계산하면 누계가 그 달 값처럼 보인다) ② 권한 없음은 오류가 아니라 denied ③ 월을 넘기면 늦게 온 이전 달 응답은 버린다
 * ④ 부르는 중 다시 불러오기는 무시, 권한 없음이면 다시 불러와도 안 되니 부르지 않는다 ⑤ 기본 데이터를 못 읽으면 서버를 부르지 않는다 ⑥ 청구·완결 금액은 서버를 기다리지 않고 먼저 그린다. */
import { closingSummary, shiftYm } from './closing.js?v=20261030a';
import { monthRows, monthTotals, prevYm, trendMonths, trendMatrix, achievementRows, parseBudgets, cumRows, cumTotals } from './monthly-mgmt.js?v=20261030a';
import { marginNotes, marginErrorState } from './margin-link.js?v=20261030a';
const isO = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const okRep = (r) => isO(r) && r.ok === true && Array.isArray(r.projects);
const ymOf = (s) => (typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])/.test(s) ? s.slice(0, 7) : '');
export function createMonthlyMgmtController(deps) {
  const d = isO(deps) ? deps : {}; const call = (fn, ...a) => (typeof fn === 'function' ? fn(...a) : undefined);
  const today = () => { let t = ''; try { t = ymOf(call(d.today)); } catch (e) { t = ''; } return t || new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 7); };
  const st = { ym: today(), base: null, rows: [], totals: monthTotals([]), srv: { state: 'loading', notes: [] }, error: '', cur: null, prev: null, trend: null, trendState: 'loading', metric: 'margin', ach: [], achState: 'loading', cum: [], cumTotals: cumTotals([]), mgmt: { enabled: typeof d.callMgmt === 'function', list: [], listState: 'idle', save: { state: 'idle', ym: '', saved: 0, skipped: [], message: '' }, view: { state: 'idle', ym: '', rows: [], message: '' } } };
  st.budgetState = 'ok'; st.budgetBad = []; // 실행예산 문서를 읽었는지(ok·error)와 못 쓰는(깨진) 문서의 프로젝트 id — 못 읽으면 달성률은 목표 마진율 기준으로만 나오므로 화면이 그 사실을 알린다
  let seq = 0, busy = false, opening = null;
  const paint = () => { try { call(d.paint); } catch (e) { /* 그리기 오류가 컨트롤러를 죽이지 않게 */ } };
  const closing = () => { const b = st.base; return b ? closingSummary(st.ym, b.projects, b.estimates, b.settlements) : { byProject: [] }; };
  /* 2단계 추이(최근 6개월 프로젝트 × 월): 서버가 준 byMonth(월별 값)로 만든다 — 서버를 더 부르지 않는다. 서버가 byMonth 를 안 주면(아직 안 올라간 서버) 만들지 않고 nodata(원가를 0 으로 꾸미지 않는다), 기다리는 중 loading, 실패·권한 없음 unavailable */
  const recomputeTrend = () => { const b = st.base; if (!b || st.srv.state === 'loading') { st.trend = null; st.trendState = 'loading'; return; } if (st.srv.state !== 'ok') { st.trend = null; st.trendState = 'unavailable'; return; }
    const t = Array.isArray(st.cur && st.cur.byMonth) ? trendMatrix(b.projects, (ym) => closingSummary(ym, b.projects, b.estimates, b.settlements), st.cur.byMonth, trendMonths(st.ym, 6)) : null; st.trend = t; st.trendState = t ? 'ok' : 'nodata'; };
  /* 3단계 원가 달성률(누계, 선택한 달까지): 서버가 준 누계(upTo 그 달 — 현장경비·자체 노무)와 기본 데이터의 견적·지급예정서(발행일이 그 달 이전)·프로젝트 목표 마진율로 만든다 — 서버를 더 부르지 않는다. 서버 원가를 모르면(loading·실패·권한 없음) 만들지 않는다: 지급예정서만으로 달성률을 내면 낮게 나와 "목표 안"으로 오해하게 된다 */
  const recomputeAch = () => { const b = st.base; if (!b || st.srv.state === 'loading') { st.ach = []; st.achState = 'loading'; return; } if (st.srv.state !== 'ok') { st.ach = []; st.achState = 'unavailable'; return; } st.ach = achievementRows(b.projects, b.estimates, b.settlements, st.cur, st.ym, b.budgets, b.budgetBad); st.achState = 'ok'; };
  /* 누적 마진율 병기(대표님 2026-10-22): 표에 나온 프로젝트의 그 달까지 누계 마진율 - 서버가 준 누계(upTo 그 달)와 기본 데이터의 정산서로 만든다(서버를 더 부르지 않는다). 서버 원가를 모르면(loading, 실패, 권한 없음) 만들지 않는다: 지급예정서만으로 마진을 내면 부풀려진다 */
 const recomputeCum = () => { const b = st.base; if (!b || st.srv.state !== 'ok') { st.cum = []; st.cumTotals = cumTotals([]); return; } const ids = new Set(st.rows.map((r) => r.id)); st.cum = cumRows(b.projects.filter((p) => p && ids.has(p.id)), b.settlements, st.cur, st.ym); st.cumTotals = cumTotals(st.cum); };
 const recompute = () => { const b = st.base; if (!b) { st.rows = []; st.totals = monthTotals([]); st.trend = null; st.trendState = 'loading'; st.ach = []; st.achState = 'loading'; st.cum = []; st.cumTotals = cumTotals([]); return; } st.rows = monthRows(b.projects, closing(), st.cur, st.prev); st.totals = monthTotals(st.rows); recomputeTrend(); recomputeAch(); recomputeCum(); };
  const classify = (e) => marginErrorState(e); // 권한 없음 = denied, 그 밖 = error
  const loadMargin = async () => {
    const my = ++seq; const ym = st.ym, pv = prevYm(ym); busy = true; st.srv = { state: 'loading', notes: [] }; st.cur = null; st.prev = null; recompute(); paint();
    const run = async (upTo) => { try { return { r: await call(d.callMargin, { action: 'report', upTo }) }; } catch (e) { return { e }; } };
    const [a, b] = await Promise.all([run(ym), run(pv)]);
    if (my !== seq) return; // 그 사이 월을 넘겼다 — 옛 응답은 버린다(새 달의 상태·값을 덮지 않는다)
    busy = false; const fails = [a, b].filter((x) => x.e !== undefined || !okRep(x.r));
    if (fails.length) { const denied = fails.some((x) => x.e !== undefined && classify(x.e) === 'denied'); st.srv = { state: denied ? 'denied' : 'error', notes: [] }; st.cur = null; st.prev = null; }
    else { st.cur = a.r; st.prev = b.r; st.srv = { state: 'ok', notes: marginNotes(a.r, null) }; }
    recompute(); paint();
  };
  /* 4단계 스냅샷(서버 monthlyMgmtAct — 관리자만): 저장은 서버가 직접 읽어 계산하므로 화면은 { action, ym } 만 보낸다(숫자를 보내지 않음). 목록·저장본은 마진 흐름과 독립이라 실패해도 1단계 표에 영향이 없다. 서버 함수가 주어지지 않으면(deps.callMgmt 없음) 기능이 꺼진다 */
  const YMRE = /^\d{4}-(0[1-9]|1[0-2])$/; let vseq = 0, savingNow = false;
  const mgmtMsg = (e) => { const code = e && typeof e === 'object' && typeof e.code === 'string' ? e.code.replace(/^functions\//, '') : ''; const m = e && typeof e.message === 'string' ? e.message.trim() : ''; if (code === 'permission-denied') return '관리자만 저장할 수 있습니다.'; if (code && code !== 'internal' && code !== 'unknown' && m && m.length <= 300 && /[가-힣]/.test(m) && !/\bat \S+:\d+/.test(m)) return m; return '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'; };
  const loadMgmtList = async () => {
    if (!st.mgmt.enabled) return; st.mgmt.listState = 'loading'; paint();
    try { const r = await call(d.callMgmt, { action: 'list' }); if (!isO(r) || r.ok !== true || !Array.isArray(r.months)) throw new Error('bad'); st.mgmt.list = r.months.filter((m) => isO(m) && typeof m.ym === 'string' && YMRE.test(m.ym)); st.mgmt.listState = 'ok'; }
    catch (e) { st.mgmt.list = []; st.mgmt.listState = (e && typeof e === 'object' && typeof e.code === 'string' && e.code.replace(/^functions\//, '') === 'permission-denied') ? 'denied' : 'error'; }
    paint();
  };
  const saveMgmt = async () => {
    if (!st.mgmt.enabled || savingNow) return; savingNow = true; const ym = st.ym; st.mgmt.save = { state: 'saving', ym, saved: 0, skipped: [], message: '' }; paint();
    try { const r = await call(d.callMgmt, { action: 'save', ym }); if (!isO(r) || r.ok !== true) throw new Error('bad'); st.mgmt.save = { state: 'ok', ym, saved: Number.isInteger(r.saved) ? r.saved : 0, skipped: (Array.isArray(r.skipped) ? r.skipped : []).filter(isO).map((x) => ({ planId: String(x.planId || ''), code: String(x.code || ''), name: String(x.name || ''), reason: String(x.reason || '') })), message: '' }; savingNow = false; paint(); await loadMgmtList(); }
    catch (e) { savingNow = false; st.mgmt.save = { state: 'error', ym, saved: 0, skipped: [], message: mgmtMsg(e) }; paint(); }
  };
  const viewMgmt = async (ym) => {
    if (!st.mgmt.enabled || !YMRE.test(ym)) return; const my = ++vseq; st.mgmt.view = { state: 'loading', ym, rows: [], message: '' }; paint();
    try { const r = await call(d.callMgmt, { action: 'get', ym }); if (my !== vseq) return; if (!isO(r) || r.ok !== true || !Array.isArray(r.rows)) throw new Error('bad'); st.mgmt.view = { state: 'ok', ym, rows: r.rows.filter(isO), message: '' }; }
    catch (e) { if (my !== vseq) return; st.mgmt.view = { state: 'error', ym, rows: [], message: mgmtMsg(e) }; }
    paint();
  };
  const doOpen = async () => {
    try { const base = await call(d.loadBase); if (!isO(base)) throw new Error('불러온 데이터가 없습니다'); const pb = parseBudgets(Array.isArray(base.budgets) ? base.budgets : []); st.base = { projects: Array.isArray(base.projects) ? base.projects : [], estimates: Array.isArray(base.estimates) ? base.estimates : [], settlements: Array.isArray(base.settlements) ? base.settlements : [], budgets: pb.map, budgetBad: pb.bad }; st.budgetState = base.budgets === null ? 'error' : 'ok'; st.budgetBad = pb.bad; st.error = ''; }
    catch (e) { st.base = null; st.error = '불러오지 못했습니다: ' + ((e && e.message) || ''); st.rows = []; st.totals = monthTotals([]); st.cum = []; st.cumTotals = cumTotals([]); st.srv = { state: 'error', notes: [] }; paint(); return; }
    recompute(); paint(); await loadMargin(); await loadMgmtList();
  };
  const open = () => { if (!opening) opening = doOpen(); return opening; };
  const act = async (a) => {
    if (!st.base) return; // 기본 데이터가 없으면 아무것도 안 한다
    if (a === 'prev' || a === 'next') { const nx = shiftYm(st.ym, a === 'prev' ? -1 : 1); if (!ymOf(nx)) return; st.ym = nx; await loadMargin(); return; }
    if (typeof a === 'string' && a.indexOf('metric:') === 0) { const v = a.slice(7); if (v === 'margin' || v === 'yield') { st.metric = v; paint(); } return; }
    if (a === 'mgmt:save') { await saveMgmt(); return; }
    if (typeof a === 'string' && a.indexOf('mgmt:view:') === 0) { await viewMgmt(a.slice(10)); return; }
    if (a === 'mgmt:close') { vseq++; st.mgmt.view = { state: 'idle', ym: '', rows: [], message: '' }; paint(); return; }
    if (a === 'reload') { if (busy || st.srv.state === 'denied' || st.srv.state === 'loading') return; await loadMargin(); }
  };
  return { st, open, act };
}
