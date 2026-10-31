/* 실행예산(계획 원가) — 순수 계산(화면·저장을 모른다). 시험: tests/plan-budget.test.mjs · 설계: 비공개 저장소 app-docs/execution-budget-design.md (대기열 1-3-9).
 * 계획 = 비목별 행의 합(외주·자체 노무·현장경비·예비비, 비목 미배정 허용). 실적 = 마진 모듈의 원가 3가지(지급예정서 발행분·자체 직접 노무비·현장경비)로 호출한 쪽이 넣어 준다.
 * 예비비는 계획에만 있고 실적이 없다 — 총 계획(예비비 포함) 대비 잔액에 들어가고, 실적이 예비비 제외 계획을 넘으면 "예비비 사용 중", 총 계획을 넘으면 "초과".
 * 모르는 값은 숫자로 꾸미지 않고 이유 상태를 돌려준다: nobudget(실행예산 없음) · bad(저장된 값이 이상함) · nocost(실적을 모름 — 계획만 보여 준다).
 * 견적에서 가져오기: 프로젝트의 견적 묶음마다 폐기(void)가 아닌 마지막 개정본만 본다. 산식 표가 있고 금액이 견적가와 같은 항목의 소계(투입비)만 자동 합계에 넣고, 네고로 금액만 고친 항목·산식 표가 없는 항목·산식 표가 틀린 항목은 합계에서 빼고 따로 돌려준다(원가를 추측해 채우지 않는다).
 * 저장·개정(2단계): 프로젝트마다 문서 하나(gihoek_budgets/{영업기획 프로젝트 id} — 견적의 pjtId 와 같은 id)에 현재 개정과 이전 개정(history)을 함께 둔다. 처음 저장 = r1, 행이 바뀐 저장 = r2·r3…(이전 개정은 이력에 그대로), 행이 같으면 번호를 올리지 않는다. 이력 50개·문서 900KB 를 넘으면 옛 이력을 조용히 버리지 않고 거부한다. 입출력은 budget-io.js.
 * 이 파일에는 단가·금액 같은 실제 값을 두지 않는다. */
