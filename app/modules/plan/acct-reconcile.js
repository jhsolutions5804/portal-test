/* 영업기획 → 재무회계 이관: 구포털 기획의 비용장부(gihoek_expenses)를 재무회계 전표(ledger_entries)와 대조한다 — 순수 규칙(화면·네트워크 없이 시험 가능).
 * 재무회계는 카드·통장·세금계산서를 가져와 전표를 이미 만들고 있어, 비용장부를 그대로 옮기면 같은 지출이 두 번 계상된다. 그래서 건마다 같은 날짜·금액의 전표가 있는지 먼저 확인하고,
 * 전표에 없는 건만 재무회계의 "전표 가져오기(JSON)" 형식으로 내려받게 한다(대표님이 확인 후 가져오기를 눌러야 반영). 프로젝트 표시는 전표에 아직 없어 대조표로 따로 내려받는다. */
import { csvCell } from '../../shared/csv.js?v=20261031d';
const T = (n) => Math.round(Number(n) || 0);
const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/\(.*?\)|주식회사|\(주\)|㈜|[\s.\-_·,]/g, '');
/** 두 이름이 비슷한 정도(0~1): 정규화한 글자열의 공통 부분(2글자 이상)이 짧은 쪽에서 차지하는 비율 */
export function similarity(a, b) {
  const x = norm(a), y = norm(b); if (!x || !y) return 0; if (x.includes(y) || y.includes(x)) return 1; const [s, l] = x.length <= y.length ? [x, y] : [y, x]; let best = 0;
  for (let i = 0; i < s.length; i++) for (let j = i + 2; j <= s.length; j++) { if (l.includes(s.slice(i, j))) best = Math.max(best, j - i); else break; }
  return best >= 2 ? best / s.length : 0;
}
const dayDiff = (a, b) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000);
const entryText = (e) => String(e.memo || '') + ' ' + (e.lines || []).map((l) => l.partner || '').join(' ');
export const NEAR_DAYS = 3;
/** 비용장부 건마다 상태를 정한다. 전표 한 건은 한 비용장부 건에만 짝지어진다(같은 날 같은 금액이 여러 건이어도 하나씩).
 *  matched: 같은 날짜·같은 금액(합계 또는 공급가액)의 전표 / near: 금액이 같고 ±3일 안이며 가맹점이 비슷 / dup: 같은 날·같은 금액의 전표가 이미 다른 비용장부 건과 짝지어져 남은 것이 없음(같은 지출을 두 번 적었거나 전표가 한 건 모자람) / missing: 전표에 없음.
 *  weak: 짝지어졌지만 가맹점 이름이 전표에서 보이지 않아 날짜·금액만 같은 경우 — 눈으로 확인할 것 */
