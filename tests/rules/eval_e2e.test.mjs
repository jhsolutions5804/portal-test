// 평가 전체 흐름(과제 배정 → 시작 → 제출 → 마감 → 집계 → 점수 계산)을 에뮬레이터에서 실제 코드로 이어서 돌린다.
//  서버 = 실제 firebase-admin 으로 eval-act.js(run), 직원·사장단 = 보안 규칙을 적용받는 클라이언트, 제출 문서 = 화면 코드(mine-logic.js buildSubmission)가 만든 것.
//  각 조각은 따로 시험했지만 "서버가 읽는 필드"와 "화면이 쓰는 필드"가 서로 맞는지는 이어 붙여야만 알 수 있다.
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs'; import { createRequire } from 'node:module';
import { doc, setDoc, getDoc, getDocs, updateDoc, collection, query, where, serverTimestamp } from 'firebase/firestore';
const FUNCS = process.env.PORTAL_FUNCTIONS ? process.env.PORTAL_FUNCTIONS + '/functions' : '/tmp/pf/functions';   // 서버 함수 저장소(portal-functions) 위치 — npm install 이 끝난 상태여야 한다
const require = createRequire(FUNCS + '/'); const admin = require('firebase-admin'); const { FieldValue } = require('firebase-admin/firestore'); const E = require(FUNCS + '/eval-act.js');
const ROOT = process.env.PORTAL_ROOT || process.cwd(); const ver = (readFileSync(ROOT + '/app/modules/eval/index.js', 'utf8').match(/eval-perm\.js\?v=([0-9a-z]+)/) || [])[1];
const ML = await import(ROOT + '/app/modules/eval/mine-logic.js?v=' + ver); const EV = await import(ROOT + '/app/modules/eval/evaluation.js?v=' + ver); const PM = await import(ROOT + '/app/shared/eval-perm.js?v=' + ver);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const PID = 'demo-eval'; const env = await initializeTestEnvironment({ projectId: PID, firestore: { rules: readFileSync(process.env.RULES_FILE || (ROOT + '/docs/rules/firestore.rules_테섭_평가추가본_2026-10-15.rules'), 'utf8'), host: '127.0.0.1', port: 8089 } });
admin.initializeApp({ projectId: PID }); const adb = admin.firestore(); const deps = { db: adb, FieldValue };
const EXEC = PM.CYCLE_MANAGERS[0].uid; const YEAR = 2026;
// 계정: 사장단 1명 + PJT팀 4명(팀장 1) — 서버 loadCaller 와 보안 규칙이 둘 다 portal_users 를 읽는다
const team = [{ uid: 'uLead', workerId: 'wLead', name: '팀장', isLead: true }, { uid: 'uA', workerId: 'wA', name: '가', isLead: false }, { uid: 'uB', workerId: 'wB', name: '나', isLead: false }, { uid: 'uC', workerId: 'wC', name: '다', isLead: false }].map((m) => Object.assign({ team: 'PJT팀' }, m));
await env.withSecurityRulesDisabled(async (ctx) => { const db = ctx.firestore(); await setDoc(doc(db, 'portal_users/' + EXEC), { name: '송지훈', rank: '대표', status: 'approved', admin: true, empNo: '00000' }); for (const m of team) await setDoc(doc(db, 'portal_users/' + m.uid), { name: m.name, rank: '사원', dept: 'PJT팀', status: 'approved', admin: false, empNo: 'E' + m.uid }); });
const as = (uid) => env.authenticatedContext(uid, { email: uid + '@jhsol.kr' }).firestore();   // 실제 계정과 같은 조건: 회사 이메일(@jhsol.kr)이 있어야 규칙(isApproved)을 통과한다 const call = (uid, data) => E.run(deps, { auth: { uid }, data });
const call = (uid, data) => E.run(deps, { auth: { uid }, data });
// 1) 사장단이 과제 배정(서버)
const g = await call(EXEC, { action: 'generateTasks', year: YEAR, members: team.map((m) => ({ uid: m.uid, workerId: m.workerId, team: m.team, name: m.name, isLead: m.isLead })) });
ok(g.ok === true && g.tasks === 4 && (g.skipped || []).length === 0, '1) 과제 배정: 4명 모두에게 과제가 만들어짐(서버 generateTasks)');
const tk = (await adb.collection('eval_tasks').doc(YEAR + '__uA').get()).data(); const keysA = tk.keys;
ok(keysA.includes(ML.taskKey(YEAR, 'self', 'wA')) && keysA.includes(ML.taskKey(YEAR, 'peer', 'wB')) && keysA.includes(ML.taskKey(YEAR, 'peer', 'wC')) && keysA.includes(ML.taskKey(YEAR, 'peer', 'wLead')) && !keysA.includes(ML.taskKey(YEAR, 'peer', 'wA')) && keysA.length === 1 + 3, '★ 과제 키 형식이 서버와 화면(taskKey)에서 같음: 가는 자기평가 1건 + 같은 팀 동료 3명(본인 제외) 평가: ' + JSON.stringify(keysA));
ok(keysA.every((k) => ML.parseKey(k)), '화면의 parseKey 가 서버가 만든 과제 키를 모두 해석함');
// 2) 사장단이 회차 시작(규칙 적용)
await assertSucceeds(setDoc(doc(as(EXEC), 'eval_cycles/' + YEAR), { status: 'open', year: YEAR, updatedAt: serverTimestamp(), updatedBy: EXEC })); ok(true, '2) 사장단이 규칙을 통과해 회차를 시작함');
// 3) 직원이 화면 코드가 만든 문서로 동료평가 제출(규칙 적용). 피평가자는 '다'(wC): 가·나·팀장이 평가
const peerItems = ML.itemsOf('peer'); const keyNames = peerItems.map((i) => i.key); ok(keyNames.length === 3, '화면의 동료평가 항목은 3개: ' + keyNames.join(','));
const give = { uA: [4, 4, 4], uB: [3, 4, 5], uLead: [5, 5, 5] };
for (const [uid, sc] of Object.entries(give)) { const wid = team.find((m) => m.uid === uid).workerId; const input = { scores: Object.fromEntries(keyNames.map((k, i) => [k, sc[i]])), text: '' };
  const body = ML.buildSubmission(YEAR, uid, 'wC', 'peer', input, 'submitted', serverTimestamp()); await assertSucceeds(setDoc(doc(as(uid), 'eval_submissions/' + ML.subId(YEAR, uid, 'wC', 'peer')), body)); }