import { calcSheet, calcIsEmpty } from './estimate-calc.js?v=20261031h';
import { itemAmt } from './estimates.js?v=20261031h';
/** 비목 — 순서 고정. 예비비만 실적이 없는 칸 */
export const CATS = Object.freeze([
  Object.freeze({ key: 'sub', label: '외주' }),
  Object.freeze({ key: 'labor', label: '자체 노무' }),
  Object.freeze({ key: 'site', label: '현장경비' }),
  Object.freeze({ key: 'reserve', label: '예비비', noActual: true }),
]);
/** 저장 한도 — 문서가 부풀지 않게 */
export const LIMITS = Object.freeze({ rows: 200, name: 120, memo: 200 });
const MAX = 1e13; // 견적 저장 규칙(estimates.js)의 금액 한도와 같게
const KEYS = CATS.map((c) => c.key);
const isO = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (error) => ({ ok: false, error });
const r1 = (v) => Math.round(v * 10) / 10;
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
/** 금액 읽기 — 0 이상의 정수(원)만. 숫자 또는 쉼표가 든 숫자 글자. 그 밖(소수·음수·글자·전각 숫자·참거짓·배열·객체)은 null */
export function parseAmount(v) {
  if (typeof v === 'number') return Number.isSafeInteger(v) && v >= 0 && v <= MAX ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.replace(/,/g, '').trim();
  if (!/^[0-9]{1,14}$/.test(s)) return null;
  const n = Number(s); return n <= MAX ? n : null;
}
/** 저장용 정리 — 알려진 칸만 새 객체로 복사(알 수 없는 필드·__proto__ 제거), 완전히 빈 행은 버린다. 한 행이라도 틀리면 전체를 거부하고 가장 앞의 틀린 행을 알린다 */
export function sanitizeRows(rows) {
  if (!Array.isArray(rows)) return fail('실행예산 행 목록이 올바르지 않습니다.');
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]; const at = (i + 1) + '번 행: ';
    if (!isO(r)) return fail(at + '행 모양이 올바르지 않습니다.');
    const cat = r.cat === undefined || r.cat === null ? '' : r.cat;
    const name = r.name === undefined || r.name === null ? '' : r.name;
    const memo = r.memo === undefined || r.memo === null ? '' : r.memo;
    const amountMissing = r.amount === undefined || r.amount === null || (typeof r.amount === 'string' && r.amount.trim() === '');
    if (typeof name === 'string' && typeof memo === 'string' && name.trim() === '' && memo.trim() === '' && amountMissing) continue; // 내역·금액·메모가 모두 비면 빈 행(비목만 골라 둔 새 행 포함)
    if (typeof cat !== 'string' || (cat !== '' && !KEYS.includes(cat))) return fail(at + '비목을 확인해 주세요.');
    if (typeof name !== 'string' || name.trim().length > LIMITS.name) return fail(at + '내역은 ' + LIMITS.name + '자까지 글자로 입력해 주세요.');
    if (typeof memo !== 'string' || memo.trim().length > LIMITS.memo) return fail(at + '메모는 ' + LIMITS.memo + '자까지 글자로 입력해 주세요.');
    if (amountMissing) return fail(at + '금액을 입력해 주세요.');
    const amount = parseAmount(r.amount);
    if (amount === null) return fail(at + '금액은 0 이상의 정수(원)로 입력해 주세요(한도 1e13).');
    const src = r.src === undefined || r.src === null ? 'manual' : r.src;
    if (src !== 'manual' && src !== 'est') return fail(at + '출처를 확인해 주세요.');
    const row = { cat, name: name.trim(), amount, memo: memo.trim(), src };
    if (src === 'est' && typeof r.estNo === 'string' && r.estNo.trim()) row.estNo = r.estNo.trim().slice(0, 40);
    out.push(row);
    if (out.length > LIMITS.rows) return fail('실행예산 행은 ' + LIMITS.rows + '개까지입니다.');
  }
  return { ok: true, rows: out };
}
/** 비목별 합 — 정리된 행(sanitizeRows 결과)을 받는다. total = 전부(미배정·예비비 포함), planBase = 예비비 제외 */
export function budgetTotals(rows) {
  const t = { sub: 0, labor: 0, site: 0, reserve: 0, unassigned: 0, total: 0, planBase: 0 };
  (Array.isArray(rows) ? rows : []).forEach((r) => { if (!isO(r) || !fin(r.amount)) return; const k = KEYS.includes(r.cat) ? r.cat : 'unassigned'; t[k] += r.amount; t.total += r.amount; });
  t.planBase = t.total - t.reserve; return t;
}
/** 계획 대비 실적 — budget = { rows }, actual = { sub, labor, site }(숫자, 모르면 넣지 않는다). 입력을 바꾸지 않는다 */
export function budgetCompare(budget, actual) {
  const none = { state: 'nobudget', rows: [], total: null, unassigned: 0, warnUnassigned: false };
  if (!isO(budget) || !Array.isArray(budget.rows)) return none;
  const s = sanitizeRows(budget.rows); if (!s.ok) return Object.assign({}, none, { state: 'bad', error: s.error });
  const t = budgetTotals(s.rows); if (!(t.total > 0)) return none;
  const known = isO(actual) && ['sub', 'labor', 'site'].every((k) => fin(actual[k]));
  const rows = CATS.map((c) => {
    const plan = t[c.key];
    if (!known || c.noActual) return { cat: c.key, label: c.label, plan, actual: null, remain: null, rate: null, over: false };
    const a = actual[c.key];
    return { cat: c.key, label: c.label, plan, actual: a, remain: plan - a, rate: plan > 0 ? r1(a / plan * 100) : null, over: a > plan };
  });
  const base = { state: known ? 'ok' : 'nocost', rows, unassigned: t.unassigned, warnUnassigned: t.unassigned > 0 };
  if (!known) return Object.assign(base, { total: { plan: t.total, planBase: t.planBase, actual: null, remain: null, rate: null, over: false, usingReserve: false } });
  const a = actual.sub + actual.labor + actual.site; const over = a > t.total;
  return Object.assign(base, { total: { plan: t.total, planBase: t.planBase, actual: a, remain: t.total - a, rate: r1(a / t.total * 100), over, usingReserve: !over && a > t.planBase } });
}
/** 견적에서 가져오기 분석 — 프로젝트(pjtId)의 견적 묶음(기준 번호)마다 폐기가 아닌 마지막 개정본의 품목을 분류한다. 입력을 바꾸지 않는다 */
export function importFromEstimates(estimates, pjtId) {
  const empty = (state) => ({ state, groups: [], autoCost: 0, supply: 0, decisions: 0, multi: false });
  if (typeof pjtId !== 'string' || !pjtId) return empty('nopjt');
  const best = new Map();
  (Array.isArray(estimates) ? estimates : []).forEach((e) => {
    if (!isO(e) || e.pjtId !== pjtId || e.status === 'void') return;
    const base = String(e.baseNo || e.no || ''); const rev = fin(e.rev) ? e.rev : 1; const cur = best.get(base);
    if (!cur || rev > cur.rev) best.set(base, { e, rev });
  });
  const groups = [...best.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([baseNo, { e, rev }]) => {
    const items = (Array.isArray(e.items) ? e.items : []).filter(isO).map((it) => {
      const name = typeof it.name === 'string' ? it.name : ''; const amount = fin(Number(itemAmt(it))) ? Number(itemAmt(it)) : 0;
      if (!isO(it.calc) || calcIsEmpty(it.calc)) return { name, kind: 'nocalc', subtotal: null, price: null, amount };
      const res = calcSheet(it.calc);
      if (!res || res.ok !== true) return { name, kind: 'bad', subtotal: null, price: null, amount, error: String((res && res.error) || '산식 표를 계산할 수 없습니다.') };
      return { name, kind: Math.round(amount) === Math.round(res.price) ? 'calc' : 'differs', subtotal: res.subtotal, price: res.price, amount };
    });
    const autoCost = items.filter((x) => x.kind === 'calc').reduce((s, x) => s + x.subtotal, 0);
    return { baseNo, no: String(e.no || baseNo), rev, status: e.status === 'closed' ? 'closed' : 'active', supply: items.reduce((s, x) => s + x.amount, 0), items, autoCost, decisions: items.filter((x) => x.kind !== 'calc').length };
  });
  if (!groups.length) return empty('noest');
  return { state: 'ok', groups, autoCost: groups.reduce((s, g) => s + g.autoCost, 0), supply: groups.reduce((s, g) => s + g.supply, 0), decisions: groups.reduce((s, g) => s + g.decisions, 0), multi: groups.length > 1 };
}
/** 가져온 결과 → 초안 행 — 묶음마다 "견적 투입비" 한 줄(비목 미배정, 출처 est). 정해야 할 항목은 자동으로 채우지 않는다 */
export function draftRowsFromImport(res) {
  if (!isO(res) || !Array.isArray(res.groups)) return [];
  return res.groups.filter((g) => isO(g) && fin(g.autoCost) && g.autoCost > 0).map((g) => {
    const no = String(g.no || g.baseNo || '').slice(0, 40);
    return { cat: '', name: '견적 투입비 (' + no + ')', amount: Math.round(g.autoCost), memo: '', src: 'est', estNo: no };
  });
}

