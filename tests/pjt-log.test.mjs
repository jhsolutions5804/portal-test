import fs from 'fs';
import { CATEGORIES, SOURCES, INPUT_SOURCES, TITLE_MAX, STATUS_LABEL, hasMoney, hasPersonal, titleHint, canSubmit, dueText, shortDate, actionsFor, friendlyError } from '../app/shared/pjt-log.js';
import { logHtml, formHtml, logCompactHtml } from '../app/modules/pjt/log-view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };

// ── 금액·연락처 안내: 서버와 같은 규칙(수량·사양·일정은 허용)
for (const s of ['단가 12만원으로 조정', '견적가 3,000,000원', '₩5,000 추가', '공사비 3억', '계약금 1,000만원', '대금 지급 200 요청', '1,200,000원']) ok(hasMoney(s) === true, '금액으로 감지: ' + s);
for (const s of ['FCU 183대 설치', '수량 1,500대로 변경', '11월 3일 납품 요청', 'CF-1000 규격 변경', '4층 B구역 공정 1주 지연', '배관 100A → 80A 변경']) ok(hasMoney(s) === false, '수량·사양·일정은 허용: ' + s);
for (const s of ['010-1234-5678 연락', 'a.b@jhsol.kr 로 회신', '900101-1234567']) ok(hasPersonal(s) === true, '개인 정보로 감지: ' + s);
ok(titleHint('배관 단가 15만원 인상').includes('금액') && titleHint('연락 010-1111-2222').includes('전화번호') && titleHint('가'.repeat(81)).includes('80자') && titleHint('정상적인 한 줄 요약') === '' && titleHint('') === '' && titleHint(null) === '', '입력 중 안내: 금액·연락처·길이는 안내, 정상 문장·빈 값은 안내 없음');

// ── 제출 가능 여부
const F = (o) => Object.assign({ category: '현장 이슈', source: '현장', title: '크레인 일정 충돌', dueDate: '' }, o);
ok(canSubmit(F()).ok === true && canSubmit(F({ dueDate: '2026-10-20' })).ok === true, '분류·출처·한 줄이 있으면 제출 가능(기한은 선택)');
ok(!canSubmit(F({ category: '' })).ok && canSubmit(F({ category: '' })).why.includes('분류') && !canSubmit(F({ source: '' })).ok && !canSubmit(F({ title: '  ' })).ok && !canSubmit(F({ title: '단가 3만원' })).ok && !canSubmit(F({ dueDate: 'abc' })).ok && !canSubmit(null).ok, '분류·출처·제목이 없거나 금액이 있거나 기한 형식이 틀리면 제출 불가(이유를 알려 줌)');
ok(!canSubmit(F({ source: '메일' })).ok && !canSubmit(F({ source: '일정' })).ok, '메일·일정은 자동 기록 전용이라 직접 입력 출처로 고를 수 없음');

// ── 기한 문구·날짜
ok(dueText({ daysLeft: -3 }) === '3일 지남' && dueText({ daysLeft: 0 }) === '오늘 마감' && dueText({ daysLeft: 1 }) === '내일 마감' && dueText({ daysLeft: 5 }) === 'D-5' && dueText(null) === '' && dueText({}) === '', '기한 문구: 지남·오늘·내일·D-N, 없으면 빈 값');
ok(shortDate('2026-10-17') === '10. 17 (토)' && shortDate('2026-01-05') === '1. 5 (월)' && shortDate('') === '' && shortDate('abc') === '', '날짜 표시: 요일 포함, 형식이 틀리면 빈 값');

