import { docFileName, safeText } from '../app/shared/doc-filename.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => ok(a === b, m + (a === b ? '' : '  ← 실제: "' + a + '" / 기대: "' + b + '"'));

// ── 문서군별 순서
eq(docFileName({ group: 'project', project: 'P4 Ph2', kind: '견적서', no: 'EST-2026-001', party: '다람이엔지', date: '2026-05-10' }), 'P4 Ph2 - 견적서 - EST-2026-001 - 다람이엔지 - 2026-05-10', '프로젝트 문서: 프로젝트 → 종류 → 번호 → 상대방 → 날짜');
eq(docFileName({ kind: '대금청구서', project: 'H17L', no: '2609001', party: 'A사', date: '2026-09-30' }), 'H17L - 대금청구서 - 2609001 - A사 - 2026-09-30', '그룹을 안 주면 프로젝트 문서로 처리');
eq(docFileName({ group: 'month', ym: '2026-09', kind: '월말 마감' }), '2026-09 월말 마감', '월 단위 문서: 연월 → 종류');
eq(docFileName({ group: 'month', ym: '2026-09', kind: '월간 보고서', project: 'P4 Ph2' }), '2026-09 월간 보고서 - P4 Ph2', '월 단위 문서에 프로젝트가 있으면 뒤에 붙임');
eq(docFileName({ group: 'person', kind: '근로계약서', name: '홍길동', date: '2026-10-26' }), '근로계약서 - 홍길동 - 2026-10-26', '인사 직원 문서: 종류 → 이름 → 기준일');
eq(docFileName({ group: 'person', ym: '2026-06', kind: '급여명세서', name: '홍길동' }), '2026-06 급여명세서 - 홍길동', '급여명세서는 연월을 앞에(확정된 예시와 같은 모양)');
eq(docFileName({ group: 'edoc', kind: '구매품의', docNo: '2610001', author: '김작성', date: '2026-10-01' }), '구매품의 - 2610001 - 김작성 - 2026-10-01', '전자결재: 종류 → 문서번호 → 작성자 → 날짜');

// ── 없는 칸은 건너뜀(빈 구분자·"undefined" 금지)
eq(docFileName({ group: 'project', kind: '견적서', no: 'E1' }), '견적서 - E1', '프로젝트·상대방·날짜가 없으면 건너뜀');
eq(docFileName({ group: 'project', project: null, kind: '계약서', no: undefined, party: '', date: 'x' }), '계약서', '모두 비어 있어도 종류만 남음(날짜 형식이 아니면 버림)');
ok(!/undefined|null|NaN/.test(docFileName({ project: undefined, kind: '견적서', no: null })), '"undefined"·"null" 글자가 파일 이름에 들어가지 않음');
eq(docFileName({}), '문서', '아무것도 없으면 "문서"');
eq(docFileName(), '문서', '인자 자체가 없어도 오류 없이 "문서"');

// ── 날짜·번호가 민감정보 필터에 잘못 지워지지 않음(번호·날짜는 필터를 거치지 않는 구조화 칸)
eq(docFileName({ project: 'P', kind: '견적서', no: 'EST-2026-001', date: '2026-05-10' }), 'P - 견적서 - EST-2026-001 - 2026-05-10', '날짜·견적 번호 보존');
eq(docFileName({ project: 'P', kind: '정산서', no: '2610003', date: '2026-10-13T09:00:00.000Z' }), 'P - 정산서 - 2610003 - 2026-10-13', 'ISO 날짜는 YYYY-MM-DD 로 줄임');
eq(docFileName({ project: 'P', kind: '정산서', no: '2026/10:003', date: '2026-10-13' }), 'P - 정산서 - 202610003 - 2026-10-13', '번호의 / : 같은 금지 문자는 제거');

// ── 민감정보 강제 필터(자유 입력 칸)
eq(safeText('홍길동 900101-1234567'), '홍길동', '주민등록번호 제거');
eq(safeText('홍길동 9001011234567'), '홍길동', '하이픈 없는 주민등록번호(13자리)도 제거');
eq(safeText('박대리 010-1234-5678'), '박대리', '휴대폰 번호 제거');
eq(safeText('박대리 031-123-4567'), '박대리', '일반 전화번호 제거');
eq(safeText('국민 464402-04-030474 홍길동'), '국민 홍길동', '하이픈 계좌번호 제거');
eq(safeText('품의 1,200,000원 건'), '품의 건', '쉼표 금액 + 원 제거');
eq(safeText('공사 5000원'), '공사', '쉼표 없는 금액 + 원 제거');
eq(safeText('견적 ₩3,500,000'), '견적', '₩ 금액 제거');
eq(safeText('공사 12,000'), '공사', '천 단위 쉼표 숫자 제거');
eq(safeText('P4 Ph2 (FAB동) FCU'), 'P4 Ph2 (FAB동) FCU', '프로젝트 이름의 일반 글자·괄호·영문숫자는 그대로');
eq(safeText('H17L Gas RM. 전환공사'), 'H17L Gas RM. 전환공사', '점·공백이 든 프로젝트 이름 보존');
eq(safeText('청주 P&T3'), '청주 P&T3', '& 문자는 파일 이름에 써도 되므로 보존');
ok(!/\d{6}-?\d{7}/.test(docFileName({ group: 'person', kind: '근로계약서', name: '홍길동 900101-1234567', date: '2026-10-26' })), '문서 파일 이름 어디에도 주민번호 모양이 남지 않음(person 그룹)');
ok(!/010/.test(docFileName({ project: 'P', kind: '정산서', party: '다람 010-1111-2222' })), '문서 파일 이름 어디에도 전화번호가 남지 않음(상대방 칸)');
ok(!/원/.test(docFileName({ project: '공사 3,000,000원', kind: '견적서' })), '문서 파일 이름 어디에도 금액이 남지 않음(프로젝트 칸)');

// ── 금지 문자·공백·길이
eq(safeText('a/b\\c:d*e?f"g<h>i|j'), 'a b c d e f g h i j', '파일 이름 금지 문자 9가지를 공백으로');
eq(safeText('  앞뒤   공백\t\n많음  '), '앞뒤 공백 많음', '공백 정리');
eq(safeText('...점으로 시작.'), '점으로 시작', '앞뒤 점·하이픈 제거(윈도우 파일 이름 오류 방지)');
eq(safeText('가'.repeat(100)).length, 40, '자유 입력 한 칸은 40자 이내');
const long = docFileName({ project: '가'.repeat(60), kind: '견적서', no: 'EST-2026-001', party: '나'.repeat(60), date: '2026-05-10' });
ok(long.length <= 120, '전체 120자 이내 (실제 ' + long.length + '자)');
ok(long.includes('EST-2026-001') && long.endsWith('2026-05-10'), '길 때는 이름 칸을 줄이고 번호·날짜는 살림');
ok(safeText('가'.normalize('NFD')) === '가'.normalize('NFC'), '한글 자모 분리(맥 파일 이름)를 합쳐 줌');
eq(docFileName({ group: 'month', ym: '2026-13-99x', kind: '월말 마감' }), '2026-13 월말 마감', '연월 앞 7자리만 형식이 맞으면 받음');
eq(docFileName({ group: 'month', ym: '잘못', kind: '월말 마감' }), '월말 마감', '연월 형식이 아니면 버림');

console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
