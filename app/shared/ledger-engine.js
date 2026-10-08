/* 복식 원장 계산 엔진 — 재무제표(공사원가명세서·손익계산서·재무상태표·합계잔액시산표)와 자동 전표 제안.
 * 순수 함수(화면·네트워크 없음). 금액은 원 단위 정수. 설계: 기획_재무제표_설계_r1.md
 * 전표(entry) = { id?, date:'YYYY-MM-DD', memo, source:{kind,id}, lines:[{account:'1020', side:'D'|'C', amount:정수, partner?, pjt?}] } */

/** 계정과목 — type: asset|liab|equity|revenue|cost|sga|nonop_rev|nonop_exp · normal: 'D'|'C'(정상 잔액 쪽) · costGroup: 공사원가 4구분 */
export const ACCOUNTS = [
  { code: '1010', name: '현금', type: 'asset', normal: 'D' }, { code: '1020', name: '보통예금(사업용계좌)', type: 'asset', normal: 'D' },
  { code: '1100', name: '외상매출금', type: 'asset', normal: 'D' }, { code: '1110', name: '미수금', type: 'asset', normal: 'D' }, { code: '1120', name: '선급금', type: 'asset', normal: 'D' },
  { code: '1130', name: '부가세대급금', type: 'asset', normal: 'D' }, { code: '1140', name: '선급비용', type: 'asset', normal: 'D' }, { code: '1200', name: '재고자산(미사용 자재)', type: 'asset', normal: 'D' },
  { code: '1500', name: '차량운반구', type: 'asset', normal: 'D' }, { code: '1510', name: '비품', type: 'asset', normal: 'D' }, { code: '1590', name: '감가상각누계액', type: 'asset', normal: 'C' },
  { code: '2010', name: '외상매입금', type: 'liab', normal: 'C' }, { code: '2020', name: '미지급금', type: 'liab', normal: 'C' }, { code: '2021', name: '미지급금(대표자 개인카드)', type: 'liab', normal: 'C' },
  { code: '2030', name: '예수금', type: 'liab', normal: 'C' }, { code: '2040', name: '부가세예수금', type: 'liab', normal: 'C' }, { code: '2050', name: '선수금', type: 'liab', normal: 'C' }, { code: '2070', name: '미지급비용(이자)', type: 'liab', normal: 'C' }, { code: '2210', name: '차량할부금', type: 'liab', normal: 'C' },
  { code: '2100', name: '단기차입금', type: 'liab', normal: 'C' }, { code: '2200', name: '장기차입금', type: 'liab', normal: 'C' },
  { code: '3010', name: '자본금', type: 'equity', normal: 'C' }, { code: '3020', name: '인출금', type: 'equity', normal: 'D' },
  { code: '4010', name: '공사수입', type: 'revenue', normal: 'C' },
  { code: '5010', name: '공사자재비', type: 'cost', normal: 'D', costGroup: 'material' },
  { code: '5110', name: '현장노무비', type: 'cost', normal: 'D', costGroup: 'labor' },
  { code: '5210', name: '외주공사비', type: 'cost', normal: 'D', costGroup: 'subcon' },
  { code: '5310', name: '현장운반비', type: 'cost', normal: 'D', costGroup: 'expense' }, { code: '5320', name: '현장장비임차료', type: 'cost', normal: 'D', costGroup: 'expense' },
  { code: '5330', name: '현장유류비·통행료', type: 'cost', normal: 'D', costGroup: 'expense' }, { code: '5340', name: '안전관리비·현장소모품', type: 'cost', normal: 'D', costGroup: 'expense' },
  { code: '5350', name: '현장복리후생비(식대)', type: 'cost', normal: 'D', costGroup: 'expense' }, { code: '5360', name: '현장차량임차료', type: 'cost', normal: 'D', costGroup: 'expense' }, { code: '5370', name: '현장숙소·기숙사 임차료', type: 'cost', normal: 'D', costGroup: 'expense' }, { code: '5380', name: '현장창고 임차료·관리비', type: 'cost', normal: 'D', costGroup: 'expense' }, { code: '5390', name: '기타현장경비', type: 'cost', normal: 'D', costGroup: 'expense' },
  { code: '6010', name: '급여(사무)', type: 'sga', normal: 'D' }, { code: '6020', name: '복리후생비', type: 'sga', normal: 'D' }, { code: '6030', name: '여비교통비', type: 'sga', normal: 'D' },
  { code: '6040', name: '접대비', type: 'sga', normal: 'D' }, { code: '6050', name: '통신비', type: 'sga', normal: 'D' }, { code: '6060', name: '임차료', type: 'sga', normal: 'D' },
  { code: '6070', name: '세금과공과', type: 'sga', normal: 'D' }, { code: '6080', name: '감가상각비', type: 'sga', normal: 'D' }, { code: '6090', name: '소모품비', type: 'sga', normal: 'D' },
  { code: '6100', name: '지급수수료', type: 'sga', normal: 'D' }, { code: '6110', name: '보험료', type: 'sga', normal: 'D' }, { code: '6120', name: '차량유지비', type: 'sga', normal: 'D' }, { code: '6130', name: '차량임차료', type: 'sga', normal: 'D' }, { code: '6190', name: '기타판관비', type: 'sga', normal: 'D' },
  { code: '7010', name: '이자수익', type: 'nonop_rev', normal: 'C' }, { code: '7090', name: '잡이익', type: 'nonop_rev', normal: 'C' },
  { code: '8010', name: '이자비용', type: 'nonop_exp', normal: 'D' }, { code: '8030', name: '기부금', type: 'nonop_exp', normal: 'D' }, { code: '8090', name: '잡손실', type: 'nonop_exp', normal: 'D' }
];
export const ACCOUNT_BY_CODE = Object.fromEntries(ACCOUNTS.map((a) => [a.code, a]));
export const COST_GROUP_LABEL = { material: 'Ⅰ. 재료비', labor: 'Ⅱ. 노무비', subcon: 'Ⅲ. 외주비', expense: 'Ⅳ. 경비' };
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(Date.parse(s));
const isInt = (n) => typeof n === 'number' && Number.isInteger(n);

