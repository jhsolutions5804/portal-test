import { ACCOUNTS, ACCOUNT_BY_CODE, validateEntry, totals, trialBalance, incomeStatement, constructionCost, balanceSheet, openingEntry, suggestPurchaseAccount } from '../../shared/ledger-engine.js?v=20261008a';
import { checkOwnership, entryFromTaxInvoice } from '../../shared/hometax-import.js?v=20261008a';
import { entryFromBank, classificationReport } from '../../shared/bank-classify.js?v=20261008a';
import { entryFromCard, classifyCardItem, setMerchantRules } from '../../shared/card-classify.js?v=20261008a';
import { merchantKey } from '../../shared/merchant-table.js?v=20261008a';

/* 재무회계 화면의 순수 규칙 — 전표 목록 거르기·재무제표 계산·가져오기 미리보기·개시 재산 목록. 화면·네트워크 없이 시험한다(tests/finance.test.mjs). */
export const SOURCE_LABEL = { opening: '개시', invoice: '청구 정산서', payment: '지급예정서', payment_paid: '지급', expense: '비용 장부', taxinv_sales: '홈택스 매출', taxinv_purchase: '홈택스 매입', owner_settle: '대표자 정산', bank: '통장', card: '카드', payslip: '급여', accrual: '결산 정리', prepaid: '선급금 대체', manual: '수기' };
export const sourceLabel = (k) => SOURCE_LABEL[k] || k || '수기';
export const won = (n) => { const v = Math.round(Number(n) || 0); return (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('ko-KR'); };
export const accountName = (code) => (ACCOUNT_BY_CODE[code] ? ACCOUNT_BY_CODE[code].name : code);
export const kstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

/** Firestore 문서 → 화면용 전표 */
export function docToEntry(id, d) { return { id, no: d.no || '', seq: d.seq || 0, date: d.date || '', memo: d.memo || '', source: d.source || { kind: 'manual' }, lines: (d.lines || []).map((l) => ({ account: l.account, side: l.side, amount: l.amount, partner: l.partner || '', pjt: l.pjt || '' })), status: d.status || 'posted', reverses: d.reverses || '', reversesNo: d.reversesNo || '', reversedBy: d.reversedBy || '', reversedByNo: d.reversedByNo || '', createdByName: d.createdByName || '', createdMs: d.createdAt && d.createdAt.seconds ? d.createdAt.seconds * 1000 : 0, needsReview: !!d.needsReview }; }
export const entryDebit = (e) => (e.lines || []).reduce((s, l) => s + (l.side === 'D' ? l.amount : 0), 0);
export function summarize(entries) { const by = {}; let review = 0, d = 0, c = 0, from = '', to = ''; (entries || []).forEach((e) => { const k = (e.source && e.source.kind) || 'manual'; by[k] = (by[k] || 0) + 1; if (e.needsReview) review++; (e.lines || []).forEach((l) => { if (l.side === 'D') d += l.amount; else c += l.amount; }); if (!from || e.date < from) from = e.date; if (!to || e.date > to) to = e.date; }); return { count: (entries || []).length, review, by, debit: d, credit: c, balanced: d === c, from, to }; }
/** 목록 거르기: 기간(from~to)·원천·확인 필요·검색어(메모·거래처·계정·전표번호) */
export function filterEntries(entries, f) {
  const q = String((f && f.q) || '').trim().toLowerCase();
  return (entries || []).filter((e) => (!f.from || e.date >= f.from) && (!f.to || e.date <= f.to) && (!f.source || (e.source && e.source.kind) === f.source) && (!f.review || e.needsReview) && (!q || (e.memo + ' ' + e.no + ' ' + e.lines.map((l) => (l.partner || '') + ' ' + accountName(l.account)).join(' ')).toLowerCase().includes(q))).sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : (b.seq || 0) - (a.seq || 0)));
}
export const monthEnd = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
export const yearOf = (d) => String(d || kstToday()).slice(0, 4);

