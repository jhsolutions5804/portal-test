import { BREAK_MINUTES, dateKey, nowHHMM, snapTo10Min, validHHMM, calcWorkHours, calcManualHours } from '../../shared/worktime.js?v=20261005a';

/* 출퇴근 순수 로직 — 화면·네트워크 없음(시험하기 쉽게 분리).
 * 규칙: 휴게는 점심 2시간(120분) 고정 · 기록 시각은 10분 단위 · 오늘 기록은 본인이 원터치/직접 입력,
 *       지난 날짜는 결재 요청 또는 관리자 직접 입력. */
export const OVERNIGHT_MAX_HOURS = 16;   // 어제 출근하고 퇴근을 안 눌렀어도 이 시간 안이면 '야간 근무 중'으로 본다
export const MAX_WORK_HOURS = 16;        // 한 번의 기록으로 인정하는 최대 근무시간(오입력 방지)
export const SOURCE_LABEL = { clock: '원터치', manual: '직접 입력', admin: '관리자 입력' };
export const sourceLabel = (s) => SOURCE_LABEL[s] || '입력';
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export { toMs, recordOf } from '../../shared/attendance-record.js?v=20261005a';   // 변환 함수는 전자결재와 함께 쓰므로 공용(shared)에 있다
export const dayLabel = (key) => { const [y, m, d] = key.split('-').map(Number); const w = DAYS[new Date(y, m - 1, d).getDay()]; return pad(m) + '/' + pad(d) + '(' + w + ')'; };
const pad = (n) => String(n).padStart(2, '0');
export function yesterdayKey(now) { const d = new Date(now); d.setDate(d.getDate() - 1); return dateKey(d); }

/** 지금 출퇴근 버튼 상태: ready(출근 가능) · working(근무 중, 퇴근 가능) · done(오늘 퇴근 완료) */
export function clockState(today, yesterday, nowMs) {
  const open = (r) => !!(r && r.checkIn && !r.checkOut);
  if (today && today.checkIn && today.checkOut) return { state: 'done', target: today, overnight: false };
  if (open(today)) return { state: 'working', target: today, overnight: false };
  if (open(yesterday) && yesterday.checkInAtMs && nowMs - yesterday.checkInAtMs < OVERNIGHT_MAX_HOURS * 3600 * 1000) return { state: 'working', target: yesterday, overnight: true };
  return { state: 'ready', target: null, overnight: false, missing: open(yesterday) ? yesterday : null };
}
/** 출근 기록 문서 — 시각은 10분 단위로 맞추고, 눌린 실제 시각은 서버 시간(checkInAt)으로 따로 남긴다 */
export function buildClockIn(worker, now) {
  const d = now instanceof Date ? now : new Date(now); const date = dateKey(d);
  return { workerId: worker.id, name: worker.name || '', rank: worker.rank || '', date, yearMonth: date.slice(0, 7), checkIn: nowHHMM(d), checkOut: '', breakMinutes: BREAK_MINUTES, workHours: 0, source: 'clock' };
}
export function buildClockOut(target, now, overnight) {
  const d = now instanceof Date ? now : new Date(now); const out = nowHHMM(d);
  return { checkOut: out, workHours: calcWorkHours(target.checkIn, out, !!overnight), breakMinutes: BREAK_MINUTES };
}
/** 직접 입력 권한: 관리자는 모든 날짜·모든 근로자, 일반 직원은 오늘 기록만 본인이 입력(지난 날짜는 결재 요청) */
export function editPermission(me, date, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return { ok: false, code: 'bad-date', reason: '날짜를 입력해 주세요.' };
  if (date > today) return { ok: false, code: 'future', reason: '오늘 이후 날짜는 입력할 수 없습니다.' };
  if (me.admin) return { ok: true, source: 'admin' };
  if (date === today) return { ok: true, source: 'manual' };
  return { ok: false, code: 'needs-approval', reason: '지난 날짜는 결재 요청으로 처리합니다. 관리자에게 입력을 요청할 수도 있습니다.' };
}
/** 직접 입력 검증 → { errors, hours, checkIn, checkOut, nextDay } (시각은 10분 단위로 맞춤) */
export function validateManual(input, me, today) {
  const errors = {}; const p = editPermission(me, input.date, today);
  if (!p.ok) errors.date = p.reason;
  const ci = validHHMM(input.checkIn) ? snapTo10Min(input.checkIn) : ''; const co = validHHMM(input.checkOut) ? snapTo10Min(input.checkOut) : '';
  if (!ci) errors.checkIn = '출근 시각을 입력해 주세요.'; if (!co) errors.checkOut = '퇴근 시각을 입력해 주세요.';
  let hours = 0; let nextDay = false;
  if (ci && co) {
    if (ci === co) errors.checkOut = '출근과 퇴근 시각이 같습니다.';
    else { nextDay = co < ci; hours = calcManualHours(ci, co); if (hours > MAX_WORK_HOURS) errors.checkOut = '근무시간이 ' + MAX_WORK_HOURS + '시간을 넘습니다. 시각을 확인해 주세요.'; }
  }
  return { errors, hours, checkIn: ci, checkOut: co, nextDay, source: p.ok ? p.source : '' };
}
export function monthTotals(rows) { return { days: rows.filter((r) => r.checkIn).length, hours: rows.reduce((s, r) => s + (Number(r.workHours) || 0), 0) }; }
export const sortRows = (rows) => rows.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
export function recentMonths(now, n) { const out = []; const d = new Date(now.getFullYear(), now.getMonth(), 1); for (let i = 0; i < n; i++) { out.push(d.getFullYear() + '-' + pad(d.getMonth() + 1)); d.setMonth(d.getMonth() - 1); } return out; }
export const fmtH = (h) => (Number(h) || 0).toFixed(1) + 'h';
