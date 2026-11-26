/* 세무 달력 — 법정 신고·납부 기한과 내부 점검일을 규칙으로 계산한다(저장 데이터 없음 · 화면·네트워크 없이 시험).
 * 대표님 결정(2026-10-29): 재무회계 일정에 세무 달력을 넣는다. 달력 모듈의 제공자(manifest.calendar)로 연결된다(modules/legacy/calendar-sources.js).
 * 규칙: 법정기한이 토·일·공휴일이면 다음 근무일로 옮겨 보여 준다(국세기본법 제5조). 내부 점검일은 옮기지 않는다.
 * verify:true 인 항목은 날짜·적용 여부를 세무사에게 확인하기 전의 일정이다(조건부이거나 제도가 바뀔 예정인 것). */
const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const nextDay = (key) => { const p = key.split('-').map(Number); const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + 1)); return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); };
export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const GROUP_ORDER = ['부가세', '소득세', '원천·지급명세서', '4대보험', '지방세'];

/** 쉬는 날이면 다음 근무일까지 민다. isOff(key) = 토·일·공휴일 판정(shared/holidays.js 의 isOffDay) */
export function adjustDeadline(key, isOff) { let k = key; for (let i = 0; i < 14 && isOff(k); i++) k = nextDay(k); return k; }

/* at: [[월, 일], …] — 일이 'last' 면 그 달 말일. shift: 법정기한(쉬는 날이면 다음 근무일) */
export const TAX_RULES = [
  { id: 'vat-invoice', group: '부가세', at: MONTHS.map((m) => [m, 11]), shift: false,
    title: (m) => (m === 1 || m === 7) ? '전월 매입 세금계산서 수령 점검 · 합계표 자동반영 마감' : '전월 매입 세금계산서 수령 점검',
    note: '발급 기한은 공급월 다음 달 10일 — 5일경 거래처에 발급 요청. 11일 이후 전송·수취분은 신고서 합계표에 직접 입력해야 하고, 늦게 받으면 지연수취 가산세 0.5%가 붙는다(2026-10 에스제이 사례).' },
  { id: 'vat-prep', group: '부가세', at: [[1, 18], [7, 18]], shift: false, title: '부가세 신고 준비 (D-7)',
    note: '매입·매출 세금계산서 합계표, 카드·현금영수증 공제, 지연 전송·수취 세금계산서와 선택불공제 업종 점검.' },
  { id: 'vat-file', group: '부가세', at: [[1, 25], [7, 25]], shift: true, statutory: true,
    title: (m) => m === 1 ? '부가세 확정신고·납부 (2기 7~12월분)' : '부가세 확정신고·납부 (1기 1~6월분)',
    note: '일반과세자 확정신고·납부 기한. 신고 후에도 누락분은 5년 안에 경정청구로 구제할 수 있다.' },
  { id: 'vat-notice', group: '부가세', at: [[4, 25], [10, 25]], shift: true, statutory: true, title: (m) => m === 4 ? '부가세 예정고지 납부 (1기)' : '부가세 예정고지 납부 (2기)',
    cond: '고지서가 나온 경우', note: '개인 일반과세자는 직전 과세기간 납부세액의 1/2을 고지(50만 원 미만이면 고지 없음). 예정신고를 선택했다면 같은 날이 신고 기한.' },
  { id: 'duty-check', group: '소득세', at: [[1, 5]], shift: false, title: '기장의무 판정 · 사업용계좌 점검',
    note: '직전 연도 수입금액으로 복식부기의무자 여부 판정(건설업 1억5천만 원 이상). 해당하면 6/30까지 사업용계좌 신고·사용 — 신고도움서비스는 5월에야 나오니 직접 확인한다.' },
  { id: 'income-tax', group: '소득세', at: [[5, 31]], shift: true, statutory: true, title: '종합소득세·개인지방소득세 확정신고·납부',
    note: '2026 귀속분(2027-05)부터 복식부기 장부·재무제표. 청년창업 세액감면 신청서 포함(5년 연속 2025~2029), 이월결손금 확인.' },
  { id: 'biz-account', group: '소득세', at: [[6, 30]], shift: true, statutory: true, title: '사업용계좌 신고 기한 (복식부기의무자)',
    cond: '복식부기의무자가 되는 해', note: '복식부기의무자 해당 과세기간 개시일부터 6개월 이내 신고. 미신고 가산세와 감면 영향이 있어 기한 전에 확인한다.' },
  { id: 'mid-prepay', group: '소득세', at: [[11, 30]], shift: true, statutory: true, verify: true, title: '종합소득세 중간예납',
    cond: '직전 연도 결정세액이 있을 때만', note: '2025년은 감면으로 결정세액이 0원이라 고지가 없을 수 있다.' },
  { id: 'wht', group: '원천·지급명세서', at: MONTHS.map((m) => [m, 10]), shift: true, statutory: true, verify: true, title: '원천세 신고·납부 (전월 지급분)',
    cond: '반기납부 승인을 받았다면 1/10·7/10에만', note: '급여·사업소득 원천징수세액과 지방소득세. 월별인지 반기납부인지 세무사 확인 후 정리한다.' },
  { id: 'stmt-annual', group: '원천·지급명세서', at: [[3, 10]], shift: true, statutory: true, title: '근로·퇴직·사업소득 지급명세서 제출 (연말정산)',
    note: '전년도 귀속분. 연말정산은 2월분 급여에서 정산하고 이 기한까지 홈택스에 제출.' },
  { id: 'stmt-simple', group: '원천·지급명세서', at: [[1, 31], [7, 31]], shift: true, statutory: true, verify: true, title: '근로소득 간이지급명세서 제출 (반기)',
    note: '2026년 지급분까지는 반기별(7/31, 다음 해 1/31). 2027년 1월 지급분부터 매월로 바뀔 예정이라(시행 유예) 확인 필요.' },
  { id: 'stmt-monthly', group: '원천·지급명세서', at: MONTHS.map((m) => [m, 'last']), shift: true, statutory: true, verify: true, title: '일용근로·사업소득(3.3%) 간이지급명세서 (해당 달)',
    cond: '일용직·프리랜서 지급이 있는 달만', note: '지급월의 다음 달 말일까지 제출. 지급이 있었던 달만 해당(전달분을 이 날짜에 제출).' },
  { id: 'yearend-open', group: '원천·지급명세서', at: [[1, 15]], shift: false, verify: true, title: '연말정산 간소화 자료 확인 시작',
    note: '국세청 연말정산 간소화 자료는 1월 중순 개통(날짜는 매년 다름). 직원 공제 서류 수집을 시작한다.' },
  { id: 'hi-total', group: '4대보험', at: [[3, 10]], shift: true, statutory: true, verify: true, title: '건강보험 보수총액 신고 (전년도)', note: '전년도 보수총액 신고. 4대보험 신고는 대표님이 직접 하신다.' },
  { id: 'ei-total', group: '4대보험', at: [[3, 15]], shift: true, statutory: true, verify: true, title: '고용·산재보험 보수총액 신고·확정정산', note: '전년도 보수총액 신고와 보험료 확정정산.' },
  { id: 'resident-tax', group: '지방세', at: [[8, 31]], shift: true, statutory: true, verify: true, title: '주민세 사업소분(균등분) 납부', cond: '고지서가 나온 경우', note: '개인사업자 사업소분. 납기는 8월 1~31일.' }
];

