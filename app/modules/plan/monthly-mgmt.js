/* 영업기획 월간 보고서 경영 층 1단계(대기열 1-2-8, 대표님 2026-10-22 ㅇㅇ) — 순수 함수(저장·호출 없음). 시험: tests/plan-monthly-mgmt.test.mjs · 설계: app-docs/monthly-report-design.md §2-2·§3.
 * 그 달 원가·노무비 = 서버 마진 보고(marginAct report, 누계 전용)를 "그 달까지"와 "전달까지" 두 번 불러 차이로 낸다(마진 모듈을 안 건드림 — 설계 §3-1 이 이미 채택한 "상태 차이" 방식).
 * 매출 기준 = 완결 청구(1-2-3-a, 대표님 2026-10-21) — shared/pjt-summary.js pjtMargin 과 같은 규칙: 완결이 0 이하이면 발행 청구로 대신 계산하지 않고 null.
 * 원가 = 지급예정서 발행 + 현장경비 + 자체 직접노무비(pjtCost 와 같은 정의 — 노무비는 지급예정서에 이미 들어 있어 따로 또 빼면 이중 차감이라는 말은 외주 노무 이야기이고, 자체 직접노무비는 별도 항목).
 * 서버 응답은 연결된 PJT 등록 id 로 찾는다(영업기획 id 가 아니다 — 대기열 1-2-2-④ 교훈). 응답 검증은 margin-link.js 와 같은 규칙을 그대로 쓴다(두 곳이 어긋나지 않게). 원가를 모르면 마진율·수율을 내지 않는다(모르는 값을 0 으로 꾸미지 않음). */
import { marginExtra, linkedPjtId } from './margin-link.js?v=20261022h';
const isO = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const T = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const r1 = (n) => Math.round(n * 10) / 10;
/** 전달(YYYY-MM) — 1월의 전달은 전년 12월, 형식이 틀리면 빈 글자 */
export function prevYm(ym) {
  const m = typeof ym === 'string' ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(ym) : null; if (!m) return '';
  let y = Number(m[1]), mo = Number(m[2]) - 1; if (mo < 1) { mo = 12; y -= 1; } return y + '-' + String(mo).padStart(2, '0');
}
/** 그 달 현장경비·자체 직접노무비 증분 — cur = 그 달까지 누계 응답, prev = 전달까지 누계 응답, pid = 연결된 PJT 등록 id. 한쪽이라도 못 받았거나 연결이 없으면 null.
 * 전달 응답에 그 프로젝트가 없으면 전달 0(그 달에 처음 생긴 원가). 증분이 음수이면(과거 전표를 고쳐 누계가 줄어든 경우) restated: true — 숨기지 않고 알린다 */
export function monthDelta(cur, prev, pid) {
  const id = typeof pid === 'string' ? pid.trim() : ''; if (!id || id === 'auto' || id === 'none') return null;
  const c = marginExtra(cur, id), p = marginExtra(prev, id); if (!c || !p) return null;
  const direct = T(c.direct) - T(p.direct), ownLabor = T(c.ownLabor) - T(p.ownLabor);
  return { direct, ownLabor, restated: direct < 0 || ownLabor < 0 };
}
/* 원가·마진율·노무 수율 규칙(1단계 monthRow 와 추이 monthRowFromMonthly 가 같이 쓴다 — 두 화면의 숫자가 어긋나지 않게): 원가 = 지급예정서 발행 + 현장경비 + 자체 직접노무비, 마진율 = (완결 − 원가) ÷ 완결(완결 0 이하면 null), 노무 수율 = 완결 ÷ 자체 노무(0 이하면 null) */
function fill(row, direct, ownLabor) { row.direct = direct; row.ownLabor = ownLabor; row.cost = row.payIssued + direct + ownLabor; if (row.collected > 0) { row.margin = r1((row.collected - row.cost) / row.collected * 100); if (ownLabor > 0) row.laborYield = r1(row.collected / ownLabor); } return row; }
/** 프로젝트 하나의 그 달 행 — p = 영업기획 프로젝트, sum = 월 마감 byProject 행(없으면 {}), cur/prev = 서버 마진 보고 응답 */
export function monthRow(p, sum, cur, prev) {
  const x = isO(p) ? p : {}, s = isO(sum) ? sum : {}; const pjt = linkedPjtId(x);
  const row = { id: typeof x.id === 'string' ? x.id : '', pjt, code: typeof x.code === 'string' ? x.code : '', name: typeof x.name === 'string' ? x.name : '', status: 'ok', restated: false,
    invoiced: T(s.invoiced), collected: T(s.collected), payIssued: T(s.payIssued), paid: T(s.paid), direct: null, ownLabor: null, cost: null, margin: null, laborYield: null };
  if (!pjt) { row.status = 'nolink'; return row; }
  const d = monthDelta(cur, prev, pjt); if (!d) { row.status = 'nocost'; return row; }
  row.restated = d.restated; return fill(row, d.direct, d.ownLabor);
}
/** 그 달 행 목록 — 월 마감 요약(byProject)에 있거나 그 달 원가가 있는 프로젝트만(청구도 원가도 없는 프로젝트는 뺀다). closing = closingSummary 결과 */
export function monthRows(projects, closing, cur, prev) {
  const list = Array.isArray(projects) ? projects.filter(isO) : []; const by = new Map(); (isO(closing) && Array.isArray(closing.byProject) ? closing.byProject : []).forEach((r) => { if (isO(r) && typeof r.id === 'string') by.set(r.id, r); });
  const out = [];
  list.forEach((p) => { const row = monthRow(p, by.get(p.id), cur, prev); const has = by.has(p.id) || (row.status === 'ok' && (row.cost > 0 || row.direct !== 0 || row.ownLabor !== 0)); if (has) out.push(row); });
  return out;
}
/** 합계 — 원가를 모르는 프로젝트가 하나라도 있으면 마진율·수율을 내지 않는다(그 프로젝트의 완결 청구만 분모에 들어가 마진이 부풀려진다) */
export function monthTotals(rows) {
  const l = Array.isArray(rows) ? rows.filter(isO) : []; const sum = (k) => l.reduce((a, r) => a + T(r[k]), 0);
  const t = { invoiced: sum('invoiced'), collected: sum('collected'), payIssued: sum('payIssued'), paid: sum('paid'), direct: sum('direct'), ownLabor: sum('ownLabor'), cost: sum('cost'), margin: null, laborYield: null, unknown: l.filter((r) => r.status !== 'ok').length, restated: l.filter((r) => r.restated === true).length };
  if (!t.unknown) { if (t.collected > 0) t.margin = r1((t.collected - t.cost) / t.collected * 100); if (t.collected > 0 && t.ownLabor > 0) t.laborYield = r1(t.collected / t.ownLabor); }
  return t;
}

