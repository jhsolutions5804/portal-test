import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/plan/index.js', import.meta.url), 'utf8').match(/margin-link\.js\?v=([0-9a-z]+)/) || [])[1];
const S = await import('../app/modules/plan/settlement-doc.js?v=' + VER);
/* 정산서 자동 이름(대기열 1-2-10, 대표님 2026-10-22 "기준월, 거래처만 고르면 2026년 10월 다람이엔지 정산서 이런 느낌").
 * 정산서는 기준월과 거래처로 식별한다(프로젝트는 항목에만 있다). 화면 표시용 이름이며 PDF 저장 파일명(settleDocTitle, 대표님 확정 규칙)은 바꾸지 않는다.
 * 공개 저장소라 가짜 값만 쓴다. 기대값은 모두 손으로 적었다. */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => { const s = JSON.stringify(a) === JSON.stringify(b); ok(s, m + (s ? '' : ' ← 실제: ' + JSON.stringify(a) + ' / 기대: ' + JSON.stringify(b))); };
const N = (baseMonth, company) => S.settleName({ baseMonth, recipient: company === undefined ? undefined : { company } });
console.log('── 기준월 + 거래처 + 정산서');
eq(N('2026-10', '다람이엔지'), '2026년 10월 다람이엔지 정산서', '★ 기준월 2026-10 · 거래처 다람이엔지 → "2026년 10월 다람이엔지 정산서"(대표님이 말씀하신 형식)');
eq(N('2026-01', '가나다상사'), '2026년 1월 가나다상사 정산서', '★ 월의 앞 0 은 뗀다(01 → 1월)');
eq(N('2026-12', '라마바'), '2026년 12월 라마바 정산서', '12월은 그대로');
eq(N('2027-03', '사아자(주)'), '2027년 3월 사아자(주) 정산서', '다른 해·괄호가 있는 거래처 이름도 그대로');
eq(N('2026-10', '  다람이엔지 '), '2026년 10월 다람이엔지 정산서', '거래처 이름의 앞뒤 공백은 다듬는다');
eq(N('2026-10', '다람  이엔지'), '2026년 10월 다람  이엔지 정산서', '이름 가운데 공백은 건드리지 않는다(거래처 이름 그대로)');
console.log('── 없는 부분은 생략');
eq(N('2026-10', ''), '2026년 10월 정산서', '★ 거래처가 없으면 "2026년 10월 정산서"');
eq(N('2026-10', undefined), '2026년 10월 정산서', '수신자 정보 자체가 없어도 같다');
eq(N('2026-10', '   '), '2026년 10월 정산서', '공백뿐인 거래처 이름도 없는 것으로');
eq(N('', '다람이엔지'), '다람이엔지 정산서', '★ 기준월이 없으면 거래처만 "다람이엔지 정산서"');
eq(N(undefined, '다람이엔지'), '다람이엔지 정산서', '기준월이 undefined 여도 같다');
eq(N('2026-13', '다람이엔지'), '다람이엔지 정산서', '13월처럼 월이 올바르지 않으면 월 부분을 생략');
eq(N('2026-00', '다람이엔지'), '다람이엔지 정산서', '0월도 올바르지 않다');
eq(N('26-10', '다람이엔지'), '다람이엔지 정산서', '해가 네 자리가 아니면 생략');
eq(N('2026/10', '다람이엔지'), '다람이엔지 정산서', '형식이 다르면(슬래시) 생략');
eq(N('', ''), '정산서', '둘 다 없으면 "정산서"');
console.log('── 이상한 입력');
for (const bad of [null, undefined, 'x', 3, [], {}]) { let r, threw = false; try { r = S.settleName(bad); } catch (e) { threw = true; } ok(!threw && r === '정산서', '정산서 값이 이상해도(' + JSON.stringify(bad) + ') 던지지 않고 "정산서"');  }
eq(S.settleName({ baseMonth: 202610, recipient: { company: '다람이엔지' } }), '다람이엔지 정산서', '기준월이 글자가 아니면(숫자) 월 부분을 생략');
eq(S.settleName({ baseMonth: '2026-10', recipient: { company: 7 } }), '2026년 10월 정산서', '거래처 이름이 글자가 아니면(7) 생략');
eq(S.settleName({ baseMonth: '2026-10', recipient: { company: { x: 1 } } }), '2026년 10월 정산서', '거래처 이름이 객체여도 생략');
eq(S.settleName({ baseMonth: '2026-10', recipient: 'x' }), '2026년 10월 정산서', '수신자가 글자여도 생략');
eq(S.settleName({ baseMonth: '2026-10', recipient: null }), '2026년 10월 정산서', '수신자가 null 이어도 생략');
{ const s = { baseMonth: '2026-10', recipient: { company: '다람이엔지' } }; const sn = JSON.stringify(s); S.settleName(s); ok(JSON.stringify(s) === sn, '정산서 값을 바꾸지 않는다'); }
console.log('── 청구서·지급예정서 공통(이름은 기준월과 거래처로만 정한다)');
eq(S.settleName({ docType: 'invoice', baseMonth: '2026-10', recipient: { company: '다람이엔지' } }), S.settleName({ docType: 'payment', baseMonth: '2026-10', recipient: { company: '다람이엔지' } }), '문서 종류가 달라도 이름은 같다(종류는 화면의 기존 라벨이 구분한다)');
console.log('── PDF 파일명은 그대로(대표님 확정 규칙)');
ok(typeof S.settleDocTitle === 'function' && /대금청구서/.test(S.settleDocTitle({ docType: 'invoice', pjtId: 'p1', no: '2026-0001', recipient: { company: '다람이엔지' }, issueDate: '2026-10-22' }, [{ id: 'p1', code: 'A1' }])), '★ settleDocTitle(PDF 저장 기본 이름)은 기존 규칙 그대로 — 이름 함수를 추가해도 파일명 규칙은 건드리지 않는다');
ok(pass + fail >= 30, '★ 시험이 끝까지 실행됨(중간에 예외로 중단돼도 FAIL 0 으로 보이지 않게)');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
