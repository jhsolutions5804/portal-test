/* 출퇴근 달력(관리자) — 구포털 "근로시간" 탭의 직원별 근태 달력·근로 내역 추가/수정/삭제·출장 표시를 옮겼다(2단계).
 * 데이터: worker_attendance_log/{근로자번호}_{날짜}(출퇴근 모듈이 같은 문서를 쓴다), 유급휴가는 edoc_leave(승인·게시), 업무일지는 edoc_daily.
 * 근무시간 계산은 출퇴근 모듈과 같은 공용 규칙(shared/worktime.js)을 쓴다: 휴게는 점심 120분 고정(출근~퇴근 5시간 이하면 0), 같은 시각은 입력 오류.
 * 화면·네트워크 없이 시험할 수 있는 순수 함수만 둔다. */
import { calcWorkHours, breakFor, validHHMM, monthlyStandardHours, monthlyMaxOvertimeHours, worktimeSummary } from '../../shared/worktime.js?v=20261030a';
import { computeLeaveHoursForMonth } from '../../shared/leave-hours.js?v=20261030a';
const pad = (n) => String(n).padStart(2, '0');
export const TRIP_TYPES = { personal_near: '🚗 개인차량 · 40km 이내 (1만원/일)', personal_far: '🚗 개인차량 · 40km 초과 (2만원/일)', company_car: '🚙 회사차량 (거리무관 1만원/일)', longtrip: '🚄 지방장기출장 · 왕복KTX 실비' };
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
export const attKey = (workerId, date) => workerId + '_' + date;
/** 관리자 입력 기본 휴게(분): 출퇴근 모듈과 같은 규칙 — 출근~퇴근이 5시간 이하면 0, 그보다 길면 120 */
export const attDefaultBreak = (inV, outV) => (validHHMM(inV) && validHHMM(outV) && inV !== outV ? breakFor(inV, outV, outV <= inV) : 120);
/** 근로 내역 저장 내용 만들기. 같은 시각·시각 오류·휴게가 근무시간보다 길면 거부. workHours 는 분 단위 정확값(소수 2자리) */
export function buildAttRecord(workerId, name, date, form) {
  const f = form || {}; const errors = [];
  if (!workerId) errors.push('근로자를 선택해 주세요.'); if (!isDate(date)) errors.push('날짜를 입력해 주세요.');
  if (!validHHMM(f.checkIn) || !validHHMM(f.checkOut)) errors.push('출근·퇴근 시간을 모두 올바르게 입력해 주세요(예: 07:00).'); else if (f.checkIn === f.checkOut) errors.push('출근과 퇴근 시각이 같습니다. 시각을 확인해 주세요.');
  const brk = f.breakMinutes === '' || f.breakMinutes == null ? attDefaultBreak(f.checkIn, f.checkOut) : Number(f.breakMinutes); if (!Number.isInteger(brk) || brk < 0 || brk > 600) errors.push('휴게시간은 0~600분의 정수로 입력해 주세요.');
  if (errors.length) return { ok: false, errors };
  const nextDay = f.checkOut <= f.checkIn; const span = calcWorkHours(f.checkIn, f.checkOut, nextDay, 0); if (brk / 60 >= span) return { ok: false, errors: ['휴게시간이 근무시간 이상입니다. 시각과 휴게를 확인해 주세요.'] };
  const hours = Math.round(calcWorkHours(f.checkIn, f.checkOut, nextDay, brk) * 100) / 100; const trip = !!f.isBusinessTrip;
  return { ok: true, errors: [], key: attKey(workerId, date), data: { workerId, name: name || '', date, yearMonth: date.slice(0, 7), checkIn: f.checkIn, checkOut: f.checkOut, breakMinutes: brk, workHours: hours, isBusinessTrip: trip, tripType: trip ? (TRIP_TYPES[f.tripType] ? f.tripType : 'personal_near') : '', updatedByAdmin: true } };
}
/** 달력: 칸마다 상태 — work(평일 근무)·holidayWork(주말·공휴일 근무)·leave(연차·휴가, 결근 아님)·absent(평일 기록·휴가 둘 다 없음)·off(쉬는 날)·future(오늘 이후 평일은 결근으로 보지 않음) */
export function attCalendar(year, month, rows, leaveDocs, holidaySet, todayStr) {
  const byDate = {}; (rows || []).forEach((r) => { byDate[r.date] = r; }); const first = new Date(year, month - 1, 1); const last = new Date(year, month, 0).getDate(); const cells = []; for (let i = 0; i < first.getDay(); i++) cells.push(null);
  const leaveOn = (ds) => { const lv = (leaveDocs || []).find((l) => l.startDate && l.endDate && ds >= l.startDate && ds <= l.endDate); return lv ? (lv.leaveType || '휴가') : null; };
  for (let d = 1; d <= last; d++) {
    const ds = year + '-' + pad(month) + '-' + pad(d); const dow = (first.getDay() + d - 1) % 7; const off = dow === 0 || dow === 6 || (holidaySet && holidaySet.has(ds)); const rec = byDate[ds]; const lv = leaveOn(ds);
    const state = rec && off ? 'holidayWork' : rec ? 'work' : !off && lv ? 'leave' : !off ? (todayStr && ds > todayStr ? 'future' : 'absent') : 'off';
    cells.push({ ds, d, dow, off, state, rec: rec || null, leaveType: lv, today: ds === todayStr, hours: rec ? Number(rec.workHours) || 0 : 0, admin: !!(rec && rec.updatedByAdmin), trip: !!(rec && rec.isBusinessTrip) });
  }
  return cells;
}
/** 월 요약: 소정근로시간·근무시간(평일/휴일 구분)·유급휴가 환산·초과·잔여, 급여명세서 연장근로 산정 시간(평일 근무+유급휴가−소정) */
export function attMonthSummary(year, month, rows, leaveDocs, workerName, holidaySet) {
  let attHours = 0, weekdayHours = 0, holidayHours = 0; const days = new Set();
  (rows || []).forEach((r) => { const h = Number(r.workHours) || 0; attHours += h; days.add(r.date); const dow = r.date ? new Date(r.date + 'T00:00:00').getDay() : -1; if (dow === 0 || dow === 6 || (holidaySet && holidaySet.has(r.date))) holidayHours += h; else weekdayHours += h; });
  const leaveHours = computeLeaveHoursForMonth(leaveDocs || [], workerName, year, month); const standard = monthlyStandardHours(year, month, holidaySet); const maxOt = monthlyMaxOvertimeHours(year, month); const sm = worktimeSummary(attHours, leaveHours, standard, maxOt);
  return Object.assign({ attHours, weekdayHours, holidayHours, days: days.size, otPayHours: Math.max(0, weekdayHours + leaveHours - standard), maxTotal: standard + maxOt }, sm, { regularUsed: Math.min(sm.total, standard), regularRemain: sm.remain, otUsed: sm.overtime });
}
export const holidaySetOf = (year, month, isHoliday) => { const s = new Set(); const last = new Date(year, month, 0).getDate(); for (let d = 1; d <= last; d++) { const ds = year + '-' + pad(month) + '-' + pad(d); if (isHoliday(ds)) s.add(ds); } return s; };
