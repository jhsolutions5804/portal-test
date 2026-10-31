import { ACCOUNTS, ACCOUNT_BY_CODE, validateEntry, totals, trialBalance, incomeStatement, constructionCost, balanceSheet, openingEntry, suggestPurchaseAccount, cashFlowStatement } from '../../shared/ledger-engine.js?v=20261031c';
import { checkOwnership, entryFromTaxInvoice } from '../../shared/hometax-import.js?v=20261031c';
import { entryFromBank, classificationReport } from '../../shared/bank-classify.js?v=20261031c';
import { entryFromCard, classifyCardItem, setMerchantRules } from '../../shared/card-classify.js?v=20261031c';
import { entryFromPortalPayslip } from '../../shared/payroll-import.js?v=20261031c';
import { merchantKey, parseMerchantTable, CHOICES, CHOICE_ACCOUNT } from '../../shared/merchant-table.js?v=20261031c';
import { docFileName } from '../../shared/doc-filename.js?v=20261031c';
import { csvCell, csvCellMin } from '../../shared/csv.js?v=20261031c';

/* 재무회계 화면의 순수 규칙 — 전표 목록 거르기·재무제표 계산·가져오기 미리보기·개시 재산 목록. 화면·네트워크 없이 시험한다(tests/finance.test.mjs). */
export const SOURCE_LABEL = { opening: '개시', invoice: '청구 정산서', payment: '지급예정서', payment_paid: '지급', expense: '비용 입력', taxinv_sales: '홈택스 매출', taxinv_purchase: '홈택스 매입', owner_settle: '대표자 정산', bank: '통장', card: '카드', payslip: '급여', accrual: '결산 정리', prepaid: '선급금 대체', manual: '수기' };
export const sourceLabel = (k) => SOURCE_LABEL[k] || k || '수기';
export const won = (n) => { const v = Math.round(Number(n) || 0); return (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('ko-KR'); };
export const accountName = (code) => (ACCOUNT_BY_CODE[code] ? ACCOUNT_BY_CODE[code].name : code);
export const kstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

/** Firestore 문서 → 화면용 전표 */
export function docToEntry(id, d) { return { id, no: d.no || '', seq: d.seq || 0, date: d.date || '', memo: d.memo || '', source: d.source || { kind: 'manual' }, lines: (d.lines || []).map((l) => ({ account: l.account, side: l.side, amount: l.amount, partner: l.partner || '', pjt: l.pjt || '' })), status: d.status || 'posted', reverses: d.reverses || '', reversesNo: d.reversesNo || '', reversedBy: d.reversedBy || '', reversedByNo: d.reversedByNo || '', createdByName: d.createdByName || '', createdMs: d.createdAt && d.createdAt.seconds ? d.createdAt.seconds * 1000 : 0, needsReview: !!d.needsReview, reviewNote: d.reviewNote || '', assignee: d.assignee || '', reviewedByName: d.reviewedByName || '', reviewedMs: d.reviewedAt && d.reviewedAt.seconds ? d.reviewedAt.seconds * 1000 : 0, replaces: d.replaces || '', replacesNo: d.replacesNo || '', attachments: (d.attachments || []).map((a) => ({ id: a.id, name: a.name, mime: a.mime, size: a.size, byName: a.byName || '', atMs: a.atMs || 0 })) }; }
export const entryDebit = (e) => (e.lines || []).reduce((s, l) => s + (l.side === 'D' ? l.amount : 0), 0);
/* 개인 지출(인출금) 누계 — 개인사업자라서 개인 지출은 지출 항목 "개인 지출(인출금)"으로 3020 에 잡는다(5xxx·6xxx 가 아니라 판관비·프로젝트 마진에 들어가지 않는다). 카드는 섞어서 쓰므로 카드가 아니라 항목 단위로 정한다.
 * 인출금 순액 = 차변(개인 지출·인출) − 대변(대표님이 회사로 되돌린 금액). 개인카드 미지급 잔액 = 2021(미지급금·대표자 개인카드) 대변 − 차변 — 회사 일을 개인카드로 쓴 것이라 인출금과 합치지 않는다.
 * 월별·누계에는 역분개 쌍을 그대로 합산(상쇄)하고, 최근 항목에서는 역분개 쌍을 숨긴다. 순수 함수(저장·호출 없음). */
export function ownerDraws(entries, opts) {
  const o = opts && typeof opts === 'object' ? opts : {}; const today = typeof o.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.today) ? o.today : new Date().toISOString().slice(0, 10);
  const year = Number(today.slice(0, 4)); const cur = today.slice(0, 7); const amt = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
  const months = []; { let y = Number(cur.slice(0, 4)), m = Number(cur.slice(5, 7)); for (let i = 0; i < 6; i++) { months.unshift({ month: y + '-' + String(m).padStart(2, '0'), amount: 0 }); m--; if (m === 0) { m = 12; y--; } } }
  const byMonth = {}; months.forEach((x) => { byMonth[x.month] = x; });
  let yearTotal = 0, allTotal = 0, cardPayable = 0; const draws = [];
  (Array.isArray(entries) ? entries : []).forEach((e) => {
    if (!e || typeof e !== 'object' || e.status !== 'posted' || typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || !Array.isArray(e.lines)) return;
    const hidden = !!e.reverses || !!e.reversedBy;
    e.lines.forEach((l) => {
      if (!l || typeof l !== 'object') return; const a = amt(l.amount); if (!a || (l.side !== 'D' && l.side !== 'C')) return;
      if (String(l.account) === '2021') { cardPayable += l.side === 'C' ? a : -a; return; }
      if (String(l.account) !== '3020') return;
      const sg = l.side === 'D' ? a : -a; allTotal += sg; if (e.date.slice(0, 4) === String(year)) yearTotal += sg;
      const mo = byMonth[e.date.slice(0, 7)]; if (mo) mo.amount += sg;
      if (l.side === 'D' && !hidden) draws.push({ date: e.date, memo: String(e.memo || ''), amount: a, seq: Number(e.seq) || 0 });
    });
  });
  draws.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : y.seq - x.seq));
  return { year, yearTotal, allTotal, months, recent: draws.slice(0, 5).map((x) => ({ date: x.date, memo: x.memo, amount: x.amount })), cardPayable };
}
export function summarize(entries) { const by = {}; let review = 0, d = 0, c = 0, from = '', to = ''; (entries || []).forEach((e) => { const k = (e.source && e.source.kind) || 'manual'; by[k] = (by[k] || 0) + 1; if (e.needsReview) review++; (e.lines || []).forEach((l) => { if (l.side === 'D') d += l.amount; else c += l.amount; }); if (!from || e.date < from) from = e.date; if (!to || e.date > to) to = e.date; }); return { count: (entries || []).length, review, by, debit: d, credit: c, balanced: d === c, from, to }; }
/** 목록 거르기: 기간(from~to)·원천·확인 필요·검색어(메모·거래처·계정·전표번호) */
export function filterEntries(entries, f) {
  const q = String((f && f.q) || '').trim().toLowerCase();
  return (entries || []).filter((e) => (!f.from || e.date >= f.from) && (!f.to || e.date <= f.to) && (!f.source || (e.source && e.source.kind) === f.source) && (!f.review || e.needsReview) && (!f.reviewed || (!e.needsReview && !!e.reviewedByName)) && (!f.assignee || (f.assignee === '__none' ? (e.needsReview && !e.assignee) : e.assignee === f.assignee)) && (!q || (e.memo + ' ' + e.no + ' ' + (e.assignee || '') + ' ' + e.lines.map((l) => (l.partner || '') + ' ' + accountName(l.account)).join(' ')).toLowerCase().includes(q))).sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : (b.seq || 0) - (a.seq || 0)));
}
/** 확인 필요 전표에 붙은 담당자 이름 목록(가나다) */
export const assigneeList = (entries) => [...new Set((entries || []).filter((e) => e.assignee).map((e) => e.assignee))].sort();
export const monthEnd = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
export const yearOf = (d) => String(d || kstToday()).slice(0, 4);

/** 재무제표 4종 계산(엔진 그대로) — 기간 from~to, 재무상태표는 to 기준 */
export function statements(entries, from, to) { const E = (entries || []).filter((e) => !e.invalid); return { is: incomeStatement(E, from, to), cc: constructionCost(E, from, to), bs: balanceSheet(E, to, from), tb: trialBalance(E, to), cf: cashFlowStatement(E, from, to), from, to }; }
export function statementCsv(st, kind) {
  const q = csvCell; const L = [];
  if (kind === 'is') { const s = st.is; L.push(['구분', '계정', '금액']); s.revenue.forEach((r) => L.push(['매출', r.name, r.amount])); L.push(['', '매출액', s.sales]); st.cc.groups.forEach((g) => { g.items.forEach((r) => L.push([g.label, r.name, r.amount])); L.push([g.label, '소계', g.subtotal]); }); L.push(['', '매출원가(당기총공사비)', s.costOfSales], ['', '매출총이익', s.grossProfit]); s.sga.forEach((r) => L.push(['판관비', r.name, r.amount])); L.push(['', '판관비 합계', s.sgaTotal], ['', '영업이익', s.operatingIncome]); s.nonopRevenue.forEach((r) => L.push(['영업외수익', r.name, r.amount])); s.nonopExpense.forEach((r) => L.push(['영업외비용', r.name, r.amount])); L.push(['', '당기순이익(세무조정 전)', s.netIncome]); }
  else if (kind === 'cf') { const c = st.cf; L.push(['구분', '항목', '금액']); L.push(['', '기초 현금', c.beginCash]); c.operating.forEach((r) => L.push(['영업활동', r.name, r.amount])); L.push(['', '영업활동 현금흐름', c.operatingTotal]); c.investing.forEach((r) => L.push(['투자활동', r.name, r.amount])); L.push(['', '투자활동 현금흐름', c.investingTotal]); c.financing.forEach((r) => L.push(['재무활동', r.name, r.amount])); L.push(['', '재무활동 현금흐름', c.financingTotal], ['', '현금 증감', c.change], ['', '기말 현금', c.endCash], ['', '검산(재무상태표 현금과의 차이)', c.diff]); }
  else if (kind === 'bs') { const b = st.bs; L.push(['구분', '계정', '금액']); b.assets.forEach((r) => L.push(['자산', r.name, r.amount])); L.push(['', '자산 총계', b.assetsTotal]); b.liabs.forEach((r) => L.push(['부채', r.name, r.amount])); L.push(['', '부채 총계', b.liabsTotal]); b.equity.forEach((r) => L.push(['자본', r.name, r.amount])); L.push(['', '자본 총계', b.equityTotal], ['', '검산(자산−부채−자본)', b.diff]); }
  else { L.push(['계정코드', '계정과목', '차변 합계', '대변 합계', '잔액(차변)', '잔액(대변)']); st.tb.rows.forEach((r) => L.push([r.code, r.name, r.debit, r.credit, r.balDebit, r.balCredit])); L.push(['', '합계', st.tb.totals.debit, st.tb.totals.credit, st.tb.totals.balDebit, st.tb.totals.balCredit]); }
  return '\uFEFF' + L.map((r) => r.map(q).join(',')).join('\r\n');
}