const dayOf = (y, m, d) => (d === 'last' ? lastDay(y, m) : d);
const memoOf = (r, shifted, due) => [r.note, r.cond ? '조건: ' + r.cond : '', shifted ? '법정기한 ' + due + '이 쉬는 날이라 다음 근무일로 표시' : '', r.verify ? '⚠ 날짜·적용 여부는 세무사 확인 전 일정' : ''].filter(Boolean).join(' · ');

/** 한 해의 세무 일정 전부 */
export function taxEventsOfYear(year, isOff) {
  const out = [];
  TAX_RULES.forEach((r) => r.at.forEach(([m, d]) => {
    const due = ymd(year, m, dayOf(year, m, d)); const date = r.shift ? adjustDeadline(due, isOff || (() => false)) : due;
    out.push({ id: r.id + ':' + due, ruleId: r.id, group: r.group, title: typeof r.title === 'function' ? r.title(m) : r.title, date, due, shifted: date !== due, statutory: r.statutory === true, verify: r.verify === true, memo: memoOf(r, date !== due, due) });
  }));
  return out;
}
/** 날짜 범위(range = {from,to}, YYYY-MM-DD)에 걸리는 세무 일정 — 날짜 → 그룹 → id 순 */
export function taxEventsForRange(range, isOff) {
  const y1 = +String(range.from).slice(0, 4), y2 = +String(range.to).slice(0, 4); const out = [];
  for (let y = y1 - 1; y <= y2; y++) taxEventsOfYear(y, isOff).forEach((e) => { if (e.date >= range.from && e.date <= range.to) out.push(e); });
  const seen = new Set(); const uniq = out.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
  return uniq.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)) || (a.id < b.id ? -1 : 1)));
}
