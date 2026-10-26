/* 건강보험 EDI "직장가입자 자격 취득 신고서(피부양자 포함)" 입력표 — 화면·네트워크 없는 순수 함수(시험: tests/hr-insurance-edi.test.mjs). 대기열 1-3-17 2단계(대표님 2026-10-26: 전자(EDI) 접수, 입사 취득·퇴사 상실이 많고 피부양자·일용직은 거의 없음).
 * 사업장 EDI 화면의 항목 순서(공통 → 국민연금 → 건강보험 → 고용보험 → 산재보험)대로 값을 보여 주고, 날짜·금액은 붙여 넣기 좋은 숫자만 값(copy)을 따로 준다.
 * 모르는 코드(취득부호·직종부호 등)는 지어내지 않고 "화면 목록에서 선택"으로 둔다. 신고 기한은 EDI 화면 안내 그대로: 건강보험=사유 발생일부터 14일 이내, 국민연금·고용·산재=사유 발생일이 속하는 달의 다음 달 15일까지.
 * 상실(퇴사) 입력표는 EDI 상실 화면을 받은 뒤 같은 방식으로 추가한다. */
import { annualSalary } from './offer.js?v=20261026h';
export const HEALTH_DEADLINE_DAYS = 14;
export const RECENT_DAYS = 60; // 최근 입사자 목록 기간
const pad = (n) => String(n).padStart(2, '0');
export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
export const addDaysIso = (s, n) => { if (!isDate(s)) return ''; const t = new Date(s + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
export const daysBetween = (a, b) => (isDate(a) && isDate(b) ? Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000) : null);
export const compactDate = (s) => String(s || '').replace(/-/g, '');
export const digits = (v) => String(v == null ? '' : v).replace(/[^\d]/g, '');
export const won = (n) => (Number(n) > 0 ? Math.round(Number(n)).toLocaleString('ko-KR') : '');
/** 신고 기한 — hire 는 입사일(취득 사유 발생일). left 는 오늘 기준 남은 날(음수면 지남) */
export function acquireDeadlines(hire, today) {
  if (!isDate(hire)) return null; const health = addDaysIso(hire, HEALTH_DEADLINE_DAYS); const y = Number(hire.slice(0, 4)), m = Number(hire.slice(5, 7)); const others = (m === 12 ? y + 1 : y) + '-' + pad(m === 12 ? 1 : m + 1) + '-15';
  return { health, others, healthLeft: daysBetween(today, health), othersLeft: daysBetween(today, others) };
}
/** 신고 기한 칩 문구 — D-3·오늘·3일 지남 */
export const leftText = (n) => (n == null ? '' : n > 0 ? 'D-' + n : n === 0 ? '오늘까지' : -n + '일 지남');
/** 최근 입사자 목록(퇴사자 제외) — 입사일이 오늘 기준 days 일 전 ~ 30일 뒤(입사 예정 포함), 최근 입사순 */
export function recentHires(workers, today, days) {
  const from = addDaysIso(today, -(days || RECENT_DAYS)), to = addDaysIso(today, 30); if (!from) return [];
  return (workers || []).filter((w) => w && w.status !== 'resigned' && isDate(w.hireDate) && w.hireDate >= from && w.hireDate <= to).sort((a, b) => (a.hireDate < b.hireDate ? 1 : a.hireDate > b.hireDate ? -1 : 0)).map((w) => Object.assign({ id: w.id, name: w.name || '', empNo: w.empNo || '', hireDate: w.hireDate }, { dl: acquireDeadlines(w.hireDate, today) }));
}
/** 월 보수 기본값 — 연봉계약서 연봉 ÷ 12, 없으면 시급으로 계산한 월 합계(연봉계약서 산식), 단시간 근로계약서는 계산하지 않는다(직접 입력) */
export function monthlyPay(annual, labor) {
  const a = annual || {}, l = labor || {};
  if (Number(a.salary) > 0) return { amount: Math.round(Number(a.salary) / 12), source: '연봉계약서(' + (a.contractDate || '') + ') 연봉 ÷ 12' };
  if (Number(a.hourly) > 0) return { amount: annualSalary(Number(a.hourly)).total, source: '연봉계약서(' + (a.contractDate || '') + ') 시급 ' + won(a.hourly) + '원으로 계산한 월 합계' };
  if (l.workType !== 'short' && Number(l.hourly) > 0) return { amount: annualSalary(Number(l.hourly)).total, source: '근로계약서(' + (l.contractDate || '') + ') 시급 ' + won(l.hourly) + '원으로 계산한 월 합계' };
  return { amount: 0, source: '' };
}
const latestBy = (a, b) => { const x = a || null, y = b || null; if (!x) return y; if (!y) return x; return String(y.contractDate || '') > String(x.contractDate || '') ? y : x; };
const TODO = '화면 목록에서 선택';
/** EDI 항목 값 — { sections:[{ id, title, rows:[{ id, label, text, copy, hint, tone }] }], warnings:[문구], deadlines, pay, hours, contract } */
export function ediAcquireSheet({ worker, annual, labor, jumin, payOverride, hoursOverride, today }) {
  const w = worker || {}; const warnings = []; const hire = isDate(w.hireDate) ? w.hireDate : ''; const dl = acquireDeadlines(hire, today);
  const mp = monthlyPay(annual, labor); const ov = digits(payOverride); const pay = ov ? Number(ov) : mp.amount; const paySource = ov ? '직접 입력' : mp.source;
  const lastC = latestBy(annual, labor); const wh = digits(hoursOverride); const hours = wh ? Number(wh) : (lastC && lastC.workType === 'short' && Number(lastC.weeklyHours) > 0 ? Math.round(Number(lastC.weeklyHours) * 10) / 10 : 40);
  const endDate = lastC && isDate(lastC.endDate) ? lastC.endDate : ''; const fixed = !!endDate;
  if (!hire) warnings.push('입사일이 없습니다 — 근로자 명부에서 입사일을 먼저 입력해 주세요.');
  if (!(pay > 0)) warnings.push('월 보수를 알 수 없습니다(연봉계약서·근로계약서가 없거나 단시간 근로계약) — 위 "월 보수" 칸에 직접 입력해 주세요.');
  if (dl && dl.healthLeft < 0) warnings.push('건강보험 신고 기한(' + dl.health + ')이 지났습니다. 늦게 신고할 때는 공단 안내(지연 사유)를 확인해 주세요.');
  if (lastC && lastC.workType === 'short') warnings.push('단시간 근로계약입니다(주 ' + hours + '시간). 월 소정근로시간 60시간 미만이면 국민연금·건강·고용은 가입 대상이 아닐 수 있으니 취득 신고 전에 확인해 주세요(산재는 가입).');
  warnings.push('산재보험: 사업장이 "자진납부사업장"이면 EDI 화면에서 산재 신고가 되지 않습니다(화면 맨 위 안내, 산재보험 고객지원센터 1588-0075). 국민연금·고용이 신청구분 체크로 함께 접수되는지는 첫 접수 결과로 확인해 주세요.');
  const date = (id, label) => ({ id, label, text: hire || '(입사일 없음)', copy: compactDate(hire), hint: '숫자만 붙여 넣기(YYYYMMDD)' });
  const money = (id, label) => ({ id, label, text: pay > 0 ? won(pay) + '원' : '(직접 입력)', copy: pay > 0 ? String(pay) : '', hint: paySource ? '출처: ' + paySource : '' });
  const hrs = (id) => ({ id, label: '1주 소정근로시간', text: hours + '시간', copy: String(hours), hint: lastC && lastC.workType === 'short' ? '단시간 근로계약서의 주 소정근로시간' : '기본 40시간(전일제) — 다르면 위 칸에서 바꾸세요' });
  const contract = (pre) => [{ id: pre + 'Fixed', label: '계약직 여부', text: fixed ? '예' : '아니오', copy: '', hint: fixed ? '계약서에 종료일(' + endDate + ')이 있어 "예"' : '계약서에 종료일이 없어 "아니오"' }, { id: pre + 'End', label: '계약종료월', text: fixed ? endDate.slice(0, 7).replace('-', '/') : '(해당 없음)', copy: fixed ? endDate.slice(0, 4) + endDate.slice(5, 7) : '', hint: fixed ? '계약직만 입력(YYYYMM)' : '' }];
  const sel = (id, label, hint) => ({ id, label, text: TODO, copy: '', hint: hint || '' });
  const none = (id, label, text, hint) => ({ id, label, text: text || '(해당 없음 — 비움)', copy: '', hint: hint || '' });
  const sections = [
    { id: 'common', title: '공통', rows: [{ id: 'name', label: '성명', text: w.name || '(이름 없음)', copy: w.name || '', hint: '' }, { id: 'jumin', label: '주민등록번호', text: jumin ? jumin : '(열람 단추를 눌러 확인)', copy: jumin ? digits(jumin) : '', hint: jumin ? '하이픈 없이 13자리 · 화면을 벗어나면 다시 가려집니다' : '열람 사유가 기록됩니다(3년)', tone: jumin ? 'warn' : '' }, { id: 'nation', label: '국적', text: '대한민국', copy: '', hint: '외국인이면 국적·체류자격을 직접 선택' }, { id: 'stay', label: '체류자격', text: '(내국인은 비움)', copy: '', hint: '' }, { id: 'ceo', label: '대표자 여부', text: /대표/.test(String(w.rank || '')) ? '예' : '아니오', copy: '', hint: '' }] },
    { id: 'pension', title: '국민연금', rows: [money('pPay', '소득월액(원)'), date('pDate', '취득일'), sel('pCode', '취득부호'), sel('pMonth', '취득월 납부 여부', '입사일이 1일이 아니면 취득 월 보험료 납부 희망 여부를 선택'), none('pSpecial', '특수직종'), none('pRetire', '직역연금부호')] },
    { id: 'health', title: '건강보험', rows: [money('hPay', '보수월액(원)'), date('hDate', '취득일'), sel('hCode', '취득부호'), none('hReduce', '보험료 감면부호'), { id: 'hDep', label: '피부양자 신청', text: '없음', copy: '', hint: '피부양자가 있으면 EDI 에서 직접 신청' }, none('hPublic', '공무원/교직원'), none('hAcct', '회계부호'), sel('hJob', '직종부호')] },
    { id: 'employ', title: '고용보험', rows: [money('ePay', '월평균보수(원)'), date('eDate', '취득일'), hrs('eHours'), sel('eJob', '직종부호')].concat(contract('e'), [none('eKind', '보험료 부과구분(해당자만)')]) },
    { id: 'accident', title: '산재보험', rows: [money('aPay', '월평균보수(원)'), date('aDate', '취득일'), hrs('aHours'), sel('aJob', '직종부호')].concat(contract('a'), [none('aKind', '보험료 부과구분(해당자만)')]) }
  ];
  return { sections, warnings, deadlines: dl, pay, paySource, hours, contract: lastC ? { contractDate: lastC.contractDate || '', endDate, workType: lastC.workType || '' } : null };
}
/** 화면 상태(e)에서 입력표를 만든다 — 화면·복사 동작이 같은 값을 쓰도록 한 곳에 둔다 */
export const sheetOfState = (e, today) => { const s = e || {}; return ediAcquireSheet({ worker: (s.workers || []).find((w) => w.id === s.sel), annual: s.annual, labor: s.labor, jumin: s.jumin, payOverride: s.payOv, hoursOverride: s.hoursOv, today }); };
