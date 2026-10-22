/* 영업기획 월간 보고서 경영 층 컨트롤러(대기열 1-2-8, 대표님 2026-10-22 ㅇㅇ) — 시험: tests/plan-monthly-mgmt-io.test.mjs · 계산: monthly-mgmt.js · 화면: monthly-mgmt-view.js.
 * 기본 데이터(프로젝트·견적·정산서)는 한 번 읽고, 서버 마진 보고(marginAct report, 전표·급여명세서를 읽어 무거움)를 "그 달까지"와 "전달까지" 정확히 두 번 불러 그 달 원가를 낸다.
 * 서버 호출·읽기·오늘·그리기는 전부 주입한다(가짜로 시험). 규칙: ① 둘 다 와야 원가를 그린다(한쪽만으로 계산하면 누계가 그 달 값처럼 보인다) ② 권한 없음은 오류가 아니라 denied ③ 월을 넘기면 늦게 온 이전 달 응답은 버린다
 * ④ 부르는 중 다시 불러오기는 무시, 권한 없음이면 다시 불러와도 안 되니 부르지 않는다 ⑤ 기본 데이터를 못 읽으면 서버를 부르지 않는다 ⑥ 청구·완결 금액은 서버를 기다리지 않고 먼저 그린다. */
import { closingSummary, shiftYm } from './closing.js?v=20261022h';
import { monthRows, monthTotals, prevYm, trendMonths, trendMatrix } from './monthly-mgmt.js?v=20261022h';
import { marginNotes, marginErrorState } from './margin-link.js?v=20261022h';
const isO = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const okRep = (r) => isO(r) && r.ok === true && Array.isArray(r.projects);
const ymOf = (s) => (typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])/.test(s) ? s.slice(0, 7) : '');
export function createMonthlyMgmtController(deps) {
  const d = isO(deps) ? deps : {}; const call = (fn, ...a) => (typeof fn === 'function' ? fn(...a) : undefined);
  const today = () => { let t = ''; try { t = ymOf(call(d.today)); } catch (e) { t = ''; } return t || new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 7); };
  const st = { ym: today(), base: null, rows: [], totals: monthTotals([]), srv: { state: 'loading', notes: [] }, error: '', cur: null, prev: null, trend: null, trendState: 'loading', metric: 'margin' };
  let seq = 0, busy = false, opening = null;
  const paint = () => { try { call(d.paint); } catch (e) { /* 그리기 오류가 컨트롤러를 죽이지 않게 */ } };
  const closing = () => { const b = st.base; return b ? closingSummary(st.ym, b.projects, b.estimates, b.settlements) : { byProject: [] }; };
  /* 2단계 추이(최근 6개월 프로젝트 × 월): 서버가 준 byMonth(월별 값)로 만든다 — 서버를 더 부르지 않는다. 서버가 byMonth 를 안 주면(아직 안 올라간 서버) 만들지 않고 nodata(원가를 0 으로 꾸미지 않는다), 기다리는 중 loading, 실패·권한 없음 unavailable */
  const recomputeTrend = () => { const b = st.base; if (!b || st.srv.state === 'loading') { st.trend = null; st.trendState = 'loading'; return; } if (st.srv.state !== 'ok') { st.trend = null; st.trendState = 'unavailable'; return; }
    const t = Array.isArray(st.cur && st.cur.byMonth) ? trendMatrix(b.projects, (ym) => closingSummary(ym, b.projects, b.estimates, b.settlements), st.cur.byMonth, trendMonths(st.ym, 6)) : null; st.trend = t; st.trendState = t ? 'ok' : 'nodata'; };
  const recompute = () => { const b = st.base; if (!b) { st.rows = []; st.totals = monthTotals([]); st.trend = null; st.trendState = 'loading'; return; } st.rows = monthRows(b.projects, closing(), st.cur, st.prev); st.totals = monthTotals(st.rows); recomputeTrend(); };
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
  const doOpen = async () => {
    try { const base = await call(d.loadBase); if (!isO(base)) throw new Error('불러온 데이터가 없습니다'); st.base = { projects: Array.isArray(base.projects) ? base.projects : [], estimates: Array.isArray(base.estimates) ? base.estimates : [], settlements: Array.isArray(base.settlements) ? base.settlements : [] }; st.error = ''; }
    catch (e) { st.base = null; st.error = '불러오지 못했습니다: ' + ((e && e.message) || ''); st.rows = []; st.totals = monthTotals([]); st.srv = { state: 'error', notes: [] }; paint(); return; }
    recompute(); paint(); await loadMargin();
  };
  const open = () => { if (!opening) opening = doOpen(); return opening; };
  const act = async (a) => {
    if (!st.base) return; // 기본 데이터가 없으면 아무것도 안 한다
    if (a === 'prev' || a === 'next') { const nx = shiftYm(st.ym, a === 'prev' ? -1 : 1); if (!ymOf(nx)) return; st.ym = nx; await loadMargin(); return; }
    if (typeof a === 'string' && a.indexOf('metric:') === 0) { const v = a.slice(7); if (v === 'margin' || v === 'yield') { st.metric = v; paint(); } return; }
    if (a === 'reload') { if (busy || st.srv.state === 'denied' || st.srv.state === 'loading') return; await loadMargin(); }
  };
  return { st, open, act };
}
