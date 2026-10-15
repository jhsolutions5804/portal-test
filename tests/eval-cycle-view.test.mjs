import { teamCriteria, teamTypeOf, competencyItems, areaItems, blankAreas, emptyCycle, setRating, cycleSummary, teamLeaderOf, evalAccess, STATUS_LABEL } from '../app/modules/eval/evaluation.js';
import { evalBoardHtml, evalPanelHtml } from '../app/modules/eval/evaluation-view.js';
import { PERM_KEYS, isTeamLead, teamLeadChanges } from '../app/modules/company/staff-logic.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
// ── 부서별 기준
ok(teamTypeOf('PJT팀') === 'pjt' && teamTypeOf('PJT 2팀') === 'pjt' && teamTypeOf('인사총무팀') === 'nonpjt' && teamTypeOf('영업기획팀') === 'nonpjt' && teamTypeOf('재무회계팀') === 'nonpjt' && teamTypeOf('') === 'nonpjt' && teamTypeOf('새팀') === 'nonpjt', '★ 팀 유형: PJT팀(PJT n팀 포함)만 프로젝트 팀(동료평가 있음), 나머지·미지정·새 팀은 비프로젝트 팀');
ok(teamCriteria('PJT팀').achievement.length === 3 && teamCriteria('인사총무팀').achievement.length === 5 && teamCriteria('영업기획팀').achievement.length === 3 && teamCriteria('재무회계팀').achievement.length === 4 && teamCriteria('새팀').achievement.length === 3 && teamCriteria('인사총무팀').achievement[0].includes('업무 정확도'), '★ 부서마다 정기 업적 항목이 다름(PJT 3·인사총무 5·영업기획 3·재무회계 4, 새 팀은 기본 3항목)');
ok(competencyItems('과장').includes('리더십') && competencyItems('차장').includes('리더십') && !competencyItems('대리').includes('리더십') && !competencyItems('사원').includes('리더십') && competencyItems('대리').length === 4 && competencyItems('과장').length === 5, '역량 항목: 과장 이상은 리더십 추가(5항목), 대리·사원은 4항목');
const it = areaItems('PJT팀', '과장'); const bl = blankAreas(it);
ok(it.achievement.length === 3 && it.competency.length === 5 && it.conduct.length === 4 && bl.competency.length === 5 && bl.competency.every((x) => x === null), '항목 목록·빈 입력 틀은 항목 수와 같은 길이(비어 있는 칸은 null)');
// ── 입력·요약
const ra = setRating(bl, 'achievement', 1, 4); ok(ra.achievement[1] === 4 && bl.achievement[1] === null && setRating(bl, 'achievement', 1, 9).achievement[1] === null && setRating(bl, 'achievement', 1, 2.5).achievement[1] === null && setRating(bl, 'nope', 0, 3).nope === undefined, '점수 입력(1~5 정수만, 범위 밖·소수는 빈 값)은 원본을 바꾸지 않고 복사본을 돌려줌');
const W = (o) => Object.assign({ id: 'w1', name: '가', dept: 'PJT팀', rank: '과장', empNo: '23001', hireDate: '2023-01-01' }, o || {});
const full = (it2, v) => ({ achievement: it2.achievement.map(() => v), competency: it2.competency.map(() => v), conduct: it2.conduct.map(() => v) });
const wP = W(); const itP = areaItems(wP.dept, wP.rank); const cP = emptyCycle(wP, 2026);
ok(cP.teamType === 'pjt' && cP.workerId === 'w1' && cP.confirmed === false && cycleSummary(cP, { teamType: 'pjt', items: itP }).status === 'none', '새 평가 기록은 미시작 상태, 팀 유형은 부서로 정해짐');
cP.team.areas = full(itP, 4); let sP = cycleSummary(cP, { teamType: 'pjt', items: itP });
ok(sP.status === 'rating' && sP.teamScore === null && sP.peerAvg === null, '★ PJT팀은 동료평가가 없으면 팀 점수를 내지 않음(입력 중)');
cP.peers = { a: [4, 4, 4], b: [5, 5, 5] }; sP = cycleSummary(cP, { teamType: 'pjt', items: itP });
ok(sP.peerAvg === 4.5 && sP.teamScore === 82 && sP.status === 'team_done' && sP.final === null && sP.grade === '', '★ PJT팀 팀 점수 = 업적 32 + 역량 16 + 태도 16 + 동료(평균 4.5) 18 = 82, 팀 평가 완료지만 대표 확정 전이라 최종 점수·등급은 없음');
cP.ceo = { approved: true, score: null, comment: '' }; ok(cycleSummary(cP, { teamType: 'pjt', items: itP }).final === null, '대표가 승인해도 "확정" 전에는 최종 점수를 내지 않음');
cP.confirmed = true; let sC = cycleSummary(cP, { teamType: 'pjt', items: itP }); ok(sC.final === 82 && sC.grade === 'A' && sC.status === 'confirmed' && sC.decided, '★ "팀 결과 그대로 승인" 확정 → 최종 = 팀 점수 82, 등급 A');
cP.ceo = { approved: false, score: 90, comment: '' }; sC = cycleSummary(cP, { teamType: 'pjt', items: itP }); ok(sC.final === 86 && sC.grade === 'A' && sC.ceoScore === 90, '대표 점수 90점으로 확정 → (82 + 90) ÷ 2 = 86');
// 비프로젝트 팀(사장단 평가)
const wN = W({ id: 'w2', name: '나', dept: '인사총무팀', rank: '대리' }); const itN = areaItems(wN.dept, wN.rank); const cN = emptyCycle(wN, 2026);
cN.exec = { e1: { areas: full(itN, 4) }, e2: { areas: full(itN, 5) }, e3: { areas: Object.assign(full(itN, 4), { conduct: [4, 4, 4, null] }) } };
let sN = cycleSummary(cN, { teamType: 'nonpjt', items: itN });
ok(sN.raters === 2 && sN.teamScore === 90 && sN.type === 'nonpjt' && sN.status === 'team_done', '★ 비프로젝트 팀: 사장단 중 입력을 끝낸 2명(80점·100점)의 평균 90점이 팀 점수, 미완성 입력(항목 하나 비어 있음)은 제외');
cN.confirmed = true; cN.ceo = { approved: true }; ok(cycleSummary(cN, { teamType: 'nonpjt', items: itN }).final === 90 && cycleSummary(cN, { teamType: 'nonpjt', items: itN }).grade === 'S', '비프로젝트 팀 확정: 90점 → 등급 S');
ok(cycleSummary(null, { teamType: 'pjt' }).status === 'none' && cycleSummary({}, null).teamScore === null && STATUS_LABEL.confirmed === '확정', '기록이 없거나 비어 있어도 안전하게 미시작 처리');
// ── 팀장
const mem = [W({ id: 'a', name: '대리님', rank: '대리', empNo: '1', hireDate: '2022-01-01' }), W({ id: 'b', name: '과장님', rank: '과장', empNo: '2', hireDate: '2020-01-01', portalUid: 'U2' }), W({ id: 'c', name: '사원', rank: '사원', empNo: '3', hireDate: '2025-01-01' })];
ok(teamLeaderOf('PJT팀', mem, []).name === '과장님' && teamLeaderOf('PJT팀', mem, []).source === 'rank' && teamLeaderOf('PJT팀', mem, [{ uid: 'U1', teamLead: true, dept: 'PJT팀', empNo: '1', name: '대리님' }]).name === '대리님' && teamLeaderOf('PJT팀', mem, [{ uid: 'U1', teamLead: true, dept: 'PJT팀', empNo: '1' }]).source === 'flag' && teamLeaderOf('PJT팀', mem, [{ uid: 'U2', teamLead: true, dept: 'PJT팀' }]).workerId === 'b' && teamLeaderOf('PJT팀', [], []).source === 'none', '★ 팀장 = 직원 관리에서 지정한 사람(사번·계정으로 명부와 연결), 지정이 없으면 팀 최상급자, 팀원이 없으면 없음');
ok(teamLeaderOf('인사총무팀', mem, [{ uid: 'U1', teamLead: true, dept: 'PJT팀', empNo: '1' }]).source === 'rank', '다른 팀에 지정된 팀장은 이 팀의 팀장으로 쓰이지 않음');
// ── 직원 관리: 팀장 지정(같은 팀 한 명)·권한 키
const U = [{ uid: 'u1', dept: 'PJT팀', teamLead: true }, { uid: 'u2', dept: 'PJT팀' }, { uid: 'u3', dept: '인사총무팀', teamLead: true }, { uid: 'u4', dept: 'PJT팀' }];
ok(JSON.stringify(teamLeadChanges(U, 'u2', true)) === '{"u2":true,"u1":false}' && JSON.stringify(teamLeadChanges(U, 'u1', false)) === '{"u1":false}' && JSON.stringify(teamLeadChanges(U, 'u4', true)) === '{"u4":true,"u1":false}' && JSON.stringify(teamLeadChanges(U, 'zz', true)) === '{}' && JSON.stringify(teamLeadChanges([{ uid: 'x', dept: '' }], 'x', true)) === '{"x":true}' && isTeamLead(U[0]) && !isTeamLead(U[1]) && !isTeamLead(null), '★ 팀장 지정: 같은 팀에는 한 명만(새로 지정하면 기존 팀장 자동 해제), 다른 팀 팀장은 그대로, 해제는 본인만');
ok(PERM_KEYS.some(([k, l]) => k === 'hrEval' && l === '인사평가') && PERM_KEYS.length === 6, '직원 관리 권한 칩에 "인사평가"가 추가됨');
// ── 권한 보정(관리자=인사팀, 대표 직급 계정은 사장단)
const V = (o) => Object.assign({ id: 'u1', empNo: '24001', rank: '대리', perms: {} }, o || {});
ok(evalAccess(V({ admin: true }), { id: 'x' }, {}).level === 'hr' && evalAccess(V({ admin: true }), { id: 'x' }, {}).manage && !evalAccess(V({ admin: true }), { id: 'x' }, {}).edit && evalAccess(V({ empNo: 'admin', rank: '대표', admin: true }), { id: 'x' }, {}).confirm && evalAccess(V({ id: 'u1', admin: true }), { id: 'u1' }, { published: false }).level === 'self', '★ 인사 모듈 접근자(관리자)는 인사팀 권한(열람·운영), 대표 직급 계정(관리자 대표 포함)은 사장단, 본인 평가는 공개 전까지 가림');
// ── 화면 마크업
const me = { uid: 'M', name: '관리자 대표', rank: '대표', empNo: 'admin', admin: true, perms: {} };
const E = [W({ id: 'p1', name: '과장님', rank: '과장' }), W({ id: 'p2', name: '대리님', rank: '대리', hireDate: '2024-03-01' }), W({ id: 'p3', name: '사원님', rank: '사원', hireDate: '2025-05-01' }), W({ id: 'h1', name: '인사대리', dept: '인사총무팀', rank: '대리' })];
const st = { evTab: 'cycle', ec: { year: 2026, me, meWorkerId: '', eligible: E, cycles: { p1: Object.assign(emptyCycle(E[0], 2026), { team: { by: 'M', areas: full(areaItems('PJT팀', '과장'), 4) } }) }, users: [{ uid: 'U3', teamLead: true, dept: 'PJT팀', empNo: '23001', name: '과장님' }], sel: '', draft: null } };
const board = evalBoardHtml(st);
ok(!board.includes('data-ec-tab') && !board.includes('jh-segmented'), '★ 정기평가 화면 안에 탭이 없음 — 메뉴가 탭 역할을 하므로 화면 안 탭은 두지 않음');
ok(board.includes('2025-10-01 ~ 2026-09-30') && board.includes('참고자료로만') && board.includes('PJT팀 · 3명') && board.includes('인사총무팀 · 1명') && board.includes('팀장(1차 평가자) 과장님') && board.includes('업적 40 · 역량 20 · 태도·근태·안전 20 · 동료 20') && board.includes('업적 40 · 역량 40 · 태도·근태·안전 20') && board.includes('입력 중') && board.includes('미시작') && board.includes('data-ec-open="p1"') && board.includes('사장단 평가') && board.includes('내 권한: 사장단'), '★ 팀 보드: 평가 기간·"올해는 참고자료" 안내, 팀별 인원·팀장·비중(PJT팀은 동료 20, 비프로젝트 팀은 4/4/2)·진행 상태, 평가 버튼');
ok(!board.includes('올해 4분기') === false && board.includes('올해 4분기 입사자는 제외'), '대상 제외 규칙(올해 4분기 입사자) 안내가 보임');
const b2 = evalBoardHtml({ evTab: 'cycle', ec: Object.assign({}, st.ec, { me: { uid: 'Z', name: '일반', rank: '사원', perms: {} } }) });
ok(b2.includes('권한이 없습니다') && !b2.includes('data-ec-open') && !b2.includes('PJT팀 · 3명'), '★ 권한이 없는 직원에게는 평가 목록이 보이지 않고 안내만 보임');
const b3 = evalBoardHtml({ evTab: 'cycle', ec: Object.assign({}, st.ec, { me: { uid: 'H', name: '인사', rank: '대리', admin: true, perms: {} } }) });
ok(b3.includes('내 권한: 인사팀') && b3.includes('>보기<') && !b3.includes('>평가<'), '인사팀은 목록을 보되 버튼이 "보기"(입력은 사장단)');
st.ec.sel = 'p1'; st.ec.draft = JSON.parse(JSON.stringify(st.ec.cycles.p1)); const pan = evalPanelHtml(st);
ok(pan.includes('과장님 · PJT팀 · 과장') && pan.includes('1차 평가 — 팀장 과장님') && pan.includes('리더십') && pan.includes('동료평가') && pan.includes('data-ec-peer="p2|0"') && pan.includes('data-ec-peer="p3|2"') && !pan.includes('data-ec-peer="p1|') && pan.includes('data-ec-score="team:achievement|0|5"') && pan.includes('자기평가') && pan.includes('팀 결과 그대로 승인') && pan.includes('아직 반영할 수 없음'), '★ 평가 패널(PJT팀 과장): 팀장 1차 평가 항목(리더십 포함)·같은 팀 동료 입력(본인 제외)·자기평가·대표 확정 버튼, 동료 평균은 2명 이상 입력 전까지 "아직 반영할 수 없음"');
ok(pan.includes('aria-pressed="true"') && pan.match(/data-ec-score="team:achievement\|0\|4"[^>]*aria-pressed="true"/) !== null && pan.includes('disabled') === true && /data-ec-act="approve" disabled/.test(pan), '입력한 점수(4점)가 눌린 상태로 보이고, 팀 점수가 아직 없으면 "그대로 승인"은 잠김');
const stN = { evTab: 'cycle', ec: Object.assign({}, st.ec, { sel: 'h1', draft: emptyCycle(E[3], 2026) }) }; const panN = evalPanelHtml(stN);
ok(panN.includes('사장단 평가 — 관리자 대표') && panN.includes('data-ec-score="exec:achievement|4|3"') && !panN.includes('data-ec-peer') && !panN.includes('1차 평가 — 팀장') && panN.includes('사장단 3명이 각자 평가') && panN.includes('data-ec-score="exec:competency|3|5"'), '★ 평가 패널(인사총무팀): 사장단 평가(업적 5항목)이고 동료평가·팀장 평가 칸은 없음');
const stH = { evTab: 'cycle', ec: Object.assign({}, st.ec, { me: { uid: 'H', name: '인사', rank: '대리', admin: true, perms: {} }, sel: 'p1' }) }; const panH = evalPanelHtml(stH);
ok(/data-ec-score="team:achievement\|0\|5"[^>]*disabled/.test(panH) && /data-ec-act="save" disabled/.test(panH) && panH.includes('인사팀은 열람·운영만') && panH.includes('최종 확정은 대표만'), '★ 인사팀이 보면 평가 입력칸은 잠기고 저장·확정은 못 함(열람만), 안내 문구가 보임');
const stL = { evTab: 'cycle', ec: Object.assign({}, st.ec, { sel: 'p1', draft: Object.assign(JSON.parse(JSON.stringify(st.ec.cycles.p1)), { confirmed: true, ceo: { approved: true } }) }) }; const panL = evalPanelHtml(stL);
ok(/data-ec-score="team:achievement\|0\|5"[^>]*disabled/.test(panL) && panL.includes('확정된 평가는 수정할 수 없습니다') && panL.includes('data-ec-act="unconfirm"') && panL.includes('그대로 승인'), '확정된 평가는 입력이 잠기고 대표에게만 "확정 취소"가 보임');
import fs from 'node:fs';
const idx = fs.readFileSync(new URL('../app/modules/eval/ops.js', import.meta.url), 'utf8');
ok(idx.includes('createCycleController(') && idx.includes('cyc.onClick(ev)') && idx.includes('cyc.onInput(ev)') && idx.includes('cyc.onChange(ev)') && idx.includes('evalBoardHtml') && idx.includes('evalPanelHtml'), '★ 평가 모듈의 운영 화면에 정기평가 컨트롤러·팀 보드·평가 패널이 연결됨(클릭·입력·선택)');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