/** 재무제표 4종 계산(엔진 그대로) — 기간 from~to, 재무상태표는 to 기준 */
export function statements(entries, from, to) { const E = (entries || []).filter((e) => !e.invalid); return { is: incomeStatement(E, from, to), cc: constructionCost(E, from, to), bs: balanceSheet(E, to, from), tb: trialBalance(E, to), from, to }; }
export function statementCsv(st, kind) {
  const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; const L = [];
  if (kind === 'is') { const s = st.is; L.push(['구분', '계정', '금액']); s.revenue.forEach((r) => L.push(['매출', r.name, r.amount])); L.push(['', '매출액', s.sales]); st.cc.groups.forEach((g) => { g.items.forEach((r) => L.push([g.label, r.name, r.amount])); L.push([g.label, '소계', g.subtotal]); }); L.push(['', '매출원가(당기총공사비)', s.costOfSales], ['', '매출총이익', s.grossProfit]); s.sga.forEach((r) => L.push(['판관비', r.name, r.amount])); L.push(['', '판관비 합계', s.sgaTotal], ['', '영업이익', s.operatingIncome]); s.nonopRevenue.forEach((r) => L.push(['영업외수익', r.name, r.amount])); s.nonopExpense.forEach((r) => L.push(['영업외비용', r.name, r.amount])); L.push(['', '당기순이익(세무조정 전)', s.netIncome]); }
  else if (kind === 'bs') { const b = st.bs; L.push(['구분', '계정', '금액']); b.assets.forEach((r) => L.push(['자산', r.name, r.amount])); L.push(['', '자산 총계', b.assetsTotal]); b.liabs.forEach((r) => L.push(['부채', r.name, r.amount])); L.push(['', '부채 총계', b.liabsTotal]); b.equity.forEach((r) => L.push(['자본', r.name, r.amount])); L.push(['', '자본 총계', b.equityTotal], ['', '검산(자산−부채−자본)', b.diff]); }
  else { L.push(['계정코드', '계정과목', '차변 합계', '대변 합계', '잔액(차변)', '잔액(대변)']); st.tb.rows.forEach((r) => L.push([r.code, r.name, r.debit, r.credit, r.balDebit, r.balCredit])); L.push(['', '합계', st.tb.totals.debit, st.tb.totals.credit, st.tb.totals.balDebit, st.tb.totals.balCredit]); }
  return '\uFEFF' + L.map((r) => r.map(q).join(',')).join('\r\n');
}

/* ───────── 개시(기초) 재산 목록 ───────── */
export const OPENING_FIELDS = [
  { code: '1020', label: '보통예금(사업용 통장 잔액)', side: 'A' }, { code: '1010', label: '현금', side: 'A' }, { code: '1100', label: '받을 돈(외상매출금)', side: 'A' }, { code: '1110', label: '미수금', side: 'A' }, { code: '1120', label: '선급금', side: 'A' }, { code: '1200', label: '재고자산(남은 자재)', side: 'A' }, { code: '1500', label: '차량운반구(취득가)', side: 'A' }, { code: '1510', label: '비품(취득가)', side: 'A' }, { code: '1590', label: '감가상각누계액(차감)', side: 'A' },
  { code: '2010', label: '갚을 돈(외상매입금)', side: 'L' }, { code: '2020', label: '미지급금(급여·카드사 등)', side: 'L' }, { code: '2021', label: '미지급금(대표자 개인카드)', side: 'L' }, { code: '2030', label: '예수금(4대보험·원천세)', side: 'L' }, { code: '2050', label: '선수금', side: 'L' }, { code: '2100', label: '단기차입금', side: 'L' }, { code: '2200', label: '장기차입금', side: 'L' }, { code: '2210', label: '차량할부금', side: 'L' }
];
/** 입력값({코드: 금액}) → 개시 전표(자본금은 차액). 숫자가 아닌 입력은 오류로 알린다 */
export function openingFromForm(date, values) {
  const errors = []; const A = [], Lb = [];
  OPENING_FIELDS.forEach((f) => { const raw = String((values && values[f.code]) == null ? '' : values[f.code]).replace(/[,\s원]/g, ''); if (raw === '') return; const n = Number(raw); if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) { errors.push(f.label + ': 0 이상의 정수(원)로 입력해 주세요.'); return; } if (n) (f.side === 'A' ? A : Lb).push({ account: f.code, amount: n }); });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) errors.push('개시 일자를 확인해 주세요.'); if (!A.length && !Lb.length) errors.push('입력된 항목이 없습니다.');
  if (errors.length) return { errors };
  const e = openingEntry(date, A, Lb, '개시(기초) 재무상태표 — 재산 목록 입력'); const v = validateEntry(e); if (!v.ok) return { errors: v.errors };
  const cap = e.lines.find((l) => l.account === '3010' || l.account === '3020'); return { entry: e, equity: cap ? (cap.account === '3010' ? cap.amount : -cap.amount) : 0 };
}

