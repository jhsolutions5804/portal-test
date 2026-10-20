import assert from 'node:assert/strict';
import { SOURCES, INPUT_SOURCES, reportLogState, reportLogMessage, runReportLog } from '../app/shared/pjt-log.js';
let pass = 0, failN = 0; const pend = [];
const t = (name, fn) => { try { const r = fn(); if (r && typeof r.then === 'function') { pend.push(r.then(() => { pass++; console.log('OK   ' + name); }, (e) => { failN++; console.log('FAIL ' + name + ' → ' + e.message); })); } else { pass++; console.log('OK   ' + name); } } catch (e) { failN++; console.log('FAIL ' + name + ' → ' + e.message); } };

t('출처 목록은 서버와 같은 7종, 직접 입력 칩은 4종 그대로(공사일보는 자동 전용)', () => {
  assert.deepEqual(SOURCES, ['회의', '카톡', '전화', '현장', '메일', '일정', '공사일보']);
  assert.deepEqual(INPUT_SOURCES, ['회의', '카톡', '전화', '현장']); assert(!INPUT_SOURCES.includes('공사일보'));
});
const S = (o) => Object.assign({ note: '3층 덕트 간섭', manage: true, logged: null, busy: false }, o);
t('★ 특이사항이 있고 작성 권한이 있으면 버튼이 나온다(ready, 라벨 "이력으로 올리기", 활성)', () => {
  const r = reportLogState(S()); assert.equal(r.show, true); assert.equal(r.state, 'ready'); assert.equal(r.label, '이력으로 올리기'); assert.equal(r.disabled, false);
});
t('★ 특이사항이 비었거나 공백뿐이면 버튼을 숨긴다(빈 값·공백·줄바꿈·undefined·null)', () => {
  for (const n of ['', '   ', '\n \t', undefined, null]) { const r = reportLogState(S({ note: n })); assert.equal(r.show, false, JSON.stringify(n)); assert.equal(r.state, 'hidden'); }
});
t('★ 조회 전용(작성 권한 없음)이면 특이사항이 있어도 숨긴다', () => { const r = reportLogState(S({ manage: false })); assert.equal(r.show, false); assert.equal(r.state, 'hidden'); });
t('★ 올리는 중이면 "올리는 중…"·비활성(두 번 눌러도 한 번만 가게)', () => {
  const r = reportLogState(S({ busy: true })); assert.equal(r.show, true); assert.equal(r.state, 'busy'); assert.equal(r.label, '올리는 중…'); assert.equal(r.disabled, true);
});
t('★ 이미 올렸으면 "이력에 올림 ✓"·비활성(같은 날짜 다시 못 누름)', () => {
  const r = reportLogState(S({ logged: { id: 'rpt_2026-10-16' } })); assert.equal(r.show, true); assert.equal(r.state, 'done'); assert.equal(r.label, '이력에 올림 ✓'); assert.equal(r.disabled, true);
});
t('올리는 중이면서 이미 올린 상태라면 done 이 우선(결과가 확정된 것)', () => { assert.equal(reportLogState(S({ busy: true, logged: { id: 'x' } })).state, 'done'); });
t('권한이 없으면 이미 올린 상태여도 숨김(조회 전용에는 버튼 영역 자체가 없다)', () => { assert.equal(reportLogState(S({ manage: false, logged: { id: 'x' } })).show, false); });
t('인자가 없어도 던지지 않고 숨김', () => { assert.equal(reportLogState().show, false); assert.equal(reportLogState({}).show, false); assert.equal(reportLogState(null).show, false); });
t('★ 서버 응답 → 안내 문구: 새로 올림 / 이미 올라가 있음 / 알 수 없는 응답은 중립 문구', () => {
  assert.equal(reportLogMessage({ ok: true, id: 'rpt_2026-10-16' }), '이력에 올렸습니다.');
  assert.equal(reportLogMessage({ ok: true, duplicate: true, id: 'rpt_2026-10-16' }), '이미 이력에 올라가 있습니다.');
  assert.equal(reportLogMessage({}), '이력에 올렸습니다.'); assert.equal(reportLogMessage(null), '이력에 올렸습니다.');
});
t('★ 응답 문구는 duplicate 가 참(true)일 때만 "이미"(문자열 "false"·0 에는 새로 올림)', () => {
  assert.equal(reportLogMessage({ ok: true, duplicate: false }), '이력에 올렸습니다.'); assert.equal(reportLogMessage({ ok: true, duplicate: 0 }), '이력에 올렸습니다.'); assert.equal(reportLogMessage({ ok: true, duplicate: 'false' }), '이력에 올렸습니다.');
});
const mkCall = (resp, spy) => async (payload) => { spy.push(payload); if (resp instanceof Error) throw resp; return resp; };
t('★ 서버에는 action·pjtId·date·category 만 보낸다(제목·출처·상태는 보내지 않음 — 서버가 일보에서 직접 만든다)', async () => {
  const spy = []; const r = await runReportLog(mkCall({ ok: true, id: 'rpt_2026-10-16' }, spy), { pjtId: 'p1', date: '2026-10-16', category: '일정 변경' });
  assert.deepEqual(spy, [{ action: 'fromReport', pjtId: 'p1', date: '2026-10-16', category: '일정 변경' }]); assert.equal(r.ok, true); assert.equal(r.msg, '이력에 올렸습니다.'); assert.deepEqual(r.logged, { id: 'rpt_2026-10-16' });
});
t('★ 분류가 비어 있으면 기본 "현장 이슈"', async () => { const spy = []; await runReportLog(mkCall({ ok: true, id: 'a' }, spy), { pjtId: 'p1', date: '2026-10-16', category: '' }); assert.equal(spy[0].category, '현장 이슈'); const s2 = []; await runReportLog(mkCall({ ok: true, id: 'a' }, s2), { pjtId: 'p1', date: '2026-10-16' }); assert.equal(s2[0].category, '현장 이슈'); });
t('★ 서버가 이미 올라가 있다고 하면(duplicate) 안내 문구가 다르고 logged 는 유지', async () => {
  const r = await runReportLog(mkCall({ ok: true, duplicate: true, id: 'rpt_2026-10-16' }, []), { pjtId: 'p1', date: '2026-10-16', category: '현장 이슈' }); assert.equal(r.ok, true); assert.equal(r.msg, '이미 이력에 올라가 있습니다.'); assert.deepEqual(r.logged, { id: 'rpt_2026-10-16' });
});
t('★ 서버가 거절하면(금액 포함 등) ok:false·서버 메시지를 그대로 안내·logged 없음', async () => {
  const e = Object.assign(new Error('금액·단가는 이력에 적지 않습니다.'), { code: 'invalid-argument' }); const r = await runReportLog(mkCall(e, []), { pjtId: 'p1', date: '2026-10-16', category: '현장 이슈' });
  assert.equal(r.ok, false); assert.equal(r.msg, '금액·단가는 이력에 적지 않습니다.'); assert.equal(r.logged, null);
});
t('메시지가 너무 길거나 없는 오류는 중립 문구(friendlyError 규칙)', async () => { const r = await runReportLog(mkCall(new Error(''), []), { pjtId: 'p1', date: '2026-10-16', category: '현장 이슈' }); assert.equal(r.ok, false); assert(r.msg.length > 0 && r.msg.length < 160); });
t('★ 알 수 없는 분류는 서버에 보내지 않고 거절(요청 0건)', async () => { const spy = []; const r = await runReportLog(mkCall({ ok: true }, spy), { pjtId: 'p1', date: '2026-10-16', category: '아무거나' }); assert.equal(r.ok, false); assert.equal(spy.length, 0); });
t('★ 프로젝트·날짜가 없으면 서버에 보내지 않고 거절(요청 0건)', async () => { const spy = []; for (const x of [{ date: '2026-10-16' }, { pjtId: 'p1' }, { pjtId: '', date: '' }, null, undefined]) { const r = await runReportLog(mkCall({ ok: true }, spy), x); assert.equal(r.ok, false); } assert.equal(spy.length, 0); });
t('응답이 비어 있어도 던지지 않고 "올렸습니다" 처리가 아닌 실패로 본다(서버는 항상 ok:true 를 준다)', async () => { const r = await runReportLog(mkCall(undefined, []), { pjtId: 'p1', date: '2026-10-16', category: '현장 이슈' }); assert.equal(r.ok, false); const r2 = await runReportLog(mkCall({}, []), { pjtId: 'p1', date: '2026-10-16', category: '현장 이슈' }); assert.equal(r2.ok, false); });
await Promise.all(pend);
assert(pass + failN >= 19, '시험이 끝까지 실행되지 않음(' + (pass + failN) + '건)');
console.log('\n' + (failN ? '실패 ' + failN + '건 / 통과 ' + pass : '전부 통과 (' + pass + '건)')); if (failN) process.exit(1);
