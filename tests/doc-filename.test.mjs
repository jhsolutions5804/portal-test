import { docFileName, safeText } from '../app/shared/doc-filename.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => ok(a === b, m + (a === b ? '' : '  ← 실제: "' + a + '" / 기대: "' + b + '"'));

// ── 문서군별 순서
eq(docFileName({ group: 'project', project: 'P4 Ph2', kind: '견적서', no: 'EST-2026-001', party: '다람이엔지', contact: '김과장', title: 'FCU 설치 견적', date: '2026-05-10' }), '견적서_20260510_다람이엔지(김과장)_P4 Ph2_FCU 설치 견적', '★ 프로젝트 문서: 종류_날짜(숫자만)_거래처(담당자)_현장명_견적명 — 대표님이 엑셀로 쓰시던 방식 + 맨 앞에 종류');
eq(docFileName({ kind: '대금청구서', project: 'H17L', no: '2609001', party: 'A사', date: '2026-09-30' }), '대금청구서_20260930_A사_H17L', '그룹을 안 주면 프로젝트 문서로 처리(번호는 파일 이름에 넣지 않음)');
eq(docFileName({ group: 'month', ym: '2026-09', kind: '월말 마감' }), '월말 마감 - 2026-09', '월 단위 문서: 종류 → 연월');
eq(docFileName({ group: 'month', ym: '2026-09', kind: '월간 보고서', project: 'P4 Ph2' }), '월간 보고서 - 2026-09 - P4 Ph2', '월 단위 문서에 프로젝트가 있으면 뒤에 붙임');
eq(docFileName({ group: 'person', kind: '근로계약서', name: '홍길동', date: '2026-10-26' }), '근로계약서 - 홍길동 - 2026-10-26', '인사 직원 문서: 종류 → 이름 → 기준일');
eq(docFileName({ group: 'person', ym: '2026-06', kind: '급여명세서', name: '홍길동' }), '급여명세서 - 2026-06 - 홍길동', '급여명세서도 종류가 맨 앞(대표님 2026-10-17: 모든 문서의 종류를 가장 앞에)');
eq(docFileName({ group: 'edoc', kind: '구매품의', docNo: '2610001', author: '김작성', date: '2026-10-01' }), '구매품의 - 2610001 - 김작성 - 2026-10-01', '전자결재: 종류 → 문서번호 → 작성자 → 날짜');

// ── 없는 칸은 건너뜀(빈 구분자·"undefined" 금지)
eq(docFileName({ group: 'project', kind: '견적서', no: 'E1' }), '견적서', '프로젝트·상대방·날짜가 없으면 종류만 남음');
eq(docFileName({ group: 'project', project: null, kind: '계약서', no: undefined, party: '', date: 'x' }), '계약서', '모두 비어 있어도 종류만 남음(날짜 형식이 아니면 버림)');
ok(!/undefined|null|NaN/.test(docFileName({ project: undefined, kind: '견적서', no: null })), '"undefined"·"null" 글자가 파일 이름에 들어가지 않음');
eq(docFileName({}), '문서', '아무것도 없으면 "문서"');
eq(docFileName(), '문서', '인자 자체가 없어도 오류 없이 "문서"');