/* ───────── 가져오기 미리보기 ───────── */
function hashKey(str) { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); }
export const safeId = (s) => { const t = String(s); const clean = t.replace(/[^A-Za-z0-9_.\-]/g, '_'); return t.length <= 100 && clean === t ? t : clean.slice(0, 100) + '~' + hashKey(t); };   /* 서버(ledger-act.js)와 같은 값 */
/** 서버(ledger-act)가 정하는 전표 문서 ID — 이미 올린 건인지 화면에서도 미리 알기 위해 같은 규칙을 쓴다 */
export function entryDocId(e) { const src = e.source || {}; const kind = src.kind || 'manual'; if (kind === 'opening') return 'opening__' + e.date; return kind !== 'manual' && src.id ? safeId(kind + '__' + src.id) : ''; }
export const postPayload = (e) => ({ date: e.date, memo: String(e.memo || '').slice(0, 200), needsReview: !!e.needsReview, source: { kind: (e.source && e.source.kind) || 'manual', id: String((e.source && e.source.id) || '').slice(0, 150) }, lines: e.lines.map((l) => { const o = { account: l.account, side: l.side, amount: l.amount }; if (l.partner) o.partner = String(l.partner).slice(0, 60); if (l.pjt) o.pjt = String(l.pjt).slice(0, 128); if (l.biz) o.biz = String(l.biz).replace(/\D/g, '').slice(0, 20); return o; }) });
export const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const splitNew = (list, existing) => { const have = existing || new Set(); const fresh = [], dup = []; list.forEach((e) => { const id = entryDocId(e); (id && have.has(id) ? dup : fresh).push(e); }); return { fresh, dup }; };