/** 전표 검증 — 서버(ledgerAct)도 같은 규칙을 쓴다. 차변 합 = 대변 합이어야 한다 */
export function validateEntry(e, opts) {
  const errors = []; const lines = (e && e.lines) || [];
  if (!e || !isDate(e.date)) errors.push('전표 일자가 올바르지 않습니다.');
  if (opts && opts.lockedBefore && isDate(e && e.date) && e.date <= opts.lockedBefore) errors.push('마감된 기간(' + opts.lockedBefore + ' 이전)의 전표는 만들 수 없습니다. 수정이 필요하면 마감 이후 날짜로 역분개하세요.');
  if (lines.length < 2) errors.push('전표는 두 줄 이상이어야 합니다.');
  let d = 0, c = 0;
  lines.forEach((l, i) => {
    if (!ACCOUNT_BY_CODE[l.account]) errors.push((i + 1) + '번째 줄: 없는 계정과목(' + l.account + ')');
    if (l.side !== 'D' && l.side !== 'C') errors.push((i + 1) + '번째 줄: 차변/대변을 지정해 주세요.');
    if (!isInt(l.amount) || l.amount <= 0) errors.push((i + 1) + '번째 줄: 금액은 1원 이상의 정수여야 합니다.');
    else if (l.side === 'D') d += l.amount; else if (l.side === 'C') c += l.amount;
  });
  if (!errors.length && d !== c) errors.push('차변 합계(' + d.toLocaleString('ko-KR') + ')와 대변 합계(' + c.toLocaleString('ko-KR') + ')가 다릅니다.');
  return { ok: errors.length === 0, errors, debit: d, credit: c };
}

