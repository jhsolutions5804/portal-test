// 견적 산식 표의 셀 수식 계산기 시험 — 가짜 숫자만 쓴다. 계산기: app/modules/plan/formula.js (eval 을 쓰지 않는 직접 만든 해석기)
// 셀 규칙: 비어 있으면 "빈 칸", 숫자(쉼표 허용)면 그 값, "=" 로 시작하면 수식(숫자 · + - × ÷ * / · 괄호 · %). 그 밖의 글자는 오류.
import { evalCell } from '../app/modules/plan/formula.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const v = (t) => { const r = evalCell(t); return r.ok && !r.empty ? r.value : r; };
const near = (a, b) => typeof a === 'number' && Math.abs(a - b) < 1e-9;
const bad = (t) => { const r = evalCell(t); return r.ok === false && typeof r.error === 'string' && r.error.length > 0; };

console.log('── 빈 칸·숫자');
ok(evalCell('').ok === true && evalCell('').empty === true && evalCell('   ').empty === true && evalCell(null).empty === true && evalCell(undefined).empty === true, '★ 빈 칸(빈 문자·공백·null·undefined)은 오류가 아니라 "빈 칸"');
ok(near(v('12'), 12) && near(v('0'), 0) && near(v('3.5'), 3.5) && near(v('.5'), 0.5) && near(v('-4'), -4), '숫자: 12 · 0 · 3.5 · .5 · -4');
ok(near(v('1,250'), 1250) && near(v('1,234,567'), 1234567) && near(v(' 7 '), 7), '쉼표(천 단위)와 앞뒤 공백을 읽음');
ok(near(v(7777), 7777) && near(v(2.5), 2.5), '숫자 타입 값도 받음(저장된 옛 데이터 호환)');

console.log('── 수식 기본');
ok(near(v('=1+2'), 3) && near(v('=5-2'), 3) && near(v('=4*3'), 12) && near(v('=12/4'), 3), '+ − * / 네 가지');
ok(near(v('=4×3'), 12) && near(v('=12÷4'), 3), '× ÷ 기호도 읽음(엑셀 대신 손으로 쓸 때)');
ok(near(v('=2+3*4'), 14) && near(v('=(2+3)*4'), 20) && near(v('=10-4-3'), 3) && near(v('=100/10/5'), 2), '★ 곱셈·나눗셈이 먼저, 같은 순위는 왼쪽부터, 괄호가 우선');
ok(near(v('=-3+5'), 2) && near(v('=+3'), 3) && near(v('=2*-3'), -6) && near(v('=-(2+3)'), -5) && near(v('=--4'), 4), '단항 부호(-3, +3, 2*-3, -(2+3), --4)');
ok(near(v('= 10 * 2.5 * 1.1'), 27.5) && near(v('=10*2.5*1.1'), 27.5), '★ 엑셀 시트에 있던 형태(=10*2.5*1.1)와 공백 포함 형태가 같은 값');
ok(near(v('=\n1'), 1) && near(v('=1 +\t2'), 3) && near(v('= ( 1 + 2 ) * 3 '), 9), '공백·탭·줄바꿈은 무시하고 읽음(한 줄 입력칸에 붙여넣은 글자 대비) — 주입이 아니라 공백이므로 거부하지 않음');
ok(near(v('=1+3+4*2*1.5+2'), 18), '여러 항목을 이어 쓴 식(=1+3+4*2*1.5+2 = 18)');
ok(near(v('=1,000*2'), 2000) && near(v('=1,000+250'), 1250), '식 안의 숫자에도 쉼표 허용');
ok(near(v('=10%'), 0.1) && near(v('=50%*200'), 100) && near(v('=200*10%'), 20), '퍼센트(10% = 0.1)');
ok(near(v('=((1+2)*(3+4))'), 21) && near(v('=(((5)))'), 5), '괄호 겹침');

console.log('── 부동소수점(0.1 + 0.2 같은 값이 지저분하게 나오지 않음)');
ok(v('=0.1+0.2') === 0.3, '★ 0.1+0.2 = 0.3 (0.30000000000000004 가 아님)');
ok(v('=25000*1.1') === 27500, '25000*1.1 = 27500 (27500.000000000004 가 아님)');
ok(v('=3*1.1') === 3.3 && v('=1.15*100') === 115, '3*1.1 = 3.3 · 1.15*100 = 115');
ok(v('=1/3') !== undefined && Math.abs(v('=1/3') - 1 / 3) < 1e-6, '나눠떨어지지 않는 값(1/3)은 소수점 6자리 근처까지 유지');