// ── 저장·개정 (2단계)
/** 저장 한도 — 이력 개수와 문서 크기(Firestore 문서 1MB 한도 안쪽) */
export const HISTORY_MAX = 50;
export const DOC_MAX_BYTES = 900000;
const NOTE_MAX = 200;
const strOrEmpty = (v) => (v === undefined || v === null ? '' : v);
/** 문서 번호 = 영업기획 프로젝트 id(견적의 pjtId 와 같다). Firestore 가 못 쓰는 값(빈 글자·'/'·'.'·'..'·__x__ 꼴·너무 긴 글자)이면 null */
export function budgetDocId(pjtId) {
  if (typeof pjtId !== 'string') return null;
  if (!pjtId || pjtId.trim() !== pjtId || pjtId.length > 100 || pjtId.includes('/') || pjtId === '.' || pjtId === '..' || /^__.*__$/.test(pjtId)) return null;
  return pjtId;
}
/** 저장 계획 — cur = 지금 저장된 실행예산(budgetFromDoc 결과, 없으면 null), rows = 새 행, o = { pjtId, note, now(저장 시각 글자), by(저장자) }. 시계를 스스로 읽지 않는다(순수). 입력을 바꾸지 않는다 */
export function buildBudgetSave(cur, rows, o) {
  if (!isO(o)) return fail('저장 정보가 올바르지 않습니다.');
  const id = budgetDocId(o.pjtId); if (!id) return fail('프로젝트를 확인해 주세요.');
  if (cur !== null && cur !== undefined && !(isO(cur) && Number.isInteger(cur.rev) && cur.rev >= 1 && Array.isArray(cur.rows) && Array.isArray(cur.history))) return fail('현재 저장된 실행예산이 올바르지 않습니다.');
  const s = sanitizeRows(rows); if (!s.ok) return s;
  if (!s.rows.length) return fail('저장할 실행예산 행이 없습니다.');
  if (!(budgetTotals(s.rows).total > 0)) return fail('실행예산 합계가 0 원입니다. 금액을 입력해 주세요.');
  const note = strOrEmpty(o.note); if (typeof note !== 'string' || note.trim().length > NOTE_MAX) return fail('메모는 ' + NOTE_MAX + '자까지 글자로 입력해 주세요.');
  if (typeof o.now !== 'string' || !o.now || o.now.length > 40) return fail('저장 시각을 확인할 수 없습니다.');
  const by = typeof o.by === 'string' ? o.by.slice(0, 80) : '';
  if (cur && JSON.stringify(cur.rows) === JSON.stringify(s.rows)) return { ok: true, unchanged: true, doc: cur, rev: cur.rev };
  const history = cur ? cur.history.concat([{ rev: cur.rev, rows: cur.rows, savedAt: cur.savedAt, note: cur.note, by: cur.by }]) : [];
  if (history.length > HISTORY_MAX) return fail('개정 이력이 ' + HISTORY_MAX + '개를 넘어 더 저장할 수 없습니다. 오래된 이력을 정리해야 합니다.');
  const doc = { pjtId: id, rev: (cur ? cur.rev : 0) + 1, rows: s.rows, note: note.trim(), savedAt: o.now, by, history };
  if (new TextEncoder().encode(JSON.stringify(doc)).length > DOC_MAX_BYTES) return fail('실행예산 문서가 너무 큽니다(900KB 초과). 행 수를 줄이거나 오래된 개정 이력을 정리해야 합니다.');
  return { ok: true, unchanged: false, doc, rev: doc.rev };
}
const metaOf = (x) => { const note = strOrEmpty(x.note), savedAt = strOrEmpty(x.savedAt), by = strOrEmpty(x.by); return typeof note === 'string' && typeof savedAt === 'string' && typeof by === 'string' && savedAt.length <= 40 ? { note, savedAt, by } : null; };
/** 저장된 문서(Firestore data) 읽기 — 알려진 칸만 새 객체로 복사(서버 시각 updatedAt·알 수 없는 필드·__proto__ 제거). 모양이 틀리면 거부(이상한 숫자로 화면을 그리지 않는다) */
export function budgetFromDoc(raw) {
  const bad = (what) => fail('저장된 실행예산이 올바르지 않습니다(' + what + ').');
  if (!isO(raw)) return bad('문서 모양');
  const pjtId = budgetDocId(raw.pjtId); if (!pjtId) return bad('프로젝트');
  if (!Number.isInteger(raw.rev) || raw.rev < 1) return bad('개정 번호');
  const s = sanitizeRows(raw.rows); if (!s.ok || !s.rows.length) return bad('행');
  const meta = metaOf(raw); if (!meta) return bad('메모·시각·저장자');
  const h = raw.history === undefined || raw.history === null ? [] : raw.history; if (!Array.isArray(h) || h.length > HISTORY_MAX) return bad('이력');
  const history = []; let prev = 0;
  for (const x of h) {
    if (!isO(x) || !Number.isInteger(x.rev) || x.rev <= prev || x.rev >= raw.rev) return bad('이력 번호');
    const hs = sanitizeRows(x.rows); if (!hs.ok || !hs.rows.length) return bad('이력 행'); const hm = metaOf(x); if (!hm) return bad('이력 메모·시각·저장자');
    history.push({ rev: x.rev, rows: hs.rows, savedAt: hm.savedAt, note: hm.note, by: hm.by }); prev = x.rev;
  }
  return { ok: true, budget: { pjtId, rev: raw.rev, rows: s.rows, note: meta.note, savedAt: meta.savedAt, by: meta.by, history } };
}
/** 개정 목록 — 최신이 위, 현재 개정 표시, 개정마다 행 수·합계(예비비·미배정 포함) */
export function revisionList(b) {
  if (!isO(b) || !Array.isArray(b.rows)) return [];
  const mk = (x, current) => ({ rev: x.rev, savedAt: typeof x.savedAt === 'string' ? x.savedAt : '', note: typeof x.note === 'string' ? x.note : '', by: typeof x.by === 'string' ? x.by : '', count: x.rows.length, total: budgetTotals(x.rows).total, current });
  const out = [mk(b, true)];
  (Array.isArray(b.history) ? b.history : []).slice().reverse().forEach((h) => { if (isO(h) && Array.isArray(h.rows)) out.push(mk(h, false)); });
  return out;
}
