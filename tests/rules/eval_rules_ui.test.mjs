// 화면 로직(mine-logic.js)이 만든 문서가 실제 보안 규칙을 통과하는지 — 규칙과 화면이 따로 놀지 않게 하는 연결 시험
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, setDoc, getDoc } from 'firebase/firestore';
const ROOT = process.env.PORTAL_ROOT;
const VER = (readFileSync(ROOT + '/app/modules/eval/index.js', 'utf8').match(/eval-perm\.js\?v=([0-9a-z]+)/) || [])[1];
const L = await import(ROOT + '/app/modules/eval/mine-logic.js?v=' + VER);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const env = await initializeTestEnvironment({ projectId: 'demo-eval', firestore: { rules: readFileSync(ROOT + '/tests/rules/test.rules', 'utf8'), host: '127.0.0.1', port: 8089 } });
const K = 'KIM1', Y = 'YOON1', year = 2026;
await env.withSecurityRulesDisabled(async (ctx) => { const db = ctx.firestore();
  await setDoc(doc(db, 'portal_users/' + K), { status: 'approved' }); await setDoc(doc(db, 'portal_users/' + Y), { status: 'approved' });
  await setDoc(doc(db, 'eval_cycles/2026'), { status: 'open' });
  // 과제 목록은 화면 로직의 키 모양(taskKey)으로 만든다 — 서버 buildTasks 가 만드는 모양과 같다
  await setDoc(doc(db, 'eval_tasks/2026__' + K), { keys: [L.taskKey(year, 'self', 'wK'), L.taskKey(year, 'peer', 'wY'), L.taskKey(year, 'peer', 'wP'), L.taskKey(year, 'lead', 'wY')] }); });
const as = (u) => env.authenticatedContext(u, { email: u.toLowerCase() + '@jhsol.kr' }).firestore();
const TS = new Date(); const ref = (db, rater, target, kind) => doc(db, 'eval_submissions/' + L.subId(year, rater, target, kind));
// 1) 임시저장(점수 일부)·제출(전부) — 화면 로직이 만든 문서가 규칙을 통과
const draft = L.buildSubmission(year, K, 'wY', 'peer', L.withScore(null, 'collab', 4), 'draft', TS);
await assertSucceeds(setDoc(ref(as(K), K, 'wY', 'peer'), draft)); ok(true, '★ 화면 로직이 만든 동료평가 임시저장 문서(점수 1개)가 규칙을 통과');
let cur = L.withScore(L.withScore(L.withScore(null, 'collab', 4), 'trust', 5), 'support', 3); cur = L.withText(cur, '믿고 맡길 수 있었습니다');
await assertSucceeds(setDoc(ref(as(K), K, 'wY', 'peer'), L.buildSubmission(year, K, 'wY', 'peer', cur, 'draft', TS))); ok(true, '같은 문서를 계속 덮어써서 임시저장 이어서 쓰기(점수 3개 + 서술)');
await assertSucceeds(setDoc(ref(as(K), K, 'wP', 'peer'), L.buildSubmission(year, K, 'wP', 'peer', cur, 'submitted', TS))); ok(true, '★ 화면 로직이 만든 동료평가 제출 문서(제출 시각 포함)가 규칙을 통과');
await assertSucceeds(setDoc(ref(as(K), K, 'wK', 'self'), L.buildSubmission(year, K, 'wK', 'self', { text: '올해 성과를 정리했습니다' }, 'submitted', TS))); ok(true, '자기평가 제출 문서(점수 없이 서술만)가 규칙을 통과');
await assertSucceeds(setDoc(ref(as(K), K, 'wY', 'lead'), L.buildSubmission(year, K, 'wY', 'lead', { scores: { achievement: 4, competency: 4, conduct: 5 } }, 'submitted', TS))); ok(true, '팀원 1차 평가(3영역) 제출 문서가 규칙을 통과');
// 2) 제출 후에는 같은 화면 로직으로도 못 고친다
await assertFails(setDoc(ref(as(K), K, 'wP', 'peer'), L.buildSubmission(year, K, 'wP', 'peer', { scores: { collab: 1, trust: 1, support: 1 } }, 'draft', TS))); ok(true, '★ 제출한 평가를 같은 문서 id 로 다시 임시저장(덮어쓰기)할 수 없음');
await assertFails(setDoc(ref(as(K), K, 'wK', 'self'), L.buildSubmission(year, K, 'wK', 'self', { text: '바꾸기' }, 'submitted', TS))); ok(true, '제출한 자기평가를 다시 제출(덮어쓰기)할 수 없음');
// 3) 화면이 실수로 만들 수 있는 잘못된 문서는 규칙이 막는다
await assertFails(setDoc(ref(as(K), K, 'wP', 'self'), L.buildSubmission(year, K, 'wP', 'self', { text: 'a' }, 'draft', TS))); ok(true, '배정되지 않은 과제(박의 자기평가)는 막힘');
await assertFails(setDoc(ref(as(Y), K, 'wY', 'peer'), L.buildSubmission(year, K, 'wY', 'peer', cur, 'draft', TS))); ok(true, '윤이 김의 평가자 id 로 쓰는 것은 막힘');
// 4) 저장된 내용을 본인이 다시 읽어 화면에 채울 수 있다
const back = await assertSucceeds(getDoc(ref(as(K), K, 'wP', 'peer'))); const d = back.data(); ok(d.status === 'submitted' && d.scores.collab === 4 && d.scores.trust === 5 && d.scores.support === 3 && d.text.startsWith('믿고'), '★ 본인이 저장한 평가를 다시 읽어 화면에 채울 수 있음(이어서 쓰기)');
ok(L.canSubmit('peer', d).ok, '읽어 온 문서로 제출 가능 판정이 이어짐');
await env.cleanup(); console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
