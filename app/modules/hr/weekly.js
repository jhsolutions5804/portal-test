/* 주 단위 근로시간 — 출퇴근 기록(worker_attendance_log)의 workHours(휴게 제외 실근로)를 법정 주(월~일)로 합산해 단계를 판정한다.
 * 기준(웹 확인 — 근로기준법 제50조·제53조, 2024-01 고용노동부 행정해석): 주 40시간 + 연장 12시간 = 52시간. 연장 한도는 "1주 40시간 초과분"으로 판단하고(하루 8시간 병행 판정 불필요), 주말·공휴일 근로도 합산한다.
 * 연차 등 휴가 환산 시간은 실근로가 아니므로 더하지 않는다. 자정을 넘긴 근무(철야)는 출근한 날짜의 주에 합산한다. 급여 계산은 바꾸지 않는다(설계서 hr-additions-design.md §4).
 * 순수 함수만 둔다 — 시험: tests/hr-weekly.test.mjs */
export const WEEK_LEGAL = 40; // 법정 주 근로시간
export const WEEK_NOTICE = 44; // 주의 단계 시작
export const WEEK_WARN = 48; // 경고 단계 시작
export const WEEK_LIMIT = 52; // 법정 한도(40 + 연장 12) — 이 값을 넘으면 초과
export const WEEK_OT_LIMIT = 12; // 주 연장 한도
export const SUSPECT_DAY_HOURS = 16; // 하루 이 시간을 넘으면 기록 확인 필요
const pad = (n) => String(n).padStart(2, '0');
export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const utc = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fmt = (ms) => { const t = new Date(ms); return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()); };
const N = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const r2 = (v) => Math.round(N(v) * 100) / 100;
export const addDays = (s, n) => (isDate(s) ? fmt(utc(s) + n * 86400000) : '');
/** 0=일 … 6=토 */
export const dow = (s) => (isDate(s) ? new Date(utc(s)).getUTCDay() : -1);
/** 그 날짜가 속한 주의 월요일 */
export const weekStart = (s) => { if (!isDate(s)) return ''; const d = dow(s); return addDays(s, d === 0 ? -6 : 1 - d); };
export const weekEnd = (s) => (isDate(s) ? addDays(weekStart(s), 6) : '');
/** 월의 날짜가 걸치는 모든 주의 월요일 목록 */
export function weeksOfMonth(y, m) {
  const first = y + '-' + pad(m) + '-01', last = fmt(Date.UTC(y, m, 0)); const out = [];
  for (let s = weekStart(first); s <= last; s = addDays(s, 7)) out.push(s);
  return out;
}
export const weekLabel = (start) => (isDate(start) ? start.slice(5, 7) + '/' + start.slice(8) + '~' + addDays(start, 6).slice(5, 7) + '/' + addDays(start, 6).slice(8) : '');
export const WEEK_STAGES = { ok: { label: '정상', mark: '', tone: 'ok', rank: 0 }, notice: { label: '주의', mark: '🟡', tone: 'accent', rank: 1 }, warn: { label: '경고', mark: '🟠', tone: 'warn', rank: 2 }, over: { label: '52시간 초과', mark: '🔴', tone: 'warn', rank: 3 } };
/** 44시간 이상 주의 · 48시간 이상 경고 · 52시간 초과(정확히 52시간은 한도 이내라 경고) */
export function weekStage(total) { const t = r2(total); return t > WEEK_LIMIT ? 'over' : t >= WEEK_WARN ? 'warn' : t >= WEEK_NOTICE ? 'notice' : 'ok'; }

/** 의심스러운 하루 기록 — 하루 16시간을 넘거나 출근·퇴근 시각이 같다(퇴근 시각이 빠졌을 가능성). 합계에서 빼지는 않고 "확인 필요"로만 표시한다(실제 본섭 기록에서 20:08~20:08 → 24시간이 발견됨) */
export const isSuspectDay = (r) => !!r && (N(r.workHours) > SUSPECT_DAY_HOURS || (!!r.checkIn && r.checkIn === r.checkOut));
/** 한 주(월~일) 요약 — 그 주에 기록이 한 건도 없으면 total 이 null(자료 없음) */
export function weekSummary(rows, start) {
  const end = addDays(start, 6); const byDate = {};
  (rows || []).forEach((r) => { if (r && isDate(r.date) && r.date >= start && r.date <= end) byDate[r.date] = r; });
  const dates = Object.keys(byDate).sort(); if (!dates.length) return { start, end, total: null, ot: null, otRemain: null, stage: null, days: 0, holidayHours: 0, suspect: 0 };
  let total = 0, hol = 0; dates.forEach((d) => { const h = N(byDate[d].workHours); total += h; const w = dow(d); if (w === 0 || w === 6) hol += h; });
  total = r2(total); const ot = r2(Math.max(0, total - WEEK_LEGAL));
  return { start, end, total, ot, otRemain: r2(WEEK_OT_LIMIT - ot), stage: weekStage(total), days: dates.length, holidayHours: r2(hol), suspect: dates.filter((d) => isSuspectDay(byDate[d])).length };
}
/** 그 주의 일별 내역 7칸(월~일) — isHoliday(날짜) 로 공휴일 표시 */
export function weekDetail(rows, start, isHoliday) {
  const byDate = {}; (rows || []).forEach((r) => { if (r && isDate(r.date)) byDate[r.date] = r; });
  return [0, 1, 2, 3, 4, 5, 6].map((i) => { const date = addDays(start, i); const r = byDate[date] || null; const w = dow(date); return { date, dow: w, off: w === 0 || w === 6 || !!(isHoliday && isHoliday(date)), rec: r, hours: r ? r2(r.workHours) : 0, checkIn: r ? r.checkIn || '' : '', checkOut: r ? r.checkOut || '' : '', breakMinutes: r ? N(r.breakMinutes) : 0, trip: !!(r && r.isBusinessTrip), suspect: isSuspectDay(r) }; });
}
/** 인사 홈 신호 — 이번 주·지난주 중 44시간 이상인 (직원, 주). rows 는 두 주를 덮는 출퇴근 기록 전체(workerId 포함) */
export function weeklyReport(workers, rows, today) {
  const thisStart = weekStart(today), lastStart = addDays(thisStart, -7); const W = {}; (workers || []).forEach((w) => { if (w && w.id) W[w.id] = w; });
  const by = {}; (rows || []).forEach((r) => { if (r && r.workerId) (by[r.workerId] = by[r.workerId] || []).push(r); });
  const items = []; let withData = 0;
  Object.keys(by).forEach((id) => {
    const w = W[id]; if (w && w.status === 'resigned') return; const name = (w && w.name) || (by[id][0] && by[id][0].name) || id; let has = false;
    [['this', thisStart], ['last', lastStart]].forEach(([which, st]) => { const s = weekSummary(by[id], st); if (s.total === null) return; has = true; if (s.stage !== 'ok') items.push(Object.assign({ workerId: id, name, which }, s)); });
    if (has) withData++;
  });
  items.sort((a, b) => WEEK_STAGES[b.stage].rank - WEEK_STAGES[a.stage].rank || b.total - a.total || (a.which === b.which ? 0 : a.which === 'this' ? -1 : 1) || String(a.name).localeCompare(String(b.name)));
  return { today, thisStart, lastStart, items, withData };
}