/** 계정별 차변·대변 합계 (from~to 포함, 비우면 전체) */
export function totals(entries, from, to) {
  const t = {};
  (entries || []).forEach((e) => { if ((from && e.date < from) || (to && e.date > to)) return; (e.lines || []).forEach((l) => { const x = t[l.account] || (t[l.account] = { debit: 0, credit: 0 }); if (l.side === 'D') x.debit += l.amount; else x.credit += l.amount; }); });
  return t;
}
/** 정상 잔액 방향 기준 금액(정상 쪽이 +) */
const net = (code, t) => { const a = ACCOUNT_BY_CODE[code]; const x = t[code] || { debit: 0, credit: 0 }; return a.normal === 'D' ? x.debit - x.credit : x.credit - x.debit; };
const sumType = (t, type, filter) => ACCOUNTS.filter((a) => a.type === type && (!filter || filter(a))).map((a) => ({ code: a.code, name: a.name, amount: (type === 'asset' && a.normal === 'C' ? -1 : 1) * net(a.code, t), costGroup: a.costGroup })).filter((r) => r.amount !== 0);   // 자산 차감 계정(감가상각누계액)은 음수로
const total = (rows) => rows.reduce((s, r) => s + r.amount, 0);

/** 합계잔액시산표 — as of to(포함) 누적. 합계(차·대)와 잔액(차·대), 전체 합이 서로 같아야 한다 */
export function trialBalance(entries, to) {
  const t = totals(entries, null, to); const rows = ACCOUNTS.filter((a) => t[a.code]).map((a) => { const x = t[a.code]; const bal = x.debit - x.credit; return { code: a.code, name: a.name, debit: x.debit, credit: x.credit, balDebit: bal > 0 ? bal : 0, balCredit: bal < 0 ? -bal : 0 }; });
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0); const totals_ = { debit: sum('debit'), credit: sum('credit'), balDebit: sum('balDebit'), balCredit: sum('balCredit') };
  return { rows, totals: totals_, balanced: totals_.debit === totals_.credit && totals_.balDebit === totals_.balCredit };
}
/** 공사원가명세서 — 재료비·노무비·외주비·경비, 당기총공사비 */
export function constructionCost(entries, from, to) {
  const t = totals(entries, from, to); const rows = sumType(t, 'cost'); const groups = ['material', 'labor', 'subcon', 'expense'].map((g) => { const items = rows.filter((r) => r.costGroup === g); return { key: g, label: COST_GROUP_LABEL[g], items, subtotal: total(items) }; });
  return { groups, total: total(rows) };
}
/** 손익계산서 — 매출액 − 매출원가(당기공사원가) = 매출총이익 − 판관비 = 영업이익 ± 영업외손익 = 당기순이익 */
export function incomeStatement(entries, from, to) {
  const t = totals(entries, from, to); const revenue = sumType(t, 'revenue'), cost = constructionCost(entries, from, to), sga = sumType(t, 'sga'), nr = sumType(t, 'nonop_rev'), ne = sumType(t, 'nonop_exp');
  const sales = total(revenue); const gross = sales - cost.total; const opInc = gross - total(sga); const net_ = opInc + total(nr) - total(ne);
  return { revenue, sales, costOfSales: cost.total, grossProfit: gross, sga, sgaTotal: total(sga), operatingIncome: opInc, nonopRevenue: nr, nonopRevTotal: total(nr), nonopExpense: ne, nonopExpTotal: total(ne), netIncome: net_ };
}
/** 재무상태표 — asOf(포함). 개인사업자: 자본 = 자본금 + 전기이월손익 + 당기순이익 − 인출금. fiscalStart 이전 손익은 전기이월로 */
export function balanceSheet(entries, asOf, fiscalStart) {
  const t = totals(entries, null, asOf); const assets = sumType(t, 'asset'), liabs = sumType(t, 'liab');
  const cur = fiscalStart ? incomeStatement(entries, fiscalStart, asOf).netIncome : incomeStatement(entries, null, asOf).netIncome;
  const prior = fiscalStart ? incomeStatement(entries, null, dayBefore(fiscalStart)).netIncome : 0;
  const capital = net('3010', t), draw = net('3020', t);
  const equity = [{ code: '3010', name: '자본금', amount: capital }, { code: '3020', name: '인출금', amount: -draw }, { code: 'pl_prior', name: '전기이월손익', amount: prior }, { code: 'pl_cur', name: '당기순손익', amount: cur }].filter((r) => r.amount !== 0);
  const A = total(assets), L = total(liabs), E = total(equity);
  return { assets, assetsTotal: A, liabs, liabsTotal: L, equity, equityTotal: E, balanced: A === L + E, diff: A - (L + E) };
}
export function dayBefore(d) { const t = new Date(Date.parse(d + 'T00:00:00Z') - 86400000); return t.toISOString().slice(0, 10); }

