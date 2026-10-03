import { db, collection, getDocs, query, where } from '../../core/firebase.js?v=20261004g';

/* 전자결재 홈이 쓰는 기준 자료: 근로자 명부(이름·부서·직급·입사일 등 일반 정보), 월 근태 기록, 공휴일 */
let workersCache = null;
export async function loadWorkers(force) {
  if (workersCache && !force) return workersCache;
  const s = await getDocs(collection(db, 'workers')); const list = [];
  s.forEach((d) => list.push(Object.assign({ id: d.id }, d.data())));
  workersCache = list; return list;
}
/** 해당 월 출퇴근 기록의 근무시간 합계(본인 기록만 읽을 수 있다) */
export async function loadMonthAttendance(workerId, ym) {
  const s = await getDocs(query(collection(db, 'worker_attendance_log'), where('workerId', '==', workerId), where('yearMonth', '==', ym)));
  let hours = 0; let days = 0; s.forEach((d) => { hours += Number(d.data().workHours) || 0; days++; });
  return { hours, days };
}
/** 공휴일 단일 출처(holidays.js) — 이미 불러왔으면 재사용 */
let holidayPromise = null;
export function loadHolidays() {
  if (window.JH_HOLIDAY_DATES) return Promise.resolve(new Set(window.JH_HOLIDAY_DATES));
  if (!holidayPromise) {
    holidayPromise = new Promise((resolve) => {
      const s = document.createElement('script'); s.src = new URL('../../../holidays.js', import.meta.url).href;
      s.onload = () => resolve(new Set(window.JH_HOLIDAY_DATES || [])); s.onerror = () => resolve(new Set());   // 못 불러오면 공휴일 없이 계산(주말만 제외)
      document.head.appendChild(s);
    });
  }
  return holidayPromise;
}
