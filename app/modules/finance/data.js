import { db, functions, httpsCallable, collection, getDocs, getDoc, doc, query, orderBy, limit } from '../../core/firebase.js?v=20261031d';
import { docToEntry, chunk, postPayload } from './logic.js?v=20261031d';

/* 재무회계 데이터 읽기·쓰기 — Firestore 를 만지는 코드는 이 파일에만 둔다.
 * 읽기: ledger_entries(전표)·ledger_meta(설정·마감일·가맹점 규칙)·ledger_imports(가져오기 이력) — 보안 규칙상 관리자·재무회계팀(dept)·perms.finance 만 읽는다.
 * 쓰기: 전부 서버 함수 ledgerAct 로만(전표는 만든 뒤 고치거나 지울 수 없고, 잘못은 역분개로). 규칙: rules_ledger_test.rules */
const tsMs = (t) => (t && t.seconds ? t.seconds * 1000 : 0);
export async function loadLedger() {
  const [es, st, rl, pr, br, mp, im] = await Promise.all([
    getDocs(query(collection(db, 'ledger_entries'), orderBy('date'))), getDoc(doc(db, 'ledger_meta', 'settings')), getDoc(doc(db, 'ledger_meta', 'merchant_rules')), getDoc(doc(db, 'ledger_meta', 'purchase_rules')), getDoc(doc(db, 'ledger_meta', 'bank_rules')), getDoc(doc(db, 'ledger_meta', 'monthly_plan')),
    getDocs(query(collection(db, 'ledger_imports'), orderBy('at', 'desc'), limit(15)))
  ]);
  const entries = []; es.forEach((d) => entries.push(docToEntry(d.id, d.data())));
  const imports = []; im.forEach((d) => { const x = d.data(); imports.push({ id: d.id, kind: x.kind, fileName: x.fileName || '', rows: x.rows || 0, posted: x.posted || 0, duplicates: x.duplicates || 0, byName: x.byName || '', ms: tsMs(x.at) }); });
  return { entries, settings: st.exists() ? st.data() : {}, rules: rl.exists() ? (rl.data().rules || []) : [], purchaseRules: pr.exists() ? (pr.data().rules || []) : [], bankRules: br.exists() ? (br.data().rules || []) : [], plan: mp.exists() ? { items: mp.data().items || [], overrides: mp.data().overrides || {} } : { items: [], overrides: {} }, imports };
}
/** 프로젝트 코드 목록(기획의 gihoek_projects) — 읽기 권한이 없으면 빈 목록(직접 입력) */
export async function loadProjects() { try { const s = await getDocs(collection(db, 'gihoek_projects')); const out = []; s.forEach((x) => { const v = x.data(); if (v && v.code) out.push({ id: x.id, code: v.code, name: v.name || '' }); }); return out.sort((a, b) => String(a.code).localeCompare(String(b.code))); } catch (e) { return []; } }
const friendly = (e) => { const m = String((e && e.message) || ''); return m.replace(/^(functions\/)?[a-z-]+:\s*/i, '') || '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'; };
/* 월별 청구서 합계(marginAct invoiceMonthly, 재무회계 권한자) — 이엔지 정산 탭의 "월별 매출 세 숫자" 카드가 쓴다. 권한 없음과 서버 오류를 화면이 구분하도록 오류 코드를 그대로 던진다(ledgerCall 처럼 문장만 남기지 않는다) */
export async function loadInvoiceMonthly() { const r = await httpsCallable(functions, 'marginAct')({ action: 'invoiceMonthly' }); return r.data; }
export async function ledgerCall(data) { try { const r = await httpsCallable(functions, 'ledgerAct')(data); return r.data; } catch (e) { throw new Error(friendly(e)); } }
/** 전표 묶음 저장 — 100건씩 나누어 서버에 보낸다. 같은 원천(승인번호 등)은 서버가 한 번만 받는다 */
export async function postEntries(entries, onProgress) {
  const out = { posted: 0, duplicates: 0, rejected: [], postedIds: [] }; let done = 0;
  for (const part of chunk(entries.map(postPayload), 100)) {
    const r = await ledgerCall({ action: 'post', entries: part }); out.posted += r.posted.length; out.duplicates += r.duplicates.length; r.rejected.forEach((x) => out.rejected.push({ index: done + x.index, errors: x.errors })); r.posted.forEach((p) => out.postedIds.push(p.id)); done += part.length; if (onProgress) onProgress(done, entries.length);
  }
  return out;
}
export const markReviewed = async (ids, done, note) => { let n = 0; for (let i = 0; i < ids.length; i += 200) { const r = await ledgerCall({ action: 'review', ids: ids.slice(i, i + 200), done, note: note || '' }); n += r.count; } return n; };
/** 영수증 사진·PDF 한 장을 서버에 올려 읽기(원본 보관 + 값 추출). 전표는 만들지 않는다 */
export async function readReceipt(fileName, mime, dataBase64) { try { const r = await httpsCallable(functions, 'ledgerReceipt')({ action: 'read', fileName, mime, dataBase64 }); return r.data; } catch (e) { throw new Error(friendly(e)); } }
/** 네이버페이 영수증 한 장 읽기 — 서버는 원본을 보관하지 않고 읽은 값(카드사·승인번호·금액·상품·취소 여부)만 돌려준다 */
export async function readNpay(fileName, mime, dataBase64) { try { const r = await httpsCallable(functions, 'ledgerReceipt')({ action: 'npayRead', fileName, mime, dataBase64 }); return r.data; } catch (e) { throw new Error(friendly(e)); } }
export async function getReceiptFile(id) { try { const r = await httpsCallable(functions, 'ledgerReceipt')({ action: 'file', id }); return r.data; } catch (e) { throw new Error(friendly(e)); } }
/** 포털 급여명세서(해당 월) 읽기 — 서버가 관리자에게만 돌려준다 */
export const readPayroll = (month) => ledgerCall({ action: 'payrollRead', month });
export const reverseEntry = (id, date, memo) => ledgerCall({ action: 'reverse', id, date, memo });
export const lockThrough = (through) => ledgerCall({ action: 'lock', through });
export const saveSettings = (ownBiz, ownName) => ledgerCall({ action: 'saveSettings', ownBiz, ownName });
export const saveMerchantRules = (rules) => ledgerCall({ action: 'saveMerchantRules', rules });
export const recordImport = (rec) => ledgerCall(Object.assign({ action: 'recordImport' }, rec));
/** 재분류(계정 바꾸기): 원 전표를 역분개하고 바른 줄로 새 전표를 한 번에 만든다 */
export const reclassifyEntry = (id, date, memo, lines) => ledgerCall({ action: 'reclassify', id, date, memo, lines });
export const savePurchaseRules = (rules) => ledgerCall({ action: 'savePurchaseRules', rules }); export const saveBankRules = (rules) => ledgerCall({ action: 'saveBankRules', rules }); export const saveMonthlyPlan = (plan) => ledgerCall({ action: 'saveMonthlyPlan', items: plan.items, overrides: plan.overrides });
/** 전표 증빙 파일 붙이기·열람(서버 저장소에 보관, 전표에는 파일 정보만) */
export async function attachEvidence(entryId, fileName, mime, dataBase64) { try { const r = await httpsCallable(functions, 'ledgerReceipt')({ action: 'attach', entryId, fileName, mime, dataBase64 }); return r.data; } catch (e) { throw new Error(friendly(e)); } }
export async function getAttachment(entryId, aid) { try { const r = await httpsCallable(functions, 'ledgerReceipt')({ action: 'attachFile', entryId, aid }); return r.data; } catch (e) { throw new Error(friendly(e)); } }
export const assignEntries = (ids, assignee) => ledgerCall({ action: 'assign', ids, assignee });
/* 전표 프로젝트 표시(분석 태그) — 읽기는 보안 규칙상 재무회계 권한자만, 쓰기는 전부 서버 함수 ledgerAct 로만. 계산은 pjt-tag-logic.js */
const byId = (snap) => { const o = {}; snap.forEach((d) => { o[d.id] = d.data(); }); return o; };
export async function loadPjtTags() {
  const [tg, pr, rg] = await Promise.all([getDocs(collection(db, 'ledger_pjt_tags')), getDocs(collection(db, 'ledger_pjt_proposals')), getDocs(collection(db, 'pjt_registry'))]);
  const names = {}; rg.forEach((d) => { const v = d.data(); names[d.id] = (v && v.name) || d.id; });
  return { tags: byId(tg), proposals: byId(pr), names };
}
/** 확정 — 서버 pjtTagBatch 에 100건씩 보내고 줄별 결과를 합친다(한 줄이 거부돼도 나머지는 저장됨) */
export async function confirmPjtTags(items) {
  const out = { saved: 0, rejected: [] }; let done = 0;
  for (const part of chunk(items, 100)) { const r = await ledgerCall({ action: 'pjtTagBatch', items: part }); out.saved += r.saved.length; r.rejected.forEach((x) => out.rejected.push({ index: done + x.index, code: x.code, message: x.message })); done += part.length; }
  return out;
}
/** 줄 직접 지정(저장·재지정) — 서버 pjtTagSet. 분할 합 = 줄 금액·등록된 프로젝트만·줄당 12개까지는 서버가 최종 검사하고 거절 사유를 한글로 돌려준다 */
export const setPjtTag = (item) => ledgerCall({ action: 'pjtTagSet', entryId: item.entryId, lineIdx: item.lineIdx, method: item.method, splits: item.splits, note: item.note || '' });
/** 거래처 규칙 목록 — 서버 pjtRuleList(꺼진 규칙 포함). 응답 { rules, warnings: [{ partners, accounts }] } */
export const listPjtRules = () => ledgerCall({ action: 'pjtRuleList', includeInactive: true });
/** 거래처 규칙 저장(추가·수정·끄기/켜기) — 서버 pjtRuleSave. 같은 거래처면 갱신되고 이전 규칙은 서버 history 에 남는다. 규칙은 제안의 입력일 뿐 확정이 아니다 */
export const savePjtRule = (r) => ledgerCall({ action: 'pjtRuleSave', partner: r.partner, accounts: r.accounts, mode: r.mode, pjt: r.pjt, note: r.note || '', active: r.active !== false });
/** 확정 해제 — 서버 pjtTagClear: 문서는 남기고 상태만 cleared, 이전 지정은 history 에 남는다. 해제한 줄은 대기 목록으로 돌아온다 */
export const clearPjtTag = (item) => ledgerCall({ action: 'pjtTagClear', entryId: item.entryId, lineIdx: item.lineIdx, note: item.note || '' });
/** 새 전표의 제안 만들기 — dryRun 이면 만들 건수만 알려 주고 쓰지 않는다 */
export const proposeNewPjt = (dryRun) => ledgerCall({ action: 'pjtProposeNew', dryRun: dryRun === true });

