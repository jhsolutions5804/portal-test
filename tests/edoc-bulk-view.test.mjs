// 업무일지 일괄 결재(2-5-104) — 결재함 목록 HTML 시험
import assert from 'node:assert/strict';
import { listHtml } from '../app/modules/edoc/views.js';
let pass = 0, fail = 0;
const ok = (n, f) => { try { f(); pass++; console.log('OK  ', n); } catch (e) { fail++; console.log('FAIL', n, '—', e.message); } };
const me = { uid: 'CEO', admin: true, isProxy: true, name: '김종화' };
const line = (cur) => [{ role: '작성', uid: 'A', status: 'draft' }, { role: '결재', uid: cur, status: 'pending' }, { role: '수신', uid: 'X', status: 'pending' }];
const d = (id, o) => Object.assign({ dtype: 'daily', id, status: 'pending', authorName: '정다애', authorUid: 'A', title: '업무일지 ' + id, _ms: 1000 + Number(id) || 1000, approvalLine: line('CEO'), viewerUids: ['CEO'] }, o || {});
const docs = [d('1'), d('2'), d('3', { dtype: 'leave', title: '연차' }), d('4', { approvalLine: line('LEAD') }), d('5', { status: 'approved' })];
const html = (q, sel) => listHtml({ docs, me, query: q || {}, selectedKey: '', bulkSel: sel });

ok('결재할 문서 탭: 내 차례 업무일지 2건에만 체크박스, 막대에 건수', () => {
  const h = html({ tab: 'todo' });
  assert.equal((h.match(/data-bulk="/g) || []).length, 2); assert.ok(h.includes('data-bulk="daily/1"')); assert.ok(h.includes('data-bulk="daily/2"'));
  assert.ok(h.includes('data-bulk-all')); assert.ok(h.includes('업무일지 전체 선택')); assert.ok(h.includes('(2건)')); assert.ok(h.includes('data-bulk-run')); assert.ok(h.includes('선택 0건 승인'));
});
ok('연차·다른 사람 차례·승인 문서에는 체크박스가 없다', () => {
  const h = html({ tab: 'todo' });
  ['daily/4', 'daily/5', 'leave/3'].forEach((k) => assert.ok(!h.includes('data-bulk="' + k + '"'), k));
});
ok('다른 탭(내 문서·수신함·전체)에는 일괄 승인 막대가 없다', () => { ['mine', 'cc', 'all'].forEach((t) => { const h = html({ tab: t }); assert.ok(!h.includes('data-bulkbar') && !h.includes('data-bulk="'), t); }); });
ok('체크 상태가 목록에 반영된다', () => { const h = html({ tab: 'todo' }, new Set(['daily/2'])); assert.ok(/data-bulk="daily\/2" checked/.test(h)); assert.ok(!/data-bulk="daily\/1" checked/.test(h)); });
ok('체크박스는 문서를 여는 행 버튼 바깥에 있다(버튼 안에 입력칸을 넣지 않는다)', () => {
  const h = html({ tab: 'todo' });
  const rows = h.match(/<div class="jh-bulkrow">[\s\S]*?<\/button><\/div>/g) || [];
  assert.equal(rows.length, 2);
  rows.forEach((r) => { const btn = r.slice(r.indexOf('<button')); assert.ok(!btn.includes('<input')); assert.ok(btn.includes('data-open="daily/')); });
});
ok('결재할 일이 없으면 막대 없음', () => { const h = listHtml({ docs: [d('9', { approvalLine: line('LEAD') })], me, query: { tab: 'todo' }, selectedKey: '' }); assert.ok(!h.includes('data-bulkbar')); });
ok('이름·제목은 이스케이프된다(체크박스 값에 문서 번호만)', () => { const h = listHtml({ docs: [d('1', { id: 'a"b' })], me, query: { tab: 'todo' }, selectedKey: '' }); assert.ok(!h.includes('data-bulk="daily/a"b"')); });
console.log(fail ? '\n실패 ' + fail + '건' : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
