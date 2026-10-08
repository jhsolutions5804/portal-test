/* 홈택스 전자(세금)계산서 목록 엑셀 → 표준 형태 + 전표 초안. 양식 이름이 조금 달라도 읽도록 머리글을 글자 포함 여부로 찾는다.
 * 매출(내가 공급자)·매입(내가 공급받는자) 모두. 승인번호가 같은 건은 한 번만 가져온다(중복 방지). */
import { validateEntry, suggestPurchaseAccount } from './ledger-engine.js?v=20261008g';
const squash = (s) => String(s == null ? '' : s).replace(/[\s\u00a0]/g, '');
const HEAD = { writeDate: ['작성일자', '작성일'], issueDate: ['발급일자', '발급일'], approvalNo: ['승인번호'], supBiz: ['공급자사업자등록번호', '공급자등록번호'], supName: ['공급자상호', '공급자회사'], buyBiz: ['공급받는자사업자등록번호', '공급받는자등록번호'], buyName: ['공급받는자상호', '공급받는자회사'], total: ['합계금액'], supply: ['공급가액'], tax: ['세액'], cls: ['전자세금계산서분류', '세금계산서분류'], kind: ['전자세금계산서종류', '세금계산서종류'], memo: ['비고'] };
const num = (v) => { if (typeof v === 'number') return Math.round(v); const s = squash(v).replace(/[,원]/g, ''); if (s === '' || s === '-') return 0; const n = Number(s.replace(/^\((.*)\)$/, '-$1')); return isNaN(n) ? NaN : Math.round(n); };
const dateOf = (v) => { if (typeof v === 'number' && v > 20000 && v < 80000) { return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10); } const s = squash(v).replace(/[./]/g, '-'); const m = /^(\d{4})-?(\d{1,2})-?(\d{1,2})/.exec(s); return m ? m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0') : ''; };
export const bizDigits = (s) => String(s || '').replace(/\D/g, '');
/** rows(2차원 배열) → { invoices, skipped, owner, summary, check }. 홈택스 실제 양식: 위쪽에 내 사업자 정보·총합계 줄, 머리글에 '상호'·'대표자명'이 공급자/공급받는자 순서로 두 번 나온다 */
export function parseTaxInvoiceRows(rows) {
  let hi = -1, map = {}, sBiz = -1, bBiz = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cand = {}; const byName = {}; (rows[i] || []).forEach((h, c) => { const k = squash(h); if (!k) return; (byName[k] || (byName[k] = [])).push(c); for (const [key, names] of Object.entries(HEAD)) if (cand[key] === undefined && names.some((n) => k === n || k.startsWith(n))) cand[key] = c; });
    const sb = (byName['공급자사업자등록번호'] || [])[0], bb = (byName['공급받는자사업자등록번호'] || [])[0];
    if (cand.approvalNo !== undefined && (cand.total !== undefined || cand.supply !== undefined) && (cand.writeDate !== undefined || cand.issueDate !== undefined)) {
      hi = i; map = cand; sBiz = sb === undefined ? -1 : sb; bBiz = bb === undefined ? -1 : bb;
      // 이름이 같은 열(상호·대표자명): 공급자 사업자번호 뒤 첫 번째는 공급자, 공급받는자 사업자번호 뒤 첫 번째는 공급받는자
      const after = (name, from, to) => { const cols = byName[name] || []; return cols.find((c) => c > from && (to < 0 || c < to)); };
      if (sBiz >= 0 && bBiz >= 0) { if (map.supName === undefined) map.supName = after('상호', sBiz, bBiz); if (map.buyName === undefined) map.buyName = after('상호', bBiz, -1); map.supCeo = after('대표자명', sBiz, bBiz); map.buyCeo = after('대표자명', bBiz, -1); }
      if (sBiz >= 0) map.supBiz = sBiz; if (bBiz >= 0) map.buyBiz = bBiz; const item = (byName['품목명'] || [])[0]; if (item !== undefined) map.item = item;
      break;
    }
  }
  if (hi < 0) return { invoices: [], skipped: [], error: '홈택스 세금계산서 목록 엑셀로 보이지 않습니다. (승인번호·작성일자·합계금액 머리글을 찾지 못했습니다)' };
  // 위쪽 안내 줄: 내 사업자 정보, 총 합계(가져온 합계와 맞는지 확인용)
  const owner = {}; let summary = null;
  for (let i = 0; i < hi; i++) { const r = rows[i] || []; for (let c = 0; c < r.length - 1; c++) { const k = squash(r[c]); if (k === '사업자등록번호') owner.biz = bizDigits(r[c + 1]); else if (k === '상호') owner.name = String(r[c + 1] || '').trim(); else if (k === '대표자명') owner.ceo = String(r[c + 1] || '').trim(); else if (k === '총합계금액') { summary = summary || {}; summary.total = num(r[c + 1]); } else if (k === '총공급가액') { summary = summary || {}; summary.supply = num(r[c + 1]); } else if (k === '총세액') { summary = summary || {}; summary.tax = num(r[c + 1]); } } }
  const invoices = [], skipped = []; const seen = new Set();
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []; if (r.every((x) => x === '' || x == null)) continue; const g = (k) => (map[k] === undefined ? '' : r[map[k]]);
    const approvalNo = squash(g('approvalNo')); if (!approvalNo || /합계|소계/.test(squash(r[0]))) { if (approvalNo || squash(r[0])) skipped.push({ row: i + 1, reason: '합계/빈 승인번호 줄' }); continue; }
    const supply = num(g('supply')), tax = num(g('tax')), total = map.total !== undefined && g('total') !== '' ? num(g('total')) : supply + tax;
    if ([supply, tax, total].some((x) => isNaN(x))) { skipped.push({ row: i + 1, reason: '금액을 읽지 못함' }); continue; }
    const date = dateOf(g('writeDate')) || dateOf(g('issueDate')); if (!date) { skipped.push({ row: i + 1, reason: '작성일자를 읽지 못함' }); continue; }
    if (seen.has(approvalNo)) { skipped.push({ row: i + 1, reason: '같은 파일 안에서 승인번호 중복' }); continue; } seen.add(approvalNo);
    const cls = squash(g('cls')), kind = squash(g('kind'));
    invoices.push({ approvalNo, date, issueDate: dateOf(g('issueDate')), supplier: { biz: bizDigits(g('supBiz')), name: String(g('supName') || '').trim(), ceo: String(map.supCeo === undefined ? '' : r[map.supCeo] || '').trim() }, buyer: { biz: bizDigits(g('buyBiz')), name: String(g('buyName') || '').trim(), ceo: String(map.buyCeo === undefined ? '' : r[map.buyCeo] || '').trim() }, supply, vat: tax, total, taxFree: (/계산서/.test(cls) && !/세금/.test(cls)) || (tax === 0 && /면세/.test(cls)), amended: /수정/.test(kind) || total < 0 || supply < 0, memo: String(g('memo') || '').trim(), item: String(map.item === undefined ? '' : r[map.item] || '').trim() });
  }
  const sum = (k) => invoices.reduce((s, x) => s + x[k], 0); const check = summary ? { ok: (summary.total == null || summary.total === sum('total')) && (summary.supply == null || summary.supply === sum('supply')) && (summary.tax == null || summary.tax === sum('vat')), expected: summary, got: { total: sum('total'), supply: sum('supply'), tax: sum('vat') } } : null;
  return { invoices, skipped, owner: owner.biz ? owner : null, summary, check };
}
/** 내 사업자등록번호와 공급자/공급받는자가 맞는지 — 다른 회사(예: 제이에이치이엔지) 자료를 잘못 올리는 것을 막는다 */
export function checkOwnership(inv, dir, ownBiz) { const own = bizDigits(ownBiz); if (!own) return { ok: true, note: '내 사업자등록번호가 설정되지 않아 확인하지 못했습니다.' }; const party = dir === 'sales' ? inv.supplier.biz : inv.buyer.biz; return party === own ? { ok: true } : { ok: false, note: (dir === 'sales' ? '공급자' : '공급받는자') + ' 사업자번호(' + party + ')가 내 사업자번호와 다릅니다.' }; }
const sugRev = (inv) => suggestPurchaseAccount(inv).needsReview;
const swap = (lines) => lines.map((l) => ({ ...l, side: l.side === 'D' ? 'C' : 'D' }));
/** 세금계산서 1건 → 전표 초안. 수정(음수) 건은 차대를 뒤집어 같은 금액의 반대 전표로. 매입은 계정을 호출한 쪽이 정한다(기본 공사자재비, 검토 필요 표시) */
export function entryFromTaxInvoice(inv, dir, opt) {
  const neg = inv.total < 0 || inv.supply < 0; const sup = Math.abs(inv.supply), vat = Math.abs(inv.vat), tot = Math.abs(inv.total || inv.supply + inv.vat); let lines;
  if (dir === 'sales') { lines = [{ account: '1100', side: 'D', amount: tot, partner: inv.buyer.name, biz: inv.buyer.biz }, { account: (opt && opt.revenueAccount) || '4010', side: 'C', amount: sup, partner: inv.buyer.name }]; if (vat) lines.push({ account: '2040', side: 'C', amount: vat }); }
  else { const sg = (opt && opt.account) ? { account: opt.account, needsReview: false } : suggestPurchaseAccount(inv); const acc = sg.account; lines = [{ account: acc, side: 'D', amount: sup, partner: inv.supplier.name, biz: inv.supplier.biz }]; if (vat) lines.push({ account: '1130', side: 'D', amount: vat }); lines.push({ account: '2010', side: 'C', amount: tot, partner: inv.supplier.name, biz: inv.supplier.biz }); }
  if (neg) lines = swap(lines);
  const e = { date: inv.date, memo: (dir === 'sales' ? '매출 ' : '매입 ') + (dir === 'sales' ? inv.buyer.name : inv.supplier.name) + (inv.item ? ' · ' + inv.item : '') + (inv.amended ? ' (수정)' : ''), source: { kind: dir === 'sales' ? 'taxinv_sales' : 'taxinv_purchase', id: inv.approvalNo }, needsReview: dir !== 'sales' && (!(opt && opt.account) && (sugRev(inv))), lines };
  const v = validateEntry(e); return v.ok ? e : { ...e, invalid: v.errors };
}
/** 통합 문서(여러 시트)에서 세금계산서 목록 시트를 찾아 변환 — 홈택스는 '세금계산서'·'품목' 두 시트를 준다 */
export function parseTaxInvoiceWorkbook(wb) { let last = null; for (const sh of (wb && wb.sheets) || []) { const r = parseTaxInvoiceRows(sh.rows); if (!r.error) return { ...r, sheet: sh.name }; last = r; } return last || { invoices: [], skipped: [], error: '시트를 찾지 못했습니다.' }; }
