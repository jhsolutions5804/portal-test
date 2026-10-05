import { db, collection, getDocs, query, where } from '../core/firebase.js?v=20261005d';
import { recordOf } from './attendance-record.js?v=20261005d';

const COL = 'worker_attendance_log';
/* 보안 규칙이 "본인 기록만 읽기"라서, 없는 문서를 번호로 직접 읽으면(getDoc) 거부된다 — 근로자·날짜로 조회(query)하면 없을 때도 빈 결과로 안전하게 돌아온다 */
export async function loadAttendRecord(workerId, date) {
  const s = await getDocs(query(collection(db, COL), where('workerId', '==', workerId), where('date', '==', date)));
  let r = null; s.forEach((d) => { if (!r) r = recordOf(d.id, d.data()); }); return r;
}
