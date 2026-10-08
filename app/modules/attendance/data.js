import { db, collection, doc, getDocs, query, where, setDoc, updateDoc, serverTimestamp } from '../../core/firebase.js?v=20261008h';
import { recordOf, sortRows } from './logic.js?v=20261008h';
import { loadAttendRecord } from '../../shared/attendance-load.js?v=20261008h';
import { breakFor } from '../../shared/worktime.js?v=20261008h';

const COL = 'worker_attendance_log';
export const recId = (workerId, date) => workerId + '_' + date;

/* 한 날의 기록 — 전자결재도 같은 함수를 쓰므로 공용(shared)에 둔다 */
export const loadRecord = loadAttendRecord;
/** 한 달 기록 — 문서 번호가 근로자번호_날짜라서 근로자·연월로 조회한다(본인 또는 관리자만 읽을 수 있음) */
export async function loadMonth(workerId, ym) {
  const s = await getDocs(query(collection(db, COL), where('workerId', '==', workerId), where('yearMonth', '==', ym)));
  const rows = []; s.forEach((d) => rows.push(recordOf(d.id, d.data()))); return sortRows(rows);
}
/** 출근(원터치): 이미 출근 기록이 있으면 새로 쓰지 않는다 */
export async function writeClockIn(data) {
  const cur = await loadRecord(data.workerId, data.date);
  if (cur && cur.checkIn) return { already: true };
  await setDoc(doc(db, COL, recId(data.workerId, data.date)), Object.assign({}, data, { checkInAt: serverTimestamp(), updatedAt: serverTimestamp() }), { merge: true });
  return { already: false };
}
/** 퇴근(원터치): 이미 퇴근 기록이 있으면 덮어쓰지 않는다 */
export async function writeClockOut(workerId, date, patch) {
  const cur = await loadRecord(workerId, date);
  if (!cur || !cur.checkIn) return { missing: true };
  if (cur.checkOut) return { already: true };
  await updateDoc(doc(db, COL, recId(workerId, date)), Object.assign({}, patch, { checkOutAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  return { already: false };
}
/** 직접 입력·수정(일반 직원은 오늘, 관리자는 어느 날짜든) */
export async function writeManual(worker, v, me, source) {
  const ref = doc(db, COL, recId(worker.id, v.date));
  await setDoc(ref, {
    workerId: worker.id, name: worker.name || '', rank: worker.rank || '', date: v.date, yearMonth: v.date.slice(0, 7),
    checkIn: v.checkIn, checkOut: v.checkOut, breakMinutes: breakFor(v.checkIn, v.checkOut, v.checkOut <= v.checkIn), workHours: v.hours, source,
    editedBy: me.uid, editedByName: me.name || '', updatedAt: serverTimestamp()
  }, { merge: true });
}
