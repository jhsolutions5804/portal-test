// 팀장 고정 결재선(2-5-103) — 화면 쪽 결재선 계산·설정 시험
import assert from 'node:assert/strict';
import * as C from '../app/modules/edoc/compose.js';
import * as SL from '../app/modules/edoc/settings-logic.js';
import { lineEditorHtml } from '../app/modules/edoc/compose-view.js';
let pass = 0, fail = 0;
const ok = (n, f) => { try { f(); pass++; console.log('OK  ', n); } catch (e) { fail++; console.log('FAIL', n, '—', e.message); } };
const U = (uid, o) => Object.assign({ uid, name: uid, rank: '', dept: 'PJT팀', empNo: 'E' + uid, status: 'approved', admin: false, teamLead: false }, o || {});
const users = [U('han', { name: '한가나' }), U('lee', { name: '이다라', teamLead: true }), U('kim', { name: '김종화', admin: true, dept: '경영지원본부' }), U('min', { name: '김민서', dept: '경영지원본부' }), U('guest1', { empNo: 'guest001', teamLead: true })];
const policy = (o) => Object.assign({ required: ['kim'], proxy: ['kim'], selfApprove: [], teamLeadLine: { enabled: true, dtypes: ['daily'] } }, o || {});
const me = (uid) => users.find((u) => u.uid === uid);

ok('팀장 판정: 직원의 팀장은 같은 부서의 팀장', () => assert.equal(C.teamLeadUid(me('han'), users, policy(), 'daily'), 'lee'));
ok('팀장 판정: 팀장 본인·대표·필수 결재자는 팀장 단계 없음', () => { assert.equal(C.teamLeadUid(me('lee'), users, policy(), 'daily'), ''); assert.equal(C.teamLeadUid(me('kim'), users, policy(), 'daily'), ''); assert.equal(C.teamLeadUid(me('han'), users, policy({ required: ['han'] }), 'daily'), ''); });
ok('팀장 판정: 정책이 꺼졌거나 문서 종류가 없으면 없음', () => { assert.equal(C.teamLeadUid(me('han'), users, policy({ teamLeadLine: { enabled: false, dtypes: ['daily'] } }), 'daily'), ''); assert.equal(C.teamLeadUid(me('han'), users, policy(), 'leave'), ''); assert.equal(C.teamLeadUid(me('han'), users, { required: ['kim'] }, 'daily'), ''); });
ok('팀장 판정: 부서가 없거나 다른 부서이면 없음', () => { assert.equal(C.teamLeadUid(Object.assign({}, me('han'), { dept: '' }), users, policy(), 'daily'), ''); assert.equal(C.teamLeadUid(me('min'), users, policy(), 'daily'), ''); });
ok('팀장 판정: 미승인·게스트 팀장은 제외, 여럿이면 uid 사전순 첫 사람', () => {
  assert.equal(C.teamLeadUid(me('han'), users.map((u) => (u.uid === 'lee' ? Object.assign({}, u, { status: 'pending' }) : u)), policy(), 'daily'), '');
  assert.equal(C.teamLeadUid(me('han'), users.concat(U('abc', { teamLead: true })), policy(), 'daily'), 'abc');
});
ok('지출·구매(spend) 화면은 purchase 또는 expense 가 켜져 있으면 미리 보여 줌', () => { assert.equal(C.teamLeadUid(me('han'), users, policy({ teamLeadLine: { enabled: true, dtypes: ['purchase'] } }), 'spend'), 'lee'); assert.equal(C.teamLeadUid(me('han'), users, policy({ teamLeadLine: { enabled: true, dtypes: ['daily'] } }), 'spend'), ''); });

