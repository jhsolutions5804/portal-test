/* 카드 이용내역 엑셀(농협·삼성·현대 등) → 표준 이용 목록. 머리글 글자로 카드사 양식을 알아낸다. 취소 건은 제외 표시. */
const squash = (s) => String(s == null ? '' : s).replace(/[\s\u00a0]/g, '');
const num = (v) => (typeof v === 'number' ? Math.round(v) : (Number(squash(v).replace(/[,원]/g, '')) || 0));
const dateOf = (v) => { if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10); const s = String(v == null ? '' : v); let m = /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec(s); return m ? m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0') : ''; };
const FORMATS = [
  { id: 'ibk_sales', need: ['계열명', '매출일', '카드번호', '카드매출금액', '매출세액', '가맹점명'], map: { date: '매출일', card: '카드번호', amount: '카드매출금액', vat: '매출세액', fee: '매출봉사료', kind: '매출구분', months: '할부기간', merchant: '가맹점명', merchantBiz: '사업자번호' }, cancelOf: () => false },
  { id: 'ibk_approval', need: ['승인일시', '카드번호', '이용가맹점명', '승인금액', '승인번호'], map: { date: '승인일시', card: '카드번호', merchant: '이용가맹점명', amount: '승인금액', kind: '이용구분', months: '할부개월', approvalNo: '승인번호', cancelAmount: '취소금액', cancelDate: '취소일자', payDate: '결제예정일자' }, cancelOf: () => false },
  { id: 'samsung', need: ['카드번호', '승인일자', '가맹점명', '승인금액(원)'], map: { date: '승인일자', time: '승인시각', card: '카드번호', merchant: '가맹점명', amount: '승인금액(원)', kind: '일시불할부구분', months: '할부개월', approvalNo: '승인번호', cancel: '취소여부', payDate: '결제일' }, cancelOf: (v) => !(v === '' || v === '-' || v == null) },
  { id: 'hyundai', need: ['이용일자', '카드명(카드뒤4자리)', '가맹점명', '이용금액'], map: { date: '이용일자', card: '카드명(카드뒤4자리)', merchant: '가맹점명', merchantBiz: '가맹점사업번호', category: '분야', amount: '이용금액', kind: '이용구분', months: '할부개월', approvalNo: '승인번호', payDate: '결제예정일' }, cancelOf: () => false },
  { id: 'nonghyup', need: ['사용일자', '이용카드', '승인번호', '가맹점명', '이용금액'], map: { date: '사용일자', card: '이용카드', approvalNo: '승인번호', merchant: '가맹점명', amount: '이용금액', kind: '이용구분', months: '할부개월', cancel: '취소여부' }, cancelOf: (v) => /^(y|취소)/i.test(squash(v)) }
];
export function parseCardRows(rows) {
  for (const f of FORMATS) {
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const m = {}; (rows[i] || []).forEach((h, c) => { const k = squash(h); if (k && m[k] === undefined) m[k] = c; });
      if (!f.need.every((k) => m[squash(k)] !== undefined)) continue;
      const col = (key) => (f.map[key] === undefined ? undefined : m[squash(f.map[key])]); const items = [];
      for (let j = i + 1; j < rows.length; j++) {
        const r = rows[j] || []; const get = (key) => { const c = col(key); return c === undefined ? '' : r[c]; }; const d = dateOf(get('date')); if (!d) continue; const amount = num(get('amount')); if (!amount) continue;
        items.push({ issuer: f.id, date: d, time: String(get('time') || '').trim(), card: ((c) => (/^\d{4}[-*0-9]/.test(c) ? c.slice(0, 19) : c.slice(-14)))(String(get('card') || '').replace(/\s+/g, '')), /* 번호 모양(4140-****-****-891)은 앞부분 유지(카드 구분), 이름형은 뒤 14자 */ merchant: String(get('merchant') || '').replace(/\s+/g, ' ').trim(), merchantBiz: String(get('merchantBiz') || '').replace(/\D/g, ''), category: String(get('category') || '').trim(), amount, kind: String(get('kind') || '').trim(), months: Number(get('months')) || 0, approvalNo: String(get('approvalNo') || '').replace(/\s+/g, ''), vat: Number(get('vat')) || 0, fee: Number(get('fee')) || 0, cancelAmount: num(get('cancelAmount')), cancelFlag: f.cancelOf(get('cancel')), cancelled: (f.id === 'ibk_approval' ? num(get('cancelAmount')) >= amount : f.cancelOf(get('cancel'))), payDate: dateOf(get('payDate')) });   // 농협의 '취소여부=Y' 는 파일 요약 합계와 맞지 않는 경우가 있어(의미 확인 전) 제외하지 않고 표시만 한다
      }
      return { issuer: f.id, items };
    }
  }
  return { issuer: '', items: [], error: '지원하는 카드 이용내역 엑셀(농협·삼성·현대)로 보이지 않습니다.' };
}
export function parseCardWorkbook(wb) { for (const sh of (wb && wb.sheets) || []) { const r = parseCardRows(sh.rows); if (!r.error && r.items.length) return { ...r, sheet: sh.name }; } return { issuer: '', items: [], error: '지원하는 카드 이용내역 엑셀(농협·삼성·현대)로 보이지 않습니다.' }; }
export const cardKey = (c) => ['card', c.issuer, c.date, c.card, c.approvalNo || c.merchant, c.amount].join('_');
