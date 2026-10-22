import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/plan/index.js', import.meta.url), 'utf8').match(/margin-link\.js\?v=([0-9a-z]+)/) || [])[1];
const S = await import('../app/shared/csv.js?v=' + VER);
const CL = await import('../app/modules/plan/closing.js?v=' + VER);
/* 표 파일(CSV) 공용 안전 함수 — 엑셀이 열 때 수식으로 실행하는 값(CSV 수식 주입)을 막는다(대기열 1-2-8 5단계, 대표님 2026-10-22 "계속").
 * 월 마감 CSV(closingCsv)는 세무사·회계에 전달하는 파일인데 프로젝트 코드·거래처 이름 같은 사용자 입력이 따옴표로 감싸기만 하고 그대로 나가 =HYPERLINK(…)·=cmd|… 가 받는 사람의 엑셀에서 실행될 수 있었다(실제 재현, 시험도 없었음).
 * 규칙: 글자가 = + - @ 탭 CR LF 로 시작하면 앞에 작은따옴표를 붙여 글자로 읽히게 한다(OWASP). 숫자(음수 포함)는 숫자라 그대로 — 음수 마진율 -53.2 에 따옴표를 붙이면 엑셀이 글자로 읽어 합계가 깨진다. 모든 값은 기존처럼 큰따옴표로 감싼다(기존 출력 호환).
 * 공개 저장소라 가짜 값만 쓴다. 기대값은 모두 손으로 적었다. */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => ok(Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b), m + (Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b) ? '' : ' ← 실제: ' + JSON.stringify(a) + ' / 기대: ' + JSON.stringify(b)));
