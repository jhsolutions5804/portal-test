/* 출퇴근 월간 달력(순수 로직) — 출퇴근 기록 화면의 달력 카드가 쓴다. 화면·Firestore 와 분리해 시험한다.
 * 칸 상태: work(평일 근무 기록) · holidayWork(토·일·공휴일 근무 기록) · off(쉬는 날, 기록 없음) · empty(평일, 기록 없음).
 * 평일에 기록이 없어도 「결근」으로 표시하지 않는다 — 연차·휴가·출장은 여기서 보지 않으므로(인사 근태 달력에서 확인) 잘못 결근으로 보이는 것을 막는다. */
const pad = (n) => String(n).padStart(2, '0');
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
export const WEEKDAY_LONG = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

/** @param ym 'YYYY-MM' · rows 그 달의 출퇴근 기록({date, checkIn, checkOut, workHours}) · opt {today, selected, holidayName(ds)→이름} */
export function monthCalendar(ym, rows, opt) {
  const o = opt || {}; const [y, m] = String(ym).split('-').map(Number); const nameOf = typeof o.holidayName === 'function' ? o.holidayName : () => '';
  const byDate = {}; (rows || []).forEach((r) => { if (r && r.date) byDate[r.date] = r; });
  const first = new Date(y, m - 1, 1).getDay(); const last = new Date(y, m, 0).getDate(); const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= last; d++) {
    const ds = y + '-' + pad(m) + '-' + pad(d); const dow = (first + d - 1) % 7; const holiday = nameOf(ds) || ''; const off = dow === 0 || dow === 6 || !!holiday; const rec = byDate[ds] || null;
    const checkIn = rec ? rec.checkIn || '' : ''; const checkOut = rec ? rec.checkOut || '' : ''; const future = !!(o.today && ds > o.today);
    cells.push({ ds, d, dow, holiday, off, rec, state: rec ? (off ? 'holidayWork' : 'work') : (off ? 'off' : 'empty'), checkIn, checkOut, hours: rec ? Number(rec.workHours) || 0 : 0, open: !!(checkIn && !checkOut), today: ds === o.today, selected: ds === o.selected, future, pickable: !future });
  }
  while (cells.length % 7) cells.push(null);
  const weeks = []; for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { ym, year: y, month: m, weeks, days: cells.filter(Boolean) };
}

/** 칸을 읽어 주는 문구(스크린 리더·툴팁) — 예: 11월 4일 수요일, 출근 08:50, 퇴근 기록 없음 */
export function cellLabel(c) {
  const [, mo, da] = c.ds.split('-').map(Number); const head = mo + '월 ' + da + '일 ' + WEEKDAY_LONG[c.dow] + (c.holiday ? ' ' + c.holiday : '');
  if (!c.rec) return head + (c.future ? ', 아직 오지 않은 날' : ', 기록 없음');
  return head + ', 출근 ' + (c.checkIn || '--:--') + (c.checkOut ? ', 퇴근 ' + c.checkOut + ', 근무 ' + c.hours.toFixed(1) + '시간' : ', 퇴근 기록 없음');
}
