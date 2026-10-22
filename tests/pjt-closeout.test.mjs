import { ckParseNames, ckRowsFrom, ckCheck, ckMove, ckPayload, ckDirty } from '../app/modules/pjt/closeout.js';
/* 프로젝트 마감 체크리스트(대기열 1-2-8 5단계 마지막) 화면의 순수 도우미 — 서버(monthlyReportAct closeoutSave)와 같은 규칙을 화면이 저장 전에 미리 알려 준다(서버가 끝내 다시 막는다).
 * 항목 이름은 코드에 없다 — 이 시험의 이름(시공검측 등)은 예시일 뿐. 현장 층이라 금액·연락처는 적지 않는다. 가짜 값만 쓴다. 기대값은 손으로 적었다. */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => { const s = JSON.stringify(a) === JSON.stringify(b); ok(s, m + (s ? '' : ' ← 실제: ' + JSON.stringify(a) + ' / 기대: ' + JSON.stringify(b))); };
const R = (o) => Object.assign({ id: 'c1', name: '시공검측', doneDate: '', assignee: '', memo: '' }, o || {});
const TODAY = '2026-10-17';
console.log('── ckParseNames: 한 줄에 하나씩 붙여넣은 이름 정리');
eq(ckParseNames('시공검측\n시운전\n\n  완성검사  \r\n턴 온'), ['시공검측', '시운전', '완성검사', '턴 온'], '★ 빈 줄·앞뒤 공백·윈도 줄바꿈(CRLF)을 정리해 이름만 순서대로');
eq(ckParseNames('시운전\n시운전\n 시운전 \n턴  온\n턴 온'), ['시운전', '턴 온'], '★ 같은 이름은 처음 것만(공백 차이도 같은 이름), 안쪽 연속 공백은 하나로');
eq(ckParseNames(Array.from({ length: 35 }, (_, i) => 'n' + i).join('\n')).length, 30, '★ 30개까지만(서버 한도)');
for (const v of [null, undefined, 3, {}, [], true]) eq(ckParseNames(v), [], '글자가 아니면 빈 목록: ' + JSON.stringify(v));
eq(ckParseNames('\n\n   \n'), [], '이름이 하나도 없으면 빈 목록');
console.log('── ckRowsFrom / ckPayload');
eq(ckRowsFrom([{ id: 'c2', name: '시운전', doneDate: '2026-10-10', assignee: '김', memo: 'm', uid: 'u1', amount: 5 }, null, 3, { name: '이름만' }]), [{ id: 'c2', name: '시운전', doneDate: '2026-10-10', assignee: '김', memo: 'm' }, { id: '', name: '이름만', doneDate: '', assignee: '', memo: '' }], '★ 편집 행은 정해진 필드만(uid·금액 등은 버림), 이상한 항목은 건너뜀, 빠진 칸은 빈 글자');
for (const v of [null, undefined, 'x', 3, {}]) eq(ckRowsFrom(v), [], '배열이 아니면 빈 목록: ' + JSON.stringify(v));
{ const it = [{ id: 'c1', name: '시공검측' }]; const rows = ckRowsFrom(it); rows[0].name = '바뀜'; eq(it[0].name, '시공검측', '편집해도 원본 항목은 그대로(복사)'); }
eq(ckPayload([R({ name: '  시운전  ', id: 'c9', doneDate: '2026-10-10', assignee: ' 김 ', memo: ' 메모 ' })]), [{ id: 'c9', name: '시운전', doneDate: '2026-10-10', assignee: '김', memo: '메모' }], '★ 서버에 보낼 모양: 이름·담당·메모는 앞뒤 공백을 지우고 정해진 필드만');
eq(ckPayload([{ name: '새 항목' }]), [{ id: '', name: '새 항목', doneDate: '', assignee: '', memo: '' }], '번호가 없는 새 항목은 id 빈 글자(서버가 붙임)');
eq(ckPayload('x'), [], '배열이 아니면 빈 목록');
console.log('── ckCheck: 저장 전 미리 알림(서버와 같은 규칙, 첫 오류만)');
eq(ckCheck([R(), R({ id: 'c2', name: '시운전', doneDate: '2026-10-17', assignee: '김', memo: '1차 완료' })], TODAY), '', '★ 정상 값은 오류 없음(완료일 오늘은 통과)');
eq(ckCheck([], TODAY), '', '빈 목록도 정상(체크리스트 비우기)');
ok(/이름/.test(ckCheck([R({ name: '' })], TODAY)) && /이름/.test(ckCheck([R({ name: '   ' })], TODAY)), '★ 이름이 비어 있거나 공백뿐이면 "이름" 안내');
ok(/40자/.test(ckCheck([R({ name: '가'.repeat(41) })], TODAY)) && ckCheck([R({ name: '가'.repeat(40) })], TODAY) === '', '★ 이름 41자는 "40자" 안내, 40자는 통과');
ok(/같은 이름/.test(ckCheck([R(), R({ id: 'c2' })], TODAY)) && /같은 이름/.test(ckCheck([R({ name: '턴 온' }), R({ id: 'c2', name: '턴  온' })], TODAY)), '★ 같은 이름(공백 차이 포함)은 "같은 이름" 안내');
ok(/같은 이름/.test(ckCheck([R({ name: '턴  온' }), R({ id: 'c2', name: '턴 온' })], TODAY)) && /같은 이름/.test(ckCheck([R({ name: ' 시운전' }), R({ id: 'c2', name: '시운전 ' })], TODAY)), '★ 첫 항목 이름 안에 연속 공백·앞뒤 공백이 있어도 같은 이름으로 걸러낸다(양쪽 모두 공백 정리 뒤 비교)');
ok(/20자/.test(ckCheck([R({ assignee: '가'.repeat(21) })], TODAY)) && ckCheck([R({ assignee: '가'.repeat(20) })], TODAY) === '', '담당 21자는 "20자", 20자는 통과');
ok(/200자/.test(ckCheck([R({ memo: '가'.repeat(201) })], TODAY)) && ckCheck([R({ memo: '가'.repeat(200) })], TODAY) === '', '메모 201자는 "200자", 200자는 통과');
ok(/금액/.test(ckCheck([R({ name: '시운전 단가 3만원' })], TODAY)) && /금액/.test(ckCheck([R({ memo: '단가 3만원 인상' })], TODAY)), '★ 이름·메모에 금액·단가가 있으면 "금액" 안내');
ok(/전화번호/.test(ckCheck([R({ memo: '연락 010-1111-2222' })], TODAY)) && /전화번호/.test(ckCheck([R({ assignee: '010-1111-2222' })], TODAY)), '★ 담당·메모에 전화번호가 있으면 "전화번호" 안내');
for (const d of ['2026-02-30', '2026-13-01', '20261010', 'x', '2026-1-1']) ok(/완료일/.test(ckCheck([R({ doneDate: d })], TODAY)), '★ 완료일 ' + d + ' 는 "완료일" 안내');
ok(/오늘 이후/.test(ckCheck([R({ doneDate: '2026-10-18' })], TODAY)) && ckCheck([R({ doneDate: '2026-10-17' })], TODAY) === '', '★ 완료일이 오늘(10/17) 이후(10/18)면 "오늘 이후" 안내, 오늘은 통과');
ok(/30/.test(ckCheck(Array.from({ length: 31 }, (_, i) => R({ id: 'c' + i, name: 'n' + i })), TODAY)) && ckCheck(Array.from({ length: 30 }, (_, i) => R({ id: 'c' + i, name: 'n' + i })), TODAY) === '', '★ 항목 31개는 "30" 안내, 30개는 통과');
ok(/이름/.test(ckCheck([R({ name: '' }), R({ id: 'c2', name: '시운전 단가 3만원' })], TODAY)), '오류가 여러 개면 목록에서 먼저 나온 것(첫 줄의 이름 비어 있음)을 알린다');
for (const v of [null, undefined, 'x', 3, {}]) ok(typeof ckCheck(v, TODAY) === 'string' && ckCheck(v, TODAY) !== '', '배열이 아니면 오류 글자: ' + JSON.stringify(v));
ok(typeof ckCheck([R()], undefined) === 'string' && typeof ckCheck([R({ doneDate: '2026-10-10' })], 'x') === 'string', '오늘 날짜가 이상해도 던지지 않는다');
{ const rows = [R({ name: '' })]; const sn = JSON.stringify(rows); ckCheck(rows, TODAY); ok(JSON.stringify(rows) === sn, '입력을 바꾸지 않는다'); }
console.log('── ckMove: 항목 순서 바꾸기(순서가 의미 있는 체크리스트)');
{ const rows = [R({ id: 'c1', name: 'a' }), R({ id: 'c2', name: 'b' }), R({ id: 'c3', name: 'c' })]; const sn = JSON.stringify(rows);
  eq(ckMove(rows, 1, -1).map((r) => r.name), ['b', 'a', 'c'], '★ 둘째를 위로 → b a c'); eq(ckMove(rows, 1, 1).map((r) => r.name), ['a', 'c', 'b'], '둘째를 아래로 → a c b');
  eq(ckMove(rows, 0, -1).map((r) => r.name), ['a', 'b', 'c'], '맨 위를 위로 → 그대로'); eq(ckMove(rows, 2, 1).map((r) => r.name), ['a', 'b', 'c'], '맨 아래를 아래로 → 그대로');
  for (const [i, d] of [[-1, 1], [3, -1], [1.5, 1], ['x', 1], [1, 'x'], [1, 0]]) eq(ckMove(rows, i, d).map((r) => r.name), ['a', 'b', 'c'], '이상한 위치·방향(' + i + ',' + d + ')은 그대로');
  eq(ckMove(rows, 0, 1).map((r) => r.id), ['c2', 'c1', 'c3'], '번호는 항목을 따라간다'); ok(JSON.stringify(rows) === sn, '★ 입력 배열을 바꾸지 않는다(새 배열)'); eq(ckMove('x', 0, 1), [], '배열이 아니면 빈 목록'); }