console.log('── csvCell: 수식 주입 방지');
for (const [v, want] of [['=1+1', '"\'=1+1"'], ['+1+1', '"\'+1+1"'], ['-2+3', '"\'-2+3"'], ['@SUM(1)', '"\'@SUM(1)"'], ['\t=1', '"\'\t=1"'], ['\r=1', '"\'\r=1"'], ['\n=1', '"\'\n=1"'], ['=HYPERLINK("http://x","a")', '"\'=HYPERLINK(""http://x"",""a"")"'], ['=cmd|\' /C calc\'!A0', '"\'=cmd|\' /C calc\'!A0"'], ['-', '"\'-"'], ['=', '"\'="']]) eq(S.csvCell(v), want, '★ 글자 ' + JSON.stringify(v) + ' 는 앞에 작은따옴표를 붙여 글자로 읽히게 한다');
for (const v of ['A=1', 'a+b', '가-나', 'x@y.com', ' =1', '1=1', '프로젝트-1', '(=1)', '"=1"', "'=1"]) eq(S.csvCell(v), '"' + v.replace(/"/g, '""') + '"', '수식 시작이 아닌 글자 ' + JSON.stringify(v) + ' 는 그대로(큰따옴표 감쌈만) — 공백이 앞에 있으면 엑셀도 수식으로 안 본다');
console.log('── 숫자는 숫자로 둔다(음수 포함)');
for (const [v, want] of [[0, '"0"'], [1500, '"1500"'], [-53.2, '"-53.2"'], [-2000, '"-2000"'], [81.3, '"81.3"'], [1e21, '"1e+21"'], [-0, '"0"']]) eq(S.csvCell(v), want, '★ 숫자 ' + String(v) + ' 는 작은따옴표 없이 그대로 — 음수 마진율에 작은따옴표를 붙이면 엑셀이 글자로 읽어 합계가 깨진다');
eq(S.csvCell('-53.2'), '"\'-53.2"', '글자 "-53.2" 는 글자라 보호한다(숫자는 숫자로 넘겨야 한다)');
console.log('── 안전한 빈 칸');
for (const v of [null, undefined, NaN, Infinity, -Infinity]) eq(S.csvCell(v), '""', '★ ' + String(v) + ' 는 빈 칸이다(엑셀에 NaN·Infinity·undefined 글자가 나가지 않는다)');
for (const v of [{}, [], { a: 1 }, [1, 2], () => 1, Symbol('x')]) ok(!/object Object|function|Symbol/.test(S.csvCell(v)), '객체·배열·함수·심볼(' + typeof v + ')은 [object Object] 같은 글자가 나가지 않는다: ' + S.csvCell(v));
eq(S.csvCell(true), '"true"', '불리언은 글자로'); eq(S.csvCell(false), '"false"', 'false 도');
console.log('── 따옴표·쉼표·줄바꿈');
eq(S.csvCell('a"b'), '"a""b"', '★ 큰따옴표는 두 개로'); eq(S.csvCell('a,b'), '"a,b"', '쉼표 포함은 감싼다'); eq(S.csvCell('a\nb'), '"a\nb"', '줄바꿈 포함(앞이 아님)은 그대로 감싼다'); eq(S.csvCell(''), '""', '빈 글자'); eq(S.csvCell('가나다 ABC 123'), '"가나다 ABC 123"', '한글·공백');
console.log('── csvText');
eq(S.csvText([['a', 1], ['=x', -2]]), '\ufeff"a","1"\r\n"\'=x","-2"\r\n', '★ BOM + 행을 CRLF 로 + 끝에 CRLF, 수식은 보호·음수는 그대로');
eq(S.csvText([]), '\ufeff\r\n', '행이 없으면 BOM 과 줄바꿈뿐'); for (const bad of [null, undefined, 'x', 3, {}]) { let r, threw = false; try { r = S.csvText(bad); } catch (e) { threw = true; } ok(!threw && typeof r === 'string' && r.startsWith('\ufeff'), '이상한 입력(' + JSON.stringify(bad) + ')에도 던지지 않는다'); }
{ let r, threw = false; try { r = S.csvText([null, 3, 'x', ['ok'], [null, undefined]]); } catch (e) { threw = true; } ok(!threw && r.includes('"ok"'), '행이 배열이 아니어도(null·숫자·글자) 던지지 않고 정상 행은 낸다'); }
{ const rows = [['a', 'b']]; const sn = JSON.stringify(rows); S.csvText(rows); ok(JSON.stringify(rows) === sn, '입력을 바꾸지 않는다'); }
console.log('── 기존 월 마감 CSV(closingCsv)는 정상 값에서 출력이 바뀌지 않고 수식 시작 값만 보호된다');
{ const P = [{ id: 'p1', code: 'P4-2' }, { id: 'p2', code: '=HYPERLINK("http://x","a")' }, { id: 'p3', code: '+1+1' }]; const base = (code, comp) => ({ no: 'S1', docType: 'invoice', pjtId: 'p1', issueDate: '2026-09-01', supply: 1000, vat: 100, total: 1100, recipient: { company: comp || '가짜상사' } });
  const csv = CL.closingCsv('2026-09', P, [base()]); eq(csv.split('\r\n')[1], '"S1","대금청구서","유효","P4-2","가짜상사","","2026-09-01","","1000","100","1100",""', '★ 정상 값의 월 마감 행은 한 글자도 안 바뀐다(숫자도 기존처럼 따옴표로 감싼 "1000")');
  const evil = CL.closingCsv('2026-09', P, [Object.assign(base('', '=1+1'), { pjtId: 'p2' }), Object.assign(base(), { no: 'S2', pjtId: 'p3', recipient: { company: '@SUM(1)' } })]).split('\r\n'); ok(evil[1].includes('"\'=HYPERLINK(""http://x"",""a"")"') && evil[1].includes('"\'=1+1"'), '★ 프로젝트 코드·거래처 이름이 = 로 시작하면 월 마감 CSV 에서도 작은따옴표로 보호된다: ' + evil[1].slice(0, 120)); ok(evil[2].includes('"\'+1+1"') && evil[2].includes('"\'@SUM(1)"'), '+·@ 시작도 보호된다');
  ok(!evil.slice(1, 3).some((l) => /(^|,)"[=+@-]/.test(l.replace(/"\d+"/g, '""')) && /(^|,)"[=+@]/.test(l)), '어떤 셀도 큰따옴표 바로 뒤가 = + @ 로 시작하지 않는다(수식으로 실행될 셀이 없다)'); }
ok(pass + fail >= 60, '★ 시험이 끝까지 실행됨(중간에 예외로 중단돼도 FAIL 0 으로 보이지 않게)');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
