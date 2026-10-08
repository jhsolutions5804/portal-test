/* 통장 거래 → 분류 규칙(상대방·내용으로 계정 후보) + 전표 초안. 규칙은 "초안"이며 사람이 확인·수정하고 한 번 정하면 기억한다(설계서 §18).
 * 분류 결과: { cat, account(상대 계정), partner, status:'auto'|'review', note } — 출금은 차변=상대 계정/대변=보통예금, 입금은 차변=보통예금/대변=상대 계정 */
import { validateEntry, solveMonthlyRate, annuitySchedule } from './ledger-engine.js?v=20261008b';
const STAFF = ['정다애', '윤석원', '이한영', '김영서', '형일우'];   // 급여 지급 대상(급여명세서·급여 시트 기준) — 설정 화면에서 관리
const rules = [
  { dir: 'in', re: /과오납/, cat: '국민연금 과오납 환급', account: '6110', status: 'review', note: '연금 보험료 환급 — 회사부담·직원부담 구분 확인(회사부담분이면 보험료 차감)' },
  { dir: 'in', re: /현대캐피탈/, cat: '현대캐피탈 환급', account: '2010', status: 'review', note: '렌트 보증금·정산 환급으로 보고 외상매입금 차감 — 내용 확인' },
  { dir: 'in', re: /신한카드/, cat: '신한카드 소액 입금(1원 인증)', account: '7090', status: 'auto' },
  { dir: 'out', re: /에스에스지페이먼츠|SSG/i, cat: '명절(설) 선물 — 상품권(거래처·발주처 담당자)', account: '6040', status: 'review', note: '대표님 확인 2026-10-08: 거래처·발주처 담당자 선물 → 접대비. 상품권 구입 증빙(결제 영수증)·받은 분 명단 보관 필요(통장 이체만으로는 증빙이 약함)' },
  { dir: 'out', re: /지효근/, cat: '청주 현장 숙소 월세(개인 임대인)', account: '5370', status: 'auto', note: '월별 손익계산서 "청주 숙소 550,000"(1·2월분, 1/31·3/3 이체) — 임대차계약서·임대인 확인, 세금계산서 없는 개인 임대(증빙은 세무사 확인)' },
  { dir: 'in', re: /\[구분:대출실행\]/, cat: '대출 실행(기업은행 진흥기금자금대출)', account: '2200', status: 'auto', note: '약정 40,000,000 · 2026-02-11 실행 · 만기 2031-01-20 · 부분균등분할상환 · 변동금리(현재 3.75%)' },
  { dir: 'in', re: /\[구분:이자\]/, cat: '예금 이자', account: '7010', status: 'auto' },
  { dir: 'out', re: /빌린돈/, cat: '대표자 개인 채무 상환(이체 메모 "빌린돈")', account: '3020', status: 'auto', note: '대표님 개인 차입 상환으로 보고 인출금 처리' },
  { dir: 'out', re: /지방세/, cat: '지방세 납부', account: '6070', status: 'review', note: '자동차세·재산세 등 사업 관련인지 확인' },
  { dir: 'in', re: /김영희/, cat: '매출대금 회수(제이에이치이엔지)', account: '1100', partner: '제이에이치이엔지', status: 'auto' },
  { dir: 'in', re: /제이에이치테크/, cat: '분류 대기: 대출 실행 또는 계좌 이전', account: null, status: 'review', note: '같은 날 신용보증료가 나간 경우 대출 실행일 수 있음(기업은행 대출 내역으로 확인)' },
  { dir: 'out', re: /서민우|에스제이|SJ/, cat: '에스제이 외주비 지급(세금계산서 수취 전)', account: '1120', partner: '에스제이', status: 'auto', note: '세금계산서를 받으면 선급금을 외주공사비로 대체' },
  { dir: 'out', re: new RegExp(STAFF.join('|')), cat: '급여 지급', account: '2020', status: 'auto', note: '급여명세서 기준 미지급 급여를 정리(명세서 없는 달은 확인)' },
  { dir: 'out', re: /경찰청/, cat: '과태료(개인)', account: '3020', status: 'review', note: '개인 위반 과태료는 사업 경비가 아님 — 인출금' },
  { dir: 'out', re: /김영희/, cat: '분류 대기: 김영희(이엔지) 앞 출금', account: null, status: 'review', note: '이엔지 대표 앞 이체 — 대여금 또는 매출 정산 반환 여부 확인' },
  { dir: 'out', re: /김종화/, cat: '대표자 인출', account: '3020', status: 'auto' }, { dir: 'in', re: /김종화/, cat: '대표자 입금(인출금 감소)', account: '3020', status: 'review' },
  { dir: 'out', re: /김민서/, cat: '개인 대출 상환(대표님 확인)', account: '3020', status: 'auto', note: '개인 성격 — 인출금으로 처리(사업 관련 대출이면 세무사 확인)' }, { dir: 'in', re: /김민서/, cat: '김민서 입금', account: '3020', status: 'review' },
  { dir: 'out', re: /삼성카드|비씨카드|BC카드|현대카드|농협카드|기업카드/, cat: '카드 대금 결제', account: '2020', status: 'auto', note: '카드 이용분(미지급금)을 정리 — 이용내역 전표가 있어야 맞음' },
  { dir: 'out', re: /하나캐피탈/, cat: '하나캐피탈 차량 오토할부(원금·이자 분리)', account: '2210', partner: '하나캐피탈', status: 'auto', split: 'hana', note: 'GMC Sierra 6.2 Denali-X(96리3695) · 84,000,000 · 월 1,623,950 · 2024-09-30~2029-10-15 · 24/60회차 — 상환표로 원금과 이자를 나눔' }, { dir: 'out', re: /현대캐피탈/, cat: '현대캐피탈 렌트료 지급', account: '2010', partner: '현대캐피탈', status: 'auto' }, { dir: 'in', re: /캐피탈/, cat: '캐피탈 환급', account: null, status: 'review' },
  { dir: 'out', re: /건강보험|국민연금|고용보험|산재|근로복지/, cat: '4대보험 납부', account: '2030', status: 'review', note: '직원부담분(예수금)과 회사부담분(보험료) 안분 필요' }, { dir: 'in', re: /과오납/, cat: '연금 과오납 환급', account: null, status: 'review' },
  { dir: 'out', re: /이순옥|이연주/, cat: '현장 자재·공구 창고 임차료(원희캐슬 B110·B111)', account: '5380', status: 'auto', note: '대표님 확인 2026-10-08: 현장에서 쓰는 자재·공구류 보관 창고 → 공사원가 경비. 개인 임대(세금계산서 없음) — 계약서·이체 증빙 보관' },
  { dir: 'out', re: /삼정데이타|넘버원|도영|거상|지평|케이티|\(주\)KT/, cat: '매입 세금계산서 대금 지급', account: '2010', status: 'auto' },
  { dir: 'out', re: /신용보증|보증료/, cat: '대출 보증료(5년분 선급)', account: '1140', status: 'auto', note: '약정 5년(0.859%/년 × 40M)에 걸쳐 월 안분 — 결산 때 비용으로 대체' }, { dir: 'out', re: /이자/, cat: '대출 이자', account: '8010', status: 'auto' },
  { dir: 'out', re: /국세|지방세|세입|세무서|국세청/, cat: '세금 납부', account: null, status: 'review', note: '부가세·원천세·소득세 구분 필요' }, { dir: 'out', re: /지급수수료|수수료|인증서/, cat: '은행 수수료', account: '6100', status: 'auto' }
];
/** 기업은행에서 대표님 농협 계좌로 간 이체 중 농협 거래내역에 같은 금액이 "E-기업은행" 입금으로 잡힌 건(±1일) — 개인카드 대금 정산으로 본다.
 *  반환: 정산으로 볼 기업은행 거래 키의 집합. 농협 계좌는 대표님 개인 계좌(저축예금)이고 농협카드(개인카드) 대금이 거기서 빠져나간다 */
