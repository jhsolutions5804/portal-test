// 직원 배치는 사번순 — 포털 전체 적용(대표님 2026-11-04 「포털 전체 적용」). 사번이 있는 직원 목록에만 적용하고, 사번이 없는 연명부(외주 인력 포함)·진행 순서가 의미 있는 목록은 그대로 둔다.
import fs from 'node:fs';
const { byEmpNo, sortByEmpNo, empNoOf } = await import('../app/shared/worker-order.js');
const { otSummary } = await import('../app/modules/hr/overtime.js');
const { tasksOf } = await import('../app/modules/eval/mine-logic.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const src = (p) => fs.readFileSync(new URL('../app/' + p, import.meta.url), 'utf8');
const W = (empNo, name) => ({ empNo, name });
// ── 비교 함수
const sample = [W('26001', '이한영'), W('', '무번호 가'), W('00000', '송지훈'), W('23002', '정다애'), W('22003', '김민서'), W(undefined, '무번호 나'), W('23001', '윤석원'), W('99999', 'test'), W('23001', '가동명이')];
const s1 = sample.slice().sort(byEmpNo).map((w) => (w.empNo || '-') + w.name).join(' ');
ok(s1 === '00000송지훈 22003김민서 23001가동명이 23001윤석원 23002정다애 26001이한영 99999test -무번호 가 -무번호 나', '★ 사번 오름차순, 사번이 없는 사람은 맨 뒤(그 안에서는 이름순), 같은 사번이면 이름순 — ' + s1);
ok(JSON.stringify(sortByEmpNo(sample)) === JSON.stringify(sample.slice().sort(byEmpNo)) && sample[0].name === '이한영' && sortByEmpNo(null).length === 0 && sortByEmpNo(undefined).length === 0, 'sortByEmpNo 는 같은 기준이며 원본 배열을 바꾸지 않고 null 도 안전');
ok(byEmpNo(null, W('1', 'a')) > 0 && byEmpNo(W('1', 'a'), undefined) < 0 && byEmpNo(null, null) === 0 && empNoOf({ empNo: ' 22001 ' }) === '22001' && empNoOf({ empNo: 123 }) === '123', '비교 함수: 빈 값·공백·숫자 사번도 안전하게 처리');
const mixed = [W('10', 'x'), W('9', 'y')]; ok(mixed.sort(byEmpNo)[0].name === 'x', '사번은 문자열 그대로 비교(본섭 사번이 5자리 0 채움이라 문자열 순서가 곧 사번 순서 — 급여대장과 같은 방식)');
// ── 초과근로 표
const rows = [{ name: '정다애', hours: 3, amount: 30000 }, { name: '윤석원', hours: 2, amount: 20000 }, { name: '이한영', hours: 1, amount: 10000 }, { name: '외부인', hours: 1, amount: 5000 }];
const roster = [W('23002', '정다애'), W('23001', '윤석원'), W('26001', '이한영')];
ok(otSummary(rows, roster).names.join() === '윤석원,정다애,이한영,외부인', '★ 초과근로 표: 직원별 합계가 사번순(명부에 없는 이름은 맨 뒤)');
ok(otSummary(rows).names.join() === '외부인,윤석원,이한영,정다애' && otSummary(rows, []).names.join() === '외부인,윤석원,이한영,정다애', '근로자 명부를 넘기지 않으면 예전처럼 이름 가나다순(기존 호출이 깨지지 않는다)');
ok(otSummary(rows, roster).totalHours === 7 && otSummary(rows, roster).totalAmount === 65000 && otSummary([], roster).names.length === 0, '합계·빈 입력은 그대로');
// ── 내 평가 동료 목록
const names = { w1: '가나다', w2: '나다라', w3: '다라마', w4: '라마바' }; const orders = { w1: '26002', w2: '23001', w3: '22003', w4: '' };
const tl = tasksOf({ keys: ['2026__peer__w1', '2026__peer__w2', '2026__peer__w3', '2026__peer__w4', '2026__self__w1', '2026__lead__w2'] }, names, orders);
ok(tl.map((t) => t.key).join() === '2026__self__w1,2026__lead__w2,2026__peer__w3,2026__peer__w2,2026__peer__w1,2026__peer__w4', '★ 내 평가: 종류 순서(자기 → 팀원 → 동료)는 그대로, 같은 종류 안에서는 사번순(사번 없는 대상은 맨 뒤)');
ok(tasksOf({ keys: ['2026__peer__w1', '2026__peer__w2', '2026__peer__w3'] }, names).map((t) => t.target).join() === 'w1,w2,w3' && tasksOf({ keys: ['2026__peer__w2', '2026__peer__w1'] }, names, {}).map((t) => t.target).join() === 'w1,w2', '사번 정보가 없으면 이름순(예전 동작)');
// ── 적용 지점(소스) — 화면마다 사번순 비교를 쓰는지
const hr = src('modules/hr/index.js'), dir = src('modules/edoc/directory.js'), mio = src('modules/eval/mine-io.js'), ot = src('modules/hr/overtime.js'), hv = src('modules/hr/view.js');
ok(/import \{ sortByEmpNo, byEmpNo \} from '\.\.\/\.\.\/shared\/worker-order\.js/.test(hr) && /st\.workers = sortByEmpNo\(list\);/.test(hr) && /st\.workers\.sort\(byEmpNo\); await loadDocs\(\);/.test(hr) && /st\.rrWorkers = sortByEmpNo\(wl\);/.test(hr) && /st\.lpWorkers = lpTargets\(sortByEmpNo\(lst\(ws\)\)\);/.test(hr), '★ 인사: 근로자 명부 불러오기·연차 화면·퇴사원서·연차촉진 대상이 모두 사번순으로 정렬해서 불러온다');
ok(/users\.sort\(byEmpNo\);/.test(dir) && !/users\.sort\(\(a, b\) => a\.name\.localeCompare/.test(dir) && /import \{ byEmpNo \} from '\.\.\/\.\.\/shared\/worker-order\.js/.test(dir), '★ 전자결재 디렉터리(결재선·참조 고르는 직원 목록)가 사번순이다');
ok(/orders\[w\.id\] = w\.empNo \|\| ''/.test(mio) && /tasksOf\(taskDoc, names, orders\)/.test(mio), '내 평가: 근로자 명부의 사번을 과제 정렬에 넘긴다');
ok(/otSummary\(st\.otRows, st\.workers\)/.test(hv) && /byEmpNo\(\{ empNo: eo\[a\]/.test(ot), '초과근로 화면이 근로자 명부를 넘겨 사번순으로 보여 준다');
// ── 이미 사번순인 곳이 그대로인지(회귀)
const stl = src('modules/company/staff-logic.js'), ledg = src('modules/hr/ledger-io.js'), att = src('modules/attendance/index.js'), ivio = src('modules/eval/interview-io.js'), flt = src('modules/hr/logic.js');
ok(/sortStaff = \(users\) => \(users \|\| \[\]\)\.slice\(\)\.sort\(byEmpNo\)/.test(stl) && /empNo \|\| 'zzz'/.test(ledg) && /sortByEmpNo\(workers\.filter/.test(att) && /sortByEmpNo\(all\.filter/.test(ivio) && /\.sort\(\(a, b\) => String\(a\.empNo \|\| 'zzz'\)/.test(flt), '이미 사번순이던 곳(직원 관리·임금대장·출퇴근 관리자 목록·면담 목록·근로자 명부)이 그대로다');
// ── 일부러 바꾸지 않은 곳(이유가 있다)
const team = src('modules/pjt/team.js'), tlab = src('modules/plan/teamlabor.js');
ok(/const byName = /.test(team) && /const byName = /.test(tlab), '일부러 그대로: 연명부 팀 목록·팀 노무(외주 인력이 섞여 사번이 없다) — 이름순 유지');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
