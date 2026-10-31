/* 견적 산식 표 — 행을 추가해 가며 세부 내역(내역·단위·수량·단가·합계·비고)을 쌓고, 합계를 가산해 견적가를 만들어 총 대수로 나눈다. 순수 계산(화면·저장을 모른다). 시험: tests/estimate-calc.test.mjs
 * 원리(대표님 2026-10-19): 일위대가는 장비 1대에 들어가는 품이 기준이지만, 계산은 총 금액을 먼저 만든 뒤 총 대수로 나눠 대당 금액을 만든다. 견적가 = 소계에 가산율(기본 10%)을 더한 값. 할증은 건마다 달라 행에 직접 쓴다.
 *   행 합계 = 합계 칸이 비어 있으면 수량 × 단가, 적혀 있으면 그 값(고정) · 소계 = 행 합계의 합 · 견적가 = 내림(소계 × (1 + 가산율/100), 내림 단위) · 대당 금액 = 견적가 ÷ 총 대수
 * 셀은 숫자 또는 =수식(formula.js). 저장은 사용자가 쓴 글자 그대로(문자열)이고 열 때 다시 계산한다. 이 파일에는 단가·인원 같은 실제 값을 두지 않는다. 설계: 비공개 저장소 app-docs/estimate-tool-design.md */
