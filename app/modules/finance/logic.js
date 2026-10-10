import { ACCOUNTS, ACCOUNT_BY_CODE, validateEntry, totals, trialBalance, incomeStatement, constructionCost, balanceSheet, openingEntry, suggestPurchaseAccount, cashFlowStatement } from '../../shared/ledger-engine.js?v=20261008m';
import { checkOwnership, entryFromTaxInvoice } from '../../shared/hometax-import.js?v=20261008m';
import { entryFromBank, classificationReport } from '../../shared/bank-classify.js?v=20261008m';
import { entryFromCard, classifyCardItem, setMerchantRules } from '../../shared/card-classify.js?v=20261008m';
import { entryFromPortalPayslip } from '../../shared/payroll-import.js?v=20261008m';
import { merchantKey, parseMerchantTable, CHOICES, CHOICE_ACCOUNT } from '../../shared/merchant-table.js?v=20261008m';

/* 재무회계 화면의 순수 규칙 — 전표 목록 거르기·재무제표 계산·가져오기 미리보기·개시 재산 목록. 화면·네트워크 없이 시험한다(tests/finance.test.mjs). */
export const SOURCE_LABEL = { opening: '개시', invoice: '청구 정산서', payment: '지급예정서', payment_paid: '지급', expense: '비용 입력', taxinv_sales: '홈택스 매출', taxinv_purchase: '홈택스 매입', owner_settle: '대표자 정산', bank: '통장', card: '카드', payslip: '급여', accrual: '결산 정리', prepaid: '선급금 대체', manual: '수기' };
export const sourceLabel = (k) => SOURCE_LABEL[k] || k || '수기';
export const won = (n) => { const v = Math.round(Number(n) || 0); return (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('ko-KR'); };
export const accountName = (code) => (ACCOUNT_BY_CODE[code] ? ACCOUNT_BY_CODE[code].name : code);
export const kstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

/** Firestore 문서 → 화면용 전표 */
export function docToEntry(id, d) { return { id, no: d.no || '', seq: d.seq || 0, date: d.date || '', memo: d.memo || '', source: d.source || { kind: 'manual' }, lines: (d.lines || []).map((l) => ({ account: l.account, side: l.side, amount: l.amount, partner: l.partner || '', pjt: l.pjt || '' })), status: d.status || 'posted', reverses: d.reverses || '', reversesNo: d.reversesNo || '', reversedBy: d.reversedBy || '', reversedByNo: d.reversedByNo || '', createdByName: d.createdByName || '', createdMs: d.createdAt && d.createdAt.seconds ? d.createdAt.seconds * 1000 : 0, needsReview: !!d.needsReview, reviewNote: d.reviewNote || '', replaces: d.replaces || '', replacesNo: d.replacesNo || '', attachments: (d.attachments || []).map((a) => ({ id: a.id, name: a.name, mime: a.mime, size: a.size, byName: a.byName || '', atMs: a.atMs || 0 })) }; }
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
export function statements(entries, from, to) { const E = (entries || []).filter((e) => !e.invalid); return { is: incomeStatement(E, from, to), cc: constructionCost(E, from, to), bs: balanceSheet(E, to, from), tb: trialBalance(E, to), cf: cashFlowStatement(E, from, to), from, to }; }
export function statementCsv(st, kind) {
  const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; const L = [];
  if (kind === 'is') { const s = st.is; L.push(['구분', '계정', '금액']); s.revenue.forEach((r) => L.push(['매출', r.name, r.amount])); L.push(['', '매출액', s.sales]); st.cc.groups.forEach((g) => { g.items.forEach((r) => L.push([g.label, r.name, r.amount])); L.push([g.label, '소계', g.subtotal]); }); L.push(['', '매출원가(당기총공사비)', s.costOfSales], ['', '매출총이익', s.grossProfit]); s.sga.forEach((r) => L.push(['판관비', r.name, r.amount])); L.push(['', '판관비 합계', s.sgaTotal], ['', '영업이익', s.operatingIncome]); s.nonopRevenue.forEach((r) => L.push(['영업외수익', r.name, r.amount])); s.nonopExpense.forEach((r) => L.push(['영업외비용', r.name, r.amount])); L.push(['', '당기순이익(세무조정 전)', s.netIncome]); }
  else if (kind === 'cf') { const c = st.cf; L.push(['구분', '항목', '금액']); L.push(['', '기초 현금', c.beginCash]); c.operating.forEach((r) => L.push(['영업활동', r.name, r.amount])); L.push(['', '영업활동 현금흐름', c.operatingTotal]); c.investing.forEach((r) => L.push(['투자활동', r.name, r.amount])); L.push(['', '투자활동 현금흐름', c.investingTotal]); c.financing.forEach((r) => L.push(['재무활동', r.name, r.amount])); L.push(['', '재무활동 현금흐름', c.financingTotal], ['', '현금 증감', c.change], ['', '기말 현금', c.endCash], ['', '검산(재무상태표 현금과의 차이)', c.diff]); }
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
  let incoming = [], filled = 0, unknown = []; (sheetsRows || []).forEach((rows) => { const r = parseMerchantTable(rows); if (r.error) return; incoming = incoming.concat(r.rules); filled += r.filled; unknown = unknown.concat(r.unknown || []); });
  if (!incoming.length && !filled) return { error: '가맹점 분류표(대표님 분류 칸)를 찾지 못했습니다. 내려받은 분류표 파일이 맞는지 확인해 주세요.' };
  const cur = new Map((existing || []).map((r) => [merchantRuleKey(r), r])); let added = 0, changed = 0, same = 0; incoming.forEach((r) => { const o = cur.get(merchantRuleKey(r)); if (!o) added++; else if (o.account !== r.account) changed++; else same++; });
  return { rules: mergeRules(existing, incoming.map((r) => ({ issuer: r.issuer, key: r.key, account: r.account, label: r.label, memo: r.memo })), merchantRuleKey), incoming: incoming.length, filled, added, changed, same, unknown: [...new Set(unknown)] };
}
/* ───────── 재분류(계정 바꾸기) ───────── */
/** 원 전표 줄들에서 계정만 바꾼 새 줄 — changes: { 줄 번호: 새 계정 코드 }. 바뀐 줄이 없으면 오류 */
export function reclassLines(entry, changes) {
  const lines = entry.lines.map((l, i) => Object.assign({}, l, { account: changes && changes[i] ? changes[i] : l.account })); const diff = lines.filter((l, i) => l.account !== entry.lines[i].account).length;
  if (!diff) return { ok: false, errors: ['바꾼 계정이 없습니다.'] }; const e = { date: '2026-01-01', memo: '', source: { kind: 'manual' }, lines: lines.map((l) => ({ account: l.account, side: l.side, amount: l.amount, partner: l.partner || '', pjt: l.pjt || '' })) }; const v = validateEntry(e); return v.ok ? { ok: true, lines: e.lines, changed: diff } : { ok: false, errors: v.errors };
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
