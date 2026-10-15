// 본인 확인 링크(sign_links) 보안 규칙 시험 — 공격(막혀야 함)과 정상 동작(되어야 함). 어떤 규칙 파일에도 돌릴 수 있다(RULES_FILE).
//  OK = 규칙이 기대대로 동작 / FAIL = 기대와 다름(공격이 허용되었거나 정상 동작이 막힘)
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'; import { readFileSync } from 'node:fs';
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, query, where, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId: 'demo-eval', firestore: { rules: readFileSync(process.env.RULES_FILE, 'utf8'), host: '127.0.0.1', port: 8089 } });
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const must = async (kind, label, fn) => { let allowed = null; try { await fn(); allowed = true; } catch (e) { allowed = false; } ok(kind === 'allow' ? allowed === true : allowed === false, (kind === 'allow' ? '[정상 동작] ' : '[공격 차단] ') + label); };
const PH = '+821012345678', PH2 = '+821099990000'; const future = Timestamp.fromMillis(Date.now() + 86400000), past = Timestamp.fromMillis(Date.now() - 86400000);
const em = (u) => ({ email: u + '@jhsol.kr' });
await env.withSecurityRulesDisabled(async (c) => { const db = c.firestore();
  await setDoc(doc(db, 'portal_users/ADM'), { status: 'approved', admin: true }); await setDoc(doc(db, 'portal_users/EMP'), { status: 'approved', admin: false });
  const mk = async (t, link, pay) => { await setDoc(doc(db, 'sign_links/' + t), Object.assign({ docType: 'payslip', viewOnly: true, status: 'view', workerName: '피해자', phoneE164: PH, expiresTs: future, synced: true }, link || {})); await setDoc(doc(db, 'sign_links/' + t + '/secure/payload'), Object.assign({ viewOnly: true, html: '<p>급여명세서 실수령 3,000,000원</p>' }, pay || {})); };
  await mk('view1'); await mk('exp1', { expiresTs: past }); await mk('rev1', { status: 'revoked' }); await mk('nophone1', { phoneE164: '' });
  await mk('sign1', { docType: 'labor', status: 'pending', viewOnly: false, synced: false }, { viewOnly: false, doc: { name: '김' } });
  await mk('signed1', { docType: 'labor', status: 'signed', viewOnly: false, synced: false }, { viewOnly: false }); await setDoc(doc(db, 'sign_links/signed1/secure/result'), { signData: 'data:image/png;base64,AAAA', signedAt: new Date(), remoteSigned: true }); });
