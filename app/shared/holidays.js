/* 공휴일 단일 출처(루트 holidays.js)의 새 플랫폼용 창구 — 날짜는 'YYYY-MM-DD'.
 * 공휴일을 추가·고칠 때는 루트 holidays.js 만 고친다(구 포털·인사·PJT 화면도 같은 파일을 쓴다). 새 화면은 window.JH_HOLIDAYS 를 직접 읽지 말고 여기 함수를 쓴다. */
let promise = null;
const dayOf = (key) => { const p = String(key || '').slice(0, 10).split('-').map(Number); return p.length === 3 && p.every((x) => isFinite(x) && x > 0) ? new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() : -1; };
/** 공휴일 이름 맵(날짜 → 이름). 아직 못 불러왔으면 빈 맵 */
export const holidayMap = () => (typeof window !== 'undefined' && window.JH_HOLIDAYS) || {};
export const holidayName = (key) => holidayMap()[String(key || '').slice(0, 10)] || '';
export const isHoliday = (key) => !!holidayName(key);
export const isWeekend = (key) => { const d = dayOf(key); return d === 0 || d === 6; };
/** 쉬는 날: 토·일 또는 공휴일 */
export const isOffDay = (key) => isWeekend(key) || isHoliday(key);
/** 근무일: 쉬는 날이 아닌 날(잘못된 날짜는 false) */
export const isWorkday = (key) => dayOf(key) !== -1 && !isOffDay(key);
/** 공휴일 날짜 목록 → Set. holidays.js 를 한 번만 불러오고, 못 불러오면 빈 Set(주말만 제외하고 계산) */
export function loadHolidays() {
  if (typeof window === 'undefined') return Promise.resolve(new Set());
  if (window.JH_HOLIDAY_DATES) return Promise.resolve(new Set(window.JH_HOLIDAY_DATES));
  if (!promise) {
    promise = new Promise((resolve) => {
      const s = document.createElement('script'); s.src = new URL('../../holidays.js', import.meta.url).href;
      s.onload = () => resolve(new Set(window.JH_HOLIDAY_DATES || [])); s.onerror = () => resolve(new Set());
      document.head.appendChild(s);
    });
  }
  return promise;
}