// ── 버튼 구성(권한·상태별) — 맡은 사람이 없으면 "내가 맡기", 서버 판정과 같은 흐름
const A = (e, me) => actionsFor(e, me).map((a) => a.act).join();
const E = (o) => Object.assign({ id: 'e1', category: '발주처 요청·지시', status: 'confirmed', claimedBy: '', impactChecked: false, createdByMe: false }, o);
ok(A(E(), { uid: 'u1', manager: false }) === 'claim', '확정·맡은 사람 없음: 일반 참여자는 "내가 맡기"만');
ok(A(E({ status: 'claimed', claimedBy: 'u1' }), { uid: 'u1', manager: false }) === 'release,done', '내가 맡은 항목: 맡기 취소·완료');
ok(A(E({ status: 'claimed', claimedBy: 'u2' }), { uid: 'u1', manager: false }) === '', '다른 사람이 맡은 항목: 일반 참여자는 누를 버튼 없음');
ok(A(E({ status: 'claimed', claimedBy: 'u2' }), { uid: 'u1', manager: true }) === 'claim,done,hold', '다른 사람이 맡은 항목: 관리 권한자는 재배정·완료·보류');
ok(A(E({ status: 'candidate' }), { uid: 'u1', manager: false }) === '' && A(E({ status: 'candidate' }), { uid: 'u1', manager: true }) === 'confirm', '후보: 관리 권한자만 확정');
ok(A(E({ status: 'done' }), { uid: 'u1', manager: false }) === '' && A(E({ status: 'done', createdByMe: true }), { uid: 'u1', manager: false }) === 'closed' && A(E({ status: 'done' }), { uid: 'u1', manager: true }) === 'closed', '완료 항목: 종결은 관리 권한자·작성자 본인만(서버 판정과 같음)');
ok(A(E({ status: 'hold' }), { uid: 'u1', manager: true }) === 'reopen' && A(E({ status: 'closed' }), { uid: 'u1', manager: true }) === 'reopen' && A(E({ status: 'hold' }), { uid: 'u1', manager: false }) === '', '보류·종결: 다시 열기는 관리 권한자만');
ok(A(E({ category: '일정 변경' }), { uid: 'u1', manager: false }) === 'claim,impact' && actionsFor(E({ category: '일정 변경', impactChecked: true }), { uid: 'u1', manager: false }).some((a) => a.label === '영향 확인 해제') && !A(E({ category: '현장 이슈' }), { uid: 'u1', manager: false }).includes('impact'), '변경사항(일정·범위·수량)만 "영향 확인" 버튼이 있고 체크하면 "해제"로 바뀜');
ok(actionsFor(null, { uid: 'u' }).length === 0 && actionsFor(E(), null).length === 0, '항목·사용자가 없어도 오류 없이 빈 목록');
ok(friendlyError({ message: 'FirebaseError: 금액·단가는 이력에 적지 않습니다.' }) === '금액·단가는 이력에 적지 않습니다.' && friendlyError(null).includes('다시 시도') && friendlyError({ message: 'x'.repeat(200) }).includes('다시 시도'), '서버 오류 문구는 그대로 보여 주고 접두어를 지움, 너무 길거나 없으면 기본 안내');

