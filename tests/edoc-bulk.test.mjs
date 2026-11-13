// 업무일지 일괄 결재(2-5-104) 순수 계산 시험
import assert from 'node:assert/strict';
import * as B from '../app/modules/edoc/bulk-logic.js';
let pass = 0, fail = 0;
const ok = (n, f) => { try { f(); pass++; console.log('OK  ', n); } catch (e) { fail++; console.log('FAIL', n, '—', e.message); } };
const okA = async (n, f) => { try { await f(); pass++; console.log('OK  ', n); } catch (e) { fail++; console.log('FAIL', n, '—', e.message); } };
const me = { uid: 'CEO', admin: true, isProxy: true };
// 내 차례 판정은 실제 코드(myTurn)를 쓴다 — 결재선의 현재 단계가 나이면 true
const line = (cur) => [{ role: '작성', uid: 'A', status: 'draft' }, { role: '결재', uid: cur, status: 'pending' }, { role: '수신', uid: 'X', status: 'pending' }];
const doc = (id, o) => Object.assign({ dtype: 'daily', id, status: 'pending', authorName: '정다애', _ms: 1000, approvalLine: line('CEO') }, o || {});

ok('결재 중인 내 차례 업무일지는 대상', () => assert.equal(B.bulkEligible(doc('1'), me), true));
ok('연차·지출 같은 다른 종류는 대상이 아님', () => { assert.equal(B.bulkEligible(doc('1', { dtype: 'leave' }), me), false); assert.equal(B.bulkEligible(doc('1', { dtype: 'purchase' }), me), false); });
ok('이미 승인·반려·임시저장 문서는 대상이 아님', () => ['approved', 'rejected', 'draft', 'posted'].forEach((s) => assert.equal(B.bulkEligible(doc('1', { status: s }), me), false)));
ok('내 차례가 아니면 대상이 아님(다른 사람 결재 단계)', () => assert.equal(B.bulkEligible(doc('1', { approvalLine: line('SOMEONE') }), me), false));
ok('대리 승인(남의 차례를 대신)은 일괄 대상이 아님 — 건별로', () => assert.equal(B.bulkEligible(doc('1', { approvalLine: line('LEAD') }), { uid: 'CEO', admin: true, isProxy: true }), false));
ok('빈 값은 대상이 아님', () => { assert.equal(B.bulkEligible(null, me), false); assert.deepEqual(B.bulkTargets(null, me), []); });
ok('대상 목록은 오래된 문서부터', () => { const t = B.bulkTargets([doc('b', { _ms: 3000 }), doc('a', { _ms: 1000 }), doc('c', { _ms: 2000 }), doc('x', { dtype: 'leave' })], me); assert.deepEqual(t.map((d) => d.id), ['a', 'c', 'b']); });
ok('요약: 작성자별 건수(많은 순, 같으면 가나다)', () => {
  const s = B.bulkSummary([doc('1'), doc('2'), doc('3', { authorName: '이한영' }), doc('4', { authorName: '김영서' }), doc('5')]);
  assert.equal(s.count, 5); assert.deepEqual(s.byAuthor, [{ name: '정다애', count: 3 }, { name: '김영서', count: 1 }, { name: '이한영', count: 1 }]);
});
ok('확인 창 문구에 건수·작성자별 건수·반려 안내', () => { const t = B.bulkConfirmBody([doc('1'), doc('2', { authorName: '이한영' })]); assert.ok(t.includes('업무일지 2건')); assert.ok(t.includes('이한영 1건, 정다애 1건')); assert.ok(t.includes('반려')); });
ok('50건씩 나눔', () => { const items = Array.from({ length: 120 }, (_, i) => doc(String(i))); const c = B.bulkChunks(items); assert.deepEqual(c.map((x) => x.length), [50, 50, 20]); });
ok('51건이면 확인 창에 나눠 처리한다는 안내', () => assert.ok(B.bulkConfirmBody(Array.from({ length: 51 }, (_, i) => doc(String(i)))).includes('50건씩 나눠서')));

await okA('순서대로 한 건씩 호출하고 호출 내용이 건별 승인과 같다', async () => {
  const calls = []; let running = 0; let maxRun = 0;
  const act = async (p) => { running++; maxRun = Math.max(maxRun, running); await new Promise((r) => setTimeout(r, 1)); calls.push(p); running--; };
  const prog = []; const r = await B.runBulk([doc('a'), doc('b'), doc('c')], act, { comment: '', onProgress: (d, t, k, o) => prog.push([d, t, k, o]) });
  assert.equal(maxRun, 1); assert.deepEqual(calls.map((c) => c.docId), ['a', 'b', 'c']);
  assert.deepEqual(calls[0], { dtype: 'daily', docId: 'a', action: 'approve', comment: '' });
  assert.deepEqual(r.ok, ['daily/a', 'daily/b', 'daily/c']); assert.equal(r.failed.length, 0); assert.equal(r.stopped, false);
  assert.deepEqual(prog.map((p) => p[0]), [1, 2, 3]);
});
await okA('한 건 실패해도 나머지는 계속하고 실패 건만 기록', async () => {
  const act = async (p) => { if (p.docId === 'b') throw new Error('이미 처리된 문서입니다'); };
  const r = await B.runBulk([doc('a'), doc('b'), doc('c')], act, {});
  assert.deepEqual(r.ok, ['daily/a', 'daily/c']); assert.deepEqual(r.failed, [{ key: 'daily/b', message: '이미 처리된 문서입니다' }]); assert.equal(r.stopped, false);
});
await okA('연속 3건 실패하면 멈추고 남은 건을 알려 줌', async () => {
  let n = 0; const act = async () => { n++; throw new Error('권한 없음'); };
  const r = await B.runBulk(Array.from({ length: 6 }, (_, i) => doc(String(i))), act, {});
  assert.equal(n, 3); assert.equal(r.stopped, true); assert.equal(r.remaining.length, 3); assert.ok(B.bulkResultText(r).includes('멈췄'));
});
await okA('실패 사이에 성공이 끼면 연속 실패로 세지 않음', async () => {
  const act = async (p) => { if (['0', '1', '3', '4'].includes(p.docId)) throw new Error('x'); };
  const r = await B.runBulk(Array.from({ length: 6 }, (_, i) => doc(String(i))), act, {});
  assert.equal(r.stopped, false); assert.equal(r.failed.length, 4); assert.equal(r.ok.length, 2);
});
await okA('취소하면 이후 건을 부르지 않음', async () => {
  let calls = 0; let cancel = false; const act = async () => { calls++; if (calls === 2) cancel = true; };
  const r = await B.runBulk(Array.from({ length: 5 }, (_, i) => doc(String(i))), act, { shouldCancel: () => cancel });
  assert.equal(calls, 2); assert.equal(r.stopped, true); assert.equal(r.remaining.length, 3);
});
ok('결과 문구', () => { assert.equal(B.bulkResultText({ ok: ['a', 'b'], failed: [], stopped: false, remaining: [] }), '2건을 승인했습니다.'); assert.ok(B.bulkResultText({ ok: ['a'], failed: [{ key: 'b', message: '오류' }], stopped: false, remaining: [] }).includes('실패 1건: 오류')); });
ok('상수', () => { assert.deepEqual(B.BULK_DTYPES, ['daily']); assert.equal(B.BULK_MAX, 50); assert.equal(B.BULK_STOP_AFTER, 3); });
console.log(fail ? '\n실패 ' + fail + '건' : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