console.log('── 오류(이유 문구가 있어야 함)');
ok(bad('=1/0') && /0/.test(evalCell('=1/0').error), '★ 0 으로 나누면 오류(무한대가 견적에 들어가지 않음)');
ok(bad('=5/(2-2)'), '식 안에서 0 이 되는 분모도 오류');
for (const t of ['=1+', '=*3', '=', '=()', '=+', '=1+*2', '=(+)', '=/2']) ok(bad(t), '불완전한 식은 오류: ' + JSON.stringify(t));
ok(near(v('=1++1'), 2) && near(v('=1--1'), 2), '"=1++1"·"=1--1" 은 단항 부호라 오류가 아님(엑셀과 같음)');
ok(bad('=(1+2') && bad('=1+2)') && bad('=((1)'), '★ 괄호가 안 맞으면 오류');
ok(bad('abc') && bad('12abc') && bad('1 2') && bad('1.2.3') && bad('--') && bad('1e5'), '★ 숫자가 아닌 글자는 오류(등호 없이 식을 쓰면 오류: 수식은 = 로 시작)');
ok(bad('1+2'), '등호 없이 쓴 식(1+2)은 오류 — 엑셀과 같이 수식은 = 로 시작');
for (const t of ['1,5', '12,34', ',5', '1,', '1,,2', '1,2345', '=1,5+1', '=12,34', '=,5']) ok(bad(t), '★ 천 단위가 아닌 쉼표는 오류(소수점을 쉼표로 쓴 실수를 15 로 읽지 않음): ' + JSON.stringify(t));
ok(near(v('1,250.5'), 1250.5) && near(v('=1,250.5*2'), 2501), '천 단위 쉼표 + 소수점은 허용');
ok(bad('=a+1') && bad('=A1+1') && bad('=2**3') && bad('=1^'), '이름만 있는 글자(=a+1)·표 없이 쓴 칸 참조(=A1+1)·**·끝이 빈 ^ 는 오류');

console.log('── 코드 주입·한도');
for (const evil of ['=alert(1)', '=constructor', '=this', '=(()=>1)()', '=__proto__', '=1;2', '=`1`', "='1'", '=1//2', '=Math.PI', '=eval(1)', '=process.exit()', '=1)+(2']) ok(bad(evil), '주입 시도 거부: ' + JSON.stringify(evil));
ok(bad('=' + '1+'.repeat(200) + '1'), '★ 너무 긴 식(120자 초과)은 거부');
ok(bad('=' + '('.repeat(30) + '1' + ')'.repeat(30)), '★ 괄호를 너무 깊게(20단계 초과) 겹치면 거부(재귀가 끝없이 가지 않음)');
ok(near(v('=' + '('.repeat(15) + '1' + ')'.repeat(15)), 1), '괄호 15단계는 허용');
ok(bad('=99999999999*99999999999'), '★ 결과가 1e13 한도를 넘으면 거부(견적 저장 규칙과 같은 한도)');
ok(bad('=' + '9'.repeat(20)) && bad('9'.repeat(20)), '숫자 자체가 한도를 넘어도 거부');
ok(bad(NaN) && bad(Infinity) && bad({}) && bad([]) && bad(true), '문자·숫자가 아닌 값(NaN·Infinity·객체·배열·true)은 오류');
const t0 = Date.now(); evalCell('=' + '(1+'.repeat(19) + '1' + ')'.repeat(19)); ok(Date.now() - t0 < 200, '깊은 식도 즉시 끝남(지수적으로 느려지지 않음)');