// ── 화면: 세 묶음 순서(기한 임박 → 변경사항 → 전체 이력)·빈 상태·로딩·오류
const ENT = (o) => Object.assign({ id: 'i' + Math.random().toString(36).slice(2, 6), date: '2026-10-14', category: '회의 결정', title: '제목', source: '회의', status: 'confirmed', claimedBy: '', claimedByName: '', dueDate: '', createdByName: '팀장', replyDetected: false, impactChecked: false, restricted: false, auto: false, createdByMe: false }, o);
const ST = (o) => Object.assign({ proj: 'p1', me: { uid: 'u1', manager: false }, loading: false, error: '', data: { urgent: [], changes: [], entries: [], total: 0, today: '2026-10-17', canConfirm: false }, filter: {}, formOpen: false, form: { category: '', source: '', title: '', dueDate: '' }, busy: false, msg: '' }, o);
const h0 = logHtml(ST());
ok(h0.indexOf('기한 임박 요청') < h0.indexOf('변경사항') && h0.indexOf('변경사항') < h0.indexOf('전체 이력'), '★ 화면 순서: 기한 임박 요청 → 변경사항 → 전체 이력(대표님 확정 우선순위)');
ok(h0.includes('기한이 있는 요청이 없습니다') && h0.includes('일정·범위·수량 변경이 없습니다') && h0.includes('조건에 맞는 이력이 없습니다'), '데이터가 없으면 각 묶음에 빈 안내');
ok(h0.includes('data-lg-toggle') && h0.includes('＋ 기록') && !h0.includes('data-lg-add'), '입력 폼은 접혀 있고 맨 위에 "＋ 기록" 버튼만');
ok(logHtml(ST({ proj: '' })).includes('이 프로젝트를 열 수 없습니다') && logHtml(ST({ loading: true, data: null })).includes('aria-busy') && logHtml(ST({ data: null })).includes('aria-busy') && logHtml(ST({ error: '권한이 없습니다' })).includes('권한이 없습니다') && logHtml(ST({ error: '권한이 없습니다' })).includes('role="alert"'), '프로젝트 없음·로딩·오류 상태 화면');
const U = ENT({ id: 'u1', title: '자재 반입 일정 회신', dueDate: '2026-10-15', due: { daysLeft: -2, tone: 'overdue' } });
const U2 = ENT({ id: 'u2', title: '검사 일정 확인', dueDate: '2026-10-19', due: { daysLeft: 2, tone: 'soon' }, claimedBy: 'u1', claimedByName: '참여A', status: 'claimed' });
const h1 = logHtml(ST({ data: { urgent: [U, U2], changes: [], entries: [U, U2], total: 2, today: '2026-10-17', canConfirm: false } }));
ok(h1.includes('2일 지남') && h1.includes('data-tone="danger"') && h1.includes('D-2') && h1.includes('data-tone="warn"'), '기한 칩: 지남은 빨강(danger), 2일 이내는 주의(warn)');
ok(h1.includes('맡은 사람 없음') && h1.includes('👤 참여A 맡음') && h1.includes('data-lg-act="claim"') && h1.includes('내가 맡기'), '맡은 사람이 없으면 표시하고 "내가 맡기" 버튼, 맡은 항목은 맡은 사람 표시');
ok(h1.includes('처리 중') && !h1.includes('>확정<'), '확정 상태는 칩을 따로 달지 않고(기본), 처리 중은 칩으로 표시');
const C = ENT({ id: 'c1', category: '일정 변경', title: '검사 11/5 → 11/7', source: '일정', auto: true });
const hc = logHtml(ST({ data: { urgent: [], changes: [C], entries: [C], total: 1, today: '2026-10-17', canConfirm: false } }));
ok(hc.includes('자동 기록') && hc.includes('data-lg-act="impact"') && hc.includes('영향 확인') && hc.includes('📅'), '일정 자동 기록 항목: "자동 기록" 표시·영향 확인 버튼·분류 아이콘');
ok(logHtml(ST({ data: { urgent: [], changes: [], entries: [ENT({ restricted: true, title: '(관리자만 볼 수 있는 항목입니다)' })], total: 1, today: '2026-10-17', canConfirm: false } })).includes('대외비'), '대외비 항목에는 "대외비" 표시');
const many = Array.from({ length: 3 }, (_, i) => ENT({ id: 'm' + i }));
ok(logHtml(ST({ data: { urgent: [], changes: [], entries: many, total: 350, today: '2026-10-17', canConfirm: false } })).includes('최근 3건만 보입니다') && !logHtml(ST({ data: { urgent: [], changes: [], entries: many, total: 3, today: '2026-10-17', canConfirm: false } })).includes('건만 보입니다'), '많을 때만 "최근 N건만 보입니다" 안내');
ok(logHtml(ST({ msg: '기록했습니다.' })).includes('기록했습니다.') && logHtml(ST()).includes('role="status"') === false, '처리 결과 안내 문구(없으면 안 보임)');

// ── 입력 폼: 칩 5개·출처 칩 4개·금액 안내·제출 버튼 상태
const fo = formHtml(ST({ formOpen: true }));
ok(CATEGORIES.every((c) => fo.includes('data-lg-cat="' + c + '"')) && INPUT_SOURCES.every((c) => fo.includes('data-lg-src="' + c + '"')) && !fo.includes('data-lg-src="메일"') && !fo.includes('data-lg-src="일정"'), '분류 칩 5개 + 직접 입력 출처 칩 4개(메일·일정 없음)');
ok(fo.includes('data-lg-add" disabled') || /data-lg-add[^>]*disabled/.test(fo), '아무것도 입력하지 않으면 "기록하기"는 비활성');
const fm = formHtml(ST({ formOpen: true, form: { category: '현장 이슈', source: '현장', title: '크레인 일정 충돌', dueDate: '' } }));
ok(!/data-lg-add[^>]*disabled/.test(fm) && fm.includes('aria-pressed="true"'), '분류·출처·한 줄이 있으면 "기록하기" 활성, 고른 칩은 pressed 표시');
const fx = formHtml(ST({ formOpen: true, form: { category: '현장 이슈', source: '현장', title: '배관 단가 15만원 인상', dueDate: '' } }));
ok(fx.includes('data-lg-hint') && fx.includes('금액·단가는 이력에 적지 않습니다') && fx.includes('aria-invalid="true"') && /data-lg-add[^>]*disabled/.test(fx), '★ 금액을 입력하면 입력칸 아래에 바로 안내하고 "기록하기"는 비활성');
ok(formHtml(ST({ formOpen: true, form: { category: '', source: '', title: '가'.repeat(30), dueDate: '' } })).includes('30 / 80'), '글자 수 표시(N / 80)');