// ── 날짜·번호가 민감정보 필터에 잘못 지워지지 않음(번호·날짜는 필터를 거치지 않는 구조화 칸)
eq(docFileName({ project: 'P', kind: '견적서', no: 'EST-2026-001', date: '2026-05-10' }), '견적서_20260510_P', '종류 다음에 날짜(숫자만) — 같은 종류끼리 날짜순으로 정렬됨');
eq(docFileName({ project: 'P', kind: '정산서', no: '2610003', date: '2026-10-13T09:00:00.000Z' }), '정산서_20261013_P', 'ISO 날짜는 YYYYMMDD 로 줄임');
eq(docFileName({ project: 'P/Q:R', kind: '정산서', date: '2026-10-13' }), '정산서_20261013_P-Q R', '이름의 / 는 - 로, : 같은 나머지 파일 이름 금지 문자는 공백으로');

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
eq(safeText('a/b' + String.fromCharCode(92) + 'c:d*e?f"g<h>i|j'), 'a-b c d e f g h i j', '파일 이름 금지 문자 9가지: / 는 - 로, 나머지 8가지(역슬래시 포함)는 공백으로');
eq(safeText('  앞뒤   공백\t\n많음  '), '앞뒤 공백 많음', '공백 정리');
eq(safeText('...점으로 시작.'), '점으로 시작', '앞뒤 점·하이픈 제거(윈도우 파일 이름 오류 방지)');
eq(safeText('가'.repeat(100)).length, 40, '자유 입력 한 칸은 40자 이내');
const long = docFileName({ project: '가'.repeat(60), kind: '견적서', no: 'EST-2026-001', party: '나'.repeat(60), contact: '라'.repeat(30), title: '다'.repeat(60), date: '2026-05-10' });
ok(long.length <= 120, '전체 120자 이내 (실제 ' + long.length + '자)');
ok(long.startsWith('견적서_20260510_'), '★ 길 때는 이름 칸을 줄이고 맨 앞의 종류와 날짜는 살림');
ok(safeText('가'.normalize('NFD')) === '가'.normalize('NFC'), '한글 자모 분리(맥 파일 이름)를 합쳐 줌');
eq(docFileName({ group: 'month', ym: '2026-13-99x', kind: '월말 마감' }), '월말 마감 - 2026-13', '연월 앞 7자리만 형식이 맞으면 받음');
eq(docFileName({ group: 'month', ym: '잘못', kind: '월말 마감' }), '월말 마감', '연월 형식이 아니면 버림');

