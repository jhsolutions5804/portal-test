/* 근로시간 공용 계산 — 출퇴근 모듈·전자결재 홈이 함께 쓴다(순수 함수, 화면·네트워크 없음).
 * 기존 전자결재·출퇴근 화면과 같은 기준: 소정근로시간 = 해당 월 평일(공휴일 제외) × 8h, 최대초과근로 = 주 12h × 겹치는 주 수,
 * 기록 시각은 10분 단위(가까운 값), 휴게시간은 점심 2시간(120분) 고정. */
export const BREAK_MINUTES = 120;
export const pad2 = (n) => String(n).padStart(2, '0');
/** 로컬 날짜 키 yyyy-mm-dd (toISOString 은 UTC 라 한국에서 하루가 밀린다) */
export function dateKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
export const validHHMM = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
/** 기존 출퇴근 화면과 같은 10분 단위 맞춤(가장 가까운 값) */
export function snapTo10Min(t) {
  if (!validHHMM(t)) return t;
  const [h, m] = t.split(':').map(Number); let total = h * 60 + Math.round(m / 10) * 10;
  if (total >= 24 * 60) total -= 24 * 60; if (total < 0) total += 24 * 60;
  return pad2(Math.floor(total / 60)) + ':' + pad2(total % 60);
}
export const nowHHMM = (d) => snapTo10Min(pad2(d.getHours()) + ':' + pad2(d.getMinutes()));
/** 근무시간(h) = (퇴근 − 출근) − 휴게. nextDay=true 면 퇴근이 다음 날(야간), false 면 같은 날이고 퇴근이 더 이르면 0 */
export function calcWorkHours(inV, outV, nextDay, brk) {
  if (!validHHMM(inV) || !validHHMM(outV)) return 0;
  const [ih, im] = inV.split(':').map(Number); const [oh, om] = outV.split(':').map(Number);
  let mins = (oh * 60 + om) - (ih * 60 + im);
  if (nextDay) { if (mins <= 0) mins += 24 * 60; } else if (mins < 0) mins = 0;
  mins -= (brk == null ? BREAK_MINUTES : brk); if (mins < 0) mins = 0;
  return mins / 60;
}
/** 수동 입력용: 퇴근이 출근보다 이르면 다음 날 퇴근(야간)으로 본다(기존 화면과 같은 해석). 같은 시각은 입력 오류 */
export function calcManualHours(inV, outV) { return calcWorkHours(inV, outV, outV <= inV ? true : false); }

export function monthlyStandardHours(year, month, holidays) {
  const EDOC_KR_HOLIDAYS = holidays instanceof Set ? holidays : new Set(holidays || []);
  const first = new Date(year, month-1, 1);
  const last  = new Date(year, month, 0);
  let workDays = 0;
  const cur = new Date(first);
  while (cur <= last) {
    const dow = cur.getDay();
    // ⚠️ toISOString()은 UTC 변환이라 KST 브라우저에서 날짜가 하루 밀린다 — 로컬 연/월/일로 직접 문자열 생성
    const key = cur.getFullYear()+'-'+String(cur.getMonth()+1).padStart(2,'0')+'-'+String(cur.getDate()).padStart(2,'0');
    if (dow!==0 && dow!==6 && !EDOC_KR_HOLIDAYS.has(key)) workDays++;
    cur.setDate(cur.getDate()+1);
  }
  return workDays*8;
}
function edocIsoWeekKey(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (t.getUTCDay()+6)%7;
  t.setUTCDate(t.getUTCDate()-dayNum+3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(),0,4));
  const weekNum = 1 + Math.round(((t-firstThursday)/86400000 - 3 + (firstThursday.getUTCDay()+6)%7)/7);
  return `${t.getUTCFullYear()}-W${weekNum}`;
}
export function monthlyMaxOvertimeHours(year, month) {
  const first = new Date(year, month-1, 1);
  const last  = new Date(year, month, 0);
  const weeks = new Set();
  const cur = new Date(first);
  while (cur <= last) { weeks.add(edocIsoWeekKey(cur)); cur.setDate(cur.getDate()+1); }
  return weeks.size*12;
}


/** 이번 달 근로시간: 출퇴근 기록 합계 + 유급휴가 환산 → 누계·소정·잔여(정규) */
export function worktimeSummary(attHours, leaveHours, standard, maxOt) {
  const total = (Number(attHours) || 0) + (Number(leaveHours) || 0);
  const remain = Math.max(0, standard - Math.min(total, standard));
  const ot = Math.max(0, total - standard);
  return { total, standard, remain, leaveHours: Number(leaveHours) || 0, overtime: ot, maxOt: maxOt || 0, otRemain: Math.max(0, (maxOt || 0) - ot) };
}


/** 계정 ↔ 근로자 연결: 인사에서 연동한 portalUid(가장 정확) → 이메일 → 이름 순. linked=true 면 portalUid 로 확인된 연동 */
export function findWorker(list, who) {
  const u = who || {}; const em = String(u.email || '').toLowerCase();
  let w = (list || []).find((x) => u.uid && x.portalUid === u.uid);
  if (w) return Object.assign({ linked: true }, w);
  w = (list || []).find((x) => em && String(x.email || '').toLowerCase() === em) || (list || []).find((x) => u.name && x.name === u.name);
  return w ? Object.assign({ linked: false }, w) : null;
}