// ── 필터
const hf = logHtml(ST({ filter: { category: '일정 변경', source: '현장' } }));
ok(hf.includes('<option value="일정 변경" selected>') && hf.includes('<option value="현장" selected>') && hf.includes('data-lg-freset') && !logHtml(ST()).includes('data-lg-freset'), '필터: 고른 값이 선택돼 있고, 필터가 있을 때만 "필터 해제"');

// ── 안전: 사용자가 쓴 글자는 HTML 로 해석되지 않음
const evil = logHtml(ST({ data: { urgent: [ENT({ id: 'x"><img src=x onerror=alert(1)>', title: '<script>alert(1)</script> & <b>x</b>', createdByName: '<img src=x onerror=1>', due: { daysLeft: 1, tone: 'soon' }, dueDate: '2026-10-18' })], changes: [], entries: [], total: 1, today: '2026-10-17', canConfirm: false } }));
ok(!/<script>alert|<img src=x|<b>x<\/b>/.test(evil) && evil.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &lt;b&gt;x&lt;/b&gt;'), '★ 제목·작성자·id 에 든 꺾쇠·따옴표는 글자로만 표시(스크립트 실행·속성 탈출 불가)');
ok(logHtml(ST({ error: '<img src=x onerror=1>' })).includes('&lt;img'), '오류 문구도 이스케이프');


// ── 프로젝트 홈 3단째(요약 이력)
const CST = (o) => Object.assign({ proj: 'p1', label: 'P4 Ph2', compact: true, me: { uid: 'u1', manager: false }, loading: false, error: '', data: { urgent: [], changes: [], entries: [], total: 0, today: '2026-10-17', canConfirm: false }, filter: {}, formOpen: false, form: { category: '', source: '', title: '', dueDate: '' }, busy: false, msg: '' }, o);
const c0 = logCompactHtml(CST());
ok(c0.includes('🗂️ 이력') && c0.includes('href="#/pjt/p1/log"') && c0.includes('전체 보기') && c0.includes('data-lg-toggle') && c0.includes('＋ 기록'), '요약: 제목·"전체 보기"(이력 탭 링크)·"＋ 기록" 버튼');
ok(c0.includes('기한 임박 요청 0건') && c0.includes('기한이 있는 요청이 없습니다') && c0.includes('아직 기록이 없습니다'), '요약: 비어 있으면 기한 임박 0건·빈 안내·첫 이력 유도');
ok(!c0.includes('변경사항') && !c0.includes('data-lg-fcat') && !c0.includes('projlabel'), '요약에는 변경사항 묶음·필터·프로젝트 헤더가 없음(이력 탭에서)');
const urg = Array.from({ length: 7 }, (_, i) => ENT({ id: 'u' + i, title: '기한요청' + i, dueDate: '2026-10-2' + i, due: { daysLeft: i, tone: 'later' } }));
const ent = Array.from({ length: 12 }, (_, i) => ENT({ id: 'r' + i, title: '이력' + i }));
const c1 = logCompactHtml(CST({ data: { urgent: urg, changes: [], entries: urg.concat(ent), total: 19, today: '2026-10-17', canConfirm: false } }));
ok((c1.match(/data-lg-row="u\d"/g) || []).length === 5 && c1.includes('기한 임박 요청 7건') && c1.includes('외 2건은 &quot;전체 보기&quot;에서 볼 수 있습니다'), '요약: 기한 임박은 5건만 보여 주고 나머지는 "외 N건"으로 안내');
ok((c1.match(/data-lg-row="r\d+"/g) || []).length === 8 && !c1.includes('data-lg-row="u5"'), '요약: 최근 이력은 8건까지, 이미 위에 보인 기한 임박 항목은 다시 안 나옴(중복 없음)');
const cf = logCompactHtml(CST({ formOpen: true }));
ok(cf.includes('data-lg-add') && cf.includes('data-lg-title') && (cf.match(/<section/g) || []).length === 1 && cf.includes('닫기'), '요약: 폼을 펼치면 입력칸이 나오고 카드 속 카드가 되지 않음(section 1개)');
ok(logCompactHtml(CST({ loading: true, data: null })).includes('aria-busy="true"') && logCompactHtml(CST({ loading: true, data: null })).includes('data-lg-toggle'), '요약: 불러오는 중에도 제목·버튼은 보임');
const ce = logCompactHtml(CST({ error: '이 프로젝트의 이력을 볼 권한이 없습니다.', data: null }));
ok(ce.includes('data-tone="warn"') && !ce.includes('data-tone="danger"') && ce.includes('data-lg-retry') && ce.includes('권한이 없습니다'), '★ 요약: 서버가 안 돼도 홈이 시끄럽지 않게 주의(warn) 안내 + 다시 시도, 빨간 오류 없음');
ok(!logCompactHtml(CST({ data: { urgent: [], changes: [], entries: [ENT({ id: 'x"><i>', title: '<script>alert(1)</script>' })], total: 1, today: '2026-10-17', canConfirm: false } })).includes('<script>alert') && logCompactHtml(CST({ proj: 'a/b c' })).includes('#/pjt/a%2Fb%20c/log'), '요약: 제목은 이스케이프, 프로젝트 주소는 인코딩');

// ── PJT 메인 홈 이력관리(전체 모드): 여러 프로젝트 항목 + 프로젝트 칩·선택·필터
const AST = (o) => CST(Object.assign({ proj: '', label: '', all: true, projects: [{ key: 'p1', label: 'P4 Ph2' }, { key: 'reg_2', label: '청주 CUB동 A/S' }], form: { category: '', source: '', title: '', dueDate: '', pjtId: '' } }, o));
const PE = (id, pjtId, pjtLabel, o) => ENT(Object.assign({ id, pjtId, pjtLabel }, o || {}));
const a1 = logCompactHtml(AST({ data: { urgent: [PE('x1', 'p1', 'P4 Ph2', { title: '회신 요청', due: { daysLeft: 1, tone: 'soon' }, dueDate: '2026-10-18' }), PE('x2', 'reg_2', '청주 CUB동 A/S', { title: '점검 일정', due: { daysLeft: 3, tone: 'later' }, dueDate: '2026-10-20' })], changes: [], entries: [], total: 2, today: '2026-10-17', canConfirm: false } }));
ok(a1.includes('P4 Ph2') && a1.includes('청주 CUB동 A/S') && a1.includes('href="#/pjt/p1/log"') && a1.includes('href="#/pjt/reg_2/log"') && a1.includes('class="jh-pjt__lgproj"'), '전체 모드: 항목마다 프로젝트 이름 칩, 누르면 그 프로젝트의 이력 탭');
ok(a1.includes('data-lg-pjt="p1"') && a1.includes('data-lg-pjt="reg_2"') && (a1.match(/data-lg-act="claim"[^>]*data-lg-pjt="/g) || []).length === 2, '★ 전체 모드: 행의 버튼마다 그 항목의 프로젝트 id 가 실려 있음(다른 프로젝트로 요청이 가지 않게)');
ok(!a1.includes('전체 보기') && a1.includes('data-lg-fproj') && a1.includes('모든 프로젝트') && a1.includes('<option value="reg_2">'), '전체 모드: "전체 보기" 링크 대신 프로젝트 필터(프로젝트가 여럿일 때)');
ok(!logCompactHtml(AST({ projects: [{ key: 'p1', label: 'P4 Ph2' }], data: { urgent: [], changes: [], entries: [], total: 0, today: '2026-10-17', canConfirm: false } })).includes('data-lg-fproj'), '전체 모드: 보이는 프로젝트가 하나뿐이면 프로젝트 필터는 없음');
ok(logCompactHtml(AST({ filter: { pjtId: 'reg_2' }, data: { urgent: [], changes: [], entries: [], total: 0, today: '2026-10-17', canConfirm: false } })).includes('<option value="reg_2" selected>'), '전체 모드: 고른 프로젝트 필터가 선택돼 있음');
const af = logCompactHtml(AST({ formOpen: true }));
ok(af.includes('data-lg-proj') && af.includes('프로젝트를 선택하세요') && af.includes('<option value="p1">') && af.includes('<option value="reg_2">') && af.indexOf('data-lg-proj') < af.indexOf('data-lg-cat'), '전체 모드 폼: 분류보다 먼저 프로젝트 선택(보이는 프로젝트만)');
ok(/data-lg-add[^>]*disabled/.test(logCompactHtml(AST({ formOpen: true, form: { category: '현장 이슈', source: '현장', title: '크레인 충돌', dueDate: '', pjtId: '' } }))) && !/data-lg-add[^>]*disabled/.test(logCompactHtml(AST({ formOpen: true, form: { category: '현장 이슈', source: '현장', title: '크레인 충돌', dueDate: '', pjtId: 'p1' } }))) && logCompactHtml(AST({ formOpen: true, form: { category: '현장 이슈', source: '현장', title: '크레인 충돌', dueDate: '', pjtId: 'p1' } })).includes('<option value="p1" selected>'), '★ 전체 모드 폼: 프로젝트를 고르지 않으면 다른 칸이 다 차도 기록하기 비활성, 고르면 활성(고른 프로젝트가 선택 표시)');
ok(canSubmit(F(), true).ok === false && canSubmit(F(), true).why.includes('프로젝트') && canSubmit(F({ pjtId: 'p1' }), true).ok === true && canSubmit(F(), false).ok === true && canSubmit(F()).ok === true, '제출 검사: 전체 모드만 프로젝트 선택을 요구하고 개별 프로젝트 화면(이력 탭)은 그대로');
ok(!logCompactHtml(CST({ formOpen: true })).includes('data-lg-proj') && !logHtml(ST({ formOpen: true })).includes('data-lg-proj') && !logCompactHtml(CST()).includes('jh-pjt__lgproj'), '개별 프로젝트 화면에는 프로젝트 선택·프로젝트 칩이 나오지 않음(이력 탭은 그대로)');
ok(logCompactHtml(AST({ data: { urgent: [PE('y1', 'p1', '<img src=x onerror=1>', { title: 'x' })], changes: [], entries: [], total: 1, today: '2026-10-17', canConfirm: false } })).includes('&lt;img src=x onerror=1&gt;') && !logCompactHtml(AST({ data: { urgent: [PE('y1', 'a"><b>', '라벨', { title: 'x' })], changes: [], entries: [], total: 1, today: '2026-10-17', canConfirm: false } })).includes('<b>'), '전체 모드: 프로젝트 이름·id 도 이스케이프');

// ── 서버 규칙과 같은지(서버 저장소가 옆에 있을 때만 대조 — 분류·출처·금액 감지가 어긋나면 입력 중 안내와 서버 거절이 달라진다)
const SRV = ['/tmp/pf_diag/functions/pjt-log-act.js', new URL('../../portal-functions/functions/pjt-log-act.js', import.meta.url).pathname].find((p) => fs.existsSync(p));
if (SRV) {
  const { createRequire } = await import('module'); const srv = createRequire(import.meta.url)(SRV);
  ok(JSON.stringify(srv.CATEGORIES) === JSON.stringify(CATEGORIES) && JSON.stringify(srv.SOURCES) === JSON.stringify(SOURCES), '★ 분류 5종·출처 6종이 서버와 같음');
  const samples = ['단가 12만원으로 조정', '견적가 3,000,000원', '₩5,000 추가', '공사비 3억', '대금 지급 200 요청', '1,200,000원', 'FCU 183대 설치', '수량 1,500대로 변경', '11월 3일 납품 요청', 'CF-1000 규격 변경', '배관 100A → 80A 변경', '인상 요청 3', '금액 확인', '010-1234-5678 연락', 'a@b.kr', '900101-1234567', '평범한 문장'];
  ok(samples.every((s) => srv.hasMoney(s) === hasMoney(s) && srv.hasPersonal(s) === hasPersonal(s)), '★ 금액·연락처 감지 결과가 서버와 모든 표본에서 같음(' + samples.length + '개)');
  ok(Object.keys(STATUS_LABEL).sort().join() === srv.STATUSES.slice().sort().join(), '상태 6종 이름표가 서버 상태와 같음');
} else console.log('SKIP 서버 파일이 없어 서버 규칙 대조는 건너뜀(portal-functions 가 옆에 있을 때만 실행)');

console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