/** 개시 전표 — 자산·부채 목록을 넣으면 자본금이 차액으로 들어간다(2025년 말 재무상태표가 없을 때 재산 목록으로 만든다) */
export function openingEntry(date, assets, liabs, memo) {
  const lines = []; let a = 0, l = 0;
  (assets || []).forEach((x) => { if (x.amount) { const ac = ACCOUNT_BY_CODE[x.account]; lines.push({ account: x.account, side: ac && ac.normal === 'C' ? 'C' : 'D', amount: Math.abs(x.amount) }); a += (ac && ac.normal === 'C' ? -1 : 1) * Math.abs(x.amount); } });
  (liabs || []).forEach((x) => { if (x.amount) { lines.push({ account: x.account, side: 'C', amount: x.amount }); l += x.amount; } });
  const cap = a - l; if (cap > 0) lines.push({ account: '3010', side: 'C', amount: cap }); else if (cap < 0) lines.push({ account: '3020', side: 'D', amount: -cap });   // 순자산이 마이너스면(자본잠식) 인출금 차변으로 임시 표시 — 세무사 확인
  return { date, memo: memo || '개시(기초) 재무상태표', source: { kind: 'opening' }, lines };
}

/* ───────── 자동 전표 제안 (정산서·비용 장부 → 전표 초안) ───────── */
const won = (n) => Math.round(Number(n) || 0);
/** 청구 정산서(매출) 완결 → 외상매출금 / 공사수입 + 부가세예수금 */
export function entryFromInvoice(s) {
  const total_ = won(s.total || (s.supply || s.amount || 0) + won(s.vat)); const supply = won(s.supply != null ? s.supply : s.amount); const vat = Math.max(0, total_ - supply);
  const lines = [{ account: '1100', side: 'D', amount: total_, partner: (s.recipient && s.recipient.company) || '', pjt: s.pjtId || '' }, { account: '4010', side: 'C', amount: supply, pjt: s.pjtId || '' }]; if (vat) lines.push({ account: '2040', side: 'C', amount: vat });
  return { date: s.issueDate || s.payDate || (s.baseMonth ? s.baseMonth + '-01' : ''), memo: '청구 ' + (s.no || ''), source: { kind: 'invoice', id: s.id }, lines };
}
/** 지급예정서(외주·용역 지급) → 외주공사비 + 부가세대급금 / 외상매입금, 지급완료분은 외상매입금 / 보통예금 */
export function entriesFromPayment(s) {
  const total_ = won(s.total || won(s.supply) + won(s.vat)); const supply = won(s.supply); const vat = Math.max(0, total_ - supply); const partner = (s.recipient && s.recipient.company) || '';
  const out = [{ date: s.issueDate || (s.baseMonth ? s.baseMonth + '-01' : ''), memo: '지급예정 ' + (s.no || ''), source: { kind: 'payment', id: s.id }, lines: [{ account: '5210', side: 'D', amount: supply, partner, pjt: s.pjtId || '' }].concat(vat ? [{ account: '1130', side: 'D', amount: vat }] : [], [{ account: '2010', side: 'C', amount: total_, partner }]) }];
  if (s.status === 'done' && s.payDate) out.push({ date: s.payDate, memo: '지급 ' + (s.no || ''), source: { kind: 'payment_paid', id: s.id }, lines: [{ account: '2010', side: 'D', amount: total_, partner }, { account: '1020', side: 'C', amount: total_ }] });
  return out;
}
/** 비용 장부 분류 + 현장(프로젝트 연결) 여부 → 계정. 확실치 않은 건은 needsReview */
export function expenseAccount(cat, hasPjt) {
  const site = { '식대': ['5350', true], '유류비': ['5330', true], '공구·자재비': ['5010', false], '사무용품': ['5340', true], '급여': ['5110', false], '용역비': ['5210', false], '차량유지비': ['5390', true], '임대료': ['5320', true], '세금': ['6070', false], '기타': ['5390', true] };
  const office = { '식대': ['6020', true], '유류비': ['6120', true], '공구·자재비': ['6090', true], '사무용품': ['6090', false], '급여': ['6010', false], '용역비': ['6100', false], '차량유지비': ['6120', false], '임대료': ['6060', false], '세금': ['6070', false], '기타': ['6190', true] };
  const m = (hasPjt ? site : office)[cat] || (hasPjt ? site['기타'] : office['기타']); return { account: m[0], needsReview: m[1] };
}
const PAY_CREDIT = { '개인카드': '2021', '법인카드': '2020', '현금': '1010', '계좌이체': '1020', '외상거래': '2010' };
/** 비용 장부 1건 → 전표 초안. 개인카드는 미지급금(대표자)로 쌓아 두고, 대표님께 정산할 때 미지급금 / 보통예금 */
export function entryFromExpense(e, opt) {
  const supply = won(e.supply != null && e.supply !== '' ? e.supply : e.total - won(e.vat)); const vat = won(e.vat); const total_ = won(e.total || supply + vat);
  const acc = (opt && opt.accountOverride) || expenseAccount(e.cat, !!e.pjt); const account = acc.account || acc; const deductible = !(opt && opt.vatNonDeductible);
  const lines = [{ account, side: 'D', amount: deductible ? supply : supply + vat, pjt: e.pjt || '', partner: e.vendor || '' }]; if (deductible && vat) lines.push({ account: '1130', side: 'D', amount: vat });
  lines.push({ account: PAY_CREDIT[e.pay] || '2020', side: 'C', amount: total_, partner: e.vendor || '' });
  return { date: e.date || (e.accMonth ? e.accMonth + '-01' : ''), memo: (e.cat || '') + ' ' + (e.vendor || ''), source: { kind: 'expense', id: e.id }, needsReview: !!(acc.needsReview), lines };
}
/** 대표님께 개인카드 대금 정산(미지급금 → 보통예금) */
export function entrySettleOwner(date, amount, memo) { return { date, memo: memo || '개인카드 사용분 대표자 정산', source: { kind: 'owner_settle' }, lines: [{ account: '2021', side: 'D', amount }, { account: '1020', side: 'C', amount }] }; }

