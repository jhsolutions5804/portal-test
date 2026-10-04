import { db, collection, doc, getDocs, query, where, setDoc, updateDoc, serverTimestamp } from '../../core/firebase.js?v=20261004o';
import { recordOf, sortRows } from './logic.js?v=20261004o';
import { BREAK_MINUTES } from '../../shared/worktime.js?v=20261004o';

const COL = 'worker_attendance_log';
export const recId = (workerId, date) => workerId + '_' + date;

/* 보안 규칙이 "본인 기록만 읽기"라서, 없는 문서를 번호로 직접 읽으면(getDoc) 거부된다 — 근로자·날짜로 조회(query)하면 없을 때도 빈 결과로 안전하게 돌아온다 */
export async function loadRecord(workerId, date) {
  const s = await getDocs(query(collection(db, COL), where('workerId', '==', workerId), where('date', '==', date)));
  let r = null; s.forEach((d) => { if (!r) r = recordOf(d.id, d.data()); }); return r;
}
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
    checkIn: v.checkIn, checkOut: v.checkOut, breakMinutes: BREAK_MINUTES, workHours: v.hours, source,
    editedBy: me.uid, editedByName: me.name || '', updatedAt: serverTimestamp()
  }, { merge: true });
}
