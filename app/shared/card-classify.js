/* 카드 이용 1건 → 전표 초안. 가맹점 이름·종류로 계정 후보를 정하고, 확실하지 않으면 needsReview. 규칙은 초안이며 대표님이 가맹점별로 정하면 그 값이 우선.
 * 부가세: IBK 카드 매출내역은 건별 매출세액이 있어 공제 가능한 비용에만 부가세대급금으로 분리, 다른 카드는 사업용카드 등록 여부를 알 수 없어 부가세를 비용에 포함(불공제로 가정). */
import { validateEntry, cardCreditAccount } from './ledger-engine.js?v=20261008h';
import { merchantKey } from './merchant-table.js?v=20261008h';
let USER_RULES = new Map();
/** 대표님이 가맹점 분류표에서 고른 규칙(카드사+가맹점 키) — 일반 규칙보다 먼저 적용 */
export function setMerchantRules(rules) { USER_RULES = new Map((rules || []).map((r) => [r.issuer + '|' + r.key, r])); }
/** 식당·카페·마트·배달류 이름 — 대표님 기준(2026-10-08): IBK(기업은행) 카드는 거의 업무 식대, 농협·현대 카드는 대체로 개인 사용 */
const FOOD_RE = /쿠팡이츠|배달|식당|곰탕|칼국수|갈비|돈까스|돈가스|스시|초밥|족발|떡집|야키|꼬치|맥주|호프|주점|이자카야|포차|카페|커피|빽다방|스타벅스|투썸|메가|컴포즈|베이커리|제과|국밥|수육|삼겹|고기|한우|돼지|오리|닭|치킨|곱창|보쌈|순대|김밥|분식|떡볶이|버거|피자|파스타|샤브|뷔페|횟집|해장|냉면|우동|라멘|짬뽕|중식|반점|도시락|푸드|마트|트레이더스|노브랜드|하모니|과일|식품|BTOWN|비타운|미당|옌뜨|양념|한식|밥집|국수|죽집|탕$|찌개|정식|숯불|대패|막창|이모/i;
const RULES = [
  [/국세|부가가치세|지방세|세입/, '2040', false, '세금 카드 납부(부가세로 가정) — 부가세 정산'],
  [/건강보험공단|국민연금|고용보험|근로복지/, '2030', false, '4대보험 카드 납부'],
  [/주유|오일뱅크|칼텍스|석유|에너지|정유/, '6120', true, '유류비(승용차 관련비용)'],
  [/타이어|카센터|정비|세차|자동차/, '6120', true, '차량 정비·타이어'],
  [/손해보험|화재|보험/, '6110', true, '보험료(차량보험 가능)'],
  [/통신요금|KT|SKT|LG유플|휴대폰|알림서비스/i, '6050', false, '통신비'],
  [/병원|의원|내과|안과|치과|약국|한의원|안경|의료재단/, '3020', true, '의료비(개인 성격으로 보고 인출금, 확인)'],
  [/아파트관리비|관리비\(아파트|월세/, '3020', true, '주거비(개인)'],
  [/휘트니스|보스턴짐|헬스|백화점|신세계|화양연화|미용|골프|의류|타미힐/, '3020', true, '개인 소비성(인출금, 확인)'],
  [FOOD_RE, 'FOOD', false, '식당·카페·마트'],
  [/네이버페이|쿠팡|다이소|구글플레이|삼성전자|다날|인쇄|문구|오피스|이마트|철물|공구|산업|건재/, '6090', true, '소모품·구독·기타 구매'],
  [/태범|태정위드유|부르릉/, '6190', true, '가맹점 업종 미확인(식대 가능)']
];
/** 대표님이 직접 정한 건(가맹점+금액 조건) — 일반 규칙보다 먼저 적용. 날짜·결정 출처를 note 에 남긴다 */
const OVERRIDES = [
  { test: (c) => /태범/.test(c.merchant) && c.issuer === 'ibk_sales' && c.amount === 1000000, account: '6040', review: false, note: '명절(추석) 선물용 주류 — 대표님 확인 2026-10-08: 거래처·발주처 담당자 선물 → 접대비' },
  { test: (c) => /태범/.test(c.merchant), account: '3020', review: false, note: '개인 지출 — 대표님 확인 2026-10-08(인출금)' },
  { test: (c) => /태정위드유/.test(c.merchant), account: '5350', review: false, note: '야간조 식사 비용(현장 복리후생·식대) — 대표님 확인 2026-10-08' },
  { test: (c) => /부르릉/.test(c.merchant), account: '8030', review: true, note: '보육원 커피차 기부(2026-05-06) — 대표님 확인 2026-10-08. 기부금영수증·기부 확인서 필요, 필요경비 산입 가능 여부는 세무사 확인(일반/지정기부금)' }
];
export function classifyCardItem(c) {
  const ur = USER_RULES.get(c.issuer + '|' + merchantKey(c.merchant)); if (ur) return { account: ur.account, review: false, note: '대표님 분류표 선택: ' + ur.label + (ur.memo ? ' — ' + ur.memo : '') };
  for (const o of OVERRIDES) if (o.test(c)) return { account: o.account, review: o.review, note: o.note };
  const m = c.merchant || ''; for (const [re, account, review, note] of RULES) if (re.test(m)) {
    if (account === 'FOOD') return c.issuer === 'ibk_sales' ? { account: '6020', review: false, note: '식대(IBK 카드 = 거의 업무 식대, 대표님 2026-10-08) — 직원 식사·회식이면 복리후생비, 거래처면 접대비' } : { account: '3020', review: false, note: '식당·카페·마트(농협·현대 카드 = 대체로 개인 사용, 대표님 2026-10-08) → 개인 지출(인출금). 업무 식사였다면 예외로 정정' };
    return { account, review, note };
  }
  return { account: '6190', review: true, note: '규칙 없음 — 가맹점 확인' };
}
/** 비용 계정 중 부가세 공제 가능(보통)한 것 — 유류(승용)·접대·개인 소비·세금·보험은 제외 */
const VAT_OK = new Set(['6020', '6050', '6090', '5340', '5350', '6190']);
export function entryFromCard(c) {
  if (c.cancelled || !c.amount) return null; const refund = c.amount < 0; const cl = classifyCardItem(c); const credit = cardCreditAccount(c.issuer); const total = Math.abs(c.amount);
  const vat = c.issuer === 'ibk_sales' && VAT_OK.has(cl.account) ? Math.min(c.vat || 0, total - 1) : 0; const supply = total - vat;
  let lines = [{ account: cl.account, side: 'D', amount: supply, partner: c.merchant.slice(0, 40) }]; if (vat > 0) lines.push({ account: '1130', side: 'D', amount: vat }); lines.push({ account: credit, side: 'C', amount: total, partner: c.issuer === 'nonghyup' ? '농협카드(대표자)' : c.issuer });
  if (refund) lines = lines.map((l) => ({ ...l, side: l.side === 'D' ? 'C' : 'D' }));   // 환불(음수)은 반대 전표
  const e = { date: c.date, memo: (refund ? '[환불] ' : '') + c.merchant.slice(0, 40) + ' · ' + cl.note, source: { kind: 'card', id: ['card', c.issuer, c.date, c.card, c.approvalNo || c.merchant, c.amount].join('_') }, needsReview: cl.review, lines };
  const v = validateEntry(e); return v.ok ? e : { ...e, invalid: v.errors };
}
