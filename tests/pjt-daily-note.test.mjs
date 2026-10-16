// 공사일보 저장 뒤 전자결재 업무일지 연동 결과 안내(순수 함수) — 이전에는 실패해도 console.warn 만 남아 아무도 몰랐다
import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/eval/index.js', import.meta.url), 'utf8').match(/eval-perm\.js\?v=([0-9a-z]+)/) || [])[1];
const N = await import('../app/modules/pjt/daily-note.js?v=' + VER);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const warn = console.warn; const warns = []; console.warn = (...a) => warns.push(a.join(' '));
// ── 결과별 안내 문구
ok(/상신했습니다/.test(N.dailyNote({ ok: true, created: true, status: 'pending' })) && !/다시/.test(N.dailyNote({ ok: true, created: true, status: 'pending' })), '새로 만들어 상신: "전자결재 업무일지도 상신했습니다"');
ok(/갱신/.test(N.dailyNote({ ok: true, updated: true, status: 'pending' })) && /다시 상신/.test(N.dailyNote({ ok: true, created: false, status: 'pending' })), '결재 중인 문서는 "내용을 갱신", 반려·임시저장 문서를 다시 저장하면 "다시 상신"');
ok(/임시저장/.test(N.dailyNote({ ok: true, created: true, status: 'draft', noApprover: true })) && /결재선/.test(N.dailyNote({ ok: true, status: 'draft', noApprover: true })) && !/상신했습니다/.test(N.dailyNote({ ok: true, status: 'draft', noApprover: true })), '★ 결재자가 없어 임시저장으로 남았을 때: 임시저장이라는 것과 전자결재에서 결재선을 정해 상신하라는 안내(상신했다고 말하지 않음)');
ok(/이미 승인/.test(N.dailyNote({ ok: true, skipped: 'locked' })) && /다른 사람/.test(N.dailyNote({ ok: true, skipped: 'other-author' })), '승인·게시된 문서(locked)·남이 쓴 문서(other-author)는 건드리지 않았다고 안내');
ok(/갱신/.test(N.dailyNote({ data: { ok: true, updated: true, status: 'pending' } })) && /임시저장/.test(N.dailyNote({ data: { ok: true, status: 'draft', noApprover: true } })), 'httpsCallable 응답({data})도 같은 문구');
ok(['', null, undefined, 0, 'x', {}, { ok: true }, [], { data: null }].every((v) => N.dailyNote(v) === ''), '알 수 없는 응답은 빈 문구(화면을 어지럽히지 않음)');
// ── 실패 문구
ok(/만들지 못했습니다 — 금일 업무 내용이 없습니다\./.test(N.failNote(new Error('금일 업무 내용이 없습니다.'))) && /공사일보는 저장했지만/.test(N.failNote(new Error('결재자는 1~5명이어야 합니다.'))), '★ 서버가 한글로 준 실패 이유를 그대로 보여 주고, 공사일보 자체는 저장됐다는 것을 먼저 알림');
ok(/서버 함수에 닿지 못했습니다/.test(N.failNote(Object.assign(new Error('internal'), { code: 'functions/internal' }))) && /서버 함수에 닿지 못했습니다/.test(N.failNote(null)) && N.failNote(new Error('가'.repeat(300))).length < 220, '영문·빈 오류는 "서버 함수에 닿지 못했습니다", 너무 긴 메시지는 잘라서 보여 줌');
// ── syncWithNote: 호출 여부와 문구
{ let calls = 0; const run = async () => { calls++; return { ok: true, created: true, status: 'pending' }; };
  const a = await N.syncWithNote('07:10 TBM', run); ok(calls === 1 && /상신했습니다/.test(a), '★ 금일 업무가 있으면 서버를 한 번 부르고 결과 문구를 돌려줌');
  const b = await N.syncWithNote('', run); const c = await N.syncWithNote('   \n ', run); const d = await N.syncWithNote(undefined, run); ok(calls === 1 && b === N.EMPTY_WORK_NOTE && c === N.EMPTY_WORK_NOTE && d === N.EMPTY_WORK_NOTE && /금일 업무가 비어/.test(b), '★ 금일 업무가 비어 있으면 서버를 부르지 않고(어차피 거부됨) 이유를 안내 — 12-31 같은 미래 날짜 저장이 조용히 사라지던 문제');
  warns.length = 0; const e = await N.syncWithNote('내용', async () => { throw new Error('결재자는 1~5명이어야 합니다.'); }); ok(/만들지 못했습니다 — 결재자는 1~5명/.test(e) && warns.length === 1 && /공사일보→업무일지 연동 실패/.test(warns[0]), '서버가 거부해도 예외를 밖으로 던지지 않고(일보 저장은 유지) 이유를 문구로 돌려주며 개발자 콘솔에는 기록 남김');
  const f = await N.syncWithNote('내용', async () => ({ data: { ok: true, skipped: 'locked' } })); ok(/이미 승인/.test(f), '{data} 응답도 처리'); }
console.warn = warn;
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