ok(true, '3) 가·나·팀장 3명이 화면 코드가 만든 문서로 동료평가를 제출하고 규칙을 통과함');
// 제출한 문서가 서버 집계가 찾는 조건(targetWid·kind·year·status)과 맞는지 직접 확인
const found = await adb.collection('eval_submissions').where('targetWid', '==', 'wC').where('kind', '==', 'peer').where('year', '==', YEAR).where('status', '==', 'submitted').get();
ok(found.size === 3, '★ 화면이 쓴 제출 문서 3건이 서버 집계 조회(targetWid·kind·year·status)에 모두 잡힘: ' + found.size + '건');
// 4) 마감 전에는 집계 불가, 마감 후 집계
let err = null; try { await call(EXEC, { action: 'aggregatePeers', year: YEAR, targets: ['wC'] }); } catch (e) { err = e; } ok(err && err.code === 'failed-precondition', '4a) 진행 중에는 서버가 집계를 거부함(평균 변화로 점수 역산 방지)');
await assertSucceeds(updateDoc(doc(as(EXEC), 'eval_cycles/' + YEAR), { status: 'closed', year: YEAR, updatedAt: serverTimestamp(), updatedBy: EXEC })); ok(true, '4b) 사장단이 회차를 마감함');
await assertFails(setDoc(doc(as('uA'), 'eval_submissions/' + ML.subId(YEAR, 'uA', 'wB', 'peer')), ML.buildSubmission(YEAR, 'uA', 'wB', 'peer', { scores: Object.fromEntries(keyNames.map((k) => [k, 5])) }, 'submitted', serverTimestamp()))); ok(true, '4c) 마감된 뒤에는 직원이 새로 제출할 수 없음');
// 5) 집계(서버)
const r = await call(EXEC, { action: 'aggregatePeers', year: YEAR, targets: ['wC', 'wB'] });
ok(r.ok && r.results.wC.n === 3 && r.results.wC.avg === 4.33, '★ 5) 집계: 다(wC)는 평가자 3명, 평균 (4+4+5)/3 = 4.33 (손계산: 가 4, 나 (3+4+5)/3=4, 팀장 5)');
ok(r.results.wB.n === 0 && r.results.wB.avg === null, '5b) 아무도 평가하지 않은 사람은 평균 없음(null)');
const stored = (await adb.collection('evaluations').doc('wC').collection('cycles').doc(String(YEAR)).get()).data();
ok(stored && stored.peerAgg && stored.peerAgg.avg === 4.33 && stored.peerAgg.n === 3 && !JSON.stringify(stored).includes('uA') && !JSON.stringify(stored).includes('uB') && !JSON.stringify(stored).includes('uLead'), '★ 집계 결과 문서에는 평균·평가자 수만 있고 평가자 식별자·원점수가 없음(익명): ' + JSON.stringify(Object.keys(stored.peerAgg)));
// 6) 화면 점수 계산에 서버 집계가 반영되는지 — 업적·역량·태도 4점이라면 32+16+16 + 동료 4.33/5×20 = 17.32 → 81.32 (손계산)
const itP = EV.areaItems('PJT팀', '사원'); const full = (it, v) => ({ achievement: it.achievement.map(() => v), competency: it.competency.map(() => v), conduct: it.conduct.map(() => v) });
const cyc = EV.emptyCycle({ id: 'wC', name: '다', dept: 'PJT팀', rank: '사원' }, YEAR); cyc.team.areas = full(itP, 4); const doc6 = Object.assign({}, cyc, stored);
const sm = EV.cycleSummary(doc6, { teamType: 'pjt', items: itP });
ok(sm.peerAvg === 4.33 && sm.raters === 3 && Math.abs(sm.teamScore - (32 + 16 + 16 + 4.33 / 5 * 20)) < 0.06, '★ 6) 서버가 집계해 둔 값을 화면 점수 계산이 그대로 읽음: 동료 평균 4.33(평가자 3명) → 팀 점수 ' + sm.teamScore + ' (손계산 81.3)');
// 7) 사장단이 점수를 저장해도(화면 saveBody) 서버가 쓴 peerAgg 는 그대로
const body = EV.saveBody(Object.assign({}, doc6, { ceo: { approved: true } })); await assertSucceeds(setDoc(doc(as(EXEC), 'evaluations/wC/cycles/' + YEAR), Object.assign(body, { updatedAt: serverTimestamp() }), { merge: true }));
const after = (await adb.collection('evaluations').doc('wC').collection('cycles').doc(String(YEAR)).get()).data(); ok(after.peerAgg.avg === 4.33 && after.peerAgg.n === 3 && after.ceo && after.ceo.approved === true, '7) 사장단이 점수·승인을 저장해도(saveBody) 서버가 집계한 동료 평균은 그대로 남음');
// 8) 익명: 직원·인사팀 관리자는 제출 원본을 읽을 수 없다
await assertFails(getDoc(doc(as('uA'), 'eval_submissions/' + ML.subId(YEAR, 'uB', 'wC', 'peer')))); await assertFails(getDocs(query(collection(as(EXEC), 'eval_submissions'), where('targetWid', '==', 'wC')))); ok(true, '8) 다른 사람의 제출 문서는 직원도, 사장단 계정도 읽을 수 없음(동료평가 원점수 비공개)');
await env.cleanup(); console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