import { evalCell } from './formula.js?v=20261031c';
/** 열 글자 — 표의 번호 열은 행 번호라서 글자가 없고, 내역부터 A. 글자 칸(A 내역·B 단위·F 비고)은 계산에 쓸 수 없고 C 수량·D 단가·E 합계만 숫자다 */
export const COL_LETTERS = 'ABCDEF';
const FIELD = { A: 'name', B: 'unit', C: 'qty', D: 'price', E: 'total', F: 'remark' }, NUMERIC = 'CDE';
import { itemSetAmount } from './estimates.js?v=20261031c';
/** 기본값 — 문자열(입력칸 값). 단가·인원 같은 실제 값은 없음 */
export const DEFAULTS = Object.freeze({ markup: '10', unit: '100000' });
/** 저장 한도 — 문서가 부풀지 않게 */
export const LIMITS = Object.freeze({ rows: 60, text: 120 });
const MAX = 1e13; // 견적 저장 규칙(estimates.js)의 금액 한도와 같게
const KEYS = ['name', 'unit', 'qty', 'price', 'total', 'remark'];
const fail = (error, extra) => Object.assign({ ok: false, error }, extra || {});
const str = (v) => (v === null || v === undefined ? '' : String(v));
export const newRow = () => ({ name: '', unit: '', qty: '', price: '', total: '', remark: '' });
export const newCalc = () => ({ rows: [newRow()], markup: DEFAULTS.markup, unit: DEFAULTS.unit, count: '' });
const rowBlank = (r) => !r || KEYS.every((k) => str(r[k]).trim() === '');
/** 칸 해석기 — 칸(예: D2)을 필요할 때 계산하고 기억한다. 자기 자신을 다시 부르면 순환 참조 오류. 합계(E)가 비어 있으면 수량(C) × 단가(D), 적혀 있으면 그 값(수식 가능) */
function makeGrid(c) {
  const rows = c.rows, memo = new Map(), visiting = new Set(); let ctx, evals = 0; const BUDGET = Math.max(rows.length, 1) * 3 * 4; // 정상이면 칸마다 한 번만 계산한다. 기억이 깨지거나 이상한 사슬이면 예산을 넘겨 브라우저가 멈추기 전에 오류로 끊는다
  function cell(col, r) {
    const key = col + r; if (memo.has(key)) return memo.get(key);
    if (++evals > BUDGET) return { ok: false, error: '수식이 너무 복잡합니다(같은 칸을 너무 많이 다시 계산합니다).' };
    if (visiting.has(key)) return { ok: false, error: '순환 참조입니다(칸이 서로를 가리킵니다).' };
    visiting.add(key); let res; const row = rows[r] || {};
    if (col === 'E' && str(row.total).trim() === '') {
      const q = cell('C', r), p = cell('D', r);
      res = !q.ok ? { ok: false, error: '수량 ' + q.error } : !p.ok ? { ok: false, error: '단가 ' + p.error } : { ok: true, auto: true, value: (q.empty || p.empty) ? 0 : q.value * p.value };
    } else { const e = evalCell(row[FIELD[col]], ctx); res = e.ok ? Object.assign({ auto: false }, e) : e; }
    visiting.delete(key); memo.set(key, res); return res;
  }
  ctx = { cols: COL_LETTERS, rowCount: rows.length, get: (col, row) => { if (!NUMERIC.includes(col)) return { ok: true, text: true }; const x = cell(col, row - 1); return x.ok ? { ok: true, value: x.empty ? 0 : x.value } : { ok: false, error: col + row + ' 칸에 오류: ' + x.error }; } };
  return { cell, ctx };
}
/** 행을 지울 때 수식의 칸 참조(E1·C2·E1:E3)를 맞춘다 — 지운 행 아래는 번호를 하나씩 당기고, 지운 행을 가리키던 칸은 #REF!(계산 때 "삭제된 칸" 오류). 안 맞추면 금액이 조용히 틀린다. 글자 칸(내역·단위·비고)의 "=…" 는 수식이 아니라 글자라 건드리지 않는다 */
const REF_RE = /(^|[^A-Za-z0-9#])([A-Fa-f])([0-9]{1,2})(?::([A-Fa-f])([0-9]{1,2}))?(?![A-Za-z0-9(])/g;
function shiftRefs(text, d) {
  if (typeof text !== 'string' || text.trim()[0] !== '=') return text;
  return text.replace(REF_RE, (m, pre, c1, n1, c2, n2) => {
    const a = parseInt(n1, 10);
    if (c2 === undefined) return a === d ? pre + '#REF!' : a > d ? pre + c1 + (a - 1) : m; // 번호가 바뀌지 않는 참조는 사용자가 쓴 글자 그대로(대소문자 포함)
    const b = parseInt(n2, 10), lo = Math.min(a, b), hi = Math.max(a, b); const nlo = lo > d ? lo - 1 : lo, nhi = hi >= d ? hi - 1 : hi;
    if ((lo === d && hi === d) || nhi < nlo) return pre + '#REF!';
    return nlo === lo && nhi === hi ? m : pre + c1 + nlo + ':' + c2 + nhi;
  });
}
/** 행 하나를 지운다(0부터). 수식의 칸 참조를 맞추고, 유일한 행이면 빈 행 1개를 남긴다 */
export function removeRow(c, r0) {
  if (!c || !Array.isArray(c.rows) || !c.rows[r0]) return c;
  c.rows.splice(r0, 1); const d = r0 + 1;
  c.rows.forEach((row) => { ['qty', 'price', 'total'].forEach((k) => { row[k] = shiftRefs(row[k], d); }); });
  ['markup', 'unit', 'count'].forEach((k) => { c[k] = shiftRefs(c[k], d); });
  if (!c.rows.length) c.rows.push(newRow());
  return c;
}
/** 아무 내역도 안 쓴 표인가 — 가산율·내림 단위만 바꾼 것은 내역이 아니다. 총 대수는 작업 중인 값이라 있으면 비어 있지 않다 */
export function calcIsEmpty(c) {
  if (!c || typeof c !== 'object' || !Array.isArray(c.rows)) return true;
  return c.rows.every(rowBlank) && str(c.count).trim() === '';
}
/** 저장용 정리 — 알려진 칸만 새 객체로 복사(알 수 없는 필드·__proto__ 제거), 문자열로 통일, 셀 글자 120자·행 60개 제한, 맨 끝 빈 행 제거. 비었거나 모양이 틀리면 null */
export function sanitizeCalc(c) {
  if (!c || typeof c !== 'object' || !Array.isArray(c.rows) || calcIsEmpty(c)) return null;
  let rows = c.rows.slice(0, LIMITS.rows).map((r) => { const o = {}; KEYS.forEach((k) => { o[k] = str(r && typeof r === 'object' ? r[k] : '').slice(0, LIMITS.text); }); return o; });
  while (rows.length && rowBlank(rows[rows.length - 1])) rows.pop();
  const out = { rows, markup: str(c.markup).slice(0, LIMITS.text), unit: str(c.unit).slice(0, LIMITS.text), count: str(c.count).slice(0, LIMITS.text) };
  return out;
}
/** 표 하나 계산. 한 행이라도 틀리면 ok:false(행마다 결과는 그대로 돌려줘 어느 행인지 보이게) */
export function calcSheet(c) {
  if (!c || typeof c !== 'object' || !Array.isArray(c.rows)) return fail('내역 표가 없습니다.');
  const g = makeGrid(c);
  const rows = c.rows.map((r, i) => {
    if (rowBlank(r)) return { ok: true, blank: true, auto: true, total: 0 };
    const q = g.cell('C', i), p = g.cell('D', i), t = g.cell('E', i);
    const bad = !q.ok ? '수량: ' + q.error : !p.ok ? '단가: ' + p.error : !t.ok ? '합계: ' + t.error : '';
    if (bad) return { ok: false, error: bad, auto: str(r.total).trim() === '', total: 0 };
    if (!Number.isFinite(t.value) || Math.abs(t.value) > MAX) return { ok: false, error: '합계가 허용 한도를 넘습니다.', auto: t.auto, total: 0 };
    return { ok: true, auto: t.auto, total: Math.round(t.value * 1e6) / 1e6 };
  });
  const firstBad = rows.findIndex((x) => !x.ok);
  const mk = evalCell(c.markup, g.ctx), un = evalCell(c.unit, g.ctx), ct = evalCell(c.count, g.ctx);
  if (firstBad >= 0) return fail((firstBad + 1) + '번 행: ' + rows[firstBad].error, { rows, badRow: firstBad });
  if (!mk.ok || mk.empty || !(mk.value >= 0)) return fail('가산율은 0 이상의 숫자로 입력해 주세요.', { rows });
  if (!un.ok || un.empty || !(un.value > 0)) return fail('내림 단위는 0 보다 커야 합니다.', { rows });
  const subtotal = Math.round(rows.reduce((s, x) => s + x.total, 0) * 1e6) / 1e6;
  if (!(subtotal > 0)) return fail('내역에 금액이 없습니다. 내역의 수량·단가(또는 합계)를 입력해 주세요.', { rows, subtotal });
  const gross = subtotal * (1 + mk.value / 100);
  if (!Number.isFinite(gross) || gross > MAX) return fail('합계가 허용 한도를 넘습니다. 입력을 확인해 주세요.', { rows, subtotal }); // 가산율 ≥ 0 이라 소계가 한도를 넘으면 여기서 반드시 걸린다
  const price = Math.floor(Math.round(gross * 1e6) / 1e6 / un.value) * un.value; // 6자리 반올림: 5600×1.1 같은 값이 6159.9999… 로 한 단위 내려가는 것을 막는다
  if (!(price > 0)) return fail('견적가가 0 이 됩니다. 내림 단위가 너무 큽니다(소계 대비 작게 줄여 주세요).', { rows, subtotal });
  if (!ct.ok || ct.empty || !(ct.value > 0)) return fail('총 장비 대수를 1 이상으로 입력해 주세요(대당 금액을 만들려면 대수가 필요합니다).', { rows, subtotal, gross, price });
  return { ok: true, rows, subtotal, gross, price, count: ct.value, perUnit: price / ct.value };
}
/** 계산 결과를 견적 항목에 넣는다 — 수량 = 총 대수, 금액 = 견적가(기존 "금액 우선" 규칙: 단가는 금액÷수량 반올림). 실패한 결과면 항목을 바꾸지 않고 null */
export function applyToItem(item, res) {
  if (!res || res.ok !== true || !item) return null;
  item.qty = res.count; return itemSetAmount(item, res.price);
}
