import { db, collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from '../../core/firebase.js?v=20261007e';
import { addDays, fromLegacyDoc, toCompanyDoc } from './logic.js?v=20261007e';

/* 회사 일정(company_schedules): 프로젝트에 속하지 않는 일정 + 전자결재가 연차 승인 때 서버에서 기록하는 연차·휴무(source:'edoc_leave').
 * 보안 규칙: 읽기는 GUEST 제외(연차·휴무 tag off·leave 만 GUEST 도 읽음), 쓰기는 승인된 비GUEST. 규칙은 필터가 아니라 조건 증명이라
 * GUEST 는 반드시 tag in ['off','leave'] 조건으로 조회해야 한다. */
const COL = 'company_schedules';
const memo = new Map();                       // 같은 범위를 제공자 두 곳이 요청해도 한 번만 읽는다(30초)
export function loadCompanyRaw(range, me) {
  const key = range.from + '|' + range.to + '|' + (me && me.isGuest ? 'g' : 'u'); const hit = memo.get(key);
  if (hit && Date.now() - hit.t < 30000) return hit.p;
  const q = me && me.isGuest ? query(collection(db, COL), where('tag', 'in', ['off', 'leave']))
    : query(collection(db, COL), where('sdate', '>=', addDays(range.from, -45)), where('sdate', '<=', range.to));   // 여러 날 일정이 앞 달에서 시작했을 수 있어 45일 앞까지
  const p = getDocs(q).then((s) => { const rows = []; s.forEach((d) => { const x = d.data(); const sd = x.sdate || ''; const ed = x.edate || sd; if (sd && ed >= range.from && sd <= range.to) rows.push({ id: d.id, d: x }); }); return rows; });
  memo.set(key, { t: Date.now(), p }); p.catch(() => memo.delete(key)); return p;
}
export const invalidateCompany = () => memo.clear();
const isLeaveRow = (d) => (d.tag === 'off' || d.tag === 'leave') && d.source !== 'calendar';

export const leaveProvider = { id: 'leave', label: '연차·휴무', order: 10, defaultOn: true,
  load: async (range, ctx) => (await loadCompanyRaw(range, ctx.me)).filter((r) => isLeaveRow(r.d)).map((r) => fromLegacyDoc(r.id, r.d, 'leave', '', { editable: false, workdays: true })) };
export const companyProvider = { id: 'company', label: '회사 일정', order: 20, defaultOn: true,
  load: async (range, ctx) => (await loadCompanyRaw(range, ctx.me)).filter((r) => !isLeaveRow(r.d)).map((r) => fromLegacyDoc(r.id, r.d, 'company', '', { editable: true, ref: r.id })) };

export async function createCompanyEvent(draft, me) { const r = await addDoc(collection(db, COL), Object.assign(toCompanyDoc(draft, me), { savedAt: serverTimestamp() })); invalidateCompany(); return r.id; }
export async function updateCompanyEvent(id, draft, me) { const d = toCompanyDoc(draft, me); delete d.done; await updateDoc(doc(db, COL, id), Object.assign(d, { updatedAt: serverTimestamp() })); invalidateCompany(); }
export async function deleteCompanyEvent(id) { await deleteDoc(doc(db, COL, id)); invalidateCompany(); }
export async function setCompanyDone(id, done) { await updateDoc(doc(db, COL, id), { done: !!done, doneUpdatedAt: serverTimestamp() }); invalidateCompany(); }
