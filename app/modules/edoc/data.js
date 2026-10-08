import { db, collection, doc, getDoc, getDocs, query, where } from '../../core/firebase.js?v=20261008h';
import { DOC_TYPES, toMillis } from './logic.js?v=20261008h';

/* Firestore 규칙과 일치하지 않는 무제한 목록 쿼리는 거부되므로 작성자 / 결재선(viewerUids) / 게시 또는 관리자 세 갈래로 조회해 합친다 */
export async function fetchAll(me) {
  const results = []; const seen = new Set();
  const add = (dtype, snap) => snap.forEach(d => {
    const k = dtype + '/' + d.id; if (seen.has(k)) return; seen.add(k);
    const data = d.data();
    results.push(Object.assign({}, data, { id: d.id, dtype, _ms: toMillis(data.createdAt) }));
  });
  await Promise.all(DOC_TYPES.map(async (dtype) => {
    const coll = collection(db, 'edoc_' + dtype);
    const jobs = [
      getDocs(query(coll, where('authorUid', '==', me.uid))),
      getDocs(query(coll, where('viewerUids', 'array-contains', me.uid))),
      me.admin ? getDocs(coll) : getDocs(query(coll, where('status', '==', 'posted')))
    ];
    try { (await Promise.all(jobs)).forEach(s => add(dtype, s)); }
    catch (e) { console.error('전자결재 조회 오류', dtype, e); }
  }));
  results.sort((a, b) => b._ms - a._ms);
  return results;
}
export async function fetchOne(dtype, id) {
  const s = await getDoc(doc(db, 'edoc_' + dtype, id));
  if (!s.exists()) return null;
  const data = s.data();
  return Object.assign({}, data, { id: s.id, dtype, _ms: toMillis(data.createdAt) });
}
