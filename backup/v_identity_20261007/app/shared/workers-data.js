import { db, collection, getDocs, query, where } from '../core/firebase.js?v=20261007m';

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
/** 공휴일은 shared/holidays.js 가 단일 창구 — 기존 import 경로 호환용 재내보내기 */
export { loadHolidays } from './holidays.js?v=20261007m';