/** 끝 달(YYYY-MM)까지 n개월 목록(오래된 달부터). 끝 달 형식이 틀리면 빈 목록, 개수가 이상하면 6, 24 까지 */
export function trendMonths(endYm, n) {
  if (!prevYm(endYm)) return []; const c = Number.isInteger(n) && n >= 1 ? Math.min(n, 24) : 6; const out = [endYm]; while (out.length < c) out.unshift(prevYm(out[0])); return out;
}
/** 서버 월별 값(byMonth 의 그 달 프로젝트 항목) 그대로 쓰는 한 달 행 — 누계의 차이가 아니다(월별 보험은 월 임금마다 반올림이라 월별 값끼리만 쓴다). entry 가 없으면(서버가 성공했는데 그 달 항목이 없음) 현장경비·노무는 0, 연결이 없으면 nolink */
export function monthRowFromMonthly(p, sum, entry) {
  const x = isO(p) ? p : {}, s = isO(sum) ? sum : {}; const pjt = linkedPjtId(x);
  const row = { id: typeof x.id === 'string' ? x.id : '', pjt, code: typeof x.code === 'string' ? x.code : '', name: typeof x.name === 'string' ? x.name : '', status: 'ok', restated: false,
    invoiced: T(s.invoiced), collected: T(s.collected), payIssued: T(s.payIssued), paid: T(s.paid), direct: null, ownLabor: null, cost: null, margin: null, laborYield: null };
  if (!pjt) { row.status = 'nolink'; return row; }
  const e = isO(entry) ? entry : {}; return fill(row, T(e.overhead), T(e.ownLabor));
}
/** 프로젝트 × 월 추이 행렬 — closingOf(ym) = 그 달 월 마감 요약(closingSummary), byMonth = 서버 report 의 byMonth. byMonth 가 배열이 아니면 null(서버가 아직 월별 값을 안 줌 — 모르는 원가를 0 으로 꾸미지 않는다).
 * 청구·지급·원가가 한 번도 없던 프로젝트는 뺀다. 월별 합계는 그 달 활동이 있는 프로젝트만 센다(활동 없는 달에 연결 없는 프로젝트가 "모름"으로 합계를 비우는 것을 막는다) */
export function trendMatrix(projects, closingOf, byMonth, months) {
  if (!Array.isArray(byMonth) || !Array.isArray(months) || !months.length) return null;
  const list = Array.isArray(projects) ? projects.filter(isO) : []; const mon = new Map(); byMonth.forEach((m) => { if (isO(m) && typeof m.month === 'string' && Array.isArray(m.projects)) { const pm = new Map(); m.projects.forEach((e) => { if (isO(e) && typeof e.pjt === 'string') pm.set(e.pjt, e); }); mon.set(m.month, pm); } });
  const closing = months.map((ym) => { let c = null; try { c = typeof closingOf === 'function' ? closingOf(ym) : null; } catch (e) { c = null; } const by = new Map(); (isO(c) && Array.isArray(c.byProject) ? c.byProject : []).forEach((r) => { if (isO(r) && typeof r.id === 'string') by.set(r.id, r); }); return by; });
  const active = (c) => !!(c.invoiced || c.collected || c.payIssued || c.paid || c.direct || c.ownLabor);
  const rows = []; list.forEach((p) => { const pjt = linkedPjtId(p); const cells = months.map((ym, i) => monthRowFromMonthly(p, closing[i].get(p.id), pjt && mon.get(ym) ? mon.get(ym).get(pjt) : undefined)); if (cells.some(active)) rows.push({ id: cells[0].id, pjt: cells[0].pjt, code: cells[0].code, name: cells[0].name, cells }); });
  const totals = months.map((ym, i) => monthTotals(rows.map((r) => r.cells[i]).filter(active)));
  return { months: months.slice(), rows, totals };
}
