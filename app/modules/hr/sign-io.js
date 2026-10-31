/* 원격 서명·열람 링크·메일 발송 — Firestore·메일 서비스를 쓰는 부분(규칙·판단은 sign.js, 시험은 거기서).
 * 서명 페이지(sign.html)는 별도 공개 페이지이고, 이 파일은 관리자 화면 쪽(링크 만들기·서명 결과 반영·메일 보내기·발송 이력)만 맡는다. */
import { db, doc, getDoc, getDocs, collection, query, where, writeBatch, serverTimestamp, Timestamp, addDoc, updateDoc } from '../../core/firebase.js?v=20261031c';
import { confirmDialog } from '../../core/dialog.js?v=20261031c';
import { toast, esc } from '../../core/ui.js?v=20261031c';
import { docHtmlByVer, __ANNUAL_TPL } from './frozen-docs.js?v=20261031c';
import { configureLaborDocs, laborDocHtml, annualDocHtml } from './labor-doc.js?v=20261031c';
import { SHORT_TPL_VER, SHORT_SIGN_ERROR } from './short-doc.js?v=20261031c';
import { psHtml } from './payslip-doc.js?v=20261031c';
import { leavePromoHtmlByVer, configureLeavePromoDocs } from './leave-promo-docs.js?v=20261031c';
import { LP_STAGE } from './leave-promo.js?v=20261031c';
import { IS_TEST } from '../../core/config.js?v=20261031c';
import { emailjsFor, phoneE164, maskJumin, contractContentHash, buildSignLink, buildViewLink, NO_PHONE_ERROR, syncDecision, isEmail, sendLogEntry, summarizeSendLog, qrUrl, EMAILJS, DOC_LABEL } from './sign.js?v=20261031c';
export const signBase = () => new URL('../../../sign.html', import.meta.url).href;   // 이 앱이 올라가 있는 곳(테섭·본섭)의 서명 페이지
const logoUrl = () => new URL('../../theme/assets/jh-logo.png', import.meta.url).href;
const COLL = { annual: 'annual_contracts', labor: 'labor_contracts' };
/** 받는 사람 메일 주소: 명부/지원서에 있는 값 → (근로자라면) 연결된 포털 로그인 계정 주소 */
export async function recipientEmail(kind, id) {
  if (!id) return { email: '', source: '' };
  try { const snap = await getDoc(doc(db, kind === 'applicant' ? 'recruit_applicants' : 'workers', id)); if (!snap.exists()) return { email: '', source: '' }; const w = snap.data(); if (w.email) return { email: w.email, source: 'record' };
    if (kind === 'worker' && w.portalUid) { const ps = await getDoc(doc(db, 'portal_users', w.portalUid)); if (ps.exists() && ps.data().email) return { email: ps.data().email, source: 'login' }; } } catch (e) { /* 주소 없음 */ }
  return { email: '', source: '' };
}
/** 링크 만들기(서명 요청 또는 열람 전용) → 토큰. 인증용 휴대폰 번호: 문서 → 근로자 명부 → 채용 지원서 순 */
export async function createDocLink({ docType, workerId, contractId, offerId, payslipWid, payslipMonth, workerName, recipient, viewOnly }) {
  let srcRef, coll = ''; if (docType === 'labor' || docType === 'annual') { coll = COLL[docType]; srcRef = doc(db, coll + '/' + workerId + '/contracts', contractId); } else if (docType === 'offer') srcRef = doc(db, 'salary_offers', offerId); else if (docType === 'payslip') srcRef = doc(db, 'payslips/' + payslipWid + '/months', payslipMonth); else if (docType === 'leavepromo') { if (!viewOnly) throw new Error('연차사용촉진 서면은 열람 링크만 만들 수 있습니다.'); srcRef = doc(db, 'leave_promotions/' + workerId + '/records', contractId); } else throw new Error('지원하지 않는 문서 종류입니다.');
  const srcSnap = await getDoc(srcRef); if (!srcSnap.exists()) throw new Error('원본 문서를 찾을 수 없습니다. 먼저 저장해 주세요.'); const src = srcSnap.data();
  let e164 = phoneE164(src.phone); const tryRec = async (c, id) => { if (e164 || !id) return; try { const s = await getDoc(doc(db, c, id)); if (s.exists()) e164 = phoneE164(s.data().phone); } catch (e) { /* 다음 후보 */ } };
  await tryRec('workers', workerId || payslipWid || src.workerId || (recipient && recipient.kind === 'worker' ? recipient.id : '')); await tryRec('recruit_applicants', src.applicantId || (recipient && recipient.kind === 'applicant' ? recipient.id : '')); if (!e164) throw new Error(NO_PHONE_ERROR);
  let seal = {}; try { const cs = await getDoc(doc(db, 'company_settings', 'signatures')); if (cs.exists()) seal = cs.data(); } catch (e) { /* 직인 없이 */ }
  const ref = doc(collection(db, 'sign_links')); const batch = writeBatch(db);
  if (viewOnly) {
    configureLaborDocs({ signatures: seal, logo: logoUrl() }); const snapDoc = Object.assign({}, src); if ('jumin' in snapDoc) snapDoc.jumin = maskJumin(snapDoc.jumin);
    if (docType === 'leavepromo') configureLeavePromoDocs({ signatures: seal });   // 도장(직인)은 저장본 HTML 에 들어간다
    const html = docType === 'payslip' ? psHtml(snapDoc) : docType === 'leavepromo' ? leavePromoHtmlByVer(snapDoc) : (docType === 'annual' ? annualDocHtml(snapDoc) : laborDocHtml(snapDoc)); const r = buildViewLink({ docType, src, workerName, e164, html, title: docType === 'leavepromo' ? (LP_STAGE[src.stage] || '연차사용촉진') + ' 서면 통지' : '' }); if (!r.ok) throw new Error(r.error);
    batch.set(ref, Object.assign({}, r.meta, { createdAt: serverTimestamp(), expiresTs: Timestamp.fromMillis(r.expMs) })); batch.set(doc(db, 'sign_links/' + ref.id + '/secure/payload'), Object.assign({}, r.payload, { createdAt: serverTimestamp() }));
  } else {
  if (docType === 'labor' && src && src.tplVer === SHORT_TPL_VER) throw new Error(SHORT_SIGN_ERROR); // 서명 페이지(sign.html)가 단시간 양식을 못 그린다 — 열람 전용 링크는 위 분기에서 미리 그린 HTML 로 허용
  const r = buildSignLink({ docType, src, workerName, e164, seal, coll, workerId, contractId, contentHash: coll ? await contractContentHash(src) : '' }); if (!r.ok) throw new Error(r.error);
    batch.set(ref, Object.assign({}, r.meta, { createdAt: serverTimestamp(), expiresTs: Timestamp.fromMillis(r.expMs) })); batch.set(doc(db, 'sign_links/' + ref.id + '/secure/payload'), Object.assign({}, r.payload, { createdAt: serverTimestamp() }));
  }
  await batch.commit(); return ref.id;
}
/** 평가 결과 통보서 열람 링크 만들기 → 토큰. 문서 내용(HTML)은 평가 모듈이 만들어 넘기고(이스케이프 완료), 여기서는 본인 확인용 휴대폰 번호(근로자 명부)를 찾아 링크 문서만 저장한다.
 *  메일 본문에는 점수가 없고 이 링크만 나간다 — 링크를 열면 명부의 번호로 문자 인증을 통과한 본인만 읽는다(보안 규칙 sign_links/{token}/secure). */