export function ownerSettlementKeys(bankTxns, nhTxns) {
  const keys = new Set(); const used = new Set(); const day = (d) => Date.parse(d + 'T00:00:00Z') / 86400000;
  (nhTxns || []).filter((x) => x.in > 0 && /기업은행/.test(x.desc + ' ' + x.counterName)).forEach((x) => {
    const i = (bankTxns || []).findIndex((t, k) => !used.has(k) && t.out === x.in && /김종화/.test((t.counterName || '') + (t.desc || '')) && Math.abs(day(t.date) - day(x.date)) <= 1);
    if (i >= 0) { used.add(i); keys.add(bankTxnKey(bankTxns[i])); }
  });
  return keys;
}
/** 포털 급여명세서(실지급액·지급일·이름)와 통장 직원 이체를 짝지음 — 같은 사람·같은 금액·지급일 ±3일 */
export function payslipMatchKeys(bankTxns, slips) {
  const keys = new Set(); const used = new Set(); const day = (d) => Date.parse(d + 'T00:00:00Z') / 86400000;
  (slips || []).forEach((p) => { const i = (bankTxns || []).findIndex((t, k) => !used.has(k) && t.out === Math.round(p.netPay) && ((t.counterName || '') + (t.desc || '')).includes(p.name) && Math.abs(day(t.date) - day(p.payDate)) <= 3); if (i >= 0) { used.add(i); keys.add(bankTxnKey(bankTxns[i])); } });
  return keys;
}
export const bankTxnKey = (t) => ['bank', t.date, t.time, t.out, t.in, t.balance].join('_');
export function classifyBankTxn(t, ctx) {
  if (ctx && ctx.payslipMatch && t.out > 0 && /정다애|윤석원|이한영|김영서|형일우/.test((t.counterName || '') + (t.desc || ''))) { const m = ctx.payslipMatch.has(bankTxnKey(t)); return { cat: m ? '급여 지급(명세서 실지급액과 일치)' : '직원 앞 지급 — 명세서 실지급액과 다름(확인)', account: '2020', partner: t.counterName || t.desc, status: m ? 'auto' : 'review', note: m ? '' : '급여 차액·개인카드 사용 정산·기타 지급일 수 있음 — 금액이 다른 이유 확인', split: '' }; }
  if (t.out === 10020944 && t.date === '2026-02-02' && !(t.counterName || t.desc)) return { cat: '기존 기업은행 대출 상환(원금 10,000,000 + 이자 20,944)', account: '2100', partner: '기업은행', status: 'auto', note: '대표님 확인: 기존 대출을 갚고 40,000,000을 새로 받음(2/11). 2025-12-31 개시 재산 목록에 기존 차입금 10,000,000이 있어야 함', split: 'oldloan' };
  if (ctx && ctx.ownerSettle && ctx.ownerSettle.has(bankTxnKey(t))) return { cat: '개인카드 대금 정산(대표자 농협 계좌로 이체)', account: '2021', partner: '김종화(대표자)', status: 'auto', note: '농협카드 사용분(미지급금-대표자)을 갚은 것' };
  const dir = t.out > 0 ? 'out' : 'in'; const text = (t.counterName || '') + ' ' + (t.desc || '') + ' ' + (t.memo || '') + ' [구분:' + (t.kind || '') + ']';
  for (const r of rules) if (r.dir === dir && r.re.test(text)) return { cat: r.cat, account: r.account, partner: r.partner || t.counterName || t.desc, status: r.status, note: r.note || '', split: r.split || '' };
  return { cat: '분류 대기', account: null, partner: t.counterName || t.desc, status: 'review', note: '' };
}
/** 분류된 계정이 있으면 전표 초안(출금: 차 상대계정/대 보통예금, 입금: 차 보통예금/대 상대계정). 계정이 없으면 null(사람이 정해야 함) */
/** 하나캐피탈 오토할부 상환표(원리금균등, 월 이율은 잔액 54,731,380(24회차 후)에서 역산) — 회차별 이자·원금 */
export const HANA = { pv: 84000000, pmt: 1623950, n: 60, firstPay: '2024-10-15', balanceAfter24: 54731380 };
let _hanaSched = null;
export function hanaSchedule() { if (!_hanaSched) { const r = solveMonthlyRate(HANA.pv, HANA.pmt, 24, HANA.balanceAfter24); _hanaSched = { rate: r, rows: annuitySchedule(HANA.pv, r, HANA.pmt, HANA.n) }; } return _hanaSched; }
const payNo = (date) => { const [y, m] = date.split('-').map(Number); const [fy, fm] = HANA.firstPay.split('-').map(Number); return (y - fy) * 12 + (m - fm) + 1; };
export function entryFromBank(t, c, ctx) {
  const cls = c || classifyBankTxn(t, ctx); if (!cls.account) return null; const amount = t.out > 0 ? t.out : t.in; const out = t.out > 0;
  if (cls.split === 'oldloan' && out) { const e = { date: t.date, memo: cls.cat, source: { kind: 'bank', id: ['bank', t.date, t.time, t.out, t.in, t.balance].join('_') }, needsReview: false, lines: [{ account: '2100', side: 'D', amount: 10000000, partner: '기업은행' }, { account: '8010', side: 'D', amount: amount - 10000000, partner: '기업은행' }, { account: '1020', side: 'C', amount }] }; const v = validateEntry(e); return v.ok ? e : { ...e, invalid: v.errors }; }
  if (cls.split === 'hana' && out) {   // 차량할부금: 정기분은 상환표대로 원금 / 이자, 정기액을 넘는 금액은 이자비용(연체이자 등, 확인 필요)
    const row = hanaSchedule().rows[payNo(t.date) - 1]; if (row) { const reg = Math.min(amount, HANA.pmt); const extra = amount - reg; const interest = Math.min(row.interest, reg) + extra; const principal = reg - Math.min(row.interest, reg);
      const e = { date: t.date, memo: cls.cat + ' · ' + payNo(t.date) + '회차', source: { kind: 'bank', id: ['bank', t.date, t.time, t.out, t.in, t.balance].join('_') }, needsReview: extra > 0, lines: [{ account: '2210', side: 'D', amount: principal, partner: '하나캐피탈' }, { account: '8010', side: 'D', amount: interest, partner: '하나캐피탈' }, { account: '1020', side: 'C', amount }].filter((l) => l.amount > 0) };
      const v = validateEntry(e); return v.ok ? e : { ...e, invalid: v.errors }; } }
  const e = { date: t.date, memo: cls.cat + ' · ' + (cls.partner || ''), source: { kind: 'bank', id: ['bank', t.date, t.time, t.out, t.in, t.balance].join('_') }, needsReview: cls.status === 'review', lines: out ? [{ account: cls.account, side: 'D', amount, partner: cls.partner }, { account: '1020', side: 'C', amount }] : [{ account: '1020', side: 'D', amount }, { account: cls.account, side: 'C', amount, partner: cls.partner }] };
  const v = validateEntry(e); return v.ok ? e : { ...e, invalid: v.errors };
}
/** 분류 현황: 자동·확인 필요·계정 미정 건수와 금액, 범주별·상대방별 합계 */
export function classificationReport(txns, ctx) {
  const by = {}; let auto = 0, review = 0, none = 0, autoAmt = 0, reviewAmt = 0, noneAmt = 0;
  txns.forEach((t) => { const c = classifyBankTxn(t, ctx); const amt = Math.max(t.out, t.in); const k = c.cat; const x = by[k] || (by[k] = { n: 0, out: 0, in: 0, status: c.status, account: c.account }); x.n++; x.out += t.out; x.in += t.in; if (!c.account) { none++; noneAmt += amt; } else if (c.status === 'auto') { auto++; autoAmt += amt; } else { review++; reviewAmt += amt; } });
  return { by, auto, review, none, autoAmt, reviewAmt, noneAmt, total: txns.length };
}