/** 매입 세금계산서의 품목·거래처 → 계정 후보(기본값). 확실하지 않으면 needsReview. 대표님이 거래처별로 정하면 그 값이 우선(화면에서 기억) */
export function suggestPurchaseAccount(inv) {
  const t = ((inv.item || '') + ' ' + (inv.supplier && inv.supplier.name || '') + ' ' + (inv.memo || '')).replace(/\s+/g, '');
  const rules = [
    [/도영|지평|원희캐슬|창고/, '5380', false], [/공사대금|공사비|시공|설치비|도급/, '5210', false], [/렌트|리스|캐피탈/, '5360', true], [/임대료|월세|관리비/, '6060', false],
    [/통신|오피스넷|인터넷|케이티|KT|SK브로드|LG유플/i, '6050', false], [/오피스365|오피스\d|소프트웨어|라이선스|구독|NCE|클라우드|데이타서비스/, '6100', false], [/수수료|인증서/, '6100', false],
    [/안전모|안전화|안전|조끼|휀스|펜스|스카프|장갑|보호구|먹통|공구|수리|소모품|테이프|폼/, '5340', true], [/자재|배관|덕트|냉매|배선|드레인|공조|FCU/i, '5010', true], [/보험/, '6110', false]
  ];
  for (const [re, account, needsReview] of rules) if (re.test(t)) return { account, needsReview };
  return { account: '5010', needsReview: true };
}

