/* 카드 가맹점 분류표(엑셀) → 가맹점 규칙. 대표님이 "대표님 분류" 칸에서 고른 값을 읽어 카드 전표 분류에 적용한다.
 * 키: 카드사 id + 가맹점 정규화 이름. 선택 항목 → 계정 */
export const CHOICES = [
  ['업무 식대(복리후생·현장식대)', '6020'], ['직원 회식·행사', '6020'], ['거래처 접대(접대비)', '6040'], ['개인 지출(인출금)', '3020'], ['업무용 구매·소모품', '6090'],
  ['보험료(업무·차량)', '6110'], ['통신비(업무)', '6050'], ['차량 유지비(유류·정비)', '6120'], ['선물(접대비)', '6040'], ['기타 업무비용(메모에 적어 주세요)', '6190'], ['모름', '']
];
export const CHOICE_ACCOUNT = Object.fromEntries(CHOICES);
/** 가맹점 이름 정규화 — 공백·(주)·주식회사 제거, 앞 18자 */
export const merchantKey = (m) => String(m || '').replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|\s/g, '').slice(0, 18);
const squash = (s) => String(s == null ? '' : s).replace(/[\s\u00a0]/g, '');
/** 채운 분류표의 한 시트(rows) → [{issuer, key, account, memo, label}] — "모름"·빈 칸은 건너뜀 */
export function parseMerchantTable(rows) {
  let hi = -1, col = {};
  for (let i = 0; i < Math.min(rows.length, 15); i++) { const m = {}; (rows[i] || []).forEach((h, c) => { const k = squash(h); if (k) m[k] = c; }); if (m['가맹점'] !== undefined && m['대표님분류'] !== undefined && m['카드사코드'] !== undefined && m['가맹점키'] !== undefined) { hi = i; col = m; break; } }
  if (hi < 0) return { rules: [], error: '분류표 형식이 아닙니다(가맹점·대표님 분류·카드사 코드·가맹점 키 열을 찾지 못했습니다).' };
  const rules = [], unknown = []; let filled = 0;
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []; const key = String(r[col['가맹점키']] || '').trim(); const issuer = String(r[col['카드사코드']] || '').trim(); const label = String(r[col['대표님분류']] || '').trim(); if (!key || !issuer || !label) continue;
    filled++; if (!(label in CHOICE_ACCOUNT)) { unknown.push(label); continue; } const account = CHOICE_ACCOUNT[label]; if (!account) continue;
    rules.push({ issuer, key, account, label, memo: String(r[col['메모']] || '').trim() });
  }
  return { rules, filled, unknown: [...new Set(unknown)] };
}
