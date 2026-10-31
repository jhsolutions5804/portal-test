/* 주 단위 근로시간 입출력 — 출퇴근 기록을 읽는다(파이어베이스 함수는 밖에서 주입, 시험: tests/hr-weekly-io.test.mjs). 새로 저장하는 것은 없다. */
import { addDays, weekStart } from './weekly.js?v=20261031h';

export function makeWeeklyIo(fb) {
  const { db, collection, getDocs, query, where } = fb;
  const lst = (snap) => { const a = []; snap.forEach((d) => a.push(Object.assign({ id: d.id }, d.data()))); return a; };
  const ymOf = (y, m) => { const d = new Date(y, m - 1, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  /** 달력에 보이는 달의 앞·뒤 달 기록(달 경계에 걸친 주의 합계를 맞추려고) — 한 직원 */
  async function adjacentRows(workerId, y, m) {
    const out = []; for (const ym of [ymOf(y, m - 1), ymOf(y, m + 1)]) out.push(...lst(await getDocs(query(collection(db, 'worker_attendance_log'), where('workerId', '==', workerId), where('yearMonth', '==', ym)))));
    return out;
  }
  /** 이번 주·지난주를 덮는 달들의 출퇴근 기록 전체(모든 직원) */
  async function reportRows(today) {
    const s = addDays(weekStart(today), -7), e = addDays(weekStart(today), 6); const yms = [...new Set([s.slice(0, 7), e.slice(0, 7)])]; const rows = [];
    for (const ym of yms) rows.push(...lst(await getDocs(query(collection(db, 'worker_attendance_log'), where('yearMonth', '==', ym)))));
    return rows.filter((r) => r.date >= s && r.date <= e);
  }
  return { adjacentRows, reportRows };
}