/* ───────── 개시(기초) 재산 목록 ───────── */
export const OPENING_FIELDS = [
  { code: '1020', label: '보통예금(사업용 통장 잔액)', side: 'A' }, { code: '1010', label: '현금', side: 'A' }, { code: '1100', label: '받을 돈(외상매출금)', side: 'A' }, { code: '1110', label: '미수금', side: 'A' }, { code: '1120', label: '선급금', side: 'A' }, { code: '1200', label: '재고자산(남은 자재)', side: 'A' }, { code: '1500', label: '차량운반구(취득가)', side: 'A' }, { code: '1510', label: '비품(취득가)', side: 'A' }, { code: '1590', label: '감가상각누계액(차감)', side: 'A' }, { code: '1610', label: '임차보증금(창고·사무실 보증금)', side: 'A' },
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
export function entryDocId(e) { const src = e.source || {}; const kind = src.kind || 'manual'; if (kind === 'opening') return 'opening__' + e.date + (/^rev\w+$/.test(String(src.id || '')) ? '__' + String(src.id).slice(0, 40) : ''); return kind !== 'manual' && src.id ? safeId(kind + '__' + src.id) : ''; }
export const postPayload = (e) => ({ date: e.date, memo: String(e.memo || '').slice(0, 200), needsReview: !!e.needsReview, source: { kind: (e.source && e.source.kind) || 'manual', id: String((e.source && e.source.id) || '').slice(0, 150) }, lines: e.lines.map((l) => { const o = { account: l.account, side: l.side, amount: l.amount }; if (l.partner) o.partner = String(l.partner).slice(0, 60); if (l.pjt) o.pjt = String(l.pjt).slice(0, 128); if (l.biz) o.biz = String(l.biz).replace(/\D/g, '').slice(0, 20); return o; }) });
export const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const splitNew = (list, existing) => { const have = existing || new Set(); const fresh = [], dup = []; list.forEach((e) => { const id = entryDocId(e); (id && have.has(id) ? dup : fresh).push(e); }); return { fresh, dup }; };

/** 홈택스 세금계산서 미리보기 — 소유 확인(내 사업자번호)·중복·매입 계정 후보 */
export function previewTaxInvoices(parsed, dir, ownBiz, existing, acctBySupplier, purchaseRules) {
  const rows = [], warnings = []; const own = String(ownBiz || '').replace(/\D/g, '');
  (parsed.invoices || []).forEach((inv) => {
    const chk = checkOwnership(inv, dir, own); const supKey = inv.supplier.biz || inv.supplier.name; const rl = purchaseRuleFor(inv, purchaseRules); const override = (acctBySupplier && acctBySupplier[supKey]) || (rl && rl.account); const sg = dir === 'purchase' ? suggestPurchaseAccount(inv) : null;
    const e = entryFromTaxInvoice(inv, dir, override ? { account: override } : (dir === 'purchase' ? { account: sg.account } : undefined)); if (dir === 'purchase') e.needsReview = !override && sg.needsReview;
    rows.push({ inv, entry: e, ruleHit: !!(rl && !(acctBySupplier && acctBySupplier[supKey])), ownerOk: chk.ok, ownerNote: chk.note || '', account: dir === 'purchase' ? (override || sg.account) : '4010', supKey });
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
/** 포털 급여명세서(서버가 읽어 온 해당 월 문서) 미리보기 — 직원별 전표 초안·합계·중복·"다른 경로로 이미 올린 급여" 막기 */
export function previewPayroll(res, existing, entries) {
  const ym = res.month; const rows = []; const PAYK = ['pension', 'health', 'ltcare', 'employ', 'incomeTax', 'localTax'];
  (res.payslips || []).forEach((p) => { const e = entryFromPortalPayslip(p, p.workerId); rows.push({ p, entry: e, ok: !e.invalid, why: e.invalid ? e.invalid[0] : '', ded: PAYK.reduce((s, k) => s + (Number(p[k]) || 0), 0), site: !e.invalid && e.lines[0].account === '5110' }); });
  const good = rows.filter((r) => r.ok); const { fresh, dup } = splitNew(good.map((r) => r.entry), existing);
  const ids = new Set(good.map((r) => entryDocId(r.entry))); const other = (entries || []).filter((e) => e.source && e.source.kind === 'payslip' && String(e.date).slice(0, 7) === ym && !ids.has(e.id));
  const warnings = []; if (!rows.length) warnings.push(ym + ' 급여명세서가 없습니다(근로자 ' + (res.workers || 0) + '명 중 0명). 인사에서 급여명세서를 먼저 저장했는지 확인해 주세요.');
  if (rows.some((r) => !r.ok)) warnings.push('총지급 ≠ 공제 + 기숙사비 + 실지급인 ' + rows.filter((r) => !r.ok).length + '건은 제외했습니다(금액 확인 필요).');
  if (other.length) warnings.push(ym + ' 급여 전표가 이미 ' + other.length + '건 있습니다(엑셀·묶음 파일 등 다른 경로). 이중으로 잡히는 것을 막기 위해 가져오지 않습니다. 바꾸려면 그 전표를 역분개한 뒤 다시 가져오세요.');
  const sum = (k) => good.reduce((s, r) => s + (Number(r.p[k]) || 0), 0);
  return { rows, fresh: other.length ? [] : fresh, dup, dupCount: dup.length, conflict: other.length, warnings, totals: { gross: sum('grossPay'), ded: good.reduce((s, r) => s + r.ded, 0), dorm: sum('dormitory'), net: sum('netPay') }, month: ym };
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
/* ───────── 비용 입력(영수증·현금 지출을 손으로) ───────── */
export const EXPENSE_CATS = [['식대(업무·직원)', '6020'], ['현장 식대(야간조 등)', '5350'], ['거래처 접대·선물', '6040'], ['소모품·사무용품', '6090'], ['현장 소모품·안전용품', '5340'], ['자재·공구', '5010'], ['외주·용역', '5210'], ['차량 유류·정비', '6120'], ['통신비', '6050'], ['보험료', '6110'], ['임차료·관리비(사무)', '6060'], ['현장 창고·숙소', '5380'], ['지급수수료', '6100'], ['기부금', '8030'], ['기타 현장경비', '5390'], ['기타 판관비', '6190'], ['개인 지출(인출금)', '3020']];
/** [키, 이름, 대변 계정, 거래처 표시] — 카드는 이용 시점에 미지급금으로 쌓고 카드 대금 이체 때 정리 */
export const PAY_METHODS = [['ibk', 'IBK(기업은행) 회사카드', '2020', 'IBK카드'], ['nh', '농협 개인카드(대표님)', '2021', '농협카드(대표자)'], ['card', '현대·삼성 등 다른 카드', '2020', '카드'], ['cash', '현금', '1010', ''], ['bank', '사업용 통장 이체', '1020', ''], ['credit', '외상·미지급(나중에 지급)', '2020', ''], ['owner', '대표님 개인 돈', '2021', '대표자']];
export const EVIDENCE = ['카드전표', '세금계산서', '현금영수증', '간이영수증', '증빙 없음'];
/** 부가세 공제를 기본으로 켜 두면 안 되는 구분(접대·기부·개인·승용차 유류) */
export const NO_VAT_CATS = ['6040', '8030', '3020', '6120'];
const intOf = (v) => { const s = String(v == null ? '' : v).replace(/[,\s원]/g, ''); return s === '' ? NaN : Number(s); };
/** 비용 입력 양식 → 전표(차 비용 + 부가세대급금 / 대 결제수단). 부가세 공제를 켜지 않으면 부가세를 비용에 포함 */
export function expenseEntryFromForm(f, now) {
  const errors = []; const cat = EXPENSE_CATS.find((c) => c[1] === f.account); const pay = PAY_METHODS.find((p) => p[0] === f.pay); const total = intOf(f.total); const vatRaw = intOf(f.vat); const what = String(f.what || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date || '')) errors.push('일자를 입력해 주세요.'); if (!what) errors.push('가맹점·내용을 입력해 주세요.'); if (!cat) errors.push('구분을 골라 주세요.'); if (!pay) errors.push('결제수단을 골라 주세요.');
  if (!Number.isInteger(total) || total <= 0) errors.push('금액은 1원 이상의 정수로 입력해 주세요.');
  const deduct = !!f.deduct && f.account !== '3020' && f.account !== '8030' && f.account !== '6040'; let vat = deduct && Number.isFinite(vatRaw) ? vatRaw : 0;
  if (deduct && vatRaw === vatRaw && (!Number.isInteger(vatRaw) || vatRaw < 0)) errors.push('부가세는 0 이상의 정수로 입력해 주세요.'); if (Number.isInteger(total) && vat >= total) errors.push('부가세가 금액보다 작아야 합니다.');
  if (errors.length) return { errors, ok: false };
  const supply = total - vat; const pjt = String(f.pjt || '').trim().slice(0, 128); const partnerSide = (f.partner || '').trim() || pay[3] || ''; const stamp = (now || Date.now()).toString(36) + Math.random().toString(36).slice(2, 7);
  const lines = [{ account: cat[1], side: 'D', amount: supply, partner: what.slice(0, 40), pjt }]; if (vat > 0) lines.push({ account: '1130', side: 'D', amount: vat, partner: what.slice(0, 40) }); lines.push({ account: pay[2], side: 'C', amount: total, partner: partnerSide });
  const memo = what + (f.evidence ? ' [' + f.evidence + ']' : '') + (f.receiptId ? ' [영수증 첨부]' : '') + (f.memo ? ' · ' + String(f.memo).trim() : '');
  const entry = { date: f.date, memo: memo.slice(0, 200), source: { kind: 'expense', id: f.receiptId ? 'rc_' + String(f.receiptId).replace(/[^A-Za-z0-9]/g, '').slice(0, 40) : 'in_' + f.date + '_' + stamp }, needsReview: f.evidence === '증빙 없음' || f.evidence === '간이영수증', lines };
  const v = validateEntry(entry); return v.ok ? { entry, ok: true, errors: [], supply, vat, total } : { ok: false, errors: v.errors };
}
/* ───────── 영수증 사진·PDF ───────── */
export const RECEIPT_MAX = 7 * 1024 * 1024; export const RECEIPT_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
/** 올리기 전 검사 — 문제가 있으면 안내 문구, 없으면 '' */
export function receiptFileProblem(f) { if (!f) return '파일이 없습니다.'; const mime = f.type || ''; const okType = RECEIPT_MIME.includes(mime) || (!mime && /\.(jpe?g|png|webp|gif|pdf)$/i.test(f.name || '')); if (!okType) return (f.name || '파일') + ': 사진(JPG·PNG·WEBP) 또는 PDF만 올릴 수 있습니다.'; if (f.size > RECEIPT_MAX * 6) return (f.name || '파일') + ': 파일이 너무 큽니다(최대 약 40MB).'; if (mime === 'application/pdf' && f.size > RECEIPT_MAX) return f.name + ': PDF가 7MB를 넘습니다. 쪽 수를 줄이거나 해상도를 낮춰 다시 만들어 주세요.'; return ''; }
const EV_BY_TYPE = { 카드전표: '카드전표', 현금영수증: '현금영수증', 간이영수증: '간이영수증', 세금계산서: '세금계산서', 기타: '증빙 없음' };
/** 서버가 읽어 준 값 → 비용 입력 양식 값(사람이 확인·수정하기 전의 초안) */
export function receiptToForm(ex) {
  const e = ex || {}; const pay = e.payment === '현금' ? 'cash' : (e.payment === '카드' ? 'ibk' : 'card'); const deduct = !!e.vat && ['카드전표', '현금영수증', '세금계산서'].includes(e.docType) && !['6040', '8030', '3020', '6120'].includes(e.category);
  const items = (e.items || []).filter((i) => i.name).map((i) => i.name); const what = [e.merchant, items.length ? items.slice(0, 2).join('·') + (items.length > 2 ? ' 외' : '') : ''].filter(Boolean).join(' — ');
  return { date: e.date || '', what: what.slice(0, 60), account: e.category || '6190', pay, total: e.total ? Number(e.total).toLocaleString('ko-KR') : '', vat: e.vat ? Number(e.vat).toLocaleString('ko-KR') : '', deduct, evidence: EV_BY_TYPE[e.docType] || '증빙 없음', cardNote: e.cardLast4 ? '카드 끝 4자리 ' + e.cardLast4 + ' — 결제수단이 맞는지 확인하세요.' : '' };
}
/* ───────── 가맹점 분류표 내려받기(CSV)·CSV 읽기 ───────── */
const CARD_CODE_LABEL = { nonghyup: '농협', ibk_sales: 'IBK', ibk_approval: 'IBK', samsung: '삼성', hyundai: '현대' };
export const MERCHANT_TABLE_HEADER = ['번호', '가맹점', '카드', '건수', '결제금액', '처음', '마지막', '추정', '', '대표님 분류', '메모', '카드사 코드', '가맹점 키'];
/** 카드 미리보기의 가맹점 묶음(groups) → 분류표 행들. 분류가 필요한 곳(확인 표시)만, 금액이 큰 순. 안내 2줄 + 머리글 + 데이터 */
export function merchantTableRows(groups) {
  const need = (groups || []).filter((g) => g.review); const rows = [['가맹점 분류표'], ['"대표님 분류" 칸에 아래 보기 중 하나를 그대로 적어 주세요(모르면 "모름" 또는 빈 칸): ' + CHOICES.map((c) => c[0]).join(' / ')], MERCHANT_TABLE_HEADER.slice()];
  need.forEach((g, i) => rows.push([i + 1, g.name, CARD_CODE_LABEL[g.issuer] || g.issuer, g.n, g.sum, '', '', ACCOUNT_BY_CODE[g.account] ? ACCOUNT_BY_CODE[g.account].name : '', '', '', '', g.issuer, g.key]));
  return rows;
}
const csvQ = csvCellMin; // 필요할 때만 큰따옴표 + 수식 시작 글자 보호(가맹점 이름은 은행·카드 거래에서 들어오는 외부 값 — 대기열 1-2-11). 분류표는 다시 읽는 입력이기도 해서 파일 모양은 그대로 둔다
/** 엑셀에서 한글이 깨지지 않도록 앞에 BOM 을 붙인 CSV 문자열 */
export const merchantTableCsv = (groups) => '\ufeff' + merchantTableRows(groups).map((r) => r.map(csvQ).join(',')).join('\r\n') + '\r\n';
/** CSV 문자열 → 행 배열(따옴표·쉼표·줄바꿈·BOM 처리) */
export function parseCsvRows(text) {
  const s = String(text || '').replace(/^\ufeff/, ''); const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < s.length; i++) { const c = s[i]; if (q) { if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; } else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += c; }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); } return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
}

/* ───────── 규칙 관리(가맹점·매입 거래처) ───────── */
const bizOf = (v) => String(v || '').replace(/\D/g, '');
/** 매입 거래처 규칙 키: 사업자번호(10자리)가 있으면 그것, 없으면 상호 */
export const purchaseKey = (inv) => (bizOf(inv.supplier && inv.supplier.biz).length === 10 ? bizOf(inv.supplier.biz) : String((inv.supplier && inv.supplier.name) || '').replace(/\(주\)|주식회사|\s/g, '').slice(0, 30));
export function purchaseRuleFor(inv, rules) { if (!rules || !rules.length) return null; const k = purchaseKey(inv); const nm = String((inv.supplier && inv.supplier.name) || '').replace(/\s/g, ''); return rules.find((r) => r.key === k) || rules.find((r) => r.key && !/^\d+$/.test(r.key) && nm.includes(r.key)) || null; }
/** 새 규칙 목록 합치기(같은 키는 새 값으로 덮어씀) */
export function mergeRules(old, incoming, keyOf) { const m = new Map((old || []).map((r) => [keyOf(r), r])); (incoming || []).forEach((r) => m.set(keyOf(r), r)); return [...m.values()]; }
export const merchantRuleKey = (r) => r.issuer + '|' + r.key;
export const CARD_LABEL = { nonghyup: '농협(개인)', ibk_sales: 'IBK', ibk_approval: 'IBK 승인', samsung: '삼성', hyundai: '현대' };
/** 채운 가맹점 분류표(엑셀 행들)에서 규칙을 읽어 저장 목록과 합친 결과·변경 요약을 만든다 */
export function applyMerchantTable(sheetsRows, existing) {
  let incoming = [], filled = 0, unknown = [], badIssuer = []; (sheetsRows || []).forEach((rows) => { const r = parseMerchantTable(rows); if (r.error) return; incoming = incoming.concat(r.rules); filled += r.filled; unknown = unknown.concat(r.unknown || []); badIssuer = badIssuer.concat(r.badIssuer || []); });
  if (!incoming.length && !filled) return { error: '가맹점 분류표(대표님 분류 칸)를 찾지 못했습니다. 내려받은 분류표 파일이 맞는지 확인해 주세요.' };
  const cur = new Map((existing || []).map((r) => [merchantRuleKey(r), r])); let added = 0, changed = 0, same = 0; incoming.forEach((r) => { const o = cur.get(merchantRuleKey(r)); if (!o) added++; else if (o.account !== r.account) changed++; else same++; });
  return { rules: mergeRules(existing, incoming.map((r) => ({ issuer: r.issuer, key: r.key, account: r.account, label: r.label, memo: r.memo })), merchantRuleKey), incoming: incoming.length, filled, added, changed, same, unknown: [...new Set(unknown)], badIssuer }; }
/* ───────── 재분류(계정 바꾸기) ───────── */
/** 계정별 원장 — 기간 앞의 잔액(기초)에서 시작해 그 계정이 들어간 전표 줄을 날짜·번호 순으로 쌓는다.
 *  잔액은 계정의 정상 방향(자산·비용은 차변, 부채·자본·수익은 대변) 기준. partnerQ 가 있으면 그 글자가 들어간 거래처 줄만 */
export function accountLedger(entries, account, from, to, partnerQ) {
  const acc = ACCOUNTS.find((a) => a.code === account); const sign = acc && acc.normal === 'C' ? -1 : 1; const q = String(partnerQ || '').trim().toLowerCase();
  const sorted = (entries || []).filter((e) => !e.invalid).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : ((a.seq || 0) - (b.seq || 0)) || (a.no < b.no ? -1 : a.no > b.no ? 1 : 0)));
  let opening = 0, bal = 0, debit = 0, credit = 0; const rows = [];
  sorted.forEach((e) => { e.lines.forEach((l) => {
    if (l.account !== account || (q && !String(l.partner || '').toLowerCase().includes(q))) return; const d = l.side === 'D' ? Number(l.amount) : 0; const c = l.side === 'C' ? Number(l.amount) : 0;
    if (to && e.date > to) return;
    if (from && e.date < from) { opening += sign * (d - c); bal = opening; return; }
    bal += sign * (d - c); debit += d; credit += c; rows.push({ id: e.id, date: e.date, no: e.no, memo: e.memo || '', partner: l.partner || '', debit: d, credit: c, balance: bal });
  }); });
  return { account, name: acc ? acc.name : account, normal: acc ? acc.normal : 'D', from: from || '', to: to || '', opening, rows, debit, credit, closing: bal };
}
/** 거래처별 잔액 — 기준일까지 그 계정의 거래처마다 차변·대변 합계와 잔액(정상 방향 기준). 잔액 0인 거래처는 기본으로 숨김 */
export function partnerBalances(entries, account, asOf, includeZero) {
  const acc = ACCOUNTS.find((a) => a.code === account); const sign = acc && acc.normal === 'C' ? -1 : 1; const map = new Map();
  (entries || []).filter((e) => !e.invalid && (!asOf || e.date <= asOf)).forEach((e) => e.lines.forEach((l) => {
    if (l.account !== account) return; const p = String(l.partner || '').trim() || '(거래처 없음)'; const g = map.get(p) || { partner: p, debit: 0, credit: 0, n: 0, last: '' };
    if (l.side === 'D') g.debit += Number(l.amount); else g.credit += Number(l.amount); g.n++; if (e.date > g.last) g.last = e.date; map.set(p, g);
  }));
  const all = [...map.values()].map((g) => Object.assign(g, { balance: sign * (g.debit - g.credit) })); const rows = all.filter((g) => includeZero || g.balance !== 0).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance) || (a.partner < b.partner ? -1 : 1));
  return { account, name: acc ? acc.name : account, normal: acc ? acc.normal : 'D', asOf: asOf || '', rows, hidden: all.length - rows.length, debit: rows.reduce((s, r) => s + r.debit, 0), credit: rows.reduce((s, r) => s + r.credit, 0), balance: rows.reduce((s, r) => s + r.balance, 0) };
}
/** 원장·거래처 잔액 엑셀(CSV) — 한글이 깨지지 않게 BOM */
export function ledgerCsv(kind, data) {
  const q = csvCell; const L = [];
  if (kind === 'gl') { L.push(['일자', '번호', '메모', '거래처', '차변', '대변', '잔액']); L.push(['', '', '기초 잔액', '', '', '', data.opening]); data.rows.forEach((r) => L.push([r.date, r.no, r.memo, r.partner, r.debit, r.credit, r.balance])); L.push(['', '', '합계 / 기말 잔액', '', data.debit, data.credit, data.closing]); }
  else if (kind === 'bk') { L.push(['월', '통장 마지막 거래일', '통장 잔액', '장부 보통예금(1020)', '차이(장부-통장)']); data.months.slice().reverse().forEach((m) => L.push([m.month, m.date, m.bankBal, m.ledgerBal, m.diff])); }
  else { L.push(['거래처', '차변 합계', '대변 합계', '잔액', '건수', '마지막 거래일']); data.rows.forEach((r) => L.push([r.partner, r.debit, r.credit, r.balance, r.n, r.last])); L.push(['합계', data.debit, data.credit, data.balance, '', '']); }
  return '\uFEFF' + L.map((r) => r.map(q).join(',')).join('\r\n');
}
/* ───────── 월간 수지: 매달 나갈 돈(고정지출 항목)과 받을 돈(이엔지 용역비)을 한 화면에 — 엑셀 '월 손익계산서'(갑지) 대체 ───────── */
export const MP_GROUPS = ['급여', '외주·구매', '임대·관리', '구독·보험', '할부·대출', '4대보험', '카드대금', '기타'];
const mpIt = (id, name, group, amount, day, method, match, note, from) => ({ id, name, group, amount, day, method, match, note: note || '', active: true, from: from || '', to: '' });
/** 엑셀(26-10 손익계산서)의 항목으로 만든 첫 목록 — 금액은 엑셀에 있던 값, 변동 항목은 0(이번 달 금액을 직접 입력) */
export const MP_SEED = [
  mpIt('s01', '급여 — 윤석원', '급여', 3055256, 0, '계좌이체', '윤석원&급여|윤석원&직원앞'), mpIt('s02', '급여 — 정다애', '급여', 2382224, 0, '계좌이체', '정다애&급여|정다애&직원앞'), mpIt('s03', '급여 — 이한영', '급여', 2643830, 0, '계좌이체', '이한영&급여|이한영&직원앞'), mpIt('s04', '급여 — 김영서', '급여', 2384844, 0, '계좌이체', '김영서&급여|김영서&직원앞'), mpIt('s05', '급여 — 형일우', '급여', 2384844, 0, '계좌이체', '형일우&급여|형일우&직원앞'),
  mpIt('s06', '외주 용역비 — 에스제이(서민우)', '외주·구매', 0, 0, '계좌이체', '에스제이|서민우', '변동 — 이번 달 지급 예정액을 입력'), mpIt('s07', '거상 구매비', '외주·구매', 0, 0, '계좌이체', '거상', '변동'), mpIt('s08', '넘버원 구매비', '외주·구매', 0, 0, '계좌이체', '넘버원', '변동'),
  mpIt('s09', '창고 임대 B111 (이순옥)', '임대·관리', 220000, 0, '계좌이체', '이순옥'), mpIt('s10', '창고 임대 B110 (이연주)', '임대·관리', 200000, 0, '계좌이체', '이연주'), mpIt('s11', '창고 관리비', '임대·관리', 158940, 0, '계좌이체', '관리비', '변동 — 임대료와 같이 이체되는 달은 임대 항목에 합쳐짐'),
  mpIt('s12', '마이크로소프트 365', '구독·보험', 199650, 5, '자동이체 (기업)', '마이크로소프트|삼정데이타', '삼정데이타서비스 경유 결제'), mpIt('s13', '노란우산', '구독·보험', 0, 6, '자동이체 (신한)', '노란우산', '월 납입액을 입력(엑셀: 현재 누적 60만원)'),
  mpIt('s14', '현대캐피탈 (1313)', '할부·대출', 559130, 25, '자동이체 (기업)', '현대캐피탈'), mpIt('s15', '하나캐피탈 (3695)', '할부·대출', 1623950, 5, '자동이체 (기업)', '하나캐피탈', '3월부터 적용', '2026-03'), mpIt('s16', '농협 대출', '할부·대출', 250000, 28, '자동이체 (농협)', '농협대출|농협 대출'), mpIt('s17', '기업은행 대출 이자', '할부·대출', 0, 21, '자동이체 (기업)', '대출이자|대출 이자|진흥기금', '이자 변동'), mpIt('s18', '김민서 대출', '할부·대출', 1324559, 0, '계좌이체', '김민서'),
  mpIt('s19', '건강보험', '4대보험', 0, 0, '계좌이체', '건강보험', '변동'), mpIt('s20', '국민연금', '4대보험', 0, 0, '계좌이체', '국민연금', '변동'), mpIt('s21', '고용·산재보험', '4대보험', 0, 0, '계좌이체', '고용|산재|근로복지', '변동'),
  mpIt('s22', '삼성카드', '카드대금', 0, 1, '자동이체 (기업)', '삼성카드', '변동'), mpIt('s23', '농협카드', '카드대금', 0, 1, '자동이체 (농협)', '농협카드', '변동'), mpIt('s24', '현대카드', '카드대금', 0, 12, '자동이체 (기업)', '현대카드', '1일~31일 사용분, 변동'), mpIt('s25', '기업카드', '카드대금', 0, 23, '자동이체 (기업)', '기업카드|IBK카드|BC카드|비씨카드', '명세서 4일, 변동')
];
/** 항목의 찾는 말: '|' 은 또는, '&' 는 그리고(공백 무시) — 예) '윤석원&급여|김영서' */
export function mpMatch(spec, hay) {
  const h = String(hay || '').replace(/\s+/g, ''); const alts = String(spec || '').split('|').map((a) => a.split('&').map((t) => t.replace(/\s+/g, '')).filter(Boolean)).filter((a) => a.length);
  return alts.length > 0 && alts.some((a) => a.every((t) => h.includes(t)));
}
const mpBank = (e) => { let o = 0, has = false; (e.lines || []).forEach((l) => { if (l.account === '1020') { has = true; o += (l.side === 'C' ? 1 : -1) * (Number(l.amount) || 0); } }); return has ? o : 0; };
/** 한 달의 월간 수지 — plan = { items, overrides }, ym = 'YYYY-MM' */
export function monthlyView(entries, plan, ym, today) {
  const t = today || kstToday(); const cur = t.slice(0, 7); const P = plan || { items: [], overrides: {} }; const ov = (P.overrides && P.overrides[ym]) || {}; const ovi = ov.items || {};
  const es = (entries || []).filter((e) => !e.invalid && e.lines && String(e.date).slice(0, 7) === ym);
  const items = (P.items || []).filter((x) => x.active !== false && (!x.from || ym >= x.from) && (!x.to || ym <= x.to));
  const paid = {}; const hits = {}; const others = new Map(); let unmatchedTotal = 0; let salesIn = 0; const sales = []; let salesSupply = 0, salesTax = 0;
  es.forEach((e) => {
    const k = e.source && e.source.kind;
    if (k === 'taxinv_sales') { let supply = 0, tax = 0, partner = ''; e.lines.forEach((l) => { const sg = (l.side === 'D' ? 1 : -1) * (Number(l.amount) || 0); if (l.account === '4010') { supply += -sg; partner = partner || l.partner || ''; } else if (l.account === '2040') tax += -sg; }); sales.push({ date: e.date, no: e.no, partner, memo: e.memo, supply, tax, total: supply + tax }); salesSupply += supply; salesTax += tax; }
    let d1020 = 0, c1100 = 0; e.lines.forEach((l) => { if (l.account === '1020' && l.side === 'D') d1020 += Number(l.amount) || 0; if (l.account === '1100' && l.side === 'C') c1100 += Number(l.amount) || 0; }); if (d1020 > 0 && c1100 > 0) salesIn += Math.min(d1020, c1100);
    const net = mpBank(e); if (net <= 0 || (d1020 > 0 && c1100 > 0)) return;
    const hay = String(e.memo || '') + ' ' + e.lines.map((l) => l.partner || '').join(' ');
    const it = items.find((x) => mpMatch(x.match || x.name, hay));
    if (it) { paid[it.id] = (paid[it.id] || 0) + net; (hits[it.id] = hits[it.id] || []).push({ date: e.date, no: e.no, memo: e.memo, amount: net }); }
    else { const pl = e.lines.find((l) => l.account !== '1020' && l.partner); const key = (pl && pl.partner) || String(e.memo || '').split('·')[0].trim() || '(이름 없음)'; const g = others.get(key) || { name: key, n: 0, total: 0, rows: [] }; g.n++; g.total += net; g.rows.push({ date: e.date, no: e.no, memo: e.memo, amount: net }); others.set(key, g); unmatchedTotal += net; }
  });
  const rows = items.map((x) => {
    const o = ovi[x.id] || {}; const skip = o.skip === true; const base = Number(x.amount) || 0; const exp = skip ? 0 : (o.amount !== undefined ? Number(o.amount) : base); const got = paid[x.id] || 0;
    const dueDay = Number(x.day) || 0; const due = dueDay ? ym + '-' + String(Math.min(dueDay, 28)).padStart(2, '0') : '';
    let state; if (skip) state = 'skip'; else if (got > 0 && exp > 0) state = Math.abs(got - exp) <= Math.max(1000, exp * 0.01) ? 'ok' : 'diff'; else if (got > 0) state = 'paid'; else if (exp === 0) state = 'noamt'; else if (ym < cur) state = 'missing'; else if (ym === cur && due && t >= due) state = 'late'; else state = 'plan';
    return { item: x, group: x.group, exp, base, override: o.amount !== undefined, skip, paid: got, state, due, hits: hits[x.id] || [], note: o.note || '' };
  });
  const groups = MP_GROUPS.map((g) => { const rs = rows.filter((r) => r.group === g); return { group: g, rows: rs, exp: rs.reduce((s, r) => s + r.exp, 0), paid: rs.reduce((s, r) => s + r.paid, 0) }; }).filter((g) => g.rows.length);
  const expTotal = rows.reduce((s, r) => s + r.exp, 0); const paidMatched = rows.reduce((s, r) => s + r.paid, 0); const expEff = rows.reduce((s, r) => s + (r.skip ? 0 : Math.max(r.exp, r.paid)), 0); const revPlan = ov.rev !== undefined ? ov.rev : salesSupply + salesTax;
  return { ym, sales, salesSupply, salesTax, salesTotal: salesSupply + salesTax, salesIn, revPlan, revOverride: ov.rev !== undefined, groups, rows, expTotal, expEff, expAll: expEff + unmatchedTotal, paidMatched, others: [...others.values()].sort((a, b) => b.total - a.total), unmatchedTotal, paidAll: paidMatched + unmatchedTotal, balance: revPlan - (expEff + unmatchedTotal), planBalance: revPlan - expTotal, actualBalance: salesIn - (paidMatched + unmatchedTotal) };
}
/** 월간 수지 엑셀(CSV) */
export function monthlyCsv(v) {
  const q = csvCell; const L = [['월간 수지', v.ym], [], ['[받을 돈 — 매출 세금계산서]'], ['작성일', '거래처', '내용', '공급가액', '부가세', '합계']];
  v.sales.forEach((s) => L.push([s.date, s.partner, s.memo, s.supply, s.tax, s.total])); L.push(['입금 예정(합계)', '', '', '', '', v.revPlan], ['실제 입금(통장)', '', '', '', '', v.salesIn], [], ['[나갈 돈 — 고정지출]'], ['구분', '내용', '결제일', '방법', '예정 금액', '지급(장부)', '상태', '비고']);
  const ST = { ok: '지급 완료', diff: '금액 다름', paid: '지급됨', skip: '이번 달 없음', noamt: '금액 미정', missing: '장부에 없음', late: '결제일 지남', plan: '예정' };
  v.groups.forEach((g) => g.rows.forEach((r) => L.push([g.group, r.item.name, r.due || (r.item.day ? r.item.day + '일' : ''), r.item.method, r.exp, r.paid, ST[r.state], r.item.note || r.note])));
  L.push(['', '고정지출 예정 합계', '', '', v.expTotal, v.paidMatched], ['', '등록 안 된 지출(장부)', '', '', '', v.unmatchedTotal], ['', '예상 총지출(예정 또는 이미 지급 + 등록 안 된 지출)', '', '', v.expAll], [], ['', '차액(입금 예정 − 예상 총지출)', '', '', v.balance]);
  return '\uFEFF' + L.map((x) => x.map(q).join(',')).join('\r\n');
}
/* ───────── 네이버페이 영수증(통합 카드영수증·주문 상세) 여러 장 → 전표 초안: 읽은 값으로 중복·취소·포인트 결제를 걸러내고 업무/개인 분류를 사람이 확인해 저장 ───────── */
const NP_PERS = /비타민|크레아틴|체지방|헤어|보스턴|햇반|비비고|포카리|현미밥|쌀|톡|홀더|생선|식이|프로틴|단백질|팔찌|치약|매트리스|토퍼|양말|운동|덤벨|샴푸|화장|올리브|사이다|쉐이빙|니베아|영양제|오메가|유산균/;
const NP_BIZ = /장갑|리벳|코팅|수직|추세|공구|테이프|드릴|볼트|너트|케이블|안전|토치|니트릴|사다리|낙상|비계|와이어|렌치|비트|절단|그라인|전동|배터리|충전기|랜선|멀티탭|작업|마스크|말비계|툴스|쓰레받기|노트북/;
export const NPAY_CHOICES = [['6090', '업무 · 소모품비'], ['3020', '개인 · 인출금'], ['6020', '복리후생비'], ['skip', '제외']];
const NP_ACCT = ['6090', '3020', '6020'];
/** 상품명·판매자로 업무/개인을 짐작(확정이 아니라 첫 제안) — 개인 3020, 업무 6090, 모르면 '' */
export function npayGuess(item, seller) { const s = String(item || '') + ' ' + String(seller || ''); return NP_PERS.test(s) ? '3020' : NP_BIZ.test(s) ? '6090' : ''; }
/** 원천 ID — 이전에 올린 네이버페이 전표(card_카드사_일자_NPAY_승인번호_금액)와 같은 모양이라 같은 영수증이면 겹쳐 올라가지 않는다 */
export function npayId(ex) { const key = ex.approval ? ex.approval : (ex.orderNo ? 'O' + ex.orderNo : 'X'); return ['card', ex.issuerKey || 'unknown', ex.date, 'NPAY', key, ex.amount].join('_'); }
/** 읽은 영수증 목록 → 계획: 건마다 상태(new·dup·dupfile·cancel·points·error)와 포함 여부, 저장할 전표 */
export function npayPlan(items, entries) {
  const have = new Set(); const softSet = new Set();
  (entries || []).forEach((e) => { if (e.invalid || !e.source || e.source.kind !== 'card') return; const p = String(e.source.id || '').split('_'); if (p.length >= 6) have.add(p[p.length - 2] + '_' + p[p.length - 1]); const d = (e.lines || []).find((l) => l.side === 'D'); if (d) softSet.add(e.date + '_' + Number(d.amount)); });
  const seen = new Set(); const rows = []; const raw = [];
  const sorted = (items || []).slice().sort((a, b) => ((a.ex && a.ex.date) || '9999') < ((b.ex && b.ex.date) || '9999') ? -1 : ((a.ex && a.ex.date) || '9999') > ((b.ex && b.ex.date) || '9999') ? 1 : a.idx - b.idx);
  sorted.forEach((it) => {
    const row = { item: it, state: 'new', include: false, soft: false, id: '', choice: it.choice || 'ask' };
    if (it.status !== 'ok' || !it.ex) { row.state = 'error'; rows.push(row); return; }
    const ex = it.ex;
    if (ex.cancelled) row.state = 'cancel';
    else if (ex.payment === 'points_only' || !ex.amount) row.state = 'points';
    else if (!ex.date) row.state = 'error', row.msg = '날짜를 읽지 못했습니다';
    else {
      row.id = npayId(ex); const key = ex.approval ? ex.approval + '_' + ex.amount : '';
      if (key && have.has(key)) row.state = 'dup';
      else if (seen.has(row.id)) row.state = 'dupfile';
      else { seen.add(row.id); row.soft = !ex.approval && softSet.has(ex.date + '_' + ex.amount); }
    }
    if (row.state === 'new') { const eff = (row.soft && !it.touched) ? 'skip' : row.choice; row.include = NP_ACCT.includes(eff); if (row.include) { const issuer = ex.issuer || '카드(카드사 확인 필요)'; raw.push({ date: ex.date, memo: (ex.seller || '네이버페이') + ' · ' + (ex.item || '상품명 미상') + ' — 네이버페이 영수증(' + issuer + (ex.approval ? ', 승인 ' + ex.approval : ex.orderNo ? ', 주문 ' + ex.orderNo : '') + ')', source: { kind: 'card', id: row.id }, needsReview: !ex.issuer || ex.confidence < 0.6 || (it.warnings || []).length > 0, lines: [{ account: eff, side: 'D', amount: ex.amount, partner: ex.seller || '네이버페이' }, { account: '2020', side: 'C', amount: ex.amount, partner: issuer }] }); row.eff = eff; } }
    rows.push(row);
  });
  const counts = { new: 0, include: 0, ask: 0, skip: 0, dup: 0, dupfile: 0, cancel: 0, points: 0, error: 0 }; const byAcct = {}; let total = 0;
  rows.forEach((r) => { counts[r.state] = (counts[r.state] || 0) + 1; if (r.state === 'new') { if (r.include) { counts.include++; total += r.item.ex.amount; byAcct[r.eff] = (byAcct[r.eff] || 0) + r.item.ex.amount; } else if (r.choice === 'ask' && !(r.soft && !r.item.touched)) counts.ask++; else counts.skip++; } });
  const parsed = raw.length ? parseEntriesJson(JSON.stringify(raw)) : { entries: [], errors: [] };
  return { rows, entries: parsed.entries, errors: parsed.errors, counts, total, byAcct };
}
/* ───────── 부가세 신고 보조표(일반과세자): 세금계산서 전표에서 매출세액·매입세액·납부세액과 매출처·매입처별 합계표 ───────── */
const VAT_FIXED = ['1500', '1510']; const VAT_CAND = [['접대비 관련 매입세액(6040) — 접대비는 공제받지 못합니다', ['6040']], ['차량 구입·유지·렌트 관련(1500·5330·5360·6120·6130) — 비영업용 소형승용차면 공제받지 못합니다', ['1500', '5330', '5360', '6120', '6130']]];
/** 과세기간 목록(반기·분기) — 장부의 가장 이른 해부터 올해까지 */
export function vatPeriods(entries, today) {
  const t = today || kstToday(); const ys = (entries || []).map((e) => Number(String(e.date).slice(0, 4))).filter(Boolean); const y0 = ys.length ? Math.min(...ys) : Number(t.slice(0, 4)); const y1 = Number(t.slice(0, 4)); const out = [];
  for (let y = y1; y >= y0; y--) { out.push({ key: y + '-2H', label: y + '년 2기 (7.1~12.31)', from: y + '-07-01', to: y + '-12-31', half: true }, { key: y + '-1H', label: y + '년 1기 (1.1~6.30)', from: y + '-01-01', to: y + '-06-30', half: true }); [[4, '10.1~12.31'], [3, '7.1~9.30'], [2, '4.1~6.30'], [1, '1.1~3.31']].forEach(([q, r]) => { const m0 = (q - 1) * 3 + 1; out.push({ key: y + '-Q' + q, label: y + '년 ' + q + '분기 (' + r + ')', from: y + '-' + String(m0).padStart(2, '0') + '-01', to: y + '-' + String(m0 + 2).padStart(2, '0') + '-' + ([3, 6, 9, 12].includes(m0 + 2) ? (m0 + 2 === 3 || m0 + 2 === 12 ? '31' : '30') : '30'), half: false }); }); }
  return out;
}
/** 선택한 과세기간(key)을 찾는다 — 없으면 오늘 기준 가장 최근에 끝난 반기 */
export function vatPick(entries, key, today) {
  const t = today || kstToday(); const ps = vatPeriods(entries, t); return ps.find((p) => p.key === key) || ps.find((p) => p.half && p.to < t) || ps[0];
}
/** 기간 안의 세금계산서 전표로 신고 보조표를 만든다. deny = 사람이 정한 공제받지 못할 매입세액(원) */
export function vatReport(entries, from, to, deny) {
  const inP = (e) => !e.invalid && e.date >= from && e.date <= to; const es = (entries || []).filter(inP);
  const sales = { supply: 0, tax: 0, n: 0, rows: new Map() }; const pur = { general: { supply: 0, tax: 0, n: 0 }, fixed: { supply: 0, tax: 0, n: 0 }, exempt: { supply: 0, n: 0 }, rows: new Map() }; const cand = VAT_CAND.map(([label, accs]) => ({ label, accs, tax: 0, supply: 0, n: 0 })); const monthly = new Map(); const pay = [], off = [];
  const mm = (e) => { const k = String(e.date).slice(0, 7); if (!monthly.has(k)) monthly.set(k, { month: k, out: 0, inn: 0 }); return monthly.get(k); };
  es.forEach((e) => {
    const k = e.source && e.source.kind; const sg = (l) => (l.side === 'D' ? 1 : -1) * (Number(l.amount) || 0);
    if (k === 'taxinv_sales') {
      let supply = 0, tax = 0, partner = ''; e.lines.forEach((l) => { if (l.account === '4010') { supply += -sg(l); partner = partner || l.partner || ''; } else if (l.account === '2040') tax += -sg(l); else if (l.account === '1100' && !partner) partner = l.partner || ''; });
      sales.supply += supply; sales.tax += tax; sales.n++; mm(e).out += tax; const key = partner || '(거래처 없음)'; const g = sales.rows.get(key) || { partner: key, n: 0, supply: 0, tax: 0 }; g.n++; g.supply += supply; g.tax += tax; sales.rows.set(key, g);
    } else if (k === 'taxinv_purchase') {
      let supply = 0, tax = 0, partner = '', fixed = false; const accs = new Set(); e.lines.forEach((l) => { if (l.account === '1130') tax += sg(l); else if (l.account === '2010') partner = partner || l.partner || ''; else { supply += sg(l); accs.add(l.account); if (VAT_FIXED.includes(l.account)) fixed = true; } });
      const bucket = tax === 0 ? pur.exempt : (fixed ? pur.fixed : pur.general); bucket.supply += supply; if (bucket.tax !== undefined) bucket.tax += tax; bucket.n++; mm(e).inn += tax;
      const key = partner || '(거래처 없음)'; const g = pur.rows.get(key) || { partner: key, n: 0, supply: 0, tax: 0 }; g.n++; g.supply += supply; g.tax += tax; pur.rows.set(key, g);
      cand.forEach((c) => { if ([...accs].some((a) => c.accs.includes(a))) { c.tax += tax; c.supply += supply; c.n++; } });
    } else if (e.lines.some((l) => l.account === '2040' && l.side === 'D')) {
      const amt = e.lines.filter((l) => l.account === '2040' && l.side === 'D').reduce((s, l) => s + (Number(l.amount) || 0), 0); (k === 'accrual' ? off : pay).push({ date: e.date, no: e.no, memo: e.memo, kind: k, amount: amt });
    }
  });
  const outputTax = sales.tax; const inputTax = pur.general.tax + pur.fixed.tax; const denyV = Math.max(0, Number(deny) || 0); const deductible = inputTax - denyV; const payable = outputTax - deductible;
  const paid = pay.reduce((s, x) => s + x.amount, 0); const rows = (m) => [...m.values()].sort((a, b) => b.supply - a.supply);
  return { from, to, sales: { supply: sales.supply, tax: sales.tax, n: sales.n, rows: rows(sales.rows) }, pur: { general: pur.general, fixed: pur.fixed, exempt: pur.exempt, rows: rows(pur.rows) }, cand, monthly: [...monthly.values()].sort((a, b) => (a.month < b.month ? -1 : 1)), pay, off, paid, summary: { outputTax, inputTax, deny: denyV, deductible, payable, supply: sales.supply } };
}
/** 신용카드 지출 참고 — 업무 비용 계정으로 쓴 카드 전표의 합계와 10/110 추정 세액(공제 가능 여부는 업종·증빙에 따라 달라 자동 공제하지 않음) */
export function vatCardRef(entries, from, to) {
  const skip = new Set(['6040', '6020', '5350', '6070', '6110', '6080', '6010', '5110', '3020']); let n = 0, total = 0;
  (entries || []).filter((e) => !e.invalid && e.date >= from && e.date <= to && e.source && e.source.kind === 'card').forEach((e) => { let hit = 0; e.lines.forEach((l) => { const a = String(l.account); if (l.side === 'D' && (a[0] === '5' || a[0] === '6') && !skip.has(a)) hit += Number(l.amount) || 0; }); if (hit > 0) { n++; total += hit; } });
  const tax = Math.round(total * 10 / 110); return { n, total, tax, supply: total - tax };
}
/** 일반과세자 부가가치세 확정신고서 양식(①~㉗)으로 채운 표 — 세금계산서 전표로 자동 채우는 칸과 직접 입력 칸(I)을 합쳐 합계를 서식의 계산식대로 계산 */
export function vatForm(v, I) {
  const g = (k) => Number((I && I[k]) || 0) || 0; const s = v.sales, p = v.pur; const R = [];
  const add = (o) => { R.push(Object.assign({ amt: 0, tax: 0 }, o)); return R[R.length - 1]; };
  const G1 = '과세표준 및 매출세액', G2 = '매입세액', G3 = '납부(환급)세액·경감·공제·가산세';
  const r1 = add({ grp: G1, sub: '과세 · 세금계산서 발급분', no: '①', amt: s.supply, tax: s.tax, rate: '10/100', auto: true });
  const r2 = add({ sub: '과세 · 매입자발행 세금계산서', no: '②', amtKey: 'f2a', taxKey: 'f2t', amt: g('f2a'), tax: g('f2t'), rate: '10/100' });
  const r3 = add({ sub: '과세 · 신용카드·현금영수증 발행분', no: '③', amtKey: 'f3a', taxKey: 'f3t', amt: g('f3a'), tax: g('f3t'), rate: '10/100' });
  const r4 = add({ sub: '과세 · 기타(정규영수증 외 매출분)', no: '④', amtKey: 'f4a', taxKey: 'f4t', amt: g('f4a'), tax: g('f4t'), rate: '10/100' });
  const r5 = add({ sub: '영세율 · 세금계산서 발급분', no: '⑤', amtKey: 'f5a', amt: g('f5a'), rate: '0/100' });
  const r6 = add({ sub: '영세율 · 기타', no: '⑥', amtKey: 'f6a', amt: g('f6a'), rate: '0/100' });
  const r7 = add({ sub: '예정신고 누락분', no: '⑦', amtKey: 'f7a', taxKey: 'f7t', amt: g('f7a'), tax: g('f7t') });
  const r8 = add({ sub: '대손세액 가감', no: '⑧', taxKey: 'f8t', tax: g('f8t') });
  const r9 = add({ sub: '합계', no: '⑨', bold: true, amt: r1.amt + r2.amt + r3.amt + r4.amt + r5.amt + r6.amt + r7.amt, tax: r1.tax + r2.tax + r3.tax + r4.tax + r7.tax + r8.tax });
  const r10 = add({ grp: G2, sub: '세금계산서 수취분 · 일반매입', no: '⑩', amt: p.general.supply, tax: p.general.tax, auto: true });
  const r101 = add({ sub: '세금계산서 수취분 · 수출기업 수입분 납부유예', no: '⑩-1', amtKey: 'f101a', taxKey: 'f101t', amt: g('f101a'), tax: g('f101t') });
  const r11 = add({ sub: '세금계산서 수취분 · 고정자산 매입', no: '⑪', amt: p.fixed.supply, tax: p.fixed.tax, auto: true });
  const r12 = add({ sub: '예정신고 누락분', no: '⑫', amtKey: 'f12a', taxKey: 'f12t', amt: g('f12a'), tax: g('f12t') });
  const r13 = add({ sub: '매입자발행 세금계산서', no: '⑬', amtKey: 'f13a', taxKey: 'f13t', amt: g('f13a'), tax: g('f13t') });
  const r14 = add({ sub: '그 밖의 공제매입세액(신용카드 매입 등)', no: '⑭', amtKey: 'f14a', taxKey: 'f14t', amt: g('f14a'), tax: g('f14t') });
  const r15 = add({ sub: '합계 (⑩+⑩-1+⑪+⑫+⑬+⑭)', no: '⑮', bold: true, amt: r10.amt + r101.amt + r11.amt + r12.amt + r13.amt + r14.amt, tax: r10.tax + r101.tax + r11.tax + r12.tax + r13.tax + r14.tax });
  const r16 = add({ sub: '공제받지 못할 매입세액', no: '⑯', amtKey: 'f16a', taxKey: 'f16t', amt: g('f16a'), tax: g('f16t') });
  const r17 = add({ sub: '차감계 (⑮−⑯)', no: '⑰', bold: true, amt: r15.amt - r16.amt, tax: r15.tax - r16.tax });
  const c = r9.tax - r17.tax;
  const rc = add({ grp: G3, sub: '납부(환급)세액 (매출세액 ㉮ − 매입세액 ㉯)', no: '㉰', bold: true, tax: c });
  const r18 = add({ sub: '그 밖의 경감·공제세액', no: '⑱', taxKey: 'f18t', tax: g('f18t') });
  const r19 = add({ sub: '신용카드매출전표등 발행공제 등', no: '⑲', taxKey: 'f19t', tax: g('f19t') });
  const r20 = add({ sub: '합계 (⑱+⑲)', no: '⑳', bold: true, tax: r18.tax + r19.tax });
  const r201 = add({ sub: '소규모 개인사업자 부가가치세 감면세액', no: '⑳-1', taxKey: 'f201t', tax: g('f201t') });
  const r21 = add({ sub: '예정신고 미환급세액', no: '㉑', taxKey: 'f21t', tax: g('f21t') });
  const r22 = add({ sub: '예정고지세액', no: '㉒', taxKey: 'f22t', tax: g('f22t') });
  const r23 = add({ sub: '사업양수자가 대리납부한 세액', no: '㉓', taxKey: 'f23t', tax: g('f23t') });
  const r24 = add({ sub: '매입자 납부특례 기납부세액', no: '㉔', taxKey: 'f24t', tax: g('f24t') });
  const r25 = add({ sub: '신용카드업자가 대리납부한 세액', no: '㉕', taxKey: 'f25t', tax: g('f25t') });
  const r26 = add({ sub: '가산세액계', no: '㉖', taxKey: 'f26t', tax: g('f26t') });
  const f27 = c - r20.tax - r201.tax - r21.tax - r22.tax - r23.tax - r24.tax - r25.tax + r26.tax;
  const r27 = add({ sub: '차가감하여 납부할 세액(환급받을 세액) (㉰−⑳−⑳-1−㉑−㉒−㉓−㉔−㉕+㉖)', no: '㉗', bold: true, tax: f27 });
  return { rows: R, t: { outputTax: r9.tax, inputTax: r17.tax, taxBase: r9.amt, c, deduct: r20.tax, final: f27 } };
}
/** 신고 보조표 엑셀(CSV): 신고서 양식 + 매출처별 + 매입처별 (form 이 없으면 간추린 요약) */
export function vatCsv(r, form) {
  const q = csvCell; const L = []; const s = r.summary;
  L.push(['부가가치세 신고 보조표(일반과세자)', r.from + ' ~ ' + r.to], []);
  if (form) { L.push(['번호', '항목', '금액', '세액']); form.rows.forEach((x) => L.push([x.no, x.sub, x.amt || '', x.tax || ''])); }
  else { L.push(['구분', '건수', '공급가액', '세액']); L.push(['매출 — 세금계산서 발급분', r.sales.n, r.sales.supply, r.sales.tax], ['매입 — 세금계산서 일반매입', r.pur.general.n, r.pur.general.supply, r.pur.general.tax], ['매입 — 세금계산서 고정자산 매입', r.pur.fixed.n, r.pur.fixed.supply, r.pur.fixed.tax], ['매입 — 계산서(면세) 매입', r.pur.exempt.n, r.pur.exempt.supply, 0]); L.push(['매출세액', '', '', s.outputTax], ['매입세액 합계', '', '', s.inputTax], ['공제받지 못할 매입세액(입력)', '', '', s.deny], ['공제받을 매입세액', '', '', s.deductible], ['납부(환급)세액', '', '', s.payable]); }
  L.push([], ['매출처별 세금계산서 합계표'], ['거래처', '건수', '공급가액', '세액']);
  r.sales.rows.forEach((x) => L.push([x.partner, x.n, x.supply, x.tax])); L.push([], ['매입처별 세금계산서 합계표'], ['거래처', '건수', '공급가액', '세액']); r.pur.rows.forEach((x) => L.push([x.partner, x.n, x.supply, x.tax]));
  return '\uFEFF' + L.map((x) => x.map(q).join(',')).join('\r\n');
}
/* ───────── 예측(12개월): 장부 실적에서 가정을 뽑아 손익·현금흐름·간이 재무상태표를 시나리오별로 ───────── */
const ymAdd = (ym, k) => { let [y, m] = ym.split('-').map(Number); m += k; y += Math.floor((m - 1) / 12); m = (((m - 1) % 12) + 12) % 12 + 1; return y + '-' + String(m).padStart(2, '0'); };
export const FC_DEFAULT = { method: 1, vat: 0.1, g: 0, sgaG: 0, hana: 1250000, ibk: 0, tax: 0, minCash: 5000000, p0: 0.4, p1: 0.4, q0: 0.4 };
export const FC_SCEN = [{ key: 'low', name: '보수', rev: 0.8, cost: 1.05 }, { key: 'base', name: '기본', rev: 1, cost: 1 }, { key: 'high', name: '낙관', rev: 1.2, cost: 0.97 }];
/** 장부에서 가정의 바탕이 되는 값 — 최근 12개월(이번 달 제외, 완결된 달)의 합계와 기초 잔액 */
export function forecastBase(entries, today) {
  const t = today || kstToday(); const cur = t.slice(0, 7); const end = ymAdd(cur, -1); const start = ymAdd(end, -11);
  const es = (entries || []).filter((e) => !e.invalid && e.lines);
  const w = { rev: 0, adj: 0, cost: 0, sga: 0, nonop: 0, rec: 0, owner: 0 }; const bal = {}; const dep = new Map();
  es.forEach((e) => {
    const ym = String(e.date).slice(0, 7); const inWin = ym >= start && ym <= end;
    let d1020 = 0, c1100 = 0, net1020 = 0; const others = [];
    e.lines.forEach((l) => {
      const a = String(l.account); const amt = Number(l.amount) || 0; const sg = (l.side === 'D' ? 1 : -1) * amt; bal[a] = (bal[a] || 0) + sg;
      if (a === '6080') dep.set(e.date, (dep.get(e.date) || 0) + sg);
      if (a === '1020') { net1020 += sg; if (l.side === 'D') d1020 += amt; } else others.push(l);
      if (a === '1100' && l.side === 'C') c1100 += amt;
      if (!inWin) return;
      if (a === '4010') w.rev += -sg; else if (a === '4090') w.adj += -sg; else if (a[0] === '5') w.cost += sg; else if (a[0] === '6' && a !== '6080') w.sga += sg; else if (a[0] === '7' || a[0] === '8') w.nonop += -sg;
    });
    if (inWin && d1020 > 0 && c1100 > 0) w.rec += Math.min(d1020, c1100);
    if (inWin && net1020 !== 0 && others.length) { const tot = others.reduce((s, l) => s + (Number(l.amount) || 0), 0) || 1; others.forEach((l) => { if (l.account === '3020' || l.account === '2021') w.owner += -(net1020 * (Number(l.amount) || 0) / tot); }); }
  });
  let depMonthly = 0; if (dep.size) { const dates = [...dep.keys()].sort(); const last = dates[dates.length - 1]; const yr = last.slice(0, 4); const tot = dates.filter((d) => d.startsWith(yr)).reduce((s, d) => s + dep.get(d), 0); const mo = Number(last.slice(5, 7)) || 12; depMonthly = Math.round(tot / mo); }
  const g = (...a) => a.reduce((s, k) => s + (bal[k] || 0), 0);
  const cash = g('1020'), ar = g('1100'), other = g('1110', '1120', '1130', '1140', '1200', '1510', '1610'), veh = g('1500', '1590'); const ap = -g('2010', '2020', '2021', '2030', '2040', '2050', '2070'); const debt = -g('2100', '2200', '2210');
  return { start, end, today: t, startForecast: ymAdd(cur, 1), rev12: w.rev, adj12: w.adj, cost12: w.cost, sga12: w.sga, nonop12: w.nonop, rec12: w.rec, owner12: w.owner, dep: depMonthly, opening: { cash, ar, other, veh, ap, debt, equity: cash + ar + other + veh - ap - debt } };
}
/** 자동값 + 대표님이 바꾼 값(over)을 합친 가정. auto 는 비교·안내용 */
export function forecastAssume(base, over) {
  const o = over || {}; const A = Object.assign({}, FC_DEFAULT); Object.keys(o).forEach((k) => { if (o[k] !== null && o[k] !== undefined && o[k] !== '' && k !== 'scn') A[k] = o[k]; });
  const m = Number(A.method) || 1; const vat = Number(A.vat) || 0;
  const revAuto = (m === 2 ? base.rev12 : m === 3 ? base.rev12 + base.adj12 : base.rec12 / (1 + vat)) / 12;
  const auto = { rev: revAuto, cr: revAuto ? base.cost12 / 12 / revAuto : 0, sga: base.sga12 / 12, nonop: -base.nonop12 / 12, owner: base.owner12 / 12, dep: base.dep };
  ['rev', 'cr', 'sga', 'nonop', 'owner', 'dep'].forEach((k) => { A[k] = (o[k] !== null && o[k] !== undefined && o[k] !== '') ? Number(o[k]) : auto[k]; });
  const sc = FC_SCEN.map((s) => Object.assign({}, s, (o.scn && o.scn[s.key]) || {}));
  return { A, auto, scen: sc };
}
/** 12개월 예측 한 시나리오 — 엑셀 예측 모델(예측모델_초안_r1)과 같은 수식 */
export function forecastRun(base, A, scen) {
  const n = 12; const R = A.rev; const p2 = 1 - A.p0 - A.p1; const q1 = 1 - A.q0; const o = base.opening;
  const z = () => new Array(n).fill(0); const r = { rev: z(), cogs: z(), gp: z(), sga: z(), dep: z(), op: z(), nonop: z(), ni: z(), rec: z(), pay: z(), intr: z(), prin: z(), draw: z(), tax: z(), net: z(), cash: z(), flag: new Array(n).fill(false), ar: z(), oth: z(), veh: z(), ta: z(), ap: z(), debt: z(), tl: z(), eq: z(), tle: z(), chk: z(), topup: z(), adj: z() };
  const extraRec = z(); extraRec[0] = R * (A.p1 + p2); extraRec[1] = R * p2; const extraPay = z(); extraPay[0] = (R * A.cr * 1 + A.sga) * q1;
  if (Array.isArray(A.extraRec)) A.extraRec.forEach((v, i) => { if (i < n && v !== null && v !== undefined) extraRec[i] = Number(v) || 0; });
  if (Array.isArray(A.extraPay)) A.extraPay.forEach((v, i) => { if (i < n && v !== null && v !== undefined) extraPay[i] = Number(v) || 0; });
  let cash = o.cash, ar = o.ar, veh = o.veh, ap = o.ap, debt = o.debt, eq = o.equity, adj = o.cash;
  for (let i = 0; i < n; i++) {
    const k = i + 1; const rev = R * Math.pow(1 + A.g, k) * scen.rev; const cogs = rev * A.cr * scen.cost; const sga = A.sga * Math.pow(1 + A.sgaG, k);
    r.rev[i] = rev; r.cogs[i] = cogs; r.gp[i] = rev - cogs; r.sga[i] = sga; r.dep[i] = A.dep; r.op[i] = rev - cogs - sga - A.dep; r.nonop[i] = A.nonop; r.ni[i] = r.op[i] - A.nonop;
    const rec = rev * A.p0 + (i >= 1 ? r.rev[i - 1] * A.p1 : 0) + (i >= 2 ? r.rev[i - 2] * p2 : 0) + extraRec[i];
    const pay = (cogs + sga) * A.q0 + (i >= 1 ? (r.cogs[i - 1] + r.sga[i - 1]) * q1 : 0) + extraPay[i];
    r.rec[i] = rec; r.pay[i] = -pay; r.intr[i] = -A.nonop; r.prin[i] = -(A.hana + A.ibk); r.draw[i] = -A.owner; r.tax[i] = -A.tax;
    r.net[i] = rec - pay - A.nonop - (A.hana + A.ibk) - A.owner - A.tax; cash += r.net[i]; r.cash[i] = cash; r.flag[i] = cash < A.minCash;
    ar += rev - rec; veh -= A.dep; ap += cogs + sga - pay; debt -= (A.hana + A.ibk); eq += r.ni[i] - A.owner - A.tax;
    r.ar[i] = ar; r.oth[i] = o.other; r.veh[i] = veh; r.ta[i] = cash + ar + o.other + veh; r.ap[i] = ap; r.debt[i] = debt; r.tl[i] = ap + debt; r.eq[i] = eq; r.tle[i] = ap + debt + eq; r.chk[i] = r.ta[i] - r.tle[i];
    r.topup[i] = Math.max(0, A.minCash - (adj + r.net[i])); adj = adj + r.net[i] + r.topup[i]; r.adj[i] = adj;
  }
  const sum = (a) => a.reduce((s, v) => s + v, 0); const minCash = Math.min(...r.cash); const labels = []; for (let i = 0; i < n; i++) labels.push(ymAdd(base.startForecast, i));
  r.labels = labels;
  r.summary = { rev: sum(r.rev), op: sum(r.op), ni: sum(r.ni), rec: sum(r.rec), owner: A.owner * n, endCash: r.cash[n - 1], minCash, minMonth: labels[r.cash.indexOf(minCash)], short: r.flag.filter(Boolean).length, topup: sum(r.topup), topupAvg: sum(r.topup) / n, endEquity: r.eq[n - 1], chk: Math.max(...r.chk.map((v) => Math.abs(Math.round(v)))) };
  return r;
}
/** 예측 월별 표 엑셀(CSV) */
export function forecastCsv(r, name) {
  const q = csvCell; const rows = [['항목(' + name + ' 시나리오, 원)'].concat(r.labels)];
  [['매출', 'rev'], ['매출원가', 'cogs'], ['매출총이익', 'gp'], ['판관비(감가상각 제외)', 'sga'], ['감가상각비', 'dep'], ['영업이익', 'op'], ['영업외 순비용', 'nonop'], ['당기순이익', 'ni'], ['수금', 'rec'], ['원가·판관비 지급', 'pay'], ['영업외비용 지급', 'intr'], ['차입금 원금 상환', 'prin'], ['대표자 현금 순유출', 'draw'], ['기타 세금 지출', 'tax'], ['순현금흐름', 'net'], ['기말 현금', 'cash'], ['외상매출금(순)', 'ar'], ['선급금·기타자산', 'oth'], ['차량운반구(순)', 'veh'], ['자산 총계', 'ta'], ['매입채무·미지급금 등', 'ap'], ['차입금', 'debt'], ['부채 총계', 'tl'], ['자본', 'eq'], ['필요 추가 입금(이엔지)', 'topup'], ['조정 후 기말 현금', 'adj']].forEach(([l, k]) => rows.push([l].concat(r[k].map((v) => Math.round(v)))));
  return '\uFEFF' + rows.map((x) => x.map(q).join(',')).join('\r\n');
}
/** 통장 잔액 대사 — 통장 전표의 원천 ID(bank_날짜_시각_출금_입금_거래후잔액)에서 거래별 잔액을 읽어 ①잔액이 끊김 없이 이어지는지 ②날짜별 통장 마지막 잔액과 장부 보통예금(1020)이 같은지 본다.
 *  같은 초에 찍힌 거래는 잔액이 이어지는 순서로 맞춘다(일괄 이체는 순서가 뒤섞여 있음). 끊김은 빠진 거래나 계좌 바뀜(예: 신한→기업은행)의 흔적 */
