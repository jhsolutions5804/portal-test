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
// ═══ 팀장 1차 평가(lead): 제출 → 마감 → 집계(leadAgg) → 화면 점수 계산 ═══
{ const YEAR2 = 2027; const y2 = (uid) => YEAR2 + '__' + uid;
  await call(EXEC, { action: 'generateTasks', year: YEAR2, members: team.map((m) => ({ uid: m.uid, workerId: m.workerId, team: m.team, name: m.name, isLead: m.isLead })) });
  const tl = (await adb.collection('eval_tasks').doc(YEAR2 + '__uLead').get()).data().keys; ok(tl.includes(ML.taskKey(YEAR2, 'lead', 'wA')) && tl.includes(ML.taskKey(YEAR2, 'lead', 'wB')) && tl.includes(ML.taskKey(YEAR2, 'lead', 'wC')) && !tl.includes(ML.taskKey(YEAR2, 'lead', 'wLead')), '★ L1) 서버가 팀장에게 팀원 3명의 1차 평가 과제를 만들고 본인은 제외함: ' + tl.filter((k) => k.includes('__lead__')).join(','));
  const tA = (await adb.collection('eval_tasks').doc(YEAR2 + '__uA').get()).data().keys; ok(!tA.some((k) => k.includes('__lead__')), 'L2) 팀원에게는 1차 평가 과제가 없음');
  await assertSucceeds(setDoc(doc(as(EXEC), 'eval_cycles/' + YEAR2), { status: 'open', year: YEAR2, updatedAt: serverTimestamp(), updatedBy: EXEC }));
  const leadItems = ML.itemsOf('lead').map((i) => i.key); ok(leadItems.join() === 'achievement,competency,conduct', 'L3) 화면의 팀장 평가 항목 키가 서버가 기대하는 영역 키와 같음: ' + leadItems.join(','));
  const leadBody = ML.buildSubmission(YEAR2, 'uLead', 'wC', 'lead', { scores: { achievement: 4, competency: 5, conduct: 3 }, text: '' }, 'submitted', serverTimestamp()); await assertSucceeds(setDoc(doc(as('uLead'), 'eval_submissions/' + ML.subId(YEAR2, 'uLead', 'wC', 'lead')), leadBody)); ok(true, 'L4) 팀장이 화면 코드가 만든 1차 평가를 제출하고 규칙을 통과함');
  await assertFails(setDoc(doc(as('uA'), 'eval_submissions/' + ML.subId(YEAR2, 'uA', 'wB', 'lead')), ML.buildSubmission(YEAR2, 'uA', 'wB', 'lead', { scores: { achievement: 1, competency: 1, conduct: 1 } }, 'submitted', serverTimestamp()))); ok(true, '★ L5) 팀장이 아닌 직원은 1차 평가를 제출할 수 없음(과제가 배정되지 않음)');
  for (const uid of ['uA', 'uB', 'uLead']) { const wid = team.find((m) => m.uid === uid).workerId; if (wid === 'wC') continue; }
  for (const uid of ['uA', 'uB', 'uLead']) await setDoc(doc(as(uid), 'eval_submissions/' + ML.subId(YEAR2, uid, 'wC', 'peer')), ML.buildSubmission(YEAR2, uid, 'wC', 'peer', { scores: Object.fromEntries(keyNames.map((k) => [k, 4])), text: '' }, 'submitted', serverTimestamp()));
  await assertSucceeds(updateDoc(doc(as(EXEC), 'eval_cycles/' + YEAR2), { status: 'closed', year: YEAR2, updatedAt: serverTimestamp(), updatedBy: EXEC }));
  const rr = await call(EXEC, { action: 'aggregatePeers', year: YEAR2, targets: ['wC', 'wA'] });
  ok(rr.results.wC.lead.ok === true && rr.results.wC.lead.n === 1 && rr.results.wA.lead.ok === false && rr.results.wA.lead.n === 0, '★ L6) 집계: 다(wC)는 팀장 평가 1건·영역 점수 기록, 가(wA)는 팀장이 아직 안 낸 상태라 영역 점수 없음');
  const sw = (await adb.collection('evaluations').doc('wC').collection('cycles').doc(String(YEAR2)).get()).data();
  ok(Object.keys(sw.leadAgg.areas).sort().join() === 'achievement,competency,conduct' && sw.leadAgg.areas.achievement === 4 && sw.leadAgg.areas.competency === 5 && sw.leadAgg.areas.conduct === 3 && sw.leadAgg.by === 'uLead' && sw.leadAgg.n === 1 && sw.peerAgg.avg === 4 && sw.peerAgg.n === 3, 'L7) 정기평가 문서에 leadAgg(영역 점수·팀장 uid·1건)와 peerAgg(4.0·3명)가 함께 기록됨 → 실제: ' + JSON.stringify({ areas: sw.leadAgg.areas, by: sw.leadAgg.by, ln: sw.leadAgg.n, avg: sw.peerAgg.avg, pn: sw.peerAgg.n }));
  const it = EV.areaItems('PJT팀', '사원'); const c0 = EV.emptyCycle({ id: 'wC', name: '다', dept: 'PJT팀', rank: '사원' }, YEAR2); const sm2 = EV.cycleSummary(Object.assign({}, c0, sw), { teamType: 'pjt', items: it });
  ok(sm2.leadFrom === 'lead' && sm2.peerAvg === 4 && sm2.teamScore === 32 + 20 + 12 + 16, '★ L8) 서버가 집계한 팀장 평가와 동료 평균을 화면 점수 계산이 그대로 읽음: 업적 4→32 + 역량 5→20 + 태도 3→12 + 동료 4.0→16 = 80점 (손계산): ' + sm2.teamScore);
  const swA = (await adb.collection('evaluations').doc('wA').collection('cycles').doc(String(YEAR2)).get()).data(); const smA = EV.cycleSummary(Object.assign({}, EV.emptyCycle({ id: 'wA', name: '가', dept: 'PJT팀', rank: '사원' }, YEAR2), swA), { teamType: 'pjt', items: it });
  ok(smA.leadFrom !== 'lead' && smA.teamScore === null, 'L9) 팀장 평가가 없는 대상은 팀 점수가 아직 없음(점수를 지어내지 않음)');
  await assertFails(updateDoc(doc(as(EXEC), 'evaluations/wC/cycles/' + YEAR2), { leadAgg: { areas: { achievement: 5, competency: 5, conduct: 5 }, n: 1, by: 'x' } })); ok(true, '★ L10) 사장단이라도 집계된 팀장 평가(leadAgg)를 고칠 수 없음 — 조정은 대표 점수로');
  const body2 = EV.saveBody(Object.assign({}, c0, sw, { ceo: { approved: true } })); await assertSucceeds(setDoc(doc(as(EXEC), 'evaluations/wC/cycles/' + YEAR2), Object.assign(body2, { updatedAt: serverTimestamp() }), { merge: true }));
  const aft = (await adb.collection('evaluations').doc('wC').collection('cycles').doc(String(YEAR2)).get()).data(); ok(aft.leadAgg.areas.achievement === 4 && aft.peerAgg.avg === 4 && aft.ceo.approved === true, 'L11) 사장단이 승인을 저장해도 서버가 집계한 leadAgg·peerAgg 는 그대로 남음');
}
await env.cleanup(); console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