console.log('── 보이지 않는 문자·다른 글자 체계(붙여넣기로 섞여 금액을 조용히 바꾸지 않게)');
for (const t of ['=1\u00a0+2', '=1\u200b+2', '=1\u3000+2', '=１+２', '=١+٢', '=1＋2', '=1－2', '=2＊3', '=1\ufeff+2']) ok(bad(t), '★ 허용 문자 밖의 글자는 거부: ' + JSON.stringify(t));
for (const t of ['\u00a01000', '1000\u00a0', '\ufeff1000', '1000\u200b', '\u3000=1+2']) ok(bad(t), '★ 숫자 셀 앞뒤의 보이지 않는 문자도 조용히 지우지 않고 거부: ' + JSON.stringify(t));
ok(bad(1e20) && bad(-1e20) && bad(1e13 + 1) && near(v(1e13), 1e13), '★ 숫자 타입도 한도 검사(1e13 초과 거부, 1e13 자체는 허용)');
console.log('── 숫자 표현');
ok(evalCell('=1+1').ok === true && evalCell('=1+1').empty !== true, '수식 결과에는 empty 표시가 없음');
ok(typeof evalCell('=2*3').value === 'number' && Number.isFinite(evalCell('=2*3').value), '값은 유한한 숫자');

console.log('── 칸 참조·범위·함수(표 안에서: 열 A~F, 행 번호는 표의 번호)');
const grid = { C1: 2, D1: 7000, E1: 14000, C2: 1.1 };
const ctx = { cols: 'ABCDEF', rowCount: 3, get: (c, r) => ('ABF'.includes(c) ? { ok: true, text: true } : { ok: true, value: grid[c + r] === undefined ? 0 : grid[c + r] }) };
const cv = (t) => { const r = evalCell(t, ctx); return r.ok && !r.empty ? r.value : r; };
const cbad = (t) => { const r = evalCell(t, ctx); return r.ok === false && typeof r.error === 'string' && r.error.length > 0; };
const close = (a, b) => typeof a === 'number' && Math.abs(a - b) < 1e-6;
ok(near(cv('=e1*c2'), 15400) && near(cv('=E1*C2'), 15400) && near(cv('= e1 * c2 '), 15400), '★ =e1*c2 (E1 = 1행 합계 × C2 = 2행 수량) — 대소문자·공백 무관');
ok(near(cv('=E1+D1'), 21000) && near(cv('=C1*D1'), 14000) && near(cv('=(e1+d1)*c1'), 42000), '칸끼리 계산·괄호');
ok(near(cv('=C3+5'), 5) && near(cv('=D3'), 0), '★ 아직 안 쓴 행의 빈 칸은 0 (엑셀과 같음)');
ok(near(cv('=SUM(C1:E1)'), 21002) && near(cv('=SUM(E1:E3)'), 14000) && near(cv('=sum(e1,c2,3)'), 14004.1), '★ SUM — 범위(C1:E1)·여러 인수·소문자');
ok(near(cv('=SUM(E1:E50)'), 14000), '범위가 표 끝을 넘으면 있는 행까지만(합계 행이 나중에 늘어나는 행을 포함할 수 있게)');
ok(near(cv('=SUM(A1:E1)'), 21002), '범위 안의 글자 칸(A·B 열)은 엑셀처럼 건너뜀');
ok(near(cv('=AVERAGE(C1:C2)'), 1.55) && near(cv('=MIN(C1:C2)'), 1.1) && near(cv('=MAX(c1:c2)'), 2), 'AVERAGE·MIN·MAX');
ok(near(cv('=ROUND(2.345,2)'), 2.35) && near(cv('=ROUND(-2.345,2)'), -2.35) && near(cv('=ROUND(1234.5,-2)'), 1200) && near(cv('=ROUND(e1*1.07,-2)'), 15000), '★ ROUND — 0.5 는 올림(0 에서 먼 쪽), 자릿수가 음수면 백 단위');
ok(near(cv('=ROUNDDOWN(1999.99,0)'), 1999) && near(cv('=ROUNDDOWN(-1.99,0)'), -1) && near(cv('=ROUNDUP(1.001,2)'), 1.01) && near(cv('=ROUNDUP(-1.001,2)'), -1.01) && near(cv('=ROUNDUP(1.01,2)'), 1.01), 'ROUNDDOWN(0 쪽으로)·ROUNDUP(0 에서 먼 쪽으로) — 1.01 처럼 이미 딱 맞는 값은 올리지 않음');
ok(near(cv('=ABS(-3.5)'), 3.5) && near(cv('=ABS(e1-c1*d1*2)'), 14000), 'ABS');
ok(near(cv('=1^2'), 1) && near(cv('=2^3'), 8) && near(cv('=2^3^2'), 64) && near(cv('=-2^2'), 4) && near(cv('=2^-1'), 0.5) && close(cv('=2^0.5'), 1.414214), '★ ^ 는 엑셀과 같이 왼쪽부터(2^3^2 = 64), 앞의 마이너스가 먼저(-2^2 = 4)');
ok(near(cv('=1,000*2'), 2000) && near(cv('=SUM(1,234)'), 235) && near(cv('=SUM(1,234,5)'), 240), '★ 함수 밖에서는 천 단위 쉼표(1,000), 함수 안에서는 쉼표가 인수 구분');
ok(near(cv('=ABS(ABS(ABS(-2)))'), 2) && near(cv('=SUM(ABS(-1),SUM(2,3))'), 6), '함수 안의 함수');
for (const t of ['=A1', '=B1+1', '=F2']) ok(cbad(t) && /글자/.test(evalCell(t, ctx).error), '★ 글자 칸(내역·단위·비고)을 계산에 쓰면 오류: ' + t);
for (const t of ['=G1', '=E4', '=E0', '=E100', '=E1E2', '=SUM1', '=SUM(E1:)', '=SUM(:E1)', '=E1:E2', '=SUM(E1:E2:E3)', '=FOO(1)', '=SUM()', '=SUM(1,)', '=SUM(,1)', '=ROUND(1)', '=ROUND(1,2,3)', '=ROUND(E1:E2,1)', '=ROUND(1,1.5)', '=ABS()', '=ABS(1,2)', '=AVERAGE(E5:E6)', '=MIN(F1:F2)', '=1+', '=SUM(1', '=SUM(1))', '=0^-1', '=(-8)^0.5', '=E1(2)']) ok(cbad(t), '잘못된 칸·범위·함수는 오류: ' + t);
ok(/행/.test(evalCell('=E4', ctx).error) && /열/.test(evalCell('=G1', ctx).error), '오류 문구에 무엇이 틀렸는지(행이 없음 · 열이 없음)가 보임');
ok(bad('=A1') && bad('=SUM(E1:E2)') && near(evalCell('=SUM(1,2)').value, 3) && near(evalCell('=ROUND(2.5,0)').value, 3), '표 없이(칸 참조 불가)도 숫자만 쓴 함수는 계산됨, 칸 참조는 "표 안에서만" 오류');
ok(/표 안/.test(evalCell('=E1').error), '표 밖에서 칸을 쓰면 "표 안에서만" 이라고 알림');
const badCtx = { cols: 'ABCDEF', rowCount: 3, get: (c, r) => ({ ok: false, error: 'E1 칸에 오류: 가짜 이유' }) };
ok(evalCell('=E1+1', badCtx).ok === false && /가짜 이유/.test(evalCell('=E1+1', badCtx).error) && evalCell('=SUM(E1:E2)', badCtx).ok === false, '★ 참조한 칸에 오류가 있으면 그 이유가 이어져 나옴(범위 안에서도)');
for (const t of ['=#REF!', '=#REF!*2', '=SUM(#REF!)']) ok(cbad(t) && /삭제/.test(evalCell(t, ctx).error), '★ 지운 행을 가리키던 수식(#REF!)은 "삭제" 오류: ' + t);
ok(cbad('=#') && cbad('=E1!') && cbad('=#REF') && cbad('=!'), '#·! 가 엉뚱하게 쓰이면 오류');
ok(cbad('=' + 'ABS('.repeat(21) + '1' + ')'.repeat(21)) && near(cv('=' + 'ABS('.repeat(15) + '1' + ')'.repeat(15)), 1), '함수를 21단계 겹치면 거부, 15단계는 허용');
for (const t of ['=1e5', '=SUM(1e5)', '=E1e5']) ok(cbad(t), '지수 표기는 읽지 않음: ' + t);
ok(near(cv('=E1*C2'), cv('=e1*c2')) && cv('=Sum(E1:E1)') === 14000, '함수 이름도 대소문자 무관');
ok(pass + fail >= 75, '★ 시험 전체가 끝까지 실행됨(' + (pass + fail) + '건 ≥ 75) — 중간에 예외로 죽어 뒤쪽 시험이 안 도는 일 방지');
console.log('\n' + (fail ? '실패 ' + fail + '건 / 통과 ' + pass : '전부 통과 (' + pass + '건)')); process.exit(fail ? 1 : 0);