export async function createResultLink({ workerId, workerName, html, title }) {
  if (!workerId) throw new Error('받는 분(근로자)을 알 수 없습니다.'); if (!html) throw new Error('통보서 내용이 비어 있습니다.');
  let e164 = ''; try { const s = await getDoc(doc(db, 'workers', workerId)); if (s.exists()) e164 = phoneE164(s.data().phone); } catch (e) { /* 번호 없음 처리로 */ } if (!e164) throw new Error(NO_PHONE_ERROR);
  const r = buildViewLink({ docType: 'evalresult', workerName, e164, html, title }); if (!r.ok) throw new Error(r.error);
  const ref = doc(collection(db, 'sign_links')); const batch = writeBatch(db);
  batch.set(ref, Object.assign({}, r.meta, { createdAt: serverTimestamp(), expiresTs: Timestamp.fromMillis(r.expMs) })); batch.set(doc(db, 'sign_links/' + ref.id + '/secure/payload'), Object.assign({}, r.payload, { createdAt: serverTimestamp() }));
  await batch.commit(); return ref.id;
}
let syncBusy = false;
/** 근로자가 원격으로 서명한 결과(sign_links/{token}/secure/result)를 계약서 원본에 반영 — 관리자 화면에서만. 링크 이후 계약 내용이 바뀌었으면 자동 반영하지 않고 conflict 로 표시 */
export async function syncSignedLinks() {
  const out = { applied: 0, conflict: 0 }; if (syncBusy) return out; syncBusy = true;
  try {
    const snap = await getDocs(query(collection(db, 'sign_links'), where('status', '==', 'signed'), where('synced', '==', false)));
    for (const d of snap.docs) {
      try {
        const l = d.data(); if (l.docType !== 'labor' && l.docType !== 'annual') { await updateDoc(d.ref, { synced: true }); continue; }
        const [pay, res] = await Promise.all([getDoc(doc(db, 'sign_links/' + d.id + '/secure/payload')), getDoc(doc(db, 'sign_links/' + d.id + '/secure/result'))]); if (!pay.exists() || !res.exists()) continue;
        const ref = pay.data().ref || {}; const cref = doc(db, ref.coll + '/' + ref.workerId + '/contracts', ref.contractId); const cs = await getDoc(cref);
        const dec = await syncDecision(l, pay.data(), res.data(), cs.exists() ? cs.data() : null); if (!dec) continue; if (dec.patch) { await updateDoc(cref, dec.patch); out.applied++; } if (dec.synced === 'conflict') out.conflict++; await updateDoc(d.ref, { synced: dec.synced });
      } catch (e) { console.warn('서명 반영 실패:', d.id, e.message); }
    }
  } catch (e) { console.warn('서명 반영 조회 실패:', e.message); } finally { syncBusy = false; }
  return out;
}
export async function loadSendLog(wid) { try { const snap = await getDocs(query(collection(db, 'doc_send_log'), where('workerId', '==', wid))); const l = []; snap.forEach((d) => l.push(d.data())); return summarizeSendLog(l); } catch (e) { return {}; } }
let emailReady = null;
function ensureEmailJs() {
  if (emailReady) return emailReady; if (!emailjsFor(IS_TEST)) return Promise.reject(new Error('테섭에서는 메일 발송을 쓰지 않습니다(시험 중 실제 직원에게 메일이 나가지 않도록). 링크·QR 로 확인해 주세요. 본섭에서는 발송됩니다.'));
  emailReady = new Promise((resolve, reject) => { const init = () => { try { globalThis.emailjs.init({ publicKey: EMAILJS.publicKey }); resolve(); } catch (e) { reject(e); } }; if (globalThis.emailjs) { init(); return; } const s = document.createElement('script'); s.src = EMAILJS.sdk; s.onload = init; s.onerror = () => { emailReady = null; reject(new Error('EmailJS SDK 로드 실패')); }; document.head.appendChild(s); });
  return emailReady;
}
/** 링크 팝업(QR + 복사) */
export function showLinkModal(token, name, opts) {
  const o = opts || {}; const isView = !!o.view; const url = signBase() + '?token=' + token; const old = document.getElementById('jh-link-modal'); if (old) old.remove();
  const wrap = document.createElement('div'); wrap.id = 'jh-link-modal'; wrap.className = 'jh-dialog'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
  wrap.innerHTML = '<div class="jh-dialog__backdrop" data-close></div><div class="jh-dialog__panel"><h3 class="jh-dialog__title">' + (isView ? '📄 ' : '🔗 ') + esc(name || '') + '님 ' + (isView ? esc((o.label || '서류') + ' 열람 링크') : '서명 링크') + '</h3><div class="jh-dialog__body" style="text-align:center"><div class="jh-field__hint">' + (isView ? '180일 동안 유효합니다' : '72시간 동안 유효합니다') + '</div><img src="' + esc(qrUrl(url)) + '" alt="QR 코드" width="180" height="180" style="margin:var(--sp-3) auto;display:block"><input class="jh-input" readonly value="' + esc(url) + '" id="jh-link-input"><div class="jh-field__hint">' + (isView ? '이 링크(또는 QR)를 근로자 본인에게 전달하세요. 링크를 열면 등록된 휴대폰 번호로 문자 인증을 거친 뒤 저장된 서류를 열람·인쇄할 수 있습니다. (서명·수정 불가)' : '이 링크(또는 QR)를 근로자 본인에게 전달하세요. 링크를 열면 등록된 휴대폰 번호로 문자 인증을 거친 뒤 서류를 확인하고 서명할 수 있습니다.') + '</div></div><div class="jh-dialog__actions"><button type="button" class="jh-btn" data-variant="secondary" data-copy>링크 복사</button><button type="button" class="jh-btn" data-variant="primary" data-close>닫기</button></div></div>';
  wrap.addEventListener('click', (ev) => { const t = ev.target; if (!(t instanceof Element)) return; if (t.closest('[data-close]')) wrap.remove(); else if (t.closest('[data-copy]')) { try { navigator.clipboard.writeText(url); toast('링크를 복사했습니다.'); } catch (e) { const i = wrap.querySelector('#jh-link-input'); i.select(); } } }); document.body.appendChild(wrap);
}
/** 메일로 링크 보내기: 주소 확인(없으면 입력받아 명부/지원서에 저장) → 링크 생성 → 메일 서비스로 발송 → 발송 이력(원본 문서에는 아무것도 쓰지 않음) */
export async function sendDocLinkByEmail({ kind, id, toEmail, toName, docLabel, linkParams }) {
  try {
    let email = toEmail || ''; let fromRecord = false; let srcNote = ''; const srcLabel = kind === 'applicant' ? '지원서' : '근로자 명부';
    if (!email && id) { const r = await recipientEmail(kind, id); email = r.email; fromRecord = !!email; srcNote = r.source === 'login' ? ' · 로그인 계정 주소' : ''; }
    if (!email) { const ask = await confirmDialog({ title: '이메일 주소 입력', body: (toName || '') + '님의 이메일 주소가 ' + srcLabel + '에 등록되어 있지 않습니다. 발송할 이메일 주소를 입력해 주세요.' + (id ? ' (발송 후 ' + srcLabel + '에 함께 저장되어 다음부터 자동 입력됩니다)' : ''), confirmLabel: '다음', reason: { label: '이메일 주소', placeholder: 'name@example.com', required: true } }); if (!ask.ok) return { ok: false, cancelled: true }; email = ask.reason; }
    email = String(email).trim(); if (!isEmail(email)) { toast('이메일 주소 형식이 올바르지 않습니다.'); return { ok: false }; }
    if (fromRecord) { const c = await confirmDialog({ title: '확인 링크 발송', body: (toName || '') + '님 (' + email + srcNote + ')에게 ' + docLabel + ' 확인 링크를 이메일로 발송합니다.', confirmLabel: '발송' }); if (!c.ok) return { ok: false, cancelled: true }; }
    const token = (linkParams && linkParams.docType === 'evalresult') ? await createResultLink({ workerId: id, workerName: toName, html: linkParams.html, title: linkParams.title }) : await createDocLink(Object.assign({}, linkParams, { workerName: toName, recipient: { kind, id } })); const link = signBase() + '?token=' + token;
    await ensureEmailJs(); await globalThis.emailjs.send(EMAILJS.serviceId, EMAILJS.templateId, { to_email: email, to_name: toName || '', doc_label: docLabel, company_name: 'JH솔루션', link });
    if (!fromRecord && !toEmail && id) { try { await updateDoc(doc(db, kind === 'applicant' ? 'recruit_applicants' : 'workers', id), { email }); } catch (e) { /* 저장 실패해도 발송은 완료 */ } }
    try { await addDoc(collection(db, 'doc_send_log'), Object.assign(sendLogEntry({ kind, id, docLabel, linkParams, email }), { sentAt: serverTimestamp() })); } catch (e) { /* 이력 기록 실패 */ }
    toast('✅ ' + email + ' 주소로 ' + docLabel + ' 확인 링크가 발송되었습니다.'); return { ok: true, email };
  } catch (e) { toast('이메일 발송 오류: ' + ((e && e.message) || e) + ' (메일 서비스 설정이 안 되어 있다면 관리자에게 문의하세요)'); return { ok: false, error: e }; }
}
export const labelOf = (docType) => DOC_LABEL[docType] || '서류';