/** 홈택스 세금계산서 미리보기 — 소유 확인(내 사업자번호)·중복·매입 계정 후보 */
export function previewTaxInvoices(parsed, dir, ownBiz, existing, acctBySupplier) {
  const rows = [], warnings = []; const own = String(ownBiz || '').replace(/\D/g, '');
  (parsed.invoices || []).forEach((inv) => {
    const chk = checkOwnership(inv, dir, own); const supKey = inv.supplier.biz || inv.supplier.name; const override = acctBySupplier && acctBySupplier[supKey]; const sg = dir === 'purchase' ? suggestPurchaseAccount(inv) : null;
    const e = entryFromTaxInvoice(inv, dir, override ? { account: override } : (dir === 'purchase' ? { account: sg.account } : undefined)); if (dir === 'purchase') e.needsReview = !override && sg.needsReview;
    rows.push({ inv, entry: e, ownerOk: chk.ok, ownerNote: chk.note || '', account: dir === 'purchase' ? (override || sg.account) : '4010', supKey });
  });
  const okRows = rows.filter((r) => r.ownerOk && !r.entry.invalid); const { fresh, dup } = splitNew(okRows.map((r) => r.entry), existing); rows.forEach((r) => { r.dup = !!(existing && existing.has(entryDocId(r.entry))); });
  if (rows.some((r) => !r.ownerOk)) warnings.push('내 사업자번호와 맞지 않는 ' + rows.filter((r) => !r.ownerOk).length + '건은 제외했습니다(다른 회사 발행분일 수 있음).');
  if (parsed.check && !parsed.check.ok) warnings.push('파일의 총 합계와 변환한 합계가 다릅니다 — 파일을 확인해 주세요.');
  if (!own) warnings.push('설정에 내 사업자번호가 없어 소유 확인을 하지 못했습니다.');
  return { rows, fresh, dup, dupCount: dup.length, warnings, sum: okRows.reduce((s, r) => s + Math.abs(r.inv.total), 0), supply: okRows.reduce((s, r) => s + Math.abs(r.inv.supply), 0) };
}
/** 통장 거래 미리보기 — 분류 현황(자동·확인·미정)과 전표 초안 */
export function previewBank(txns, ctx, existing) {
  const list = []; const unclassified = []; (txns || []).forEach((t) => { const e = entryFromBank(t, null, ctx); if (e && !e.invalid) list.push(e); else unclassified.push(t); });
  const { fresh, dup } = splitNew(list, existing); const rep = classificationReport(txns || [], ctx);
  return { fresh, dup, dupCount: dup.length, unclassified, report: rep, count: (txns || []).length };
}
/** 카드 이용 미리보기 — 가맹점 규칙 적용, 취소 제외, 가맹점별 묶음 */
export function previewCards(items, rules, existing) {
  setMerchantRules(rules || []); const list = [], skipped = []; const groups = new Map();
  (items || []).forEach((c) => { if (c.cancelled) { skipped.push(c); return; } const e = entryFromCard(c); if (!e) return; if (e.invalid) { skipped.push(c); return; } list.push(e); const k = c.issuer + '|' + merchantKey(c.merchant); const cl = classifyCardItem(c); const g = groups.get(k) || { issuer: c.issuer, key: merchantKey(c.merchant), name: c.merchant, n: 0, sum: 0, account: cl.account, review: cl.review }; g.n++; g.sum += c.amount; groups.set(k, g); });
  const seen = {}; list.forEach((e) => { const k = e.source.id; seen[k] = (seen[k] || 0) + 1; if (seen[k] > 1) e.source.id = k + '#' + seen[k]; });   /* 같은 날 같은 금액을 같은 가맹점에서 여러 번 결제한 건(승인번호가 없는 카드)은 번호를 붙여 서로 다른 전표로 */
  const { fresh, dup } = splitNew(list, existing); return { fresh, dup, dupCount: dup.length, skipped, groups: [...groups.values()].sort((a, b) => b.sum - a.sum), total: (items || []).reduce((s, c) => s + (c.cancelled ? 0 : c.amount), 0) };
}
/** 전표 묶음(JSON) 검사 — 계정·차대·금액 */
export function parseEntriesJson(text) {
  let data; try { data = JSON.parse(String(text || '').replace(/^\uFEFF/, '')); } catch (e) { return { entries: [], errors: ['JSON 형식이 아닙니다.'] }; }
  const arr = Array.isArray(data) ? data : (data && data.entries); if (!Array.isArray(arr)) return { entries: [], errors: ['전표 목록(entries)을 찾지 못했습니다.'] };
  const entries = [], errors = []; arr.forEach((e, i) => { const v = validateEntry(e); if (!v.ok) { errors.push((i + 1) + '번째 전표: ' + v.errors[0]); return; } entries.push({ date: e.date, memo: e.memo || '', source: e.source || { kind: 'manual' }, needsReview: !!e.needsReview, lines: e.lines }); });
  return { entries, errors };
}
/** 수기 전표 입력값 검사 */
export function manualEntry(date, memo, lines) { const L = (lines || []).filter((l) => l.account || l.amount).map((l) => ({ account: String(l.account || ''), side: l.side === 'C' ? 'C' : 'D', amount: Number(String(l.amount == null ? '' : l.amount).replace(/[,\s원]/g, '')), partner: String(l.partner || '').trim() })); const e = { date, memo: String(memo || '').trim(), source: { kind: 'manual' }, lines: L }; const v = validateEntry(e); return { entry: e, ok: v.ok, errors: v.errors, debit: v.debit, credit: v.credit }; }
export { ACCOUNTS, ACCOUNT_BY_CODE };
