import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, setDoc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, query, where } from 'firebase/firestore';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const env = await initializeTestEnvironment({ projectId: 'demo-eval', firestore: { rules: readFileSync(process.env.RULES_FILE || (process.cwd() + '/docs/rules/firestore.rules_테섭_평가추가본_2026-10-15.rules'), 'utf8'), host: '127.0.0.1', port: 8089 } });
const A = 'ADMIN1', K = 'KIM1', Y = 'YOON1', P = 'PARK1', X = 'OUT1';
// 사장단 3명(송지훈·김종화·김영희) — 규칙(isCycleManager)에 적힌 실제 계정 식별자. 시험은 이 계정으로 접속해 본다
const EX1 = '202TPNudKZghsTPAeeG206f8vbJ3', EX2 = '8KuOuhqirGWmrYKw8eOCPnqtYBr2', EX3 = 'muButMmunGX91id0HmHZVBMDq6B3';
const email = (u) => u.toLowerCase() + '@jhsol.kr';
// 시험 데이터(규칙 우회로 직접 심는다): 계정·회차·과제
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'portal_users/' + A), { status: 'approved', admin: true });
  for (const u of [EX1, EX2, EX3]) await setDoc(doc(db, 'portal_users/' + u), { status: 'approved', admin: true });
  for (const u of [K, Y, P]) await setDoc(doc(db, 'portal_users/' + u), { status: 'approved' });
  await setDoc(doc(db, 'portal_users/' + X), { status: 'pending' });
  await setDoc(doc(db, 'eval_cycles/2026'), { status: 'open' }); await setDoc(doc(db, 'eval_cycles/2027'), { status: 'closed' });
  // 김에게 배정: 자기평가, 윤·박 동료평가. 윤에게: 자기평가
  await setDoc(doc(db, 'eval_tasks/2026__' + K), { keys: ['2026__self__wK', '2026__peer__wY', '2026__peer__wP'] });
  await setDoc(doc(db, 'eval_tasks/2026__' + Y), { keys: ['2026__self__wY'] });
  await setDoc(doc(db, 'eval_tasks/2027__' + K), { keys: ['2027__self__wK'] });
});
const as = (u) => env.authenticatedContext(u, { email: email(u) }).firestore();
const sub = (rater, target, kind, extra, year = 2026) => Object.assign({ year, raterUid: rater, targetWid: target, kind, scores: { a: 4, b: 5, c: 3 }, status: 'draft', text: '' }, extra || {});
const id = (rater, target, kind, year = 2026) => year + '__' + rater + '__' + target + '__' + kind;
const dk = (db, rater, target, kind, year) => doc(db, 'eval_submissions/' + id(rater, target, kind, year));