const adm = env.authenticatedContext('ADM', em('ADM')).firestore(), emp = env.authenticatedContext('EMP', em('EMP')).firestore();
const ph = env.authenticatedContext('p1', { phone_number: PH }).firestore(), ph2 = env.authenticatedContext('p2', { phone_number: PH2 }).firestore(), anon = env.unauthenticatedContext().firestore();
const L = (db, t) => doc(db, 'sign_links/' + t), S = (db, t, d) => doc(db, 'sign_links/' + t + '/secure/' + (d || 'payload'));
// ───── 공격 ─────
await must('deny', '일반 직원(이메일 로그인)이 남의 링크 비공개 문서(급여명세서 내용)를 읽을 수 없음', () => getDoc(S(emp, 'view1')));
await must('deny', '일반 직원이 링크 목록을 조회해 토큰을 찾아볼 수 없음', () => getDocs(collection(emp, 'sign_links')));
await must('deny', '일반 직원이 조건 조회(status/synced)로 목록을 긁어갈 수 없음', () => getDocs(query(collection(emp, 'sign_links'), where('status', '==', 'signed'), where('synced', '==', false))));
await must('deny', '일반 직원이 링크를 만들 수 없음(위조)', () => setDoc(L(emp, 'forged1'), { docType: 'payslip', viewOnly: true, status: 'view', phoneE164: '+821055556666', expiresTs: future }));
await must('deny', '일반 직원이 비공개 문서를 만들 수 없음(가짜 내용)', () => setDoc(S(emp, 'forged1'), { html: '<p>가짜</p>', viewOnly: true }));
await must('deny', '일반 직원이 남의 링크의 인증 번호를 바꿀 수 없음', () => updateDoc(L(emp, 'view1'), { phoneE164: '+821077778888' }));
await must('deny', '일반 직원이 남의 비공개 문서 내용을 바꿀 수 없음', () => setDoc(S(emp, 'view1'), { html: '<p>변조</p>', viewOnly: true }));
await must('deny', '일반 직원이 남의 링크를 지울 수 없음', () => deleteDoc(L(emp, 'view1')));
await must('deny', '문자 인증 번호가 다른 사람은 남의 비공개 문서를 읽을 수 없음', () => getDoc(S(ph2, 'view1')));
await must('deny', '로그인 없이는 비공개 문서를 읽을 수 없음', () => getDoc(S(anon, 'view1')));
await must('deny', '로그인 없이 링크 목록을 조회할 수 없음', () => getDocs(collection(anon, 'sign_links')));
await must('deny', '문자 인증 사용자가 링크를 목록 조회할 수 없음', () => getDocs(collection(ph, 'sign_links')));
await must('deny', '문자 인증 사용자가 링크를 만들 수 없음', () => setDoc(L(ph, 'byphone1'), { docType: 'payslip', viewOnly: true, status: 'view', phoneE164: PH, expiresTs: future }));
await must('deny', '문자 인증 본인이 자기 통보서(비공개 문서) 내용을 바꿀 수 없음', () => setDoc(S(ph, 'view1'), { html: '<p>위조</p>', viewOnly: true }));
await must('deny', '문자 인증 본인이 열람 전용 링크(급여명세서·평가 결과)에 서명 완료 표시를 할 수 없음', () => updateDoc(L(ph, 'view1'), { status: 'revoked' }));
await must('deny', '유효기간이 지난 링크는 본인 번호로도 읽을 수 없음', () => getDoc(S(ph, 'exp1')));
await must('deny', '취소된 링크는 본인 번호로도 읽을 수 없음', () => getDoc(S(ph, 'rev1')));
await must('deny', '인증 번호가 비어 있는 링크는 누구도 읽을 수 없음', () => getDoc(S(ph, 'nophone1')));
await must('deny', '관리자가 서명 결과(result)를 위조해서 만들 수 없음(결과는 본인만 생성)', () => setDoc(S(adm, 'sign1', 'result'), { signData: 'data:image/png;base64,AAAA', signedAt: serverTimestamp(), remoteSigned: true }));
// ───── 정상 동작 ─────
await must('allow', '관리자가 링크와 비공개 문서를 한 번에 만들 수 있음(근로계약서·급여명세서·평가 결과 발송)', async () => { const b = writeBatch(adm); b.set(L(adm, 'new1'), { docType: 'evalresult', viewOnly: true, status: 'view', workerName: '김', phoneE164: PH, expiresTs: future }); b.set(S(adm, 'new1'), { viewOnly: true, html: '<p>x</p>', docType: 'evalresult' }); await b.commit(); });
await must('allow', '관리자가 서명 완료 & 미동기화 링크를 조건 조회할 수 있음(서명 결과 동기화)', () => getDocs(query(collection(adm, 'sign_links'), where('status', '==', 'signed'), where('synced', '==', false))));
await must('allow', '관리자가 비공개 문서와 서명 결과를 읽을 수 있음(계약서 원본에 반영)', async () => { await getDoc(S(adm, 'signed1')); await getDoc(S(adm, 'signed1', 'result')); });
await must('allow', '관리자가 synced 표시를 갱신할 수 있음', () => updateDoc(L(adm, 'signed1'), { synced: true }));
await must('allow', '관리자가 링크를 취소(상태 변경)·삭제할 수 있음', async () => { await updateDoc(L(adm, 'new1'), { status: 'revoked' }); await deleteDoc(L(adm, 'new1')); });
await must('allow', '로그인 없이 링크 문서 한 건을 조회할 수 있음(열람 페이지가 먼저 읽음)', () => getDoc(L(anon, 'view1')));
await must('allow', '링크에 지정된 번호로 문자 인증한 본인은 비공개 문서를 읽을 수 있음', () => getDoc(S(ph, 'view1')));
await must('allow', '본인이 계약서에 서명(서명 결과 생성 + 링크 상태 signed)을 한 번의 쓰기로 완료할 수 있음', async () => { const b = writeBatch(ph); b.set(S(ph, 'sign1', 'result'), { signData: 'data:image/png;base64,AAAA', signedAt: serverTimestamp(), remoteSigned: true }); b.update(L(ph, 'sign1'), { status: 'signed', signedAt: serverTimestamp() }); await b.commit(); });
await must('allow', '서명 후 본인이 서명 결과를 다시 읽을 수 있음(이미 서명된 문서 화면)', () => getDoc(S(ph, 'sign1', 'result')));
await env.cleanup(); console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
