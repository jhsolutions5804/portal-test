/* 영업기획 월간 보고서 경영 층 1단계(대기열 1-2-8, 대표님 2026-10-22 ㅇㅇ) — 순수 함수(저장·호출 없음). 시험: tests/plan-monthly-mgmt.test.mjs · 설계: app-docs/monthly-report-design.md §2-2·§3.
 * 그 달 원가·노무비 = 서버 마진 보고(marginAct report, 누계 전용)를 "그 달까지"와 "전달까지" 두 번 불러 차이로 낸다(마진 모듈을 안 건드림 — 설계 §3-1 이 이미 채택한 "상태 차이" 방식).
 * 매출 기준 = 완결 청구(1-2-3-a, 대표님 2026-10-21) — shared/pjt-summary.js pjtMargin 과 같은 규칙: 완결이 0 이하이면 발행 청구로 대신 계산하지 않고 null.
 * 원가 = 지급예정서 발행 + 현장경비 + 자체 직접노무비(pjtCost 와 같은 정의 — 노무비는 지급예정서에 이미 들어 있어 따로 또 빼면 이중 차감이라는 말은 외주 노무 이야기이고, 자체 직접노무비는 별도 항목).
 * 서버 응답은 연결된 PJT 등록 id 로 찾는다(영업기획 id 가 아니다 — 대기열 1-2-2-④ 교훈). 응답 검증은 margin-link.js 와 같은 규칙을 그대로 쓴다(두 곳이 어긋나지 않게). 원가를 모르면 마진율·수율을 내지 않는다(모르는 값을 0 으로 꾸미지 않음). */
import { marginExtra, linkedPjtId } from './margin-link.js?v=20261030a';
import { budgetCompare, budgetFromDoc } from './budget.js?v=20261030a';
import { pjtSummary, settleBelongsToPjt, settleAmountForPjt } from './projects.js?v=20261030a';
import { monthOfTs } from './closing.js?v=20261030a';
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

/* ───────── 3단계: 원가 달성률(설계 monthly-report-design.md §3-3, 대표님 2026-10-22 ㄱㄱ) ─────────
 * 목표 원가 = 견적 공급가액 × (1 − 목표 마진율 ÷ 100), 실제 원가 = 선택한 달까지의 지급예정서 발행 + 현장경비 + 자체 직접노무비(마진 모듈의 원가와 같은 정의), 달성률 = 실제 원가 ÷ 목표 원가 × 100(100% 이하 = 목표 원가 안).
 * 견적 공급가액·지급예정서 합산은 기존 마진 화면과 같은 pjtSummary 를 쓴다(공동 발행 몫·균등 분배·폐기 제외 규칙이 같다). 지급예정서는 발행일이 그 달 이전인 것만(발행일이 없거나 형식이 틀리면 그 달까지에 넣는다 — 원가를 낮춰 "목표 안"으로 보이게 하지 않는 보수적 선택).
 * 모르는 값은 숫자로 꾸미지 않고 이유 상태를 돌려준다: notarget(목표 마진율 미입력) · noest(견적 없음) · badtarget(목표 마진율 100 이상 — 목표 원가 0 이하) · nolink(연결 없음) · nocost(서버 원가를 모름 — 지급예정서만으로 달성률을 내면 낮게 나와 "목표 안"으로 오해하게 되므로 내지 않는다).
 * 공정율 대비 달성률(달성률 − 공정율)은 공정율이 PJT 현장 층 데이터라 영업기획에는 없어 하지 않는다. 견적의 개정(rev)이 모두 유효 상태면 합이 겹칠 수 있다 — 기존 마진 화면과 같은 정의라 그대로 쓴다. */
