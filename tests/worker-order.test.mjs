// 직원 목록 사번순 정렬 시험 — shared/worker-order.js (2026-11-04 대표님 「직원 배치는 무조건 사번 순으로」)
import { sortByEmpNo, empNoOf } from '../app/shared/worker-order.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const prod = [{ id: 'a', empNo: '26005', name: '이민정' }, { id: 'b', empNo: '22003', name: '김민서' }, { id: 'c', empNo: '99999', name: 'test' }, { id: 'd', empNo: '00000', name: '송지훈' }, { id: 'e', empNo: '23002', name: '정다애' }, { id: 'f', empNo: '22001', name: '김종화' }, { id: 'g', empNo: '26001', name: '이한영' }, { id: 'h', empNo: '22002', name: '김영희' }, { id: 'i', empNo: '23001', name: '윤석원' }, { id: 'j', empNo: '26002', name: '김영서' }, { id: 'k', empNo: '26003', name: '형일우' }, { id: 'l', empNo: '26006', name: '김현경' }];
const prodOrig = prod.map((w) => w.id).join(); // 정렬 호출 전의 원래 순서(원본이 바뀌었는지 확인하는 기준)
ok(sortByEmpNo(prod).map((w) => w.name).join(',') === '송지훈,김종화,김영희,김민서,윤석원,정다애,이한영,김영서,형일우,이민정,김현경,test', '★ 본섭 직원 12명: 사번순(00000 송지훈 → 22001 김종화 → … → 26006 김현경 → 99999 test) — 이름순이 아니다');
ok(sortByEmpNo(prod).map((w) => w.name).join(',') !== [...prod].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((w) => w.name).join(','), '이름순(옛 방식)과는 결과가 다르다');
sortByEmpNo(prod); ok(prod.map((w) => w.id).join() === prodOrig && prodOrig === 'a,b,c,d,e,f,g,h,i,j,k,l', '★ 원본 배열은 바꾸지 않는다(여러 번 정렬해도 처음 순서 그대로)');
const mixed = [{ name: '사번없음B' }, { empNo: '22001', name: '김종화' }, { empNo: '', name: '사번없음A' }, { empNo: null, name: '사번없음C' }, { empNo: '00000', name: '송지훈' }];
ok(sortByEmpNo(mixed).map((w) => w.name).join(',') === '송지훈,김종화,사번없음A,사번없음B,사번없음C', '★ 사번이 없는(빈 값·null·없음) 사람은 맨 뒤, 그 안에서는 이름순');
ok(sortByEmpNo([{ empNo: '22001', name: '나' }, { empNo: '22001', name: '가' }]).map((w) => w.name).join() === '가,나', '같은 사번이면 이름순');
ok(sortByEmpNo([{ empNo: ' 22002 ', name: 'b' }, { empNo: '22001', name: 'a' }]).map((w) => w.name).join() === 'a,b' && empNoOf({ empNo: ' 7 ' }) === '7' && empNoOf(null) === '' && empNoOf({ empNo: 5 }) === '5', '사번 앞뒤 공백은 무시, 숫자 사번도 문자열로 처리');
ok(sortByEmpNo(null).length === 0 && sortByEmpNo(undefined).length === 0 && sortByEmpNo([]).length === 0, '목록이 없어도 오류 없이 빈 배열');
const t = [{ empNo: 'T90001', name: '[테스트]직원' }, { empNo: '99999', name: 'test' }, { empNo: '2603', name: '형일우' }, { empNo: '26005', name: '이민정' }]; ok(sortByEmpNo(t).map((w) => w.empNo).join() === '26005,2603,99999,T90001', '테섭처럼 자리수가 다른 사번이 섞여도 문자열 비교로 일정하게(숫자 사번 → 영문 사번 순)');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