console.log('── ckDirty: 저장할 변경이 있는가');
{ const items = [{ id: 'c1', name: '시공검측', doneDate: '', assignee: '', memo: '' }]; ok(ckDirty(ckRowsFrom(items), items) === false, '★ 그대로면 변경 없음'); ok(ckDirty(null, items) === false, '편집을 시작하지 않았으면(초안 없음) 변경 없음');
  ok(ckDirty([R({ name: '시공검측 ' })], items) === false, '이름 뒤 공백만 다르면 변경 없음(저장 때 공백을 지우므로)');
  for (const [k, v] of [['name', '바뀜'], ['doneDate', '2026-10-10'], ['assignee', '김'], ['memo', 'm']]) ok(ckDirty([R({ [k]: v })], items) === true, '★ ' + k + ' 가 바뀌면 변경 있음');
  ok(ckDirty([R(), R({ id: 'c2', name: 'b' })], items) === true && ckDirty([], items) === true, '항목이 늘거나 줄면 변경 있음'); ok(ckDirty([R({ id: '' , name: '시공검측' })], items) === true, '번호가 다르면 변경 있음'); }
ok(pass + fail >= 67, '★ 시험이 끝까지 실행됨(중간에 예외로 중단돼도 FAIL 0 으로 보이지 않게)');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