/** 카드사별 대변 계정: 농협카드는 대표님 개인카드(대금은 대표님 개인 농협 계좌에서 나가고, 회사가 정산) → 미지급금(대표자 개인카드). 삼성·현대·IBK 는 회사 통장에서 결제 → 미지급금(카드사) */
export function cardCreditAccount(issuer) { return issuer === 'nonghyup' ? '2021' : '2020'; }

/* ───────── 대출·할부·선급비용 계산 ───────── */
const day = (d) => Date.parse(d + 'T00:00:00Z') / 86400000;
/** 단리 일할 이자(실제 일수/365) — 원금 × 연이율 × 일수 / 365, 원 단위 반올림 */
export function dailyInterest(principal, annualRate, from, to) { return Math.round(principal * annualRate * (day(to) - day(from)) / 365); }
/** 원리금균등 상환표: 월 이율 r, 월 납입액 pmt. n회까지 {no, interest, principal, balance} 반환(마지막 회차 반올림 오차는 balance 에 남음) */
export function annuitySchedule(pv, monthlyRate, pmt, n) { const out = []; let bal = pv; for (let i = 1; i <= n; i++) { const interest = Math.round(bal * monthlyRate); const principal = pmt - interest; bal -= principal; out.push({ no: i, interest, principal, balance: bal }); } return out; }
/** 대출 잔액이 알려진 회차의 잔액과 같아지는 월 이율을 이분법으로 찾는다(잔액 54,731,380 = 24회차 후 같은 계약에서 역산) */
export function solveMonthlyRate(pv, pmt, afterN, balanceAfterN) { let lo = 0, hi = 0.05; for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; const b = annuitySchedule(pv, mid, pmt, afterN)[afterN - 1].balance; if (b > balanceAfterN) hi = mid; else lo = mid; } return (lo + hi) / 2; }
/** 선급비용(보증료 등) 월 안분: 기간 [start, end] 일수 기준으로 asOf 까지 비용으로 넘어간 금액 */
export function prepaidUsed(total, start, end, asOf) { const span = day(end) - day(start) + 1; const used = Math.max(0, Math.min(span, day(asOf) - day(start) + 1)); return Math.round(total * used / span); }

/** 업무용 차량(GMC Sierra, 2024-09-30 구입) 감가상각표 — 대표님 제공(2026-10-08): 취득가 89,870,000, 정률법 상각률 0.451, 잔존가 1,000.
 *  1년차(2024)는 4개월분. 연도별 상각비(원)와 연말 잔존가액. ※ 업무용승용차 특례는 세무상 5년 정액법·연 800만원 한도 → 회계상 정률 상각과의 차이는 세무조정 */
export const VEHICLE = { cost: 89870000, rate: 0.451, residual: 1000, schedule: [{ year: 2024, dep: 13510456 }, { year: 2025, dep: 34438154 }, { year: 2026, dep: 18906546 }, { year: 2027, dep: 10379694 }, { year: 2028, dep: 5698452 }, { year: 2029, dep: 6935698 }] };
/** 연도 말까지 누적 상각액, 해당 연도의 월할 상각액(1~months월) */
export function vehicleAccumulated(throughYear) { return VEHICLE.schedule.filter((s) => s.year <= throughYear).reduce((a, s) => a + s.dep, 0); }
export function vehicleDepreciationYtd(year, months) { const s = VEHICLE.schedule.find((x) => x.year === year); return s ? Math.round(s.dep * months / 12) : 0; }

