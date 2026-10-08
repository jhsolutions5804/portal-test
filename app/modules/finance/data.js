import { db, functions, httpsCallable, collection, getDocs, getDoc, doc, query, orderBy, limit } from '../../core/firebase.js?v=20261008h';
import { docToEntry, chunk, postPayload } from './logic.js?v=20261008h';

/* 재무회계 데이터 읽기·쓰기 — Firestore 를 만지는 코드는 이 파일에만 둔다.
 * 읽기: ledger_entries(전표)·ledger_meta(설정·마감일·가맹점 규칙)·ledger_imports(가져오기 이력) — 보안 규칙상 관리자·재무회계팀(dept)·perms.finance 만 읽는다.
 * 쓰기: 전부 서버 함수 ledgerAct 로만(전표는 만든 뒤 고치거나 지울 수 없고, 잘못은 역분개로). 규칙: rules_ledger_test.rules */
const tsMs = (t) => (t && t.seconds ? t.seconds * 1000 : 0);
export async function loadLedger() {
  const [es, st, rl, im] = await Promise.all([
    getDocs(query(collection(db, 'ledger_entries'), orderBy('date'))), getDoc(doc(db, 'ledger_meta', 'settings')), getDoc(doc(db, 'ledger_meta', 'merchant_rules')),
    getDocs(query(collection(db, 'ledger_imports'), orderBy('at', 'desc'), limit(15)))
  ]);
  const entries = []; es.forEach((d) => entries.push(docToEntry(d.id, d.data())));
  const imports = []; im.forEach((d) => { const x = d.data(); imports.push({ id: d.id, kind: x.kind, fileName: x.fileName || '', rows: x.rows || 0, posted: x.posted || 0, duplicates: x.duplicates || 0, byName: x.byName || '', ms: tsMs(x.at) }); });
  return { entries, settings: st.exists() ? st.data() : {}, rules: rl.exists() ? (rl.data().rules || []) : [], imports };
}
/** 프로젝트 코드 목록(기획의 gihoek_projects) — 읽기 권한이 없으면 빈 목록(직접 입력) */
export async function loadProjects() { try { const s = await getDocs(collection(db, 'gihoek_projects')); const out = []; s.forEach((x) => { const v = x.data(); if (v && v.code) out.push({ id: x.id, code: v.code, name: v.name || '' }); }); return out.sort((a, b) => String(a.code).localeCompare(String(b.code))); } catch (e) { return []; } }
const friendly = (e) => { const m = String((e && e.message) || ''); return m.replace(/^(functions\/)?[a-z-]+:\s*/i, '') || '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'; };
export async function ledgerCall(data) { try { const r = await httpsCallable(functions, 'ledgerAct')(data); return r.data; } catch (e) { throw new Error(friendly(e)); } }
/** 전표 묶음 저장 — 100건씩 나누어 서버에 보낸다. 같은 원천(승인번호 등)은 서버가 한 번만 받는다 */
export async function postEntries(entries, onProgress) {
  const out = { posted: 0, duplicates: 0, rejected: [], postedIds: [] }; let done = 0;
  for (const part of chunk(entries.map(postPayload), 100)) {
    const r = await ledgerCall({ action: 'post', entries: part }); out.posted += r.posted.length; out.duplicates += r.duplicates.length; r.rejected.forEach((x) => out.rejected.push({ index: done + x.index, errors: x.errors })); r.posted.forEach((p) => out.postedIds.push(p.id)); done += part.length; if (onProgress) onProgress(done, entries.length);
  }
  return out;
}
export const markReviewed = async (ids, done) => { let n = 0; for (let i = 0; i < ids.length; i += 200) { const r = await ledgerCall({ action: 'review', ids: ids.slice(i, i + 200), done }); n += r.count; } return n; };
/** 영수증 사진·PDF 한 장을 서버에 올려 읽기(원본 보관 + 값 추출). 전표는 만들지 않는다 */
export async function readReceipt(fileName, mime, dataBase64) { try { const r = await httpsCallable(functions, 'ledgerReceipt')({ action: 'read', fileName, mime, dataBase64 }); return r.data; } catch (e) { throw new Error(friendly(e)); } }
export async function getReceiptFile(id) { try { const r = await httpsCallable(functions, 'ledgerReceipt')({ action: 'file', id }); return r.data; } catch (e) { throw new Error(friendly(e)); } }
/** 포털 급여명세서(해당 월) 읽기 — 서버가 관리자에게만 돌려준다 */
export const readPayroll = (month) => ledgerCall({ action: 'payrollRead', month });
export const reverseEntry = (id, date, memo) => ledgerCall({ action: 'reverse', id, date, memo });
export const lockThrough = (through) => ledgerCall({ action: 'lock', through });
export const saveSettings = (ownBiz, ownName) => ledgerCall({ action: 'saveSettings', ownBiz, ownName });
export const saveMerchantRules = (rules) => ledgerCall({ action: 'saveMerchantRules', rules });
export const recordImport = (rec) => ledgerCall(Object.assign({ action: 'recordImport' }, rec));
