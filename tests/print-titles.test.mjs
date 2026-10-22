import { reportPrintTitle } from '../app/modules/finance/logic.js';
import { edocPrintTitle } from '../app/modules/edoc/logic.js';
/* 인쇄 제목(대기열 1-2-7 ①, 대표님 2026-10-22) — 재무회계·전자결재가 "인쇄 → PDF 저장" 할 때의 문서 이름. 공개 저장소라 가짜 이름·값만 쓴다.
 * 재무회계는 기간(시작~끝)이 핵심이라 docFileName 의 period 형식을 쓰고, 전자결재는 문서번호 필드가 없어 번호 없이 종류 → 작성자 → 날짜로 만든다. */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => ok(a === b, m + (a === b ? '' : ' ← 실제: "' + a + '" / 기대: "' + b + '"'));
const AN = (c) => ({ '1020': '보통예금', '1100': '외상매출금', '2010': '외상매입금' })[c] || c;
const T = (rep, extra) => reportPrintTitle(rep, Object.assign({ accountName: AN }, extra || {}));
console.log('── 재무회계 보고서');
eq(T({ kind: 'is', from: '2026-01-01', to: '2026-09-30' }), '손익계산서 - 2026-01~2026-09', '★ 손익계산서: 기간을 월 단위로 줄여 넣는다');
eq(T({ kind: 'cf', from: '2026-01-01', to: '2026-09-30' }), '현금흐름표 - 2026-01~2026-09', '현금흐름표도 기간');
eq(T({ kind: 'tb', from: '2026-01-01', to: '2026-09-30' }), '합계잔액시산표 - 2026-01~2026-09', '합계잔액시산표도 기간');
eq(T({ kind: 'bs', from: '2026-01-01', to: '2026-09-30' }), '재무상태표 - 2026-09-30', '★ 재무상태표는 기준일(끝날짜)만 — 시작 날짜가 있어도 넣지 않는다(재무상태표는 시점 보고서)');
eq(T({ kind: 'is', from: '2026-01-15', to: '2026-09-10' }), '손익계산서 - 2026-01-15~2026-09-10', '월 경계가 아닌 기간은 날짜 그대로');
eq(T({ kind: 'gl', acct: '1020', from: '2026-01-01', to: '2026-09-30' }), '계정별 원장 - 2026-01~2026-09 - 보통예금', '★ 계정별 원장: 기간 뒤에 계정 이름(코드가 아니라 이름)');
eq(T({ kind: 'gl', acct: '1020', from: '', to: '2026-09-30' }), '계정별 원장 - 2026-09-30 - 보통예금', '★ 원장의 시작이 비어 있으면(처음부터) 끝날짜만');
eq(T({ kind: 'gl', acct: '9999', from: '2026-01-01', to: '2026-09-30' }), '계정별 원장 - 2026-01~2026-09 - 9999', '이름을 모르는 계정은 코드 그대로');
eq(T({ kind: 'pt', pacct: '1100', to: '2026-09-30' }), '거래처별 잔액 - 2026-09-30 - 외상매출금', '★ 거래처별 잔액: 기준일 + 계정 이름(거래처 이름은 넣지 않는다 — 거래처 전체 목록 문서라서)');
eq(T({ kind: 'bk' }), '통장 대사', '★ 통장 대사는 기간이 없어 종류만');
eq(T({ kind: 'bk', from: '2026-01-01', to: '2026-09-30' }), '통장 대사', '통장 대사는 기간이 있어도 넣지 않는다(월별 표라서)');
eq(T({ kind: 'vat' }, { vatRange: { from: '2026-07-01', to: '2026-09-30' } }), '부가세 신고표 - 2026-07~2026-09', '★ 부가세 신고표: 신고 기간(주입된 기간)');
eq(T({ kind: 'vat' }), '부가세 신고표', '부가세 기간을 모르면 종류만');
eq(T({ kind: 'zz' }), '재무회계 보고서', '★ 알 수 없는 종류도 제목 없이 인쇄하지 않는다');
eq(T({}), '재무회계 보고서', '종류가 없어도');
for (const bad of [null, undefined, 'x', 3, [], { kind: 5 }]) { let r, threw = false; try { r = reportPrintTitle(bad, { accountName: AN }); } catch (e) { threw = true; } ok(!threw && typeof r === 'string' && r.length > 0, '이상한 입력(' + JSON.stringify(bad) + ')에도 던지지 않고 제목을 돌려준다'); }
{ let threw = false, r; try { r = reportPrintTitle({ kind: 'gl', acct: '1020', to: '2026-09-30' }); } catch (e) { threw = true; } ok(!threw && /^계정별 원장 - 2026-09-30/.test(r), '계정 이름 함수를 안 줘도 던지지 않는다(코드 그대로) — 실제: ' + r); }
eq(reportPrintTitle({ kind: 'gl', acct: 'X', to: '2026-09-30' }, { accountName: () => '외상매출금 010-1234-5678' }), '계정별 원장 - 2026-09-30 - 외상매출금', '★ 안전 규칙은 계정 이름 칸에도 적용된다(이름에 전화번호가 섞여 있으면 지운다 — 사용자가 계정 이름을 직접 정하는 경우를 대비)');
eq(reportPrintTitle({ kind: 'pt', pacct: 'X', to: '2026-09-30' }, { accountName: () => '외상매출금 1,234,567원' }), '거래처별 잔액 - 2026-09-30 - 외상매출금', '이름에 금액이 섞여 있으면 지운다');
{ const rep = { kind: 'is', from: '2026-01-01', to: '2026-09-30' }; const sn = JSON.stringify(rep); T(rep); ok(JSON.stringify(rep) === sn, '입력을 바꾸지 않는다'); }
console.log('── 전자결재 문서');
const KST = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h, mi) - 9 * 3600 * 1000;
eq(edocPrintTitle({ dtype: 'purchase', authorName: '김작성', createdAt: KST(2026, 10, 1, 14, 30) }), '구매품의서 - 김작성 - 2026-10-01', '★ 종류 → 작성자 → 작성일(문서번호 필드가 없어 번호는 넣지 않는다)');
eq(edocPrintTitle({ dtype: 'expense', authorName: '이작성', createdAt: KST(2026, 10, 1, 0, 30) }), '지출결의서 - 이작성 - 2026-10-01', '★ 한국 시간 기준 날짜(한국 10월 1일 00:30 = UTC 9월 30일 15:30 이어도 10월 1일)');
eq(edocPrintTitle({ dtype: 'expense', authorName: '이작성', createdAt: KST(2026, 9, 30, 23, 59) }), '지출결의서 - 이작성 - 2026-09-30', '한국 시간 9월 30일 23:59 는 9월 30일');
eq(edocPrintTitle({ dtype: 'daily', authorName: '박작성', createdAt: { seconds: Math.floor(KST(2026, 10, 1, 12, 0) / 1000) } }), '업무일지 - 박작성 - 2026-10-01', '★ Firestore Timestamp 모양({ seconds })도 읽는다');
eq(edocPrintTitle({ dtype: 'daily', authorName: '박작성', createdAt: { toMillis: () => KST(2026, 10, 1, 12, 0) } }), '업무일지 - 박작성 - 2026-10-01', 'toMillis 가 있는 객체도');
eq(edocPrintTitle({ dtype: 'daily', authorName: '박작성', createdAt: new Date(KST(2026, 10, 1, 12, 0)).toISOString() }), '업무일지 - 박작성 - 2026-10-01', '문자열(ISO) 날짜도');
eq(edocPrintTitle({ dtype: 'leave', authorName: '최작성', createdAt: KST(2026, 10, 1, 12, 0) }), '연차신청서 - 최작성 - 2026-10-01', '연차신청서');
eq(edocPrintTitle({ dtype: 'cert', authorName: '정작성', createdAt: KST(2026, 10, 1, 12, 0) }), '재직증명서 - 정작성 - 2026-10-01', '재직증명서');
eq(edocPrintTitle({ dtype: 'zz', authorName: '김작성', createdAt: KST(2026, 10, 1, 12, 0) }), '결재 문서 - 김작성 - 2026-10-01', '★ 종류를 모르면 "결재 문서"');
eq(edocPrintTitle({ dtype: 'purchase', createdAt: KST(2026, 10, 1, 12, 0) }), '구매품의서 - 2026-10-01', '★ 작성자가 없으면 칸을 건너뛴다');
eq(edocPrintTitle({ dtype: 'purchase', authorName: '김작성' }), '구매품의서 - 김작성', '★ 작성일을 알 수 없으면 날짜 칸을 건너뛴다(0 시각을 1970-01-01 로 쓰지 않는다)');
eq(edocPrintTitle({ dtype: 'purchase', authorName: '김작성', createdAt: 0 }), '구매품의서 - 김작성', '시각 0 도 날짜 없음으로');
eq(edocPrintTitle({ dtype: 'purchase', authorName: '김작성 010-1234-5678', createdAt: KST(2026, 10, 1, 12, 0) }), '구매품의서 - 김작성 - 2026-10-01', '★ 안전 규칙: 작성자 칸의 전화번호는 지운다');
eq(edocPrintTitle({ dtype: 'purchase', authorName: '김/작성', createdAt: KST(2026, 10, 1, 12, 0) }), '구매품의서 - 김-작성 - 2026-10-01', '금지 문자는 정리한다');
eq(edocPrintTitle({}), '결재 문서', '아무 정보가 없어도 제목을 돌려준다');
for (const bad of [null, undefined, 'x', 3, []]) { let r, threw = false; try { r = edocPrintTitle(bad); } catch (e) { threw = true; } ok(!threw && r === '결재 문서', '이상한 입력(' + JSON.stringify(bad) + ')에도 던지지 않는다'); }
{ const d = { dtype: 'purchase', authorName: '김작성', createdAt: KST(2026, 10, 1, 12, 0) }; const sn = JSON.stringify(d); edocPrintTitle(d); ok(JSON.stringify(d) === sn, '입력을 바꾸지 않는다'); }
console.log('── 제목에 들어가면 안 되는 필드(실제 문서에는 항상 있다)');
{ const d = { id: 'Ab12Cd34Ef56Gh78Ij90Kl12', dtype: 'purchase', authorName: '김작성', authorEmail: 'kim.writer@example.com', authorUid: 'uid_secret_123', createdAt: KST(2026, 10, 1, 12, 0), title: '비밀 거래처 견적', docNo: 'SECRET-77' }; const r = edocPrintTitle(d); eq(r, '구매품의서 - 김작성 - 2026-10-01', '★ 전자결재 문서에 id·이메일·uid·제목이 있어도 제목에는 종류·작성자·날짜만 들어간다'); ok(!/Ab12Cd|example\.com|uid_secret|비밀|SECRET/.test(r), '★ 문서 id·이메일·uid·제목·번호가 파일 이름에 새지 않는다 — 실제: ' + r); }
{ const rep = { kind: 'pt', pacct: '1100', to: '2026-09-30', partner: '비밀거래처', q: '검색어비밀', acct: '1020' }; const r = T(rep); eq(r, '거래처별 잔액 - 2026-09-30 - 외상매출금', '★ 거래처별 잔액 화면에 거래처 이름·검색어·다른 계정이 있어도 제목에는 계정 이름만'); ok(!/비밀|보통예금/.test(r), '거래처 이름·검색어가 새지 않는다'); }
{ const rep = { kind: 'gl', acct: '1020', pacct: '1100', from: '2026-01-01', to: '2026-09-30', q: '검색어비밀' }; const r = T(rep); eq(r, '계정별 원장 - 2026-01~2026-09 - 보통예금', '★ 원장 화면의 검색어(q)·다른 화면의 계정(pacct)은 제목에 들어가지 않는다'); }
ok(pass + fail >= 51, '★ 시험이 끝까지 실행됨(중간에 예외로 중단돼도 FAIL 0 으로 보이지 않게)');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