const ctxOf = (uid, o) => C.lineContext(me(uid), policy(o), { daily: { steps: ['kim'], cc: ['min'] } }, users, 'daily');
ok('컨텍스트: 직원은 lead 가 팀장, 팀장·대표는 빈 값, 면제 작성자는 빈 값', () => { assert.equal(ctxOf('han').lead, 'lee'); assert.equal(ctxOf('lee').lead, ''); assert.equal(ctxOf('kim').lead, ''); assert.equal(ctxOf('han', { selfApprove: ['han'] }).lead, ''); });
ok('처음 결재선: 팀장이 맨 앞, 그다음 권장 결재선·필수 결재자(대표)', () => assert.deepEqual(C.initialLine(ctxOf('han')).approvers, ['lee', 'kim']));
ok('처음 결재선: 팀장이 쓰면 팀장 단계 없이 대표만', () => assert.deepEqual(C.initialLine(ctxOf('lee')).approvers, ['kim']));
ok('팀장이 권장 결재선 뒤쪽에 있어도 맨 앞으로 옮기고, 참조에 있으면 참조에서 뺀다', () => {
  const ctx = C.lineContext(me('han'), policy(), { daily: { steps: ['kim', 'lee'], cc: ['lee'] } }, users, 'daily');
  const l = C.initialLine(ctx); assert.deepEqual(l.approvers, ['lee', 'kim']); assert.equal(l.cc.indexOf('lee'), -1);
});
ok('기존 문서(반려·임시저장)를 불러와도 팀장이 맨 앞', () => { const ctx = ctxOf('han'); const l = C.lineFromDoc({ approvalLine: [{ role: '작성', uid: 'han' }, { role: '결재', uid: 'kim' }] }, ctx); assert.deepEqual(l.approvers, ['lee', 'kim']); });
ok('고정: 팀장은 잠김(빼기·이동 불가), 문구가 팀장 고정', () => {
  const ctx = ctxOf('han'); assert.equal(C.isLocked('lee', ctx), true); const line = C.initialLine(ctx);
  assert.equal(C.removeFromLine(line, 'lee', ctx).error, '팀장 결재는 고정이라 뺄 수 없습니다.'); assert.deepEqual(C.removeFromLine(line, 'lee', ctx).state, line);
  assert.deepEqual(C.moveApprover(line, 'lee', 1, ctx), line, '팀장은 아래로 못 옮김'); assert.deepEqual(C.moveApprover(line, 'kim', -1, ctx), line, '다른 사람이 팀장 위로 못 올라감');
});
ok('고정이 아니면 이동은 그대로 된다(팀장 규칙 없을 때)', () => { const ctx = C.lineContext(me('han'), policy({ teamLeadLine: { enabled: false, dtypes: [] } }), { daily: { steps: ['lee', 'kim'] } }, users, 'daily'); const l = C.initialLine(ctx); assert.deepEqual(C.moveApprover(l, 'kim', -1, ctx).approvers, ['kim', 'lee']); });
ok('상신 전 검사: 팀장이 첫 결재자가 아니면 서버와 같은 문구', () => {
  const ctx = ctxOf('han'); assert.deepEqual(C.lineIssues({ approvers: ['kim'], cc: [] }, ctx), ['팀장(이다라)이 첫 결재자여야 합니다.']);
  assert.deepEqual(C.lineIssues({ approvers: ['kim', 'lee'], cc: [] }, ctx), ['팀장(이다라)이 첫 결재자여야 합니다.']); assert.deepEqual(C.lineIssues({ approvers: ['lee', 'kim'], cc: [] }, ctx), []);
});
ok('상신 전 검사: 팀장이 쓴 문서는 대표만으로 통과', () => assert.deepEqual(C.lineIssues({ approvers: ['kim'], cc: [] }, ctxOf('lee')), []));
ok('결재선 화면: 팀장 고정 표시와 안내문, 팀장 이동 버튼 비활성', () => {
  const ctx = ctxOf('han'); const h = lineEditorHtml(C.initialLine(ctx), ctx, {});
  assert.ok(h.includes('팀장 고정')); assert.ok(h.includes('팀장 결재 → 대표 결재')); assert.ok(h.includes('팀장(이다라)은 뺄 수 없습니다'));
  const lee = h.slice(h.indexOf('data-uid="lee"')); assert.ok(/data-remove="lee"[^>]*disabled/.test(lee)); assert.ok(/data-move="lee:-1"[^>]*disabled/.test(lee)); assert.ok(/data-move="lee:1"[^>]*disabled/.test(lee));
  const kim = h.slice(h.indexOf('data-uid="kim"')); assert.ok(/data-move="kim:-1"[^>]*disabled/.test(kim), '대표가 팀장 위로 못 올라감');
});
ok('결재선 화면: 팀장 규칙이 없으면 안내문이 없다', () => { const ctx = ctxOf('lee'); assert.ok(!lineEditorHtml(C.initialLine(ctx), ctx, {}).includes('팀장 결재 → 대표 결재')); });

// 설정 화면 로직
const dir = (tl) => ({ users, policy: { required: ['kim'], proxy: ['kim'], teamLeadLine: tl }, guides: {} });
ok('설정: 상태에 teamLeadLine 이 들어가고 없으면 꺼짐·빈 목록', () => { assert.deepEqual(SL.initState(dir(undefined), {}, me('kim')).policy.teamLeadLine, { enabled: false, dtypes: [] }); assert.deepEqual(SL.initState(dir({ enabled: true, dtypes: ['daily'] }), {}, me('kim')).policy.teamLeadLine, { enabled: true, dtypes: ['daily'] }); });
ok('설정: 켜고 문서 종류를 고르면 변경됨, 저장 요청에 teamLeadLine 이 담긴다', () => {
  const S = SL.initState(dir(undefined), {}, me('kim')); assert.equal(SL.isDirty(S, 'policy'), false);
  SL.setTeamLead(S, { enabled: true }); SL.setTeamLead(S, { dtype: 'daily', on: true }); SL.setTeamLead(S, { dtype: 'daily', on: true }); assert.equal(SL.isDirty(S, 'policy'), true);
  assert.deepEqual(SL.payloadFor('policy', S).policy.teamLeadLine, { enabled: true, dtypes: ['daily'] }); SL.setTeamLead(S, { dtype: 'daily', on: false }); assert.deepEqual(S.policy.teamLeadLine.dtypes, []);
});
ok('설정: 켰는데 문서 종류가 없으면 저장 전에 안내', () => { const S = SL.initState(dir(undefined), {}, me('kim')); SL.setTeamLead(S, { enabled: true }); assert.ok(SL.validateSection(S, 'policy').includes('문서 종류')); SL.setTeamLead(S, { dtype: 'daily', on: true }); assert.ok(!SL.validateSection(S, 'policy')); });
ok('문서 종류 목록은 서버가 아는 이름뿐', () => assert.deepEqual(SL.TEAMLEAD_TYPES.map((x) => x[0]), ['daily', 'leave', 'purchase', 'expense', 'attend', 'cert', 'resign']));
console.log(fail ? '\n실패 ' + fail + '건' : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