export function bankReconcile(entries, acct) {
  const account = acct || '1020'; const re = /^bank_(\d{4}-\d{2}-\d{2})_(\d{2})[:_](\d{2})[:_](\d{2})_(\d+)_(\d+)_(-?\d+)/; const map = new Map();
  (entries || []).filter((e) => !e.invalid).forEach((e) => { const sid = (e.source && e.source.id) || ''; if (!e.source || e.source.kind !== 'bank') return; const m = re.exec(sid); if (!m || map.has(m[0])) return; map.set(m[0], { date: m[1], time: m[2] + ':' + m[3] + ':' + m[4], out: Number(m[5]), inn: Number(m[6]), bal: Number(m[7]) }); });
  const txns = [...map.values()].sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : a.date + a.time > b.date + b.time ? 1 : 0));
  const ordered = [], breaks = []; let cur = null; let i = 0;
  while (i < txns.length) { let j = i; while (j < txns.length && txns[j].date === txns[i].date && txns[j].time === txns[i].time) j++; const rest = txns.slice(i, j); i = j;
    while (rest.length) { let k = cur === null ? -1 : rest.findIndex((t) => cur + t.inn - t.out === t.bal);
      if (k < 0) { k = rest.findIndex((t) => !rest.some((o) => o !== t && o.bal === t.bal - t.inn + t.out)); if (k < 0) k = 0; const t = rest[k]; if (cur !== null) breaks.push({ afterDate: ordered[ordered.length - 1].date, afterTime: ordered[ordered.length - 1].time, afterBal: cur, date: t.date, time: t.time, startBal: t.bal - t.inn + t.out, gap: t.bal - t.inn + t.out - cur }); }
      const t = rest.splice(k, 1)[0]; ordered.push(t); cur = t.bal; } }
  const bankEnd = new Map(); ordered.forEach((t) => bankEnd.set(t.date, t.bal));
  const chg = new Map(); (entries || []).filter((e) => !e.invalid).forEach((e) => e.lines.forEach((l) => { if (l.account !== account) return; chg.set(e.date, (chg.get(e.date) || 0) + (l.side === 'D' ? 1 : -1) * Number(l.amount)); }));
  const days = [...new Set([...chg.keys(), ...bankEnd.keys()])].sort(); let run = 0; const led = new Map(); days.forEach((d) => { run += chg.get(d) || 0; led.set(d, run); });
  const bankDays = [...bankEnd.keys()].sort(); const changes = [], months = new Map(); let prev = null;
  bankDays.forEach((d) => { const diff = led.get(d) - bankEnd.get(d); if (prev === null ? diff !== 0 : diff !== prev) changes.push({ date: d, bankBal: bankEnd.get(d), ledgerBal: led.get(d), diff, delta: diff - (prev || 0) }); prev = diff; months.set(d.slice(0, 7), { month: d.slice(0, 7), date: d, bankBal: bankEnd.get(d), ledgerBal: led.get(d), diff }); });
  const lastDiff = prev === null ? 0 : prev;
  return { count: ordered.length, first: ordered.length ? ordered[0].date : '', last: ordered.length ? ordered[ordered.length - 1].date : '', breaks, changes, months: [...months.values()], lastDiff, ledgerNow: run, ok: !!ordered.length && lastDiff === 0 };
}
/** 통장 거래처 규칙 입력 검사 — key(상대방·내용에 포함된 글자) 2~40자, 방향 in/out/any, 존재하는 계정 */
export function bankRuleFromForm(key, dir, account, partner, memo) {
  const k = String(key || '').trim(); const errors = [];
  if (k.length < 2) errors.push('상대방·내용 글자를 2자 이상 입력해 주세요.'); if (k.length > 40) errors.push('글자는 40자까지 입니다.');
  if (!['in', 'out', 'any'].includes(dir)) errors.push('방향을 골라 주세요.');
  if (!accountName(account) || accountName(account) === account) errors.push('계정을 골라 주세요.');
  return { ok: !errors.length, errors, rule: { key: k, dir: dir || 'any', account: String(account || ''), partner: String(partner || '').trim().slice(0, 60), memo: String(memo || '').trim().slice(0, 100) } };
}
/** 재분류 새 전표의 기본 일자 — 원 전표 일자(마감일 이후일 때), 마감일 이전이면 마감일 다음 날. 날짜가 없으면 오늘 */
export function reclassDefaultDate(entry, lockedThrough, today) {
  const nextOk = lockedThrough ? new Date(Date.parse(lockedThrough + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10) : '';
  const d = entry && /^\d{4}-\d{2}-\d{2}$/.test(entry.date || '') ? entry.date : (today || '');
  return nextOk && d < nextOk ? nextOk : d;
}
/** 일괄 재분류 계획 — 고른 전표들에서 from 계정 줄을 to 계정(·거래처)으로 바꾼 새 줄과 일자를 전표마다 만든다.
 *  opts: { from, to, partner, dateMode: 'keep'|'fixed', fixedDate, lockedThrough, today } — 바꿀 수 없는 전표는 skipped 에 이유와 함께 담는다 */
export function bulkReclassPlan(entries, opts) {
  const o = opts || {}; const items = [], skipped = [];
  if (!o.from || !o.to) return { items, skipped, errors: ['바꿀 계정과 새 계정을 모두 골라 주세요.'] };
  if (o.from === o.to && !String(o.partner || '').trim()) return { items, skipped, errors: ['계정이 같으면 거래처를 입력해야 바뀝니다.'] };
  if (o.dateMode === 'fixed' && !/^\d{4}-\d{2}-\d{2}$/.test(o.fixedDate || '')) return { items, skipped, errors: ['새 전표 일자를 입력해 주세요.'] };
  (entries || []).forEach((e) => {
    if (e.reversedBy) { skipped.push({ no: e.no, reason: '이미 역분개된 전표' }); return; }
    if (e.reverses) { skipped.push({ no: e.no, reason: '역분개 전표' }); return; }
    const changes = {}, partners = {}; e.lines.forEach((l, i) => { if (l.account === o.from) { changes[i] = o.to; if (String(o.partner || '').trim()) partners[i] = String(o.partner).trim(); } });
    if (!Object.keys(changes).length) { skipped.push({ no: e.no, reason: o.from + ' 계정 줄이 없음' }); return; }
    const r = reclassLines(e, changes, partners);
    if (!r.ok) { skipped.push({ no: e.no, reason: r.errors[0] }); return; }
    const date = o.dateMode === 'fixed' ? o.fixedDate : reclassDefaultDate(e, o.lockedThrough, o.today);
    items.push({ entry: e, lines: r.lines, date, shifted: o.dateMode !== 'fixed' && date !== e.date });
  });
  return { items, skipped, errors: [] };
}
/** 원 전표 줄들에서 계정(·거래처)만 바꾼 새 줄 — changes: { 줄 번호: 새 계정 코드 }, partners: { 줄 번호: 새 거래처 }(고른 줄만).
 *  계정을 바꾸는데 거래처를 따로 정하지 않았고 옛 거래처가 '분류 대기: …' 표시이면 그 표시는 지운다(분류가 끝났으므로) */
export function reclassLines(entry, changes, partners) {
  const lines = entry.lines.map((l, i) => { const acc = changes && changes[i] ? changes[i] : l.account; let partner = l.partner || ''; if (partners && Object.prototype.hasOwnProperty.call(partners, i)) partner = String(partners[i] || '').trim(); else if (acc !== l.account && /^분류 대기/.test(partner)) partner = ''; return Object.assign({}, l, { account: acc, partner }); }); const diff = lines.filter((l, i) => l.account !== entry.lines[i].account || (l.partner || '') !== (entry.lines[i].partner || '')).length;
  if (!diff) return { ok: false, errors: ['바꾼 계정·거래처가 없습니다.'] }; const e = { date: '2026-01-01', memo: '', source: { kind: 'manual' }, lines: lines.map((l) => ({ account: l.account, side: l.side, amount: l.amount, partner: l.partner || '', pjt: l.pjt || '' })) }; const v = validateEntry(e); return v.ok ? { ok: true, lines: e.lines, changed: diff } : { ok: false, errors: v.errors };
}
/** 개시 전표 줄 → 입력 양식 값({계정코드: 금액}) — 자본(3010·3020)은 차액이라 뺀다 */
export function openingToForm(entry) { const v = {}; (entry.lines || []).forEach((l) => { if (l.account === '3010' || l.account === '3020') return; v[l.account] = Number(l.amount).toLocaleString('ko-KR'); }); return v; }
/* ───────── 이엔지 정산 차액 ───────── */
/** 외상매출금(1100) 월별 움직임: 청구(홈택스 매출) · 입금(통장) · 정산 차액 조정(4090) · 기타 · 월말 잔액 */
export function arByMonth(entries) {
  const rows = new Map(); const cat = (e, l) => { const k = (e.source && e.source.kind) || 'manual'; if (l.side === 'D') return k === 'taxinv_sales' ? 'billed' : 'other'; if (e.lines.some((x) => x.account === '4090' && x.side === 'D')) return 'adjusted'; if (k === 'bank') return 'received'; return 'other'; };
  (entries || []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).forEach((e) => (e.lines || []).forEach((l) => { if (l.account !== '1100') return; const ym = e.date.slice(0, 7); const r = rows.get(ym) || { ym, billed: 0, received: 0, adjusted: 0, other: 0 }; const c = cat(e, l); r[c] += l.side === 'D' ? l.amount : -l.amount; rows.set(ym, r); }));
  let bal = 0; return [...rows.values()].sort((a, b) => (a.ym < b.ym ? -1 : 1)).map((r) => { bal += r.billed + r.received + r.adjusted + r.other; return Object.assign(r, { received: -r.received, adjusted: -r.adjusted, balance: bal }); });
}
/** 세금계산서 공급가(홈택스 매출 전표의 4010 월별 합) — arByMonth 와 같은 집단(외상매출금 1100 차변이 있는 홈택스 매출 전표)만 세고 대변은 더하고 차변(발행 취소·정정)은 뺀다. 이엔지 정산 탭의 "월별 매출 세 숫자"(대표님 2026-10-21 "제이에이치 전체 매출 정보가 있어야 한다")에서 청구서 공급가와 같은 기준(공급가액)으로 비교하려고 쓴다 */
export function taxSalesSupplyByMonth(entries) {
  const out = {}; (Array.isArray(entries) ? entries : []).forEach((e) => {
    if (!e || typeof e !== 'object' || !e.source || e.source.kind !== 'taxinv_sales' || typeof e.date !== 'string' || !Array.isArray(e.lines)) return;
    if (!e.lines.some((l) => l && l.account === '1100' && l.side === 'D')) return;
    const ym = e.date.slice(0, 7); e.lines.forEach((l) => { if (!l || l.account !== '4010') return; const m = Number(l.amount) || 0; out[ym] = (out[ym] || 0) + (l.side === 'C' ? m : -m); });
  }); return out;
}
/** 월별 매출 세 숫자 — 청구서(이엔지 명의, 서버 invoiceMonthly: 공급가·완결·미완결)·세금계산서(공급가·부가세 포함 합계)·통장 입금을 월별 한 줄과 연 합계로 합친다. 세 서류는 서로 다른 거래의 것이라 짝짓지 않고 나란히만 둔다. 서버 응답이 없거나 이상하면 청구서 칸만 null(세금계산서·입금은 그대로) */
export function revenueTriple(arRows, supply, invoiceMonthly) {
  const fin = (v) => typeof v === 'number' && Number.isFinite(v); const im = invoiceMonthly;
  const ready = !!im && typeof im === 'object' && im.ok === true && Array.isArray(im.months) && !!im.total && typeof im.total === 'object' && im.months.every((m) => m && typeof m === 'object' && typeof m.month === 'string' && fin(m.supply) && fin(m.done) && fin(m.open));
  const by = {}; const row = (ym) => (by[ym] = by[ym] || { ym, invSupply: ready ? 0 : null, invDone: ready ? 0 : null, invOpen: ready ? 0 : null, taxSupply: 0, taxTotal: 0, bank: 0 });
  (Array.isArray(arRows) ? arRows : []).forEach((r) => { if (r && typeof r.ym === 'string') { const x = row(r.ym); x.taxTotal = Number(r.billed) || 0; x.bank = Number(r.received) || 0; } });
  const sp = supply && typeof supply === 'object' ? supply : {}; Object.keys(sp).forEach((ym) => { row(ym).taxSupply = Number(sp[ym]) || 0; });
  if (ready) im.months.forEach((m) => { const x = row(m.month); x.invSupply = m.supply; x.invDone = m.done; x.invOpen = m.open; });
  const rows = Object.keys(by).sort().reverse().map((k) => by[k]); const years = {};
  rows.forEach((r) => { const y = r.ym.slice(0, 4); const t = years[y] = years[y] || { year: y, invSupply: ready ? 0 : null, invDone: ready ? 0 : null, invOpen: ready ? 0 : null, taxSupply: 0, taxTotal: 0, bank: 0 }; if (ready) { t.invSupply += r.invSupply; t.invDone += r.invDone; t.invOpen += r.invOpen; } t.taxSupply += r.taxSupply; t.taxTotal += r.taxTotal; t.bank += r.bank; });
  return { rows, years: Object.keys(years).sort().reverse().map((y) => years[y]), invoiceReady: ready };
}
export const GAP_TYPES = [['nodoc', '증빙 없음(실제로 받지 않은 차액)', '4090'], ['cash', '현금으로 받음(증빙 있음)', '1010'], ['offset', '다른 거래와 상계·공제(증빙 있음)', '2020']];
/** 정산 차액 처리 전표 — 증빙이 있다고 한 유형은 증빙 설명이 비어 있으면 거부 */
export function gapEntry(type, date, amount, memo, evidence) {
  const t = GAP_TYPES.find((x) => x[0] === type); const n = Number(String(amount == null ? '' : amount).replace(/[,\s원]/g, '')); const errors = [];
  if (!t) errors.push('처리 방식을 골라 주세요.'); if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) errors.push('일자를 입력해 주세요.'); if (!Number.isInteger(n) || n <= 0) errors.push('금액은 1원 이상의 정수로 입력해 주세요.'); if (t && t[0] !== 'nodoc' && !String(evidence || '').trim()) errors.push('증빙이 있는 처리는 증빙 내용(문서 이름·날짜 등)을 적어 주세요.');
  if (errors.length) return { ok: false, errors };
  const base = '이엔지 정산 차액 처리 — ' + t[1] + (evidence ? ' · 증빙: ' + String(evidence).trim() : '') + (memo ? ' · ' + String(memo).trim() : ''); const entry = { date, memo: base.slice(0, 200), source: { kind: 'accrual', id: 'enj_gap_in_' + date + '_' + Math.round(n) + '_' + type }, needsReview: type === 'nodoc', lines: [{ account: t[2], side: 'D', amount: n, partner: '제이에이치이엔지' }, { account: '1100', side: 'C', amount: n, partner: '제이에이치이엔지' }] };
  const v = validateEntry(entry); return v.ok ? { ok: true, entry } : { ok: false, errors: v.errors };
}
/* ───────── 마감 전 점검 ───────── */
/** 마감일(through)까지 기준 점검 목록 — level: ok / warn / bad. bad 가 있으면 마감을 권하지 않는다 */
export function closeCheck(entries, through) {
  const E = (entries || []).filter((e) => !e.invalid && e.date <= through); const checks = []; const push = (level, label, detail) => checks.push({ level, label, detail });
  const s = summarize(E); push(s.balanced ? 'ok' : 'bad', '전표 대차 일치', s.balanced ? '차변 = 대변 ' + won(s.debit) : '차변과 대변이 ' + won(Math.abs(s.debit - s.credit)) + ' 다릅니다');
  const yStart = through.slice(0, 4) + '-01-01'; const st = statements(E, yStart, through); push(st.tb.balanced ? 'ok' : 'bad', '합계잔액시산표 대차 일치', st.tb.balanced ? '일치' : '불일치'); push(st.bs.balanced ? 'ok' : 'bad', '재무상태표 균형(자산 = 부채 + 자본)', st.bs.balanced ? '일치' : '차이 ' + won(st.bs.diff)); push(st.cf.balanced ? 'ok' : 'bad', '현금흐름표 기말 현금 = 재무상태표 현금', st.cf.balanced ? '일치' : '차이 ' + won(st.cf.diff));
  const hasOpen = E.some((e) => e.source && e.source.kind === 'opening'); push(hasOpen ? 'ok' : 'warn', '개시(기초) 재산 전표', hasOpen ? '있음' : '없음 — 기초 잔액 없이 시작한 장부입니다');
  const rev = E.filter((e) => e.needsReview && !e.reversedBy).length; push(rev ? 'warn' : 'ok', '확인 필요 전표', rev ? rev + '건이 남아 있습니다(전표 탭 "확인 필요만")' : '없음');
  const wait = E.filter((e) => !e.reversedBy && !e.reverses && e.lines.some((l) => /분류 대기/.test(l.partner || ''))).length; push(wait ? 'warn' : 'ok', '분류 대기 통장 거래', wait ? wait + '건이 임시 계정(미수금)에 있습니다' : '없음');
  const cash = ['1010', '1020'].reduce((a, c) => a + E.reduce((x, e) => x + e.lines.reduce((y, l) => y + (l.account === c ? (l.side === 'D' ? l.amount : -l.amount) : 0), 0), 0), 0); push(cash < 0 ? 'bad' : 'ok', '현금(보통예금+현금) 잔액', cash < 0 ? '마이너스 ' + won(cash) + ' — 빠진 입금이 있는지 확인' : won(cash));
  const ar = E.reduce((x, e) => x + e.lines.reduce((y, l) => y + (l.account === '1100' ? (l.side === 'D' ? l.amount : -l.amount) : 0), 0), 0); push(ar > 0 ? 'warn' : 'ok', '외상매출금 잔액', ar > 0 ? won(ar) + ' — 실제로 받을 돈인지, 정산 차액 처리가 필요한지 확인' : won(ar));
  return { checks, bad: checks.filter((c) => c.level === 'bad').length, warn: checks.filter((c) => c.level === 'warn').length };
}
export { ACCOUNTS, ACCOUNT_BY_CODE };