/** 현금흐름표(간접법) — 기간 from~to. 개시(기초) 전표는 "기초 잔액"으로 보고 흐름에서 뺀다.
 *  모든 비현금 재무상태표 계정의 증감을 현금 영향으로 바꿔 영업·투자·재무로 나눈다: 기초 현금 + 영업 + 투자 + 재무 = 기말 현금(= 재무상태표 현금). 대표자 인출금(3020)과 대표자 개인카드 미지급금(2021)은 합쳐 "대표자 인출·정산(순)" 으로 재무활동에 둔다 */
const CF_OP = [['1100', '외상매출금 증감'], ['1110', '미수금 증감'], ['1120', '선급금 증감'], ['1130', '부가세대급금 증감'], ['1140', '선급비용 증감'], ['1200', '재고자산 증감'], ['2010', '외상매입금 증감'], ['2020', '미지급금 증감'], ['2030', '예수금 증감'], ['2040', '부가세예수금 증감'], ['2050', '선수금 증감'], ['2070', '미지급비용 증감']];
const CF_INV = [['1500', '차량운반구 취득(−)·처분'], ['1510', '비품 취득(−)·처분']];
const CF_FIN = [['2100', '단기차입금 증감'], ['2200', '장기차입금 증감'], ['2210', '차량할부금 증감(상환은 −)'], ['3010', '자본금 증감']];
export function cashFlowStatement(entries, from, to) {
  const all = (entries || []).filter((e) => !e.invalid && (!to || e.date <= to)); const isOpen = (e) => e.source && e.source.kind === 'opening';
  const beginT = totals(all.filter((e) => e.date < from || isOpen(e)), null, null); const endT = totals(all, null, null);
  const ds = (t, c) => { const x = t[c]; return x ? x.debit - x.credit : 0; }; const eff = (c) => -(ds(endT, c) - ds(beginT, c));   // 현금에 미친 영향(+는 늘림)
  const cashB = ds(beginT, '1010') + ds(beginT, '1020'), cashE = ds(endT, '1010') + ds(endT, '1020');
  const ni = incomeStatement(all.filter((e) => !isOpen(e)), from, to).netIncome; const pick = (list) => list.map(([c, n]) => ({ code: c, name: n, amount: eff(c) })).filter((r) => r.amount !== 0);
  const known = new Set(['1010', '1020', '1590', '2021', '3020'].concat(CF_OP.map((x) => x[0]), CF_INV.map((x) => x[0]), CF_FIN.map((x) => x[0])));
  const other = ACCOUNTS.filter((a) => ['asset', 'liab', 'equity'].includes(a.type) && !known.has(a.code)).reduce((s, a) => s + eff(a.code), 0);
  const dep = eff('1590'); const owner = eff('3020') + eff('2021');
  const operating = [{ code: 'ni', name: '당기순이익', amount: ni }].concat(dep ? [{ code: '1590', name: '감가상각비(현금 지출 없음)', amount: dep }] : [], pick(CF_OP), other ? [{ code: 'other', name: '기타 증감(분류 외)', amount: other }] : []);
  const investing = pick(CF_INV); const financing = pick(CF_FIN).concat(owner ? [{ code: 'owner', name: '대표자 인출·정산(순)', amount: owner }] : []);
  const sum = (l) => l.reduce((s, r) => s + r.amount, 0); const opT = sum(operating), invT = sum(investing), finT = sum(financing); const change = cashE - cashB;
  return { from, to, beginCash: cashB, endCash: cashE, netIncome: ni, operating, operatingTotal: opT, investing, investingTotal: invT, financing, financingTotal: finT, change, diff: change - (opT + invT + finT), balanced: change === opT + invT + finT };
}
