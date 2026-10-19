/* 견적 산식 표 — 행을 추가해 가며 세부 내역(내역·단위·수량·단가·합계·비고)을 쌓고, 합계를 가산해 견적가를 만들어 총 대수로 나눈다. 순수 계산(화면·저장을 모른다). 시험: tests/estimate-calc.test.mjs
 * 원리(대표님 2026-10-19): 일위대가는 장비 1대에 들어가는 품이 기준이지만, 계산은 총 금액을 먼저 만든 뒤 총 대수로 나눠 대당 금액을 만든다. 견적가 = 소계에 가산율(기본 10%)을 더한 값. 할증은 건마다 달라 행에 직접 쓴다.
 *   행 합계 = 합계 칸이 비어 있으면 수량 × 단가, 적혀 있으면 그 값(고정) · 소계 = 행 합계의 합 · 견적가 = 내림(소계 × (1 + 가산율/100), 내림 단위) · 대당 금액 = 견적가 ÷ 총 대수
 * 셀은 숫자 또는 =수식(formula.js). 저장은 사용자가 쓴 글자 그대로(문자열)이고 열 때 다시 계산한다. 이 파일에는 단가·인원 같은 실제 값을 두지 않는다. 설계: 비공개 저장소 app-docs/estimate-tool-design.md */
import { evalCell } from './formula.js?v=20261019d';
import { itemSetAmount } from './estimates.js?v=20261019d';
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
  const rows = c.rows.map((r) => {
    if (rowBlank(r)) return { ok: true, blank: true, auto: true, total: 0 };
    const q = evalCell(r.qty), p = evalCell(r.price), t = evalCell(r.total);
    const bad = !q.ok ? '수량: ' + q.error : !p.ok ? '단가: ' + p.error : !t.ok ? '합계: ' + t.error : '';
    if (bad) return { ok: false, error: bad, auto: str(r.total).trim() === '', total: 0 };
    const auto = !!t.empty; const total = auto ? ((q.empty || p.empty) ? 0 : q.value * p.value) : t.value;
    if (!Number.isFinite(total) || Math.abs(total) > MAX) return { ok: false, error: '합계가 허용 한도를 넘습니다.', auto, total: 0 };
    return { ok: true, auto, total: Math.round(total * 1e6) / 1e6 };
  });
  const firstBad = rows.findIndex((x) => !x.ok);
  const mk = evalCell(c.markup), un = evalCell(c.unit), ct = evalCell(c.count);
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