/* ───────── 인쇄 제목(대기열 1-2-7 ①, 대표님 2026-10-22) ─────────
 * 재무회계 보고서를 "인쇄 → PDF 저장" 할 때의 문서 이름 — 기간(시작~끝)이 핵심이라 docFileName 의 period 형식(종류 - 기간 - 이름). 종류 이름은 화면의 STM 과 같다.
 * ctx = { accountName: 코드 → 이름(없으면 코드 그대로), vatRange: { from, to }(부가세 신고 기간 — 장부로 계산해야 해서 주입) }. 종류를 몰라도 제목 없이 인쇄하지 않도록 "재무회계 보고서"를 돌려준다 */
const PRINT_KINDS = { is: ['손익계산서', 'range'], bs: ['재무상태표', 'asof'], cf: ['현금흐름표', 'range'], tb: ['합계잔액시산표', 'range'], gl: ['계정별 원장', 'range+acct'], pt: ['거래처별 잔액', 'asof+pacct'], bk: ['통장 대사', 'none'], vat: ['부가세 신고표', 'vat'] };
export function reportPrintTitle(rep, ctx) {
  const r = rep && typeof rep === 'object' && !Array.isArray(rep) ? rep : {}; const c = ctx && typeof ctx === 'object' ? ctx : {}; const def = typeof r.kind === 'string' ? PRINT_KINDS[r.kind] : null;
  if (!def) return docFileName({ group: 'period', kind: '재무회계 보고서' });
  const nm = (code) => (typeof c.accountName === 'function' ? String(c.accountName(code) == null ? '' : c.accountName(code)) : String(code == null ? '' : code));
  const mode = def[1]; const o = { group: 'period', kind: def[0] };
  if (mode === 'range' || mode === 'range+acct') { o.from = r.from; o.to = r.to; if (mode === 'range+acct') o.project = nm(r.acct); }
  else if (mode === 'asof' || mode === 'asof+pacct') { o.to = r.to; if (mode === 'asof+pacct') o.project = nm(r.pacct); }
  else if (mode === 'vat' && c.vatRange && typeof c.vatRange === 'object') { o.from = c.vatRange.from; o.to = c.vatRange.to; }
  return docFileName(o);
}

