// 참여 프로젝트 기록(pjt_day_part) 보안 규칙 시험 — 서버 전용이라 클라이언트는 직원·관리자 모두 읽고 쓸 수 없어야 한다. 어떤 규칙 파일에도 돌릴 수 있다(RULES_FILE).
// OK = 규칙이 기대대로 동작 / FAIL = 기대와 다름(공격이 허용되었거나 정상 동작이 막힘). 게시본(수정 전)에서는 공격 항목이 FAIL 로 보여 결함을 드러내고 수정본에서는 전부 OK 여야 한다.
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'; import { readFileSync } from 'node:fs';
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId: 'demo-part', firestore: { rules: readFileSync(process.env.RULES_FILE, 'utf8'), host: '127.0.0.1', port: 8089 } });
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK ' + m); } else { fail++; console.log('FAIL ' + m); } };
const must = async (kind, label, fn) => { let allowed = null; try { await fn(); allowed = true; } catch (e) { allowed = false; } ok(kind === 'allow' ? allowed === true : allowed === false, (kind === 'allow' ? '[정상 동작] ' : '[공격 차단] ') + label); };
const em = (u) => ({ email: u + '@jhsol.kr' });
await env.withSecurityRulesDisabled(async (c) => { const db = c.firestore();
  await setDoc(doc(db, 'portal_users/ADM'), { status: 'approved', admin: true, name: '관리자' }); await setDoc(doc(db, 'portal_users/EMP'), { status: 'approved', admin: false, name: '직원' }); await setDoc(doc(db, 'portal_users/EMP2'), { status: 'approved', admin: false, name: '다른직원' }); await setDoc(doc(db, 'portal_users/PEND'), { status: 'pending' });
  await setDoc(doc(db, 'pjt_day_part/2026-10-16_EMP'), { date: '2026-10-16', uid: 'EMP', projects: [{ pjt: 'pa', bp: 10000 }], basis: 'single', history: [] });
  await setDoc(doc(db, 'pjt_registry/pa'), { name: '프로젝트A', status: 'run' }); await setDoc(doc(db, 'pjt_log/pa/entries/e1'), { title: '이력' }); await setDoc(doc(db, 'ledger_pjt_tags/t1'), { status: 'confirmed' }); });
const adm = env.authenticatedContext('ADM', em('ADM')).firestore(), emp = env.authenticatedContext('EMP', em('EMP')).firestore(), emp2 = env.authenticatedContext('EMP2', em('EMP2')).firestore(), pend = env.authenticatedContext('PEND', em('PEND')).firestore(), anon = env.unauthenticatedContext().firestore();
const P = (db, id) => doc(db, 'pjt_day_part/' + id); const REC = { date: '2026-10-16', uid: 'EMP', projects: [{ pjt: 'pa', bp: 10000 }], basis: 'single', history: [] };
// ───── 공격(막혀야 함) ─────
await must('deny', '일반 직원이 자기 참여 기록을 직접 쓸 수 없음(서버를 우회해 40일 규칙·참여자 확인·정정 이력을 건너뜀)', () => setDoc(P(emp, '2026-10-15_EMP'), REC));
await must('deny', '일반 직원이 남의 참여 기록을 만들 수 없음(위조)', () => setDoc(P(emp, '2026-10-15_EMP2'), Object.assign({}, REC, { uid: 'EMP2' })));
await must('deny', '일반 직원이 자기 기록을 직접 고칠 수 없음(비율 바꿔치기·history 지우기)', () => updateDoc(P(emp, '2026-10-16_EMP'), { projects: [{ pjt: 'pa', bp: 5000 }, { pjt: 'pb', bp: 5000 }], history: [] }));
await must('deny', '일반 직원이 자기 기록을 지울 수 없음', () => deleteDoc(P(emp, '2026-10-16_EMP')));
await must('deny', '일반 직원이 남의 참여 기록을 읽을 수 없음(누가 어느 프로젝트에 있었는지)', () => getDoc(P(emp2, '2026-10-16_EMP')));
await must('deny', '일반 직원이 자기 기록도 직접 읽을 수 없음(읽기는 서버 get 으로만)', () => getDoc(P(emp, '2026-10-16_EMP')));
await must('deny', '일반 직원이 참여 기록 목록을 조회할 수 없음', () => getDocs(collection(emp, 'pjt_day_part')));
await must('deny', '관리자도 클라이언트로 직접 쓸 수 없음(대리 저장은 서버 saveFor 로만, 이력·감사 기록이 남게)', () => setDoc(P(adm, '2026-10-15_EMP'), REC));
await must('deny', '관리자도 클라이언트로 직접 읽을 수 없음', () => getDoc(P(adm, '2026-10-16_EMP')));
await must('deny', '관리자도 클라이언트로 목록 조회할 수 없음', () => getDocs(collection(adm, 'pjt_day_part')));
await must('deny', '관리자도 직접 지울 수 없음(정정 이력 보존)', () => deleteDoc(P(adm, '2026-10-16_EMP')));
await must('deny', '승인되지 않은 사용자는 읽을 수 없음', () => getDoc(P(pend, '2026-10-16_EMP')));
await must('deny', '승인되지 않은 사용자는 쓸 수 없음', () => setDoc(P(pend, '2026-10-15_PEND'), Object.assign({}, REC, { uid: 'PEND' })));
await must('deny', '로그인 없이 읽을 수 없음', () => getDoc(P(anon, '2026-10-16_EMP')));
await must('deny', '로그인 없이 쓸 수 없음', () => setDoc(P(anon, '2026-10-15_X'), REC));
await must('deny', '하위 경로(하위 컬렉션)로도 쓸 수 없음(규칙 우회 시도)', () => setDoc(doc(emp, 'pjt_day_part/2026-10-16_EMP/extra/x'), { a: 1 }));
await must('deny', '컬렉션 이름만 비슷하게 바꿔 우회할 수 없음 — 같은 이름의 문서 id 에 슬래시를 넣은 경로', () => setDoc(doc(emp, 'pjt_day_part/a/b/c'), { a: 1 }));
// ───── 회귀(바뀌면 안 되는 동작) ─────
await must('deny', '[회귀] 프로젝트 이력(pjt_log)은 여전히 직원이 읽을 수 없음', () => getDoc(doc(emp, 'pjt_log/pa/entries/e1')));
await must('deny', '[회귀] 프로젝트 표시(ledger_pjt_tags)는 직원이 쓸 수 없음', () => setDoc(doc(emp, 'ledger_pjt_tags/forged'), { status: 'confirmed' }));
await must('allow', '[회귀] 일반 컬렉션(프로젝트 문서 pjt_registry)은 직원이 읽을 수 있음 — 새 규칙이 다른 컬렉션을 막지 않음', () => getDoc(doc(emp, 'pjt_registry/pa')));
await must('allow', '[회귀] 관리자 전용 컬렉션 목록에 이름만 추가했으므로 관리자가 평범한 문서(pjt_registry)를 읽는 것은 그대로', () => getDoc(doc(adm, 'pjt_registry/pa')));
console.log('\n' + (fail ? '실패 ' + fail + '건 / 통과 ' + pass : '전부 통과 (' + pass + '건)')); await env.cleanup(); process.exit(fail ? 1 : 0);
