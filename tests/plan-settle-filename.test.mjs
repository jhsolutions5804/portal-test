import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/plan/index.js', import.meta.url), 'utf8').match(/margin-link\.js\?v=([0-9a-z]+)/) || [])[1];
const S = await import('../app/modules/plan/settlement-doc.js?v=' + VER);
const D = await import('../app/shared/doc-filename.js?v=' + VER);
/* 정산서 PDF 저장 기본 파일 이름(대기열 1-2-10, 대표님 2026-10-23 "1-2-10 파일명은 기준월 거래처").
 * 종류 - 기준월 - 거래처. 프로젝트·번호·발행일·담당자는 이름에 넣지 않는다(한 정산서에 프로젝트가 여럿이라 이름이 길어지던 문제).
 * 종류는 모든 문서군에서 이름의 맨 앞(대표님 2026-10-17 원칙)이라 유지한다. 공개 저장소라 가짜 값만 쓴다. 기대값은 모두 손으로 적었다. */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => { const s = JSON.stringify(a) === JSON.stringify(b); ok(s, m + (s ? '' : ' ← 실제: ' + JSON.stringify(a) + ' / 기대: ' + JSON.stringify(b))); };
const PR = [{ id: 'p1', code: 'P4 Ph2 (FAB동) FCU' }, { id: 'p2', code: 'H17L Gas RM. 전환공사' }];
const SET = (o) => Object.assign({ docType: 'invoice', no: '2610001', issueDate: '2026-10-22', baseMonth: '2026-10', pjtId: 'p1', pjtIds: ['p1'], recipient: { company: '다람이엔지', contact: '이대리' } }, o || {});
console.log('── 종류 - 기준월 - 거래처');
eq(S.settleDocTitle(SET(), PR), '대금청구서 - 2026-10 - 다람이엔지', '★ 청구서·기준월 2026-10·거래처 다람이엔지 → "대금청구서 - 2026-10 - 다람이엔지"');
eq(S.settleDocTitle(SET({ docType: 'payment', baseMonth: '2026-09', recipient: { company: '에스제이' } }), PR), '지급예정서 - 2026-09 - 에스제이', '지급예정서도 같은 모양 — "지급예정서 - 2026-09 - 에스제이"');
console.log('── 프로젝트·번호·발행일·담당자는 이름에 들어가지 않는다');
eq(S.settleDocTitle(SET({ pjtIds: ['p1', 'p2'] }), PR), S.settleDocTitle(SET({ pjtIds: ['p1'] }), PR), '★ 프로젝트가 여럿이어도 이름이 같다(옛 이름은 "P4 Ph2 … + H17L …" 로 길어졌다)');
eq(S.settleDocTitle(SET({ pjtId: 'zz', pjtIds: [] }), PR), '대금청구서 - 2026-10 - 다람이엔지', '프로젝트 정보가 없거나 목록에 없어도 같다');
eq(S.settleDocTitle(SET({ no: '9999999', issueDate: '2026-12-31' }), PR), '대금청구서 - 2026-10 - 다람이엔지', '★ 번호·발행일이 달라도 이름은 같다(기준월과 거래처만)');
eq(S.settleDocTitle(SET({ recipient: { company: '다람이엔지', contact: '박과장' } }), PR), '대금청구서 - 2026-10 - 다람이엔지', '★ 담당자가 있어도 이름에 안 들어간다(옛 이름은 "다람이엔지(이대리)")');
eq(S.settleDocTitle(SET(), undefined), '대금청구서 - 2026-10 - 다람이엔지', '프로젝트 목록을 안 넘겨도 같다(프로젝트를 안 쓰므로)');
console.log('── 없는 칸은 건너뛴다');
eq(S.settleDocTitle(SET({ recipient: null }), PR), '대금청구서 - 2026-10', '★ 거래처가 없으면 "대금청구서 - 2026-10"');
eq(S.settleDocTitle(SET({ recipient: { company: '' } }), PR), '대금청구서 - 2026-10', '거래처 이름이 비어도 같다');
eq(S.settleDocTitle(SET({ baseMonth: '' }), PR), '대금청구서 - 다람이엔지', '★ 기준월이 없으면 "대금청구서 - 다람이엔지"');
eq(S.settleDocTitle(SET({ baseMonth: '2026/10' }), PR), '대금청구서 - 다람이엔지', '기준월 형식이 올바르지 않으면(슬래시) 월 칸을 건너뛴다');
eq(S.settleDocTitle(SET({ baseMonth: '2026-13' }), PR), '대금청구서 - 다람이엔지', '13월도 올바르지 않다');
eq(S.settleDocTitle(SET({ baseMonth: '', recipient: null }), PR), '대금청구서 - 2610001', '★ 기준월과 거래처가 둘 다 없으면 번호로 대체(이름이 종류 한 단어만 남으면 여러 장이 구분되지 않는다)');
eq(S.settleDocTitle(SET({ baseMonth: '', recipient: null, no: '' }), PR), '대금청구서', '번호도 없으면 종류만');
eq(S.settleDocTitle(SET({ recipient: { company: 7 } }), PR), '대금청구서 - 2026-10', '★ 거래처 이름이 글자가 아니면(숫자 7) 거래처 칸을 건너뛴다("7" 이 거래처로 들어가지 않는다)');
eq(S.settleDocTitle(SET({ recipient: { company: { x: 1 } } }), PR), '대금청구서 - 2026-10', '거래처 이름이 객체여도 건너뛴다');
eq(S.settleDocTitle(SET({ baseMonth: '', recipient: { company: '010-1111-2222' } }), PR), '대금청구서 - 2610001', '★ 기준월이 없고 거래처 이름이 전화번호뿐이면(안전 규칙이 모두 지운다) 번호로 대체 — 지워져 비는 이름을 거래처가 있다고 보지 않는다');
eq(S.settleDocTitle(SET({ baseMonth: '', recipient: { company: '   ' } }), PR), '대금청구서 - 2610001', '거래처 이름이 공백뿐이어도 번호로 대체');
eq(S.settleDocTitle(SET({ baseMonth: '', recipient: null, no: '26 10/001' }), PR), '대금청구서 - 2610001', '★ 번호에 공백·슬래시가 있어도 파일 이름에 쓸 수 있는 문자만 남긴다');
eq(S.settleDocTitle(SET({ baseMonth: '', recipient: null, no: 2610001 }), PR), '대금청구서 - 2610001', '번호가 숫자 타입이어도 글자로 바꿔 쓴다');
console.log('── 안전 규칙(기존 그대로)');
ok(!/010|1111|2222/.test(S.settleDocTitle(SET({ recipient: { company: '다람 010-1111-2222' } }), PR)), '거래처 칸에 전화번호가 들어와도 파일 이름에 남지 않는다');
ok(!/[\\/:*?"<>|]/.test(S.settleDocTitle(SET({ recipient: { company: 'A/B:C*D?E' } }), PR)), '파일 이름에 못 쓰는 문자는 없앤다');
ok(S.settleDocTitle(SET({ recipient: { company: '가'.repeat(200) } }), PR).length <= 120, '길이 120자 이내');
for (const bad of [null, undefined, 'x', 3, [], {}]) { let r, threw = false; try { r = S.settleDocTitle(bad, PR); } catch (e) { threw = true; } ok(!threw && typeof r === 'string', '정산서 값이 이상해도(' + JSON.stringify(bad) + ') 던지지 않는다'); }
console.log('── 연월 문서군의 기존 사용은 한 글자도 달라지지 않는다(월간 보고서·월말 마감·월간 보고서 CSV는 거래처를 안 준다)');
eq(D.docFileName({ group: 'month', ym: '2026-09', kind: '월말 마감' }), '월말 마감 - 2026-09', '★ 월말 마감');
eq(D.docFileName({ group: 'month', ym: '2026-07', kind: '월간 보고서', project: 'P4 Ph2 (FAB)' }), '월간 보고서 - 2026-07 - P4 Ph2 (FAB)', '★ 월간 보고서(프로젝트 칸은 그대로)');
eq(D.docFileName({ group: 'month', ym: '2026-07', kind: '월간 보고서', project: 'P4', party: '' }), '월간 보고서 - 2026-07 - P4', '거래처가 빈 글자여도 기존과 같다');
eq(D.docFileName({ group: 'month', ym: '2026-10', kind: '대금청구서', party: '다람이엔지' }), '대금청구서 - 2026-10 - 다람이엔지', '연월 문서군에 거래처를 주면 연월 다음에 들어간다');
eq(D.docFileName({ group: 'month', ym: '2026-10', kind: '대금청구서', project: 'P4', party: '다람이엔지' }), '대금청구서 - 2026-10 - 다람이엔지 - P4', '프로젝트와 거래처를 함께 주면 거래처가 먼저, 프로젝트가 그다음');
ok(pass + fail >= 34, '★ 시험이 끝까지 실행됨(중간에 예외로 중단돼도 FAIL 0 으로 보이지 않게)');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