/* ───────── 가맹점 규칙으로 기존 카드 전표 다시 분류(대표님 2026-10-26: 분류표 261곳 저장 뒤 검토 필요 카드 전표에 한꺼번에 적용) ─────────
 * 대상: 카드 전표(source.kind 'card') 중 검토 필요 표시가 있고 역분개되지 않은 것. 카드사는 전표 원천 id(card_{카드사}_날짜_…)에서, 가맹점은 메모의 앞부분에서 읽는다.
 * 규칙과 계정이 이미 같으면 계정은 두고 "확인 완료"만 표시하고(same), 다르면 차변 계정만 바꾼 새 줄을 만든다(items — 전표마다 역분개 + 새 전표). 규칙이 없으면 건드리지 않는다(noRule). */
export const cardIssuerOf = (e) => { const m = /^card_([a-z_]+?)_\d{4}-\d{2}-\d{2}/.exec((e && e.source && e.source.id) || ''); return m ? m[1] : ''; };
export const cardMerchantOf = (e) => String((e && e.memo) || '').replace(/^\[재분류\]\s*/, '').split(' · ')[0];
/** 부가세 대급금 계정 · 매입세액이 불공제라서 부가세를 비용에 합산해야 하는 계정(접대비·인출금=개인 지출) */
export const VAT_ACCOUNT = '1130';
export const VAT_NONDEDUCT_ACCOUNTS = ['6040', '3020'];
export function ruleReclassPlan(entries, rules, opts) {
  const o = opts || {}; const by = new Map((rules || []).map((r) => [r.issuer + '|' + r.key, r])); const items = [], same = [], noRule = [], skipped = []; let targets = 0;
  (entries || []).forEach((e) => {
    if (!e || e.invalid || !e.source || e.source.kind !== 'card' || !e.needsReview || e.reversedBy || e.reverses) return;
    targets++; const rule = by.get(cardIssuerOf(e) + '|' + merchantKey(cardMerchantOf(e)));
    if (!rule) { noRule.push({ id: e.id, no: e.no, merchant: cardMerchantOf(e) }); return; }
    // 차변은 "비용 한 줄" 또는 "비용 한 줄 + 부가세(1130) 한 줄"만 처리 — 그 밖의 구성은 건드리지 않고 건너뛴다
    const ds = (e.lines || []).map((l, i) => ({ l, i })).filter((x) => x.l.side === 'D'); const vatLs = ds.filter((x) => x.l.account === VAT_ACCOUNT), expLs = ds.filter((x) => x.l.account !== VAT_ACCOUNT);
    if (expLs.length !== 1 || vatLs.length > 1) { skipped.push({ id: e.id, no: e.no, reason: '차변이 비용 한 줄(+부가세 한 줄)이 아닙니다' }); return; }
    const d = expLs[0].l, di = expLs[0].i, v = vatLs[0] || null; if (d.account === rule.account) { same.push({ entry: e, rule }); return; }
    const exp = Number(d.amount) || 0, vat = v ? Number(v.l.amount) || 0 : 0; const merge = !!v && VAT_NONDEDUCT_ACCOUNTS.includes(rule.account);
    const r = reclassLines(e, { [di]: rule.account }, null); if (!r.ok) { skipped.push({ id: e.id, no: e.no, reason: r.errors[0] }); return; }
    let lines = r.lines;
    if (merge) { lines = r.lines.filter((_, k) => k !== v.i).map((l, k) => (l.side === 'D' && l.account === rule.account ? Object.assign({}, l, { amount: exp + vat }) : l)); const sd = lines.filter((l) => l.side === 'D').reduce((a, l) => a + Number(l.amount), 0), sc = lines.filter((l) => l.side === 'C').reduce((a, l) => a + Number(l.amount), 0); /* 이중 안전장치 — 위의 reclassLines 가 원 전표의 대차를 이미 검사하므로 현재 입력으로는 도달하지 않는다(시험으로 도달 불가를 확인함). 합산 로직을 바꿀 때를 대비해 남겨 둔다 */ if (Math.round(sd) !== Math.round(sc)) { skipped.push({ id: e.id, no: e.no, reason: '부가세를 합산하면 차변·대변이 맞지 않습니다' }); return; } }
    const date = reclassDefaultDate(e, o.lockedThrough, o.today); const moved = exp + (merge ? vat : 0);
    const deltas = [{ account: d.account, amount: -exp }, { account: rule.account, amount: moved }].concat(merge ? [{ account: VAT_ACCOUNT, amount: -vat }] : []);
    items.push({ entry: e, lines, date, shifted: date !== e.date, from: d.account, to: rule.account, amount: moved, vat, vatMerged: merge, deltas });
  });
  const mv = new Map(); items.forEach((i) => { const k = i.from + '>' + i.to; const x = mv.get(k) || { from: i.from, to: i.to, count: 0, amount: 0 }; x.count++; x.amount += i.amount; mv.set(k, x); });
  const personal = items.filter((i) => i.to === '3020'); // 개인 지출(인출금) — 회사 비용에서 빠진다
  const kept = items.filter((i) => i.vat > 0 && !i.vatMerged), merged = items.filter((i) => i.vatMerged);
  const sumv = (a) => a.reduce((s, i) => s + i.vat, 0);
  return { targets, items, same, noRule, skipped, moves: [...mv.values()].sort((a, b) => b.count - a.count || b.amount - a.amount), amount: items.reduce((s, i) => s + i.amount, 0), personal: { count: personal.length, amount: personal.reduce((s, i) => s + i.amount, 0) }, shifted: items.filter((i) => i.shifted).length, vat: { kept: kept.length, keptAmount: sumv(kept), merged: merged.length, mergedAmount: sumv(merged), car: kept.filter((i) => i.to === '6120').length } };
}
/** 계정별 순합계(차변 − 대변) — 역분개·새 전표를 포함한 모든 유효 전표 */
export function netByAccount(entries) { const m = new Map(); (entries || []).forEach((e) => { if (!e || e.invalid) return; (e.lines || []).forEach((l) => { m.set(l.account, (m.get(l.account) || 0) + (l.side === 'D' ? 1 : -1) * (Number(l.amount) || 0)); }); }); return m; }
/** 처리한 계획(items)이 장부에 계획대로만 반영됐는지 — 계정별 변화가 계획(items 의 deltas: 계정별 증감, 없으면 from −금액·to +금액)과 같고 장부 전체가 대차 균형인지 */
export function verifyReclass(before, after, items) {
  const exp = new Map(); const add = (a, v) => exp.set(a, (exp.get(a) || 0) + v); (items || []).forEach((i) => { if (Array.isArray(i.deltas)) i.deltas.forEach((d) => add(d.account, d.amount)); else { add(i.from, -i.amount); add(i.to, i.amount); } });
  const keys = new Set([...(before ? before.keys() : []), ...(after ? after.keys() : []), ...exp.keys()]); const diffs = []; let sum = 0;
  keys.forEach((k) => { const act = ((after && after.get(k)) || 0) - ((before && before.get(k)) || 0); const ex = exp.get(k) || 0; if (Math.round(act) !== Math.round(ex)) diffs.push({ account: k, expected: ex, actual: act }); sum += (after && after.get(k)) || 0; });
  const balanced = Math.round(sum) === 0; return { ok: !diffs.length && balanced, diffs, balanced };
}