export function reconcileExpenses(expenses, entries) {
  const byAmt = {}; (entries || []).forEach((e) => { const seen = new Set(); (e.lines || []).forEach((l) => { const a = T(l.amount); if (!a || seen.has(a)) return; seen.add(a); (byAmt[a] = byAmt[a] || []).push(e); }); });
  const used = new Set(); const rows = (expenses || []).map((x) => ({ x, status: 'missing', entry: null, score: 0 }));
  const order = rows.map((r, i) => i).sort((a, b) => String(rows[a].x.date || '').localeCompare(String(rows[b].x.date || '')));
  const pick = (r, test) => { const amts = [T(r.x.total), T(r.x.supply)].filter((v, i, a) => v && a.indexOf(v) === i); let best = null;
    amts.forEach((a) => (byAmt[a] || []).forEach((e) => { if (used.has(e.id || e._id || e.no) || !test(e)) return; const sc = similarity(r.x.vendor, entryText(e)); if (!best || sc > best.sc) best = { e, sc }; })); return best; };
  order.forEach((i) => { const r = rows[i]; const b = pick(r, (e) => e.date === r.x.date); if (b) { r.status = 'matched'; r.entry = b.e; r.score = b.sc; used.add(b.e.id || b.e._id || b.e.no); } });
  order.forEach((i) => { const r = rows[i]; if (r.status !== 'missing' || !/^\d{4}-\d{2}-\d{2}$/.test(String(r.x.date || ''))) return; const b = pick(r, (e) => e.date && Math.abs(dayDiff(e.date, r.x.date)) <= NEAR_DAYS && similarity(r.x.vendor, entryText(e)) >= 0.5); if (b) { r.status = 'near'; r.entry = b.e; r.score = b.sc; used.add(b.e.id || b.e._id || b.e.no); } });
  const sameDayAmt = (r) => (entries || []).find((e) => e.date === r.x.date && (e.lines || []).some((l) => T(l.amount) === T(r.x.total) || T(l.amount) === T(r.x.supply)));
  rows.forEach((r) => { if (r.status === 'missing') { const e = sameDayAmt(r); if (e) { r.status = 'dup'; r.entry = e; } } r.weak = (r.status === 'matched' || r.status === 'near') && r.score === 0; });
  return rows;
}
export function reconcileSummary(rows) {
  const c = (s) => rows.filter((r) => r.status === s).length;
  return { total: rows.length, matched: c('matched'), near: c('near'), dup: c('dup'), weak: rows.filter((r) => r.weak).length, missing: c('missing'), tagged: rows.filter((r) => String(r.x.pjt || '').trim()).length, taggedMatched: rows.filter((r) => String(r.x.pjt || '').trim() && (r.status === 'matched' || r.status === 'near')).length, amount: { missing: rows.filter((r) => r.status === 'missing').reduce((a, r) => a + T(r.x.total), 0) } };
}
export function filterRows(rows, f) { const o = f || {}; return rows.filter((r) => (!o.status || r.status === o.status) && (!o.month || String(r.x.date || '').startsWith(o.month)) && (!o.cat || r.x.cat === o.cat) && (!o.pay || r.x.pay === o.pay)); }
/** 비용장부 분류 → 재무회계 계정(차변), 결제수단 → 대변 계정·거래처. 급여는 급여명세서 가져오기로 들어오므로 옮기지 않는다(null) */
export const CAT_ACCOUNT = { '식대': ['6020', true], '공구·자재비': ['5010', true], '사무용품': ['6090', true], '유류비': ['6120', false], '기타': ['6190', true], '용역비': ['5210', true], '급여': [null, false] };
export const PAY_ACCOUNT = { '개인카드': ['2021', '농협카드(대표자)'], '법인카드': ['2020', 'IBK카드'], '외상거래': ['2020', ''], '계좌이체': ['1020', ''], '현금': ['1010', ''] };
/** 전표에 없는 비용장부 건 하나를 재무회계 전표 가져오기 형식으로(차변: 비용(공급가액)·매입세액(부가세), 대변: 결제수단). 계정을 알 수 없거나 금액이 맞지 않으면 null + 이유 */
export function expenseToEntry(x) {
  const cat = CAT_ACCOUNT[x.cat]; const pay = PAY_ACCOUNT[x.pay]; const total = T(x.total); let vat = T(x.vat); const vendor = String(x.vendor || '').trim();
  if (!cat || !cat[0]) return { entry: null, reason: x.cat === '급여' ? '급여는 급여명세서 가져오기로 들어옵니다' : '분류를 계정으로 옮길 수 없습니다(' + (x.cat || '없음') + ')' };
  if (!pay) return { entry: null, reason: '결제수단을 옮길 수 없습니다(' + (x.pay || '없음') + ')' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(x.date || ''))) return { entry: null, reason: '날짜가 없습니다' }; if (total <= 0) return { entry: null, reason: '금액이 없습니다' };
  if (!cat[1] || vat < 0 || vat >= total) vat = 0; const supply = total - vat; const pjt = String(x.pjt || '').trim().slice(0, 128);
  const lines = [{ account: cat[0], side: 'D', amount: supply, partner: vendor.slice(0, 40), pjt }]; if (vat > 0) lines.push({ account: '1130', side: 'D', amount: vat, partner: vendor.slice(0, 40) }); lines.push({ account: pay[0], side: 'C', amount: total, partner: pay[1] });
  return { entry: { date: x.date, memo: (vendor + (x.note ? ' · ' + String(x.note).trim() : '') + ' [비용장부 이관]').slice(0, 200), source: { kind: 'manual' }, needsReview: true, lines }, reason: '' };
}
/** 전표에 없는 건을 가져오기 JSON 으로. opt.excludeCredit(기본 true): 외상거래는 매입 세금계산서로 이미 들어왔을 가능성이 커 제외, opt.includeDup(기본 false): 중복 의심 건도 포함 */
export function missingToJson(rows, opt) {
  const o = Object.assign({ excludeCredit: true, includeDup: false }, opt || {}); const entries = [], skipped = [];
  rows.filter((r) => r.status === 'dup' && !o.includeDup).forEach((r) => skipped.push({ x: r.x, reason: '같은 날·같은 금액 전표가 이미 다른 건과 짝지어짐(중복 입력 가능성)' }));
  rows.filter((r) => r.status === 'missing' || (r.status === 'dup' && o.includeDup)).forEach((r) => { if (o.excludeCredit && r.x.pay === '외상거래') { skipped.push({ x: r.x, reason: '외상거래(매입 세금계산서로 들어왔을 수 있음)' }); return; } const c = expenseToEntry(r.x); if (c.entry) entries.push(c.entry); else skipped.push({ x: r.x, reason: c.reason }); });
  return { entries, skipped, json: JSON.stringify({ entries }, null, 2) };
}
const q = csvCell;
/** 프로젝트 표시가 있는 비용장부 건과 짝지어진 전표 번호의 대조표(CSV, 엑셀 BOM): 재무회계가 전표에 프로젝트 표시를 지원할 때 이어받기 위한 자료 */
export function tagTableCsv(rows, projects) {
  const P = projects || []; const name = (id) => { const p = P.find((x) => x.id === id); return p ? p.code : id; };
  const head = ['날짜', '가맹점', '분류', '금액', '프로젝트(비용장부)', '프로젝트 코드', '상태', '전표 번호']; const body = rows.filter((r) => String(r.x.pjt || '').trim()).map((r) => [r.x.date, r.x.vendor, r.x.cat, T(r.x.total), r.x.pjt, name(r.x.pjt), r.status === 'matched' ? '일치' : r.status === 'near' ? '날짜 어긋남' : r.status === 'dup' ? '중복 의심' : '없음', r.entry ? r.entry.no || '' : '']);
  return '\ufeff' + [head].concat(body).map((r) => r.map(q).join(',')).join('\r\n') + '\r\n';
}