const tmOf = (v) => { if (typeof v !== 'number' && typeof v !== 'string') return null; /* 숫자·글자만 — Number([]) 가 0, Number([12]) 가 12, Number(true) 가 1 로 둔갑하지 않게 */ const t = typeof v === 'string' ? v.trim() : v; if (t === '') return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
/** 실행예산이 있으면(budget = parseBudgets 가 준 프로젝트별 실행예산) 목표 원가 = 실행예산 총 계획(예비비 포함), 실제 원가의 세 부분이 곧 비목 실적(외주 = 지급예정서 발행 누계 · 자체 노무 = 자체 직접노무비 · 현장경비)이라 비목별 달성률을 같이 낸다(대기열 1-3-9 4단계, 대표님 2026-10-24).
 * 실행예산이 없거나 비어 있으면(합계 0) 지금처럼 목표 마진율 기준(basis 'margin'), 깨졌으면 budgetBad 를 켜고 목표 마진율 기준으로 돌아간다(깨진 숫자로 계산하지 않는다). 실행예산 기준 행은 견적이 없어도 나온다. */
export function achievementRow(p, estimates, settlements, cur, ym, budget) {
  const x = isO(p) ? p : {}; const pjt = linkedPjtId(x); const target = tmOf(x.targetMargin);
  const row = { id: typeof x.id === 'string' ? x.id : '', pjt, code: typeof x.code === 'string' ? x.code : '', name: typeof x.name === 'string' ? x.name : '', status: 'ok', est: null, target, targetCost: null, payIssued: null, direct: null, ownLabor: null, cost: null, rate: null, over: null };
  /* 주의: 실행예산이 없는 행은 예전과 정확히 같은 모양이어야 한다 — 서버가 저장본(스냅샷)을 만들 때 쓰는 계산 사본(portal-functions mgmt-core.js)과 tests/plan-mgmt-core-parity.test.mjs 가 한 글자도 다르지 않게 대조하는 안전망이다. 그래서 basis·budgetRev·plan·byCat·usingReserve·warnUnassigned·budgetBad 는 실행예산 기준 행(또는 깨진 표시)에만 붙인다 */
  const id = row.id; const month = typeof ym === 'string' ? ym.slice(0, 7) : ''; const set = (Array.isArray(settlements) ? settlements : []).filter((s) => { if (!isO(s)) return false; const d = typeof s.issueDate === 'string' && /^\d{4}-\d{2}/.test(s.issueDate) ? s.issueDate.slice(0, 7) : ''; return !d || !month || d <= month; });
  const sm = pjtSummary(id, Array.isArray(estimates) ? estimates.filter(isO) : [], set); row.est = T(sm.est); row.payIssued = T(sm.paid);
  const probe = isO(budget) ? budgetCompare(budget, { sub: 0, labor: 0, site: 0 }) : null;
  if (probe && probe.state === 'bad') row.budgetBad = true;
  if (probe && probe.state === 'ok') {
    row.basis = 'budget'; row.budgetRev = budget.rev; row.plan = probe.total.plan; row.targetCost = probe.total.plan; row.warnUnassigned = probe.warnUnassigned; row.usingReserve = false; row.byCat = null;
    if (!pjt) { row.status = 'nolink'; return row; }
    const e = marginExtra(cur, pjt); if (!e) { row.status = 'nocost'; return row; }
    row.direct = T(e.direct); row.ownLabor = T(e.ownLabor); row.cost = row.payIssued + row.direct + row.ownLabor;
    const cmp = budgetCompare(budget, { sub: row.payIssued, labor: row.ownLabor, site: row.direct });
    row.byCat = cmp.rows; row.rate = cmp.total.rate; row.over = cmp.total.over; row.usingReserve = cmp.total.usingReserve;
    return row;
  }
  if (!(row.est > 0)) { row.status = 'noest'; return row; }
  if (target === null) { row.status = 'notarget'; return row; }
  if (target >= 100) { row.status = 'badtarget'; return row; }
  row.targetCost = Math.round(row.est * (1 - target / 100));
  if (!pjt) { row.status = 'nolink'; return row; }
  const e = marginExtra(cur, pjt); if (!e) { row.status = 'nocost'; return row; }
  row.direct = T(e.direct); row.ownLabor = T(e.ownLabor); row.cost = row.payIssued + row.direct + row.ownLabor; row.rate = r1(row.cost / row.targetCost * 100); row.over = row.cost > row.targetCost;
  return row;
}
/** 실행예산 문서 목록(화면이 읽은 gihoek_budgets 문서들, 각각 id 포함) → Map(프로젝트 id → 실행예산). 깨진 문서와 문서 번호가 안의 프로젝트 번호와 다른 문서는 쓰지 않고 bad 로 알린다 */
export function parseBudgets(list) {
  const map = new Map(), bad = [];
  (Array.isArray(list) ? list : []).forEach((d) => { if (!isO(d) || typeof d.id !== 'string' || !d.id) return; const r = budgetFromDoc(d); if (r.ok && r.budget.pjtId === d.id) map.set(d.id, r.budget); else bad.push(d.id); });
  return { map, bad };
}
/** 견적이 있거나 실행예산이 있는 프로젝트만(둘 다 없으면 목표 원가를 모르는 행으로 목록을 채우지 않는다). budgets 는 parseBudgets 의 Map(없으면 지금과 같다) */
export function achievementRows(projects, estimates, settlements, cur, ym, budgets, badIds) {
  const list = Array.isArray(projects) ? projects.filter(isO) : []; const bm = budgets instanceof Map ? budgets : null; const bad = badIds instanceof Set ? badIds : Array.isArray(badIds) ? new Set(badIds) : null; const out = [];
  /* badIds = parseBudgets 가 걸러 낸(깨진) 실행예산 문서의 프로젝트 id — 그 프로젝트 행에 budgetBad 를 붙여 "실행예산 오류"가 어느 프로젝트인지 표에서 보이게 한다(표 위의 개수 알림만으로는 어느 프로젝트인지 모른다) */
  list.forEach((p) => { const r = achievementRow(p, estimates, settlements, cur, ym, bm && typeof p.id === 'string' ? bm.get(p.id) : undefined); if (bad && typeof p.id === 'string' && bad.has(p.id) && r.basis !== 'budget') r.budgetBad = true; if (r.status !== 'noest') out.push(r); }); return out;
}
/* ── 누적 마진율 병기(대표님 2026-10-22 "누적 병기") — 실제 테섭에서 월 마진율이 99.7%·100% 와 합계 −193.8% 사이를 오가는 것을 보고 정함: 원가(지급예정서 발행 월)와 매출(완결 월)의 시점이 어긋나면 한 달 값이 널뛰므로
 * "그 달까지 누계" 마진율을 같이 보여 준다. 누계 완결 = 완결(status done) 청구서 중 완결 시각(doneAt, 한국 시간)의 월이 그 달 이하인 것의 프로젝트 몫(월 마감 closingSummary 의 "완결"과 같은 기준)
 * · 누계 원가 = 그 달까지 발행한 지급예정서 + 서버 누계 현장경비 + 서버 누계 자체 직접노무비(원가 달성률의 실제 원가와 같은 정의, cur = 그 달까지 누계 응답) · 누적 마진율 = (누계 완결 − 누계 원가) ÷ 누계 완결(완결이 0 이하이면 null)
 * 원가를 모르면(연결 없음·서버 응답 없음) 마진율은 null — 지급 발행만으로 마진을 내면 부풀려진다. */
export function cumRow(p, settlements, cur, ym) {
  const x = isO(p) ? p : {}; const id = typeof x.id === 'string' ? x.id : ''; const pjt = linkedPjtId(x);
  const row = { id, pjt, code: typeof x.code === 'string' ? x.code : '', name: typeof x.name === 'string' ? x.name : '', status: 'ok', collected: 0, payIssued: 0, direct: null, ownLabor: null, cost: null, margin: null };
  const month = typeof ym === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(ym) ? ym : ''; const S = (Array.isArray(settlements) ? settlements : []).filter(isO);
  if (!month) { row.status = 'nocost'; return row; }
  row.collected = S.filter((s) => s.docType === 'invoice' && s.status === 'done' && settleBelongsToPjt(s, id)).filter((s) => { const m = monthOfTs(s.doneAt); return !!m && m <= month; }).reduce((a, s) => a + T(settleAmountForPjt(s, id)), 0);
  const set = S.filter((s) => { const d = typeof s.issueDate === 'string' && /^\d{4}-\d{2}/.test(s.issueDate) ? s.issueDate.slice(0, 7) : ''; return !d || d <= month; }); row.payIssued = T(pjtSummary(id, [], set).paid);
  if (!pjt) { row.status = 'nolink'; return row; }
  const e = marginExtra(cur, pjt); if (!e) { row.status = 'nocost'; return row; }
  row.direct = T(e.direct); row.ownLabor = T(e.ownLabor); row.cost = row.payIssued + row.direct + row.ownLabor;
  if (row.collected > 0) row.margin = r1((row.collected - row.cost) / row.collected * 100);
  return row;
}
/** 프로젝트마다 한 행(입력 순서 그대로) */
export function cumRows(projects, settlements, cur, ym) { return (Array.isArray(projects) ? projects.filter(isO) : []).map((p) => cumRow(p, settlements, cur, ym)); }
/** 합계 — 원가를 모르는 프로젝트가 하나라도 있으면 원가·마진율을 비운다(그 프로젝트의 완결만 분모에 들어가 마진이 부풀려진다) */
export function cumTotals(rows) {
  const l = Array.isArray(rows) ? rows.filter(isO) : []; const unknown = l.filter((r) => r.status !== 'ok').length; const collected = l.reduce((a, r) => a + T(r.collected), 0); const t = { collected, cost: null, margin: null, unknown };
  if (!unknown) { t.cost = l.reduce((a, r) => a + T(r.cost), 0); if (collected > 0) t.margin = r1((collected - t.cost) / collected * 100); }
  return t;
}