// ── 프로젝트 문서군 새 형식(대표님 2026-10-17): 날짜(YYYYMMDD)_거래처(담당자)_현장명_견적명_종류
{ const base = { group: 'project', kind: '견적서', project: 'P4 Ph2', party: '다람이엔지', contact: '김과장', title: 'FCU 설치 견적', no: 'EST-2026-001', date: '2026-05-10' };
  eq(docFileName(base), '견적서_20260510_다람이엔지(김과장)_P4 Ph2_FCU 설치 견적', '★ 4칸 모두 있는 견적서');
  ok(!docFileName(base).includes('EST-2026-001') && !docFileName(base).includes(' - '), '문서 번호는 파일 이름에 넣지 않고, 구분자는 \'_\' 만(\' - \' 없음)');
  eq(docFileName(Object.assign({}, base, { contact: '' })), '견적서_20260510_다람이엔지_P4 Ph2_FCU 설치 견적', '담당자가 없으면 괄호도 없음');
  eq(docFileName(Object.assign({}, base, { party: '', contact: '김과장' })), '견적서_20260510_김과장_P4 Ph2_FCU 설치 견적', '거래처가 없고 담당자만 있으면 담당자만(빈 괄호 없음)');
  eq(docFileName(Object.assign({}, base, { title: '' })), '견적서_20260510_다람이엔지(김과장)_P4 Ph2', '견적명이 없으면(정산서·계약서) 그 칸만 건너뜀');
  eq(docFileName(Object.assign({}, base, { title: 'P4 Ph2' })), '견적서_20260510_다람이엔지(김과장)_P4 Ph2', '견적명이 현장명과 같으면 한 번만');
  eq(docFileName(Object.assign({}, base, { date: '' })), '견적서_다람이엔지(김과장)_P4 Ph2_FCU 설치 견적', '날짜가 없으면 그 칸만 건너뜀(연속 밑줄이 남지 않음)');
  ok(!/^_|_$|__/.test(docFileName({ group: 'project', kind: '견적서', project: '', party: '', title: '', date: '' })), '비어 있는 칸이 많아도 밑줄이 맨 앞·맨 끝·연속으로 남지 않음');
  eq(docFileName(Object.assign({}, base, { date: '2026-05-10T09:00:00Z' })), '견적서_20260510_다람이엔지(김과장)_P4 Ph2_FCU 설치 견적', 'ISO 날짜도 YYYYMMDD');
  ok(docFileName(Object.assign({}, base, { date: '20260510' })).startsWith('견적서_다람이엔지'), '날짜 형식이 아니면(이미 압축된 값 포함) 버림 — 입력은 YYYY-MM-DD 만 받는다');
  ok(!/010|1234|5678/.test(docFileName(Object.assign({}, base, { contact: '김과장 010-1234-5678' }))) && docFileName(Object.assign({}, base, { contact: '김과장 010-1234-5678' })).includes('(김과장)'), '★ 담당자 칸에 전화번호가 섞여도 지워지고 이름만 남음');
  ok(!/원|3,000/.test(docFileName(Object.assign({}, base, { title: '공사 3,000,000원 견적' }))), '★ 견적명에 금액이 섞여도 지워짐');
  ok(!/[\\/:*?"<>|]/.test(docFileName(Object.assign({}, base, { title: '가/나:다*라?' }))), '견적명의 파일 이름 금지 문자도 지워짐');
  const mix = docFileName(Object.assign({}, base, { contact: '김(과장)' })); ok(mix.includes('다람이엔지(김(과장))'), '담당자 이름에 괄호가 있어도 오류 없이(그대로 둠)');
  ok(docFileName({ group: 'month', ym: '2026-09', kind: '월말 마감' }) === '월말 마감 - 2026-09' && docFileName({ group: 'person', kind: '근로계약서', name: '홍길동', date: '2026-10-26' }) === '근로계약서 - 홍길동 - 2026-10-26' && docFileName({ group: 'edoc', kind: '구매품의', docNo: '2610001', author: '김작성', date: '2026-10-01' }) === '구매품의 - 2610001 - 김작성 - 2026-10-01', '★ 월 단위는 종류가 앞으로 옮겨졌고, 사람(근로계약서)·결재 문서는 이미 종류가 맨 앞이라 그대로'); }
// ── 실제 견적(테섭 13건)에서 나온 사례: 견적명이 길거나 이미 종류 글자를 포함한 경우 — 종류는 항상 맨 앞, 견적명 끝의 종류 글자는 떼어 중복을 없앤다
{ const b = { group: 'project', kind: '견적서', project: 'P5 Ph1 (복합동)', party: '귀뚜라미범양냉방', contact: '', date: '2026-08-13' };
  eq(docFileName(Object.assign({}, b, { title: 'P5 Ph1 PAC 26대 납품 설치 견적서' })), '견적서_20260813_귀뚜라미범양냉방_P5 Ph1 (복합동)_P5 Ph1 PAC 26대 납품 설치', '★ 견적명이 이미 "…견적서"로 끝나면 끝의 종류 글자를 떼어 냄(종류는 맨 앞에 한 번만)');
  ok(docFileName(Object.assign({}, b, { title: 'P5 Ph1 PAC 26대 납품 설치 견적서' })).split('견적서').length === 2, '"견적서" 글자가 파일 이름에 한 번만 나옴');
  const long52 = 'P4 Ph2 FCU 87대분 관리자 2인 파견 (3F FIZ, X-OB, 복합4동, 복합3동)'; ok(long52.length === 52, '시험 자료: 실제 견적명 52자');
  ok(docFileName(Object.assign({}, b, { title: long52 })).includes(long52) && docFileName(Object.assign({}, b, { title: long52 })).startsWith('견적서_'), '★ 52자 견적명이 잘리지 않고 전부 들어가며 종류가 맨 앞에 옴');
  ok(docFileName(Object.assign({}, b, { title: '가'.repeat(80) })).length <= 120, '견적명이 아주 길어도 전체는 120자 이내');
  eq(docFileName(Object.assign({}, b, { title: 'P5 Ph1 (복합동)' })), '견적서_20260813_귀뚜라미범양냉방_P5 Ph1 (복합동)', '견적명이 현장명과 같으면 견적명 칸만 생략');
  eq(docFileName(Object.assign({}, b, { title: '견적서' })), '견적서_20260813_귀뚜라미범양냉방_P5 Ph1 (복합동)', '견적명이 종류 글자뿐이어도 "견적서" 한 번만');
  eq(docFileName(Object.assign({}, b, { title: '' })), '견적서_20260813_귀뚜라미범양냉방_P5 Ph1 (복합동)', '견적명이 비어 있으면 그 칸만 건너뜀');
  eq(docFileName({ group: 'project', kind: '하도급 변경 계약서', project: 'P4 Ph2', party: '에스제이', title: '하도급 변경 계약서', date: '2026-10-14' }), '하도급 변경 계약서_20261014_에스제이_P4 Ph2', '종류가 긴 글자("하도급 변경 계약서")여도 같은 규칙');
  eq(docFileName(Object.assign({}, b, { title: '견적서 검토 건' })), '견적서_20260813_귀뚜라미범양냉방_P5 Ph1 (복합동)_견적서 검토 건', '견적명이 "견적서"를 포함하지만 끝이 아니면 그대로 둠');
  eq(docFileName(Object.assign({}, b, { title: 'FCU 설치 - 견적서' })), '견적서_20260813_귀뚜라미범양냉방_P5 Ph1 (복합동)_FCU 설치', '끝의 종류 글자 앞에 붙은 구분 글자(- · _)도 같이 정리'); }

// ── ★ 종류는 모든 문서군에서 이름의 맨 앞(대표님 2026-10-17)
{ const KINDS = [['project', { kind: '견적서', project: 'P', party: 'A', date: '2026-05-10', title: 'T' }], ['project', { kind: '대금청구서', project: 'P', party: 'A', date: '2026-05-10' }], ['project', { kind: '지급예정서', project: 'P', party: 'A', date: '2026-05-10' }], ['project', { kind: '하도급 계약서', project: 'P', party: 'A', date: '2026-05-10' }],
    ['month', { kind: '월말 마감', ym: '2026-09' }], ['month', { kind: '월간 보고서', ym: '2026-09', project: 'P' }], ['person', { kind: '근로계약서', name: '홍길동', date: '2026-10-26' }], ['person', { kind: '급여명세서', ym: '2026-06', name: '홍길동' }], ['edoc', { kind: '구매품의', docNo: '2610001', author: '김작성', date: '2026-10-01' }]];
  KINDS.forEach(([g, o]) => ok(docFileName(Object.assign({ group: g }, o)).startsWith(o.kind), '종류가 맨 앞: ' + g + ' / ' + o.kind + ' → ' + docFileName(Object.assign({ group: g }, o))));
  ok(KINDS.every(([g, o]) => docFileName(Object.assign({ group: g }, o)).split(o.kind).length === 2), '종류 글자가 이름에 한 번만 나옴(모든 문서군)'); }

// ── 실제 프로젝트 코드의 "/": 청주 M15X CUB동 A/S → A-S (공백으로 바꾸면 "A S" 처럼 어색해짐 — 대표님 화면 확인에서 발견)
eq(docFileName({ group: 'project', kind: '견적서', project: '청주 M15X CUB동 A/S', party: '다람이엔지', title: 'M15X FCU 보수 작업', date: '2026-08-25' }), '견적서_20260825_다람이엔지_청주 M15X CUB동 A-S_M15X FCU 보수 작업', '★ 프로젝트 코드의 / 는 - 로("A/S" → "A-S")');
ok(!docFileName({ group: 'project', kind: '견적서', project: '가/나/다', date: '2026-08-25' }).includes('/') && docFileName({ group: 'project', kind: '견적서', project: '가/나/다', date: '2026-08-25' }).endsWith('가-나-다'), '/ 가 여러 개여도 모두 -');
eq(docFileName({ group: 'project', kind: '견적서', project: 'A/', date: '2026-08-25' }), '견적서_20260825_A', '끝에 붙은 / 는 - 가 된 뒤 가장자리의 - 로 정리되어 남지 않음');
// ── 개정본: rev 2 이상이면 맨 끝에 _r2 · _r3 (대표님 2026-10-18). 처음 발행한 견적의 이름은 그대로
{ const b = { group: 'project', kind: '견적서', project: 'P4 Ph4 (SUP)', party: '다람이엔지', contact: '현병찬 차장님', title: '(삼성물산) EHU 8대 설치', date: '2026-01-15' };
  eq(docFileName(Object.assign({}, b, { rev: 1 })), '견적서_20260115_다람이엔지(현병찬 차장님)_P4 Ph4 (SUP)_(삼성물산) EHU 8대 설치', '★ 처음 발행한 견적(rev 1)은 이름 그대로 — 담당자 직함(차장님)도 그대로');
  eq(docFileName(Object.assign({}, b, { rev: 2 })), '견적서_20260115_다람이엔지(현병찬 차장님)_P4 Ph4 (SUP)_(삼성물산) EHU 8대 설치_r2', '★ 개정 2는 맨 끝에 _r2');
  eq(docFileName(Object.assign({}, b, { rev: 9 })).slice(-3), '_r9', '개정 9는 _r9');
  eq(docFileName(b), docFileName(Object.assign({}, b, { rev: undefined })), 'rev 가 없으면 붙지 않음');
  ok(!/_r/.test(docFileName(Object.assign({}, b, { rev: 0 }))) && !/_r/.test(docFileName(Object.assign({}, b, { rev: 'x' }))) && !/_r/.test(docFileName(Object.assign({}, b, { rev: -3 }))) && !/_r/.test(docFileName(Object.assign({}, b, { rev: null }))), 'rev 가 0·음수·숫자 아님·null 이면 붙지 않음');
  ok(docFileName(Object.assign({}, b, { rev: 2 })) !== docFileName(Object.assign({}, b, { rev: 1 })), '★ 같은 날 같은 거래처·견적명의 원본과 개정본은 서로 다른 이름(덮어쓰기 방지)');
  const long = docFileName(Object.assign({}, b, { rev: 3, project: '가'.repeat(60), party: '나'.repeat(60), title: '다'.repeat(80) })); ok(long.length <= 120 && long.endsWith('_r3') && long.startsWith('견적서_20260115_'), '★ 이름이 아주 길어도 120자 이내이고 앞의 종류·날짜와 끝의 _r3 가 모두 살아남음 (' + long.length + '자)');
  { const x = { group: 'project', kind: '가'.repeat(60), project: '나'.repeat(60), party: '다'.repeat(60), contact: '라'.repeat(40), title: '마'.repeat(80), date: '2026-01-15' }; ok(docFileName(x).length >= 118, '시험 자료: 18자 축소로도 120자 가까이 가서 최종 자르기 경로에 도달(' + docFileName(x).length + '자)'); const r3 = docFileName(Object.assign({}, x, { rev: 3 })); ok(r3.length <= 120 && r3.endsWith('_r3'), '★ 최종 자르기 경로에서도 개정 접미사 _r3 가 잘리지 않고 120자 이내 (' + r3.length + '자)'); }
  eq(docFileName({ group: 'month', ym: '2026-09', kind: '월말 마감', rev: 2 }), '월말 마감 - 2026-09_r2', 'rev 는 어떤 문서군이든 같은 규칙(견적서만 rev 를 넘김)'); }
// ── 기간 문서(재무제표·원장·부가세 신고표 — 시작~끝 기간이 핵심, 대표님 2026-10-22 "기간 전체를 넣자")
eq(docFileName({ group: 'period', kind: '손익계산서', from: '2026-01-01', to: '2026-09-30' }), '손익계산서 - 2026-01~2026-09', '★ 기간 문서: 월의 첫날~월의 마지막 날이면 연월로 줄여 2026-01~2026-09');
eq(docFileName({ group: 'period', kind: '손익계산서', from: '2026-09-01', to: '2026-09-30' }), '손익계산서 - 2026-09', '★ 한 달 전체면 연월 하나');
eq(docFileName({ group: 'period', kind: '손익계산서', from: '2026-01-15', to: '2026-09-10' }), '손익계산서 - 2026-01-15~2026-09-10', '★ 월 경계가 아니면 날짜 그대로');
eq(docFileName({ group: 'period', kind: '손익계산서', from: '2026-01-01', to: '2026-09-10' }), '손익계산서 - 2026-01-01~2026-09-10', '시작만 월 경계이고 끝이 월말이 아니면 날짜 그대로(한쪽만 줄이지 않는다)');
eq(docFileName({ group: 'period', kind: '손익계산서', from: '2026-01-15', to: '2026-09-30' }), '손익계산서 - 2026-01-15~2026-09-30', '끝만 월말이고 시작이 1일이 아니면 날짜 그대로');
eq(docFileName({ group: 'period', kind: '재무상태표', to: '2026-09-30' }), '재무상태표 - 2026-09-30', '★ 끝날짜만 있으면(기준일) 그 날짜');
eq(docFileName({ group: 'period', kind: '계정별 원장', to: '2026-09-30', project: '보통예금' }), '계정별 원장 - 2026-09-30 - 보통예금', '★ 이름 칸(계정·거래처)은 기간 뒤에 붙는다');
eq(docFileName({ group: 'period', kind: '계정별 원장', from: '2026-01-01', to: '2026-09-30', project: '보통예금' }), '계정별 원장 - 2026-01~2026-09 - 보통예금', '기간과 이름이 같이 있을 때');
eq(docFileName({ group: 'period', kind: '합계잔액시산표', from: '2026-01-01' }), '합계잔액시산표 - 2026-01-01~', '시작만 있으면 "시작~"(끝이 없는 기간)');
eq(docFileName({ group: 'period', kind: '통장 대사' }), '통장 대사', '기간이 없으면 종류만');
eq(docFileName({ group: 'period', kind: '손익계산서', from: 'x', to: '2026-13-01' }), '손익계산서', '형식이 틀린 날짜는 버린다(YYYY-MM-DD 만 받는다)');
eq(docFileName({ group: 'period', kind: '손익계산서', from: '2026-09-30', to: '2026-01-01' }), '손익계산서 - 2026-01~2026-09', '★ 시작이 끝보다 늦으면 순서를 바로잡고(날짜 입력 실수) 그 기간이 월 경계면 연월로 줄인다');
eq(docFileName({ group: 'period', kind: '손익계산서', from: '2026-09-10', to: '2026-01-15' }), '손익계산서 - 2026-01-15~2026-09-10', '순서를 바로잡은 기간이 월 경계가 아니면 날짜 그대로');
eq(docFileName({ group: 'period', kind: '거래처별 잔액', to: '2026-09-30', project: '김철수 010-1234-5678' }), '거래처별 잔액 - 2026-09-30 - 김철수', '★ 안전 규칙: 이름 칸의 전화번호는 지운다');
eq(docFileName({ group: 'period', kind: '거래처별 잔액', to: '2026-09-30', project: '삼성 1,234,567원' }), '거래처별 잔액 - 2026-09-30 - 삼성', '★ 이름 칸의 금액은 지운다');
eq(docFileName({ group: 'period', kind: '계정별/원장', to: '2026-09-30' }), '계정별-원장 - 2026-09-30', '종류의 금지 문자는 없앤다(/ 는 -)');
{ const s = docFileName({ group: 'period', kind: '계정별 원장', from: '2026-01-15', to: '2026-09-10', project: '가'.repeat(80) }); ok(s.length <= 120, '★ 120자를 넘지 않는다 (실제 ' + s.length + '자)'); ok(s.startsWith('계정별 원장 - 2026-01-15~2026-09-10'), '길어도 종류와 기간은 살린다'); }
eq(docFileName({ group: 'period', kind: '손익계산서', from: '2026-01-01', to: '2026-09-30', rev: 2 }), '손익계산서 - 2026-01~2026-09_r2', 'rev 는 이 그룹도 같은 규칙');
eq(docFileName({ group: 'period', from: '2026-01-01', to: '2026-09-30' }), '문서 - 2026-01~2026-09', '종류가 없으면 "문서"');
eq(docFileName({ group: 'period', kind: '손익계산서', from: '2024-02-01', to: '2024-02-29' }), '손익계산서 - 2024-02', '윤년 2월 29일도 월말로 본다');
eq(docFileName({ group: 'period', kind: '손익계산서', from: '2026-02-01', to: '2026-02-28' }), '손익계산서 - 2026-02', '평년 2월 28일은 월말');
eq(docFileName({ group: 'period', kind: '손익계산서', from: '2026-02-01', to: '2026-02-29' }), '손익계산서 - 2026-02-01~2026-02-29', '존재하지 않는 날짜(평년 2월 29일)는 월말로 보지 않고 날짜 그대로 — 입력 검사는 날짜 형식만 보므로 그대로 둔다');
// 기존 그룹은 그대로
eq(docFileName({ group: 'month', ym: '2026-09', kind: '월말 마감' }), '월말 마감 - 2026-09', '회귀: month 그룹은 그대로');
eq(docFileName({ group: 'edoc', kind: '구매품의서', author: '김작성', date: '2026-10-01' }), '구매품의서 - 김작성 - 2026-10-01', '★ 전자결재(번호 없이): 종류 → 작성자 → 날짜 — 문서번호 필드가 없어 칸만 건너뛴다(대표님 2026-10-22)');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