// ── 1. 정상: 본인에게 배정된 과제를 열린 기간에 쓴다
await assertSucceeds(setDoc(dk(as(K), K, 'wY', 'peer'), sub(K, 'wY', 'peer'))); ok(true, '★ 김이 배정된 동료평가(윤)를 열린 기간에 임시저장할 수 있음');
await assertSucceeds(setDoc(dk(as(K), K, 'wK', 'self'), sub(K, 'wK', 'self', { text: '올해 성과' }))); ok(true, '김이 본인 자기평가를 쓸 수 있음');
await assertSucceeds(getDoc(dk(as(K), K, 'wY', 'peer'))); ok(true, '김이 자기가 쓴 동료평가를 다시 읽을 수 있음(이어서 쓰기)');
await assertSucceeds(updateDoc(dk(as(K), K, 'wY', 'peer'), { scores: { a: 5, b: 5, c: 5 } })); ok(true, '제출 전(draft)에는 계속 고칠 수 있음');
// ── 2. 공격: 남의 이름으로 쓰기·배정 안 된 과제·다른 종류
await assertFails(setDoc(dk(as(Y), K, 'wP', 'peer'), sub(K, 'wP', 'peer'))); ok(true, '★ 윤이 김의 이름으로(문서 id 의 평가자가 김) 동료평가를 쓸 수 없음');
await assertFails(setDoc(dk(as(Y), Y, 'wP', 'peer'), sub(Y, 'wP', 'peer'))); ok(true, '★ 윤에게 배정되지 않은 과제(박 동료평가)는 쓸 수 없음');
await assertFails(setDoc(dk(as(K), K, 'wP', 'lead'), sub(K, 'wP', 'lead'))); ok(true, '김에게 배정되지 않은 종류(팀장 1차 평가)는 쓸 수 없음');
await assertFails(setDoc(dk(as(K), K, 'wY', 'peer'), sub(Y, 'wY', 'peer'))); ok(true, '문서 안의 평가자(raterUid)를 남으로 바꿔 쓸 수 없음');
await assertFails(setDoc(dk(as(K), K, 'wY', 'peer'), sub(K, 'wP', 'peer'))); ok(true, '문서 id 와 다른 대상(targetWid)을 넣을 수 없음');
// ── 3. 공격: 기간·형식
await assertFails(setDoc(dk(as(K), K, 'wK', 'self', 2027), sub(K, 'wK', 'self', {}, 2027))); ok(true, '★ 닫힌 평가 기간(2027)에는 배정되어 있어도 쓸 수 없음');
await assertFails(setDoc(dk(as(K), K, 'wK', 'self', 2030), sub(K, 'wK', 'self', {}, 2030))); ok(true, '회차가 없는 연도에는 쓸 수 없음');
await assertFails(setDoc(dk(as(K), K, 'wP', 'peer'), sub(K, 'wP', 'peer', { hacker: 1 }))); ok(true, '정의되지 않은 필드를 끼워 넣을 수 없음');
await assertFails(setDoc(dk(as(K), K, 'wP', 'peer'), sub(K, 'wP', 'peer', { status: 'approved' }))); ok(true, '상태 값을 임의로(approved 등) 바꿀 수 없음');
await assertFails(setDoc(dk(as(K), K, 'wP', 'peer'), sub(K, 'wP', 'peer', { text: 'x'.repeat(2001) }))); ok(true, '서술이 2000자를 넘으면 거부');
await assertFails(setDoc(dk(as(K), K, 'wP', 'peer'), sub(K, 'wP', 'peer', { scores: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1, h: 1, i: 1 } }))); ok(true, '점수 항목이 8개를 넘으면 거부');
// ── 4. 제출 잠금
await assertSucceeds(setDoc(dk(as(K), K, 'wP', 'peer'), sub(K, 'wP', 'peer', { status: 'submitted', submittedAt: new Date() }))); ok(true, '김이 박 동료평가를 바로 제출할 수 있음');
await assertFails(updateDoc(dk(as(K), K, 'wP', 'peer'), { scores: { a: 1, b: 1, c: 1 } })); ok(true, '★ 제출한 평가는 점수를 다시 고칠 수 없음(잠금)');
await assertFails(updateDoc(dk(as(K), K, 'wP', 'peer'), { status: 'draft' })); ok(true, '제출을 취소해(draft 로 되돌려) 다시 고칠 수도 없음');
await assertFails(deleteDoc(dk(as(K), K, 'wP', 'peer'))); ok(true, '★ 제출한 평가는 삭제할 수 없음');
await assertFails(deleteDoc(dk(as(K), K, 'wY', 'peer'))); ok(true, '임시저장 평가도 삭제할 수 없음(기록 보존)');
// ── 5. 읽기: 남·관리자·외부인
await assertFails(getDoc(dk(as(Y), K, 'wY', 'peer'))); ok(true, '★ 윤이 김이 쓴 평가를 읽을 수 없음(작성자 본인만)');
await assertFails(getDoc(dk(as(A), K, 'wY', 'peer'))); ok(true, '★★ 관리자도 동료평가(peer) 원점수를 읽을 수 없음(익명 보장 — 서버 함수만)');
await assertFails(getDoc(dk(as(A), K, 'wP', 'peer'))); ok(true, '관리자는 제출된 동료평가도 읽을 수 없음');
await assertSucceeds(getDoc(dk(as(A), K, 'wK', 'self'))); ok(true, '관리자는 자기평가(self)는 읽을 수 있음(면담 자료)');
await assertFails(getDoc(dk(as(X), K, 'wK', 'self'))); ok(true, '승인되지 않은 계정은 아무것도 읽을 수 없음');
await assertFails(getDoc(doc(as(Y), 'eval_submissions/' + id(K, 'wK', 'self')))); ok(true, '다른 직원은 김의 자기평가도 읽을 수 없음');
// 목록(쿼리)으로 긁어가기
await assertFails(getDocs(collection(as(A), 'eval_submissions'))); ok(true, '★ 관리자가 제출 컬렉션 전체를 목록으로 긁어갈 수 없음(동료평가가 섞여 있음)');
await assertSucceeds(getDocs(query(collection(as(A), 'eval_submissions'), where('kind', '==', 'self')))); ok(true, '관리자는 자기평가만 조건을 걸어 목록을 볼 수 있음');
await assertFails(getDocs(query(collection(as(A), 'eval_submissions'), where('kind', 'in', ['self', 'peer'])))); ok(true, '조건에 동료평가(peer)를 끼워 넣어도 거부');
await assertFails(getDocs(collection(as(Y), 'eval_submissions'))); ok(true, '일반 직원이 제출 컬렉션 전체를 긁어갈 수 없음');
// ── 5-2. 목록 조회(쿼리) 우회 시도 — 읽기 규칙을 문서 id 에서 raterUid 필드 기준으로 바꾼 뒤 새로 열린 틈이 없는지
await assertSucceeds(getDocs(query(collection(as(K), 'eval_submissions'), where('raterUid', '==', K), where('year', '==', 2026)))); ok(true, '★ 김이 자기 제출 목록(raterUid==김)을 조회할 수 있음 — 내 평가 화면이 이어서 쓰기에 사용');
await assertFails(getDocs(query(collection(as(A), 'eval_submissions'), where('raterUid', '==', K)))); ok(true, '★★ 관리자가 raterUid 조건으로 김의 제출(동료평가 포함)을 목록 조회할 수 없음 — 익명 보장이 필드 조건으로 뚫리지 않음');
await assertFails(getDocs(query(collection(as(A), 'eval_submissions'), where('raterUid', '==', K), where('kind', '==', 'peer')))); ok(true, '관리자가 raterUid + kind==peer 로 조회해도 거부');
await assertSucceeds(getDocs(query(collection(as(A), 'eval_submissions'), where('raterUid', '==', K), where('kind', '==', 'self')))); ok(true, '관리자는 자기평가(self)만 조건을 걸면 볼 수 있음(면담 자료) — 동료평가가 아닌 종류만');
await assertFails(getDocs(query(collection(as(Y), 'eval_submissions'), where('raterUid', '==', K)))); ok(true, '윤이 김의 제출을 raterUid 조건으로 조회할 수 없음');
await assertFails(getDocs(query(collection(as(K), 'eval_submissions'), where('kind', '==', 'peer')))); ok(true, '김이 raterUid 조건 없이 동료평가 전체를 조회할 수 없음(남의 평가가 섞여 있음)');
await assertFails(getDocs(query(collection(as(K), 'eval_submissions'), where('targetWid', '==', 'wK')))); ok(true, '김이 자기를 평가한 사람들의 제출을 대상(targetWid) 조건으로 조회할 수 없음(누가 나를 어떻게 평가했는지 엿보기 방지)');
await assertFails(getDocs(query(collection(as(X), 'eval_submissions'), where('raterUid', '==', X)))); ok(true, '승인되지 않은 계정은 자기 uid 조건으로도 조회할 수 없음');
// ── 6. 과제·회차
await assertSucceeds(getDoc(doc(as(K), 'eval_tasks/2026__' + K))); ok(true, '김이 자기 과제 목록을 읽을 수 있음');
await assertFails(getDoc(doc(as(Y), 'eval_tasks/2026__' + K))); ok(true, '★ 윤이 김의 과제 목록(누구를 평가하는지)을 읽을 수 없음');
await assertSucceeds(getDoc(doc(as(A), 'eval_tasks/2026__' + K))); ok(true, '관리자는 과제 목록을 읽을 수 있음(독촉용)');
await assertFails(setDoc(doc(as(K), 'eval_tasks/2026__' + K), { keys: ['2026__peer__wA'] })); ok(true, '★ 직원이 자기 과제 목록을 스스로 고칠 수 없음(관리자만)');
await assertFails(setDoc(doc(as(K), 'eval_cycles/2026'), { status: 'open' })); ok(true, '직원이 평가 회차를 열고 닫을 수 없음');
await assertSucceeds(setDoc(doc(as(EX1), 'eval_cycles/2028'), { status: 'draft' })); ok(true, '★ 사장단(송지훈)은 평가 회차를 만들 수 있음');
await assertSucceeds(setDoc(doc(as(A), 'eval_tasks/2026__NEW1'), { keys: ['2026__self__wN'] })); ok(true, '관리자는 과제 목록을 만들 수 있음');
await assertSucceeds(getDoc(doc(as(K), 'eval_cycles/2026'))); ok(true, '직원은 평가 회차(열림 여부)를 읽을 수 있음');
await assertFails(getDoc(doc(as(X), 'eval_cycles/2026'))); ok(true, '승인되지 않은 계정은 회차도 읽을 수 없음');
// ── 6-2. 평가 회차 상태 전이: draft → open → closed → published 로만 나아가고, 마감 뒤에는 다시 열 수 없다(재개방 후 재집계 → 평균 변화로 점수 역산 방지)
await env.withSecurityRulesDisabled(async (ctx) => { const db = ctx.firestore(); await setDoc(doc(db, 'eval_cycles/2040'), { status: 'draft', year: 2040 }); await setDoc(doc(db, 'eval_cycles/2041'), { status: 'closed', year: 2041 }); await setDoc(doc(db, 'eval_cycles/2042'), { status: 'published', year: 2042 }); });
const cy = (db, y) => doc(db, 'eval_cycles/' + y);
await assertSucceeds(updateDoc(cy(as(EX1), 2040), { status: 'open' })); ok(true, '정상 전이: 준비(draft) → 진행(open)');
await assertSucceeds(updateDoc(cy(as(EX1), 2040), { status: 'closed' })); ok(true, '정상 전이: 진행(open) → 마감(closed)');
await assertSucceeds(updateDoc(cy(as(EX1), 2040), { status: 'published' })); ok(true, '정상 전이: 마감(closed) → 공개(published)');
await assertFails(updateDoc(cy(as(EX1), 2041), { status: 'open' })); ok(true, '★★ 마감된 회차를 다시 열 수 없음(재개방 후 재집계로 개인 점수가 역산되는 것 방지)');
await assertFails(updateDoc(cy(as(EX1), 2041), { status: 'draft' })); ok(true, '마감된 회차를 준비로 되돌릴 수 없음');
await assertFails(updateDoc(cy(as(EX1), 2042), { status: 'closed' })); ok(true, '공개된 회차를 마감으로 되돌릴 수 없음');
await assertFails(updateDoc(cy(as(EX1), 2042), { status: 'open' })); ok(true, '공개된 회차를 다시 열 수 없음');
await assertSucceeds(updateDoc(cy(as(EX1), 2041), { status: 'published' })); ok(true, '마감 → 공개는 가능');
await assertFails(updateDoc(cy(as(EX1), 2043), { status: 'bogus' })); ok(true, '없는 회차·알 수 없는 상태 값은 거부');
await assertFails(setDoc(cy(as(EX1), 2044), { status: 'closed', year: 2044 })); ok(true, '처음부터 마감 상태로 만들 수 없음(draft·open 으로만 생성)');
await assertSucceeds(setDoc(cy(as(EX1), 2044), { status: 'open', year: 2044 })); ok(true, '진행(open) 상태로 바로 만드는 것은 가능');
await assertFails(updateDoc(cy(as(EX1), 2044), { status: 'open', hacker: 1 })); ok(true, '정의되지 않은 필드를 끼워 넣을 수 없음');
await assertFails(deleteDoc(cy(as(EX1), 2044))); ok(true, '회차 문서는 지울 수 없음');
await assertFails(updateDoc(cy(as(K), 2044), { status: 'closed' })); ok(true, '일반 직원은 회차를 바꿀 수 없음');
// ── 6-3. 회차 관리는 사장단 3명(송지훈·김종화·김영희)의 계정만 — 관리자 계정이라도 사장단이 아니면 거부(인사팀 관리자가 화면을 우회해 평가를 마감하는 것 방지)
await env.withSecurityRulesDisabled(async (ctx) => { const db = ctx.firestore(); await setDoc(doc(db, 'eval_cycles/2050'), { status: 'open', year: 2050 }); await setDoc(doc(db, 'eval_cycles/2051'), { status: 'draft', year: 2051 }); });
await assertFails(updateDoc(cy(as(A), 2050), { status: 'closed' })); ok(true, '★★ 관리자 계정이라도 사장단이 아니면(인사팀 관리자) 회차를 마감할 수 없음');
await assertFails(updateDoc(cy(as(A), 2051), { status: 'open' })); ok(true, '사장단이 아닌 관리자는 회차를 시작할 수도 없음');
await assertFails(setDoc(cy(as(A), 2052), { status: 'draft', year: 2052 })); ok(true, '사장단이 아닌 관리자는 회차를 만들 수도 없음');
await assertSucceeds(updateDoc(cy(as(EX1), 2050), { status: 'closed' })); ok(true, '사장단 송지훈은 회차를 마감할 수 있음');
await assertSucceeds(updateDoc(cy(as(EX2), 2051), { status: 'open' })); ok(true, '사장단 김종화는 회차를 시작할 수 있음');
await assertSucceeds(setDoc(cy(as(EX3), 2053), { status: 'draft', year: 2053 })); ok(true, '사장단 김영희는 회차를 만들 수 있음');
await assertFails(updateDoc(cy(as(EX1), 2050), { status: 'open' })); ok(true, '사장단이라도 마감된 회차를 다시 열 수는 없음(재개방 금지는 사장단에게도 적용)');
await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'portal_users/' + EX2), { status: 'approved', admin: false }); });
await assertFails(updateDoc(cy(as(EX2), 2051), { status: 'closed' })); ok(true, '사장단 목록에 있어도 관리자 권한이 해제된 계정은 거부(목록 + 관리자 둘 다 필요)');
await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'portal_users/' + EX2), { status: 'suspended', admin: true }); });
await assertFails(updateDoc(cy(as(EX2), 2051), { status: 'closed' })); ok(true, '사장단이라도 사용 중지된 계정은 거부');
await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'portal_users/' + EX2), { status: 'approved', admin: true }); });
const FAKE_EXEC = 'ATTACKER1'; await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'portal_users/' + FAKE_EXEC), { status: 'approved', admin: true, rank: '대표', name: '송지훈', empNo: '00000' }); });
await assertFails(updateDoc(cy(as(FAKE_EXEC), 2051), { status: 'closed' })); ok(true, '★ 직급을 "대표"로, 이름·사번을 사장단과 같게 적어도 계정 식별자가 다르면 거부(직급·이름은 직원 관리에서 바뀌는 값이라 믿지 않음)');
// ── 6-4. 평가 점수 문서(정기평가 cycles·수시평가 adhoc): 쓰기는 사장단만, 동료 평균 peerAgg 는 어떤 계정도 못 씀, 개별 기록(records)은 기존대로 관리자
const cyc = (db, w, y) => doc(db, 'evaluations/' + w + '/cycles/' + y), adh = (db, w, p) => doc(db, 'evaluations/' + w + '/adhoc/' + p), rec = (db, w, r) => doc(db, 'evaluations/' + w + '/records/' + r), adhP = (db, p) => doc(db, 'evaluations/_pjt/adhoc/' + p);
await env.withSecurityRulesDisabled(async (ctx) => { const db = ctx.firestore(); await setDoc(cyc(db, 'wA', 2026), { year: 2026, team: { by: 'x' }, peerAgg: { avg: 4.2, n: 3 } }); await setDoc(adh(db, 'wA', 'p1'), { items: {} }); await setDoc(adhP(db, 'p1'), { perf: 3 }); await setDoc(rec(db, 'wA', 'r1'), { type: 'regular', grade: 'A' }); });
await assertSucceeds(getDoc(cyc(as(A), 'wA', 2026))); ok(true, '사장단이 아닌 관리자도 정기평가 문서를 읽을 수 있음(기존과 같음)');
await assertSucceeds(getDoc(adh(as(A), 'wA', 'p1'))); await assertSucceeds(getDoc(adhP(as(A), 'p1'))); ok(true, '사장단이 아닌 관리자도 수시평가 문서를 읽을 수 있음');
await assertFails(getDoc(cyc(as(K), 'wA', 2026))); await assertFails(getDoc(adh(as(K), 'wA', 'p1'))); ok(true, '일반 직원은 정기·수시평가 문서를 읽을 수 없음');
await assertFails(setDoc(cyc(as(A), 'wB', 2026), { year: 2026, team: {} })); ok(true, '★★ 관리자 계정이라도 사장단이 아니면 정기평가 점수 문서를 만들 수 없음');
await assertFails(updateDoc(cyc(as(A), 'wA', 2026), { 'team.by': 'forged' })); ok(true, '★★ 사장단이 아닌 관리자는 정기평가 점수·확정을 고칠 수 없음');
await assertFails(setDoc(adh(as(A), 'wA', 'p2'), { items: {} })); await assertFails(updateDoc(adhP(as(A), 'p1'), { perf: 5 })); ok(true, '사장단이 아닌 관리자는 수시평가도 쓸 수 없음');
await assertFails(updateDoc(cyc(as(A), 'wA', 2026), { peerAgg: { avg: 5, n: 9 } })); ok(true, '★★ 사장단이 아닌 관리자는 동료 평균(peerAgg)을 위조할 수 없음');
await assertSucceeds(setDoc(cyc(as(EX1), 'wB', 2026), { year: 2026, team: { by: 'e' } })); ok(true, '사장단은 정기평가 점수 문서를 만들 수 있음(peerAgg 없이)');
await assertSucceeds(updateDoc(cyc(as(EX2), 'wA', 2026), { 'team.by': 'e2' })); ok(true, '사장단은 정기평가 점수를 고칠 수 있음');
await assertSucceeds(setDoc(cyc(as(EX3), 'wA', 2026), { year: 2026, team: { by: 'e3' }, ceo: { approved: true } }, { merge: true })); ok(true, '★ 사장단의 merge 저장은 통과 — 기존 peerAgg 를 건드리지 않으므로 서버가 집계해 둔 값이 있어도 점수·확정 저장이 막히지 않음');
await assertFails(updateDoc(cyc(as(EX1), 'wA', 2026), { peerAgg: { avg: 1, n: 1 } })); ok(true, '★★ 사장단이라도 동료 평균(peerAgg)은 쓸 수 없음(서버만 씀)');
await assertFails(setDoc(cyc(as(EX1), 'wA', 2026), { year: 2026, peerAgg: { avg: 5, n: 5 } }, { merge: true })); ok(true, '사장단의 merge 로 peerAgg 를 바꾸려는 시도도 거부');
await assertFails(setDoc(cyc(as(EX1), 'wC', 2026), { year: 2026, peerAgg: { avg: 5, n: 5 } })); ok(true, '처음 만들 때 peerAgg 를 끼워 넣는 것도 거부');
await assertFails(deleteDoc(cyc(as(EX1), 'wA', 2026))); await assertFails(deleteDoc(adh(as(EX1), 'wA', 'p1'))); ok(true, '사장단도 점수 문서를 삭제할 수 없음(되돌리기 방지)');
await assertSucceeds(setDoc(adh(as(EX1), 'wA', 'p3'), { items: { a: 1 } })); await assertSucceeds(setDoc(adhP(as(EX2), 'p1'), { perf: 4 }, { merge: true })); ok(true, '사장단은 수시평가(참여자·프로젝트 성과)를 쓸 수 있음');
await assertSucceeds(getDoc(rec(as(A), 'wA', 'r1'))); await assertSucceeds(addDoc(collection(as(A), 'evaluations/wA/records'), { type: 'regular', grade: 'B' })); await assertSucceeds(updateDoc(rec(as(A), 'wA', 'r1'), { status: 'confirmed' })); await assertSucceeds(deleteDoc(rec(as(A), 'wA', 'r1'))); ok(true, '★ 기존 개별 기록(records)은 그대로 — 관리자가 읽기·추가·수정·삭제 모두 가능(이번 변경으로 인사 화면이 깨지지 않음)');
await assertFails(getDoc(rec(as(K), 'wA', 'r1'))); await assertFails(setDoc(rec(as(K), 'wA', 'r9'), { grade: 'S' })); ok(true, '일반 직원은 개별 기록을 읽거나 쓸 수 없음');
// ── 7. 관리자가 직원 대신 쓰기·미승인
await assertFails(setDoc(dk(as(A), K, 'wY', 'peer', 2026), sub(K, 'wY', 'peer'))); ok(true, '★ 관리자도 직원의 이름으로 평가를 대신 쓸 수 없음');
await assertFails(setDoc(dk(as(X), X, 'wX', 'self'), sub(X, 'wX', 'self'))); ok(true, '승인되지 않은 계정은 쓸 수 없음');
await env.cleanup();
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
