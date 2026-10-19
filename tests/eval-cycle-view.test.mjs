import { leadAreasOf, leadNote, peerAggNote, saveBody, SERVER_ONLY_FIELDS, teamCriteria, teamTypeOf, competencyItems, areaItems, blankAreas, emptyCycle, setRating, cycleSummary, teamLeaderOf, evalAccess, STATUS_LABEL } from '../app/modules/eval/evaluation.js';
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
cP.peerAgg = { avg: 4.5, n: 2 }; sP = cycleSummary(cP, { teamType: 'pjt', items: itP });
ok(sP.peerAvg === 4.5 && sP.teamScore === 82 && sP.status === 'team_done' && sP.final === null && sP.grade === '', '★ 동료 평균은 서버가 집계한 값(peerAgg 4.5)을 씀 — PJT팀 팀 점수 = 업적 32 + 역량 16 + 태도 16 + 동료(평균 4.5) 18 = 82, 팀 평가 완료지만 대표 확정 전이라 최종 점수·등급은 없음');
// ── 동료평가는 서버 집계(peerAgg)만 쓴다: 평가자별 점수가 화면에 오가지 않고, 관리자가 대신 입력한 옛 값(peers)은 무시한다
{ const base = () => { const c = emptyCycle({ id: 'w1', name: '김', dept: 'PJT팀', rank: '사원' }, 2026); c.team.areas = full(itP, 4); return c; };
  const a = base(); a.peerAgg = { avg: 3.8, n: 3 }; const sa = cycleSummary(a, { teamType: 'pjt', items: itP });
  ok(sa.peerAvg === 3.8 && sa.raters === 3 && sa.teamScore === 32 + 16 + 16 + 15.2 && sa.status === 'team_done', '★ 서버 집계 평균 3.8(평가자 3명) → 동료 3.8/5×20 = 15.2점, 팀 점수 79.2, 평가자 수(raters)가 3으로 나옴');
  const b = base(); b.peerAgg = { avg: null, n: 1 }; const sb = cycleSummary(b, { teamType: 'pjt', items: itP });
  ok(sb.peerAvg === null && sb.teamScore === null && sb.raters === 1 && sb.status === 'rating', '★ 평가자가 2명 미만이라 서버가 평균을 비웠으면(null) 팀 점수를 내지 않고 평가자 수 1명을 알려 줌(점수를 임의로 채우지 않음)');
  const c = base(); c.peers = { x: [5, 5, 5], y: [5, 5, 5] }; const sc = cycleSummary(c, { teamType: 'pjt', items: itP });
  ok(sc.peerAvg === null && sc.teamScore === null, '★ 옛 방식(관리자가 평가자별로 대신 입력한 peers)은 더 이상 점수에 반영되지 않음 — 서버 집계가 없으면 동료 평균이 없는 것으로 봄');
  const d = base(); d.peers = { x: [1, 1, 1] }; d.peerAgg = { avg: 4, n: 3 }; ok(cycleSummary(d, { teamType: 'pjt', items: itP }).peerAvg === 4, '둘 다 있으면 서버 집계만 씀(옛 입력값이 섞이지 않음)');
  const e = base(); e.peerAgg = { avg: 'abc', n: 'x' }; const se = cycleSummary(e, { teamType: 'pjt', items: itP }); ok(se.peerAvg === null && se.teamScore === null, '서버 값이 이상한 형식이어도 오류 없이 평균 없음으로 처리');
  const f = base(); f.peerAgg = { avg: 6, n: 3 }; ok(cycleSummary(f, { teamType: 'pjt', items: itP }).peerAvg === null, '범위(1~5)를 벗어난 값은 평균으로 인정하지 않음');
  const g = emptyCycle({ id: 'w2', name: '박', dept: '인사총무팀', rank: '사원' }, 2026); g.peerAgg = { avg: 5, n: 4 }; g.exec = { e1: { areas: full(areaItems('인사총무팀', '사원'), 4) } }; ok(cycleSummary(g, { teamType: 'nonpjt', items: areaItems('인사총무팀', '사원') }).peerAvg === null, '비프로젝트 팀은 동료평가를 쓰지 않으므로 peerAgg 가 있어도 무시');
}
// ── 동료평가 집계 상태 안내(peerAggNote)
{ const n = (sm, st) => peerAggNote(sm, st);
  ok(n({ peerAvg: 4.2, raters: 3 }, 'closed').tone === 'ok' && /동료 평균 4\.2 \/ 5 \(평가자 3명/.test(n({ peerAvg: 4.2, raters: 3 }, 'closed').text) && /볼 수 없음/.test(n({ peerAvg: 4.2, raters: 3 }, 'published').text), '집계됐으면 평균과 평가자 수를 보여 주고 평가자별 점수는 볼 수 없다고 안내');
  ok(n({ peerAvg: null, raters: 1 }, 'closed').tone === 'low' && /1명뿐이라 평균을 반영하지 않습니다\(2명 이상 필요\)/.test(n({ peerAvg: null, raters: 1 }, 'closed').text), '★ 평가자가 1명이면 평균을 만들지 않았다고 이유와 함께 안내');
  ok(/"동료평가 집계"를 눌러/.test(n({ peerAvg: null, raters: 0 }, 'closed').text) && /"동료평가 집계"를 눌러/.test(n({ peerAvg: null, raters: 0 }, 'published').text), '마감·공개 상태인데 아직 집계 전이면 집계 버튼을 누르라고 안내');
  ok(/진행 중입니다/.test(n({ peerAvg: null, raters: 0 }, 'open').text) && /짐작할 수 있어 막아/.test(n({ peerAvg: null, raters: 0 }, 'open').text), '★ 진행 중에는 집계가 막혀 있는 이유(개인 점수 짐작 방지)를 안내');
  ok(/회차가 시작되면/.test(n({ peerAvg: null, raters: 0 }, '').text) && /회차가 시작되면/.test(n({ peerAvg: null, raters: 0 }, 'draft').text) && /회차가 시작되면/.test(n(null, undefined).text), '회차가 없거나 준비 상태·빈 입력이어도 오류 없이 시작 안내');
}
// ── 저장 본문: 서버 전용 필드(peerAgg)는 화면이 쓰지 않는다
{ const d = { year: 2026, workerId: 'w1', team: { areas: {} }, self: { text: '메모' }, peerAgg: { avg: 4.2, n: 3 }, confirmed: false }; const b = saveBody(d);
  ok(!('peerAgg' in b) && b.year === 2026 && b.workerId === 'w1' && b.self.text === '메모' && b.confirmed === false && 'team' in b, '★ 저장 본문에서 peerAgg 만 빠지고 나머지 필드(연도·근로자·팀 평가·자기평가·확정)는 그대로');
  ok('peerAgg' in d && d.peerAgg.avg === 4.2, '원본(화면 상태)은 바뀌지 않음 — 화면의 평균 표시는 유지됨');
  ok(SERVER_ONLY_FIELDS.join() === 'peerAgg,leadAgg' && JSON.stringify(saveBody(null)) === '{}' && JSON.stringify(saveBody(undefined)) === '{}', '서버 전용 필드 목록과 빈 입력 안전 처리');
}
// ── 팀장 1차 평가(서버가 마감 후 집계해 둔 leadAgg: 영역 점수)가 팀 점수의 기초가 된다
{ const base = (rank) => { const it = areaItems('PJT팀', rank); const c = emptyCycle({ id: 'w1', name: '김', dept: 'PJT팀', rank }, 2026); return { c, it }; };
  const { c: c1, it: it1 } = base('사원'); c1.leadAgg = { areas: { achievement: 4, competency: 5, conduct: 3 }, n: 1, by: 'uLead' }; c1.peerAgg = { avg: 4, n: 3 };
  const s1 = cycleSummary(c1, { teamType: 'pjt', items: it1 });
  ok(s1.teamScore === 32 + 20 + 12 + 16 && s1.status === 'team_done' && s1.leadFrom === 'lead', '★ 팀장 영역 점수(업적 4·역량 5·태도 3) + 동료 평균 4.0 → 32 + 20 + 12 + 16 = 80점, 점수의 출처는 팀장 평가(lead)');
  const ex = leadAreasOf(c1.leadAgg, it1); ok(ex && ex.achievement.length === 3 && ex.achievement.every((v) => v === 4) && ex.competency.length === it1.competency.length && ex.competency.every((v) => v === 5) && ex.conduct.length === it1.conduct.length && ex.conduct.every((v) => v === 3), '영역 점수를 그 영역의 세부 항목 개수만큼 펼침(업적 3개·역량 ' + it1.competency.length + '개·태도 ' + it1.conduct.length + '개) — 평균이 팀장이 준 영역 점수와 같음');
  const { c: c2, it: it2 } = base('과장'); c2.leadAgg = { areas: { achievement: 4, competency: 5, conduct: 3 }, n: 1, by: 'u' }; c2.peerAgg = { avg: 4, n: 3 }; ok(it2.competency.length === it1.competency.length + 1 && cycleSummary(c2, { teamType: 'pjt', items: it2 }).teamScore === 80, '★ 과장 이상은 역량 항목이 하나 더(리더십) 있어도 같은 영역 점수면 같은 점수 80점(항목 개수가 달라도 어긋나지 않음)');
  const { c: c3, it: it3 } = base('사원'); c3.team.areas = { achievement: [2, 2, 2], competency: it3.competency.map(() => 2), conduct: it3.conduct.map(() => 2) }; c3.peerAgg = { avg: 4, n: 3 };
  ok(cycleSummary(c3, { teamType: 'pjt', items: it3 }).teamScore === 16 + 8 + 8 + 16 && cycleSummary(c3, { teamType: 'pjt', items: it3 }).leadFrom === 'manual', '★ 팀장 평가가 도착하지 않았으면 사장단이 입력해 둔 점수(team.areas)로 계산(출처 manual) — 팀장이 제출하지 않아도 평가가 막히지 않음');
  const { c: c4, it: it4 } = base('사원'); c4.team.areas = { achievement: [2, 2, 2], competency: it4.competency.map(() => 2), conduct: it4.conduct.map(() => 2) }; c4.leadAgg = { areas: { achievement: 5, competency: 5, conduct: 5 }, n: 1, by: 'u' }; c4.peerAgg = { avg: 4, n: 3 };
  ok(cycleSummary(c4, { teamType: 'pjt', items: it4 }).teamScore === 40 + 20 + 20 + 16, '★ 둘 다 있으면 팀장 평가(서버 집계)가 우선 — 사장단이 미리 입력해 둔 값이 팀장 평가를 덮지 못함');
  for (const [bad, why] of [[{ areas: null, n: 0, by: null }, '영역 점수 없음'], [{ areas: { achievement: 6, competency: 5, conduct: 3 }, n: 1 }, '범위 밖'], [{ areas: { achievement: 4, competency: 5 }, n: 1 }, '영역 누락'], [{ areas: { achievement: 4.5, competency: 5, conduct: 3 }, n: 1 }, '정수 아님'], [{ areas: { achievement: '4', competency: 5, conduct: 3 }, n: 1 }, '숫자 아님'], [null, '없음'], ['x', '문자열']]) { const { c, it } = base('사원'); c.leadAgg = bad; c.peerAgg = { avg: 4, n: 3 }; ok(cycleSummary(c, { teamType: 'pjt', items: it }).teamScore === null && leadAreasOf(bad, it) === null, '팀장 집계가 올바르지 않으면(' + why + ') 점수를 만들지 않음'); }
  const { c: c5, it: it5 } = base('사원'); c5.leadAgg = { areas: { achievement: 4, competency: 4, conduct: 4 }, n: 1, by: 'u' }; ok(cycleSummary(c5, { teamType: 'pjt', items: it5 }).teamScore === null && cycleSummary(c5, { teamType: 'pjt', items: it5 }).status === 'rating', '팀장 평가가 있어도 동료 평균이 없으면 팀 점수는 아직 없음(입력 중)');
  const g = emptyCycle({ id: 'w2', name: '박', dept: '인사총무팀', rank: '사원' }, 2026); g.leadAgg = { areas: { achievement: 5, competency: 5, conduct: 5 }, n: 1, by: 'u' }; const itg = areaItems('인사총무팀', '사원'); g.exec = { e1: { areas: { achievement: itg.achievement.map(() => 4), competency: itg.competency.map(() => 4), conduct: itg.conduct.map(() => 4) } } }; ok(cycleSummary(g, { teamType: 'nonpjt', items: itg }).teamScore === 80, '비프로젝트 팀은 팀장 평가를 쓰지 않으므로 leadAgg 가 있어도 사장단 평가로만 계산(모두 4점 → 80점)');
  const note = (sm, st) => leadNote(sm, st); ok(/팀장 평가가 반영되었습니다/.test(note({ leadFrom: 'lead' }, 'closed').text) && /제출하지 않았거나 아직 집계되지 않았습니다/.test(note({ leadFrom: 'manual', leadN: 0 }, 'closed').text) && /2건/.test(note({ leadFrom: 'none', leadN: 2 }, 'closed').text) && /마감한 뒤/.test(note({ leadFrom: 'none', leadN: 0 }, 'open').text), '팀장 평가 안내: 반영됨 / 마감 후 미제출(사장단 대신 입력 가능) / 중복 2건 / 진행 중');
}
// ── 저장 본문에서 서버 전용 필드 두 가지 모두 제외
{ const b = saveBody({ year: 2026, peerAgg: { avg: 4 }, leadAgg: { areas: {} }, ceo: { approved: true } }); ok(!('peerAgg' in b) && !('leadAgg' in b) && b.ceo.approved === true && SERVER_ONLY_FIELDS.join() === 'peerAgg,leadAgg', '★ 저장 본문에서 peerAgg 와 leadAgg 둘 다 빠지고 나머지는 그대로'); }
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
ok(evalAccess(V({ admin: true }), { id: 'x' }, {}).level === 'hr' && evalAccess(V({ admin: true }), { id: 'x' }, {}).manage && !evalAccess(V({ admin: true }), { id: 'x' }, {}).edit && evalAccess(V({ empNo: 'admin', rank: '대표', admin: true, canManage: true }), { id: 'x' }, {}).confirm && evalAccess(V({ id: 'u1', admin: true }), { id: 'u1' }, { published: false }).level === 'self', '★ 인사 모듈 접근자(관리자)는 인사팀 권한(열람·운영), 사장단 계정(canManage)의 대표는 입력·확정, 본인 평가는 공개 전까지 가림');
ok(evalAccess(V({ empNo: 'admin', rank: '대표', admin: true }), { id: 'x' }, {}).level === 'exec' && !evalAccess(V({ empNo: 'admin', rank: '대표', admin: true }), { id: 'x' }, {}).edit && !evalAccess(V({ empNo: 'admin', rank: '대표', admin: true }), { id: 'x' }, {}).confirm && evalAccess(V({ empNo: 'admin', rank: '대표', admin: true }), { id: 'x' }, {}).manage, '★ 대표 직급의 관리자 시스템 계정이라도 사장단 계정 목록에 없으면(canManage 없음) 열람·운영만 되고 입력·확정은 안 됨 — 보안 규칙이 저장을 거부하기 때문');
// ── 화면 마크업
const me = { uid: '202TPNudKZghsTPAeeG206f8vbJ3', name: '조은별', rank: '대표', empNo: '00000', admin: true, perms: {} };   // 사장단 계정(보안 규칙 isCycleManager 의 목록에 있는 실제 계정 식별자)
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
ok(pan.includes('과장님 · PJT팀 · 과장') && pan.includes('1차 평가 — 팀장 과장님') && pan.includes('리더십') && pan.includes('동료평가') && pan.includes('data-ec-score="team:achievement|0|5"') && pan.includes('자기평가') && pan.includes('팀 결과 그대로 승인'), '★ 평가 패널(PJT팀 과장): 팀장 1차 평가 항목(리더십 포함)·자기평가·대표 확정 버튼이 그대로 있음');
ok(!pan.includes('data-ec-peer') && !/<select[^>]*동료|협업·소통<\/option>/.test(pan) && pan.includes('직원이 "내 평가"에서 직접 입력') && pan.includes('평가자별 점수는 누구도 볼 수 없고 평균만 반영') && pan.includes('평가 회차가 시작되면 동료평가가 진행되고'), '★ 평가자별 동료 점수 입력 칸이 더 이상 없음(익명 약속과 화면 일치) — 대신 직원이 직접 입력한다는 안내와 집계 상태 문구(회차 전)가 보임');
ok(!pan.includes('아직 반영할 수 없음') && !pan.includes('미리보기에서는 동료가 쓴 점수를 대신 입력'), '옛 미리보기 문구("대신 입력"·"아직 반영할 수 없음")가 남아 있지 않음');
ok(pan.includes('aria-pressed="true"') && pan.match(/data-ec-score="team:achievement\|0\|4"[^>]*aria-pressed="true"/) !== null && pan.includes('disabled') === true && /data-ec-act="approve" disabled/.test(pan), '입력한 점수(4점)가 눌린 상태로 보이고, 팀 점수가 아직 없으면 "그대로 승인"은 잠김');
const stN = { evTab: 'cycle', ec: Object.assign({}, st.ec, { sel: 'h1', draft: emptyCycle(E[3], 2026) }) }; const panN = evalPanelHtml(stN);
ok(panN.includes('사장단 평가 — 조은별') && panN.includes('data-ec-score="exec:achievement|4|3"') && !panN.includes('data-ec-peer') && !panN.includes('1차 평가 — 팀장') && panN.includes('사장단 3명이 각자 평가') && panN.includes('data-ec-score="exec:competency|3|5"'), '★ 평가 패널(인사총무팀): 사장단 평가(업적 5항목)이고 동료평가·팀장 평가 칸은 없음');
const stH = { evTab: 'cycle', ec: Object.assign({}, st.ec, { me: { uid: 'H', name: '인사', rank: '대리', admin: true, perms: {} }, sel: 'p1' }) }; const panH = evalPanelHtml(stH);
ok(/data-ec-score="team:achievement\|0\|5"[^>]*disabled/.test(panH) && /data-ec-act="save" disabled/.test(panH) && panH.includes('인사팀은 열람·운영만') && panH.includes('최종 확정은 대표만'), '★ 인사팀이 보면 평가 입력칸은 잠기고 저장·확정은 못 함(열람만), 안내 문구가 보임');
const stL = { evTab: 'cycle', ec: Object.assign({}, st.ec, { sel: 'p1', draft: Object.assign(JSON.parse(JSON.stringify(st.ec.cycles.p1)), { confirmed: true, ceo: { approved: true } }) }) }; const panL = evalPanelHtml(stL);
ok(/data-ec-score="team:achievement\|0\|5"[^>]*disabled/.test(panL) && panL.includes('확정된 평가는 수정할 수 없습니다') && panL.includes('data-ec-act="unconfirm"') && panL.includes('그대로 승인'), '확정된 평가는 입력이 잠기고 대표에게만 "확정 취소"가 보임');
import fs from 'node:fs';
const idx = fs.readFileSync(new URL('../app/modules/eval/ops.js', import.meta.url), 'utf8');
ok(idx.includes('createCycleController(') && idx.includes('cyc.onClick(ev)') && idx.includes('cyc.onInput(ev)') && idx.includes('cyc.onChange(ev)') && idx.includes('evalBoardHtml') && idx.includes('evalPanelHtml'), '★ 평가 모듈의 운영 화면에 정기평가 컨트롤러·팀 보드·평가 패널이 연결됨(클릭·입력·선택)');
// ── 패널: 팀장 평가가 서버에서 집계돼 왔으면 읽기 전용으로 보이고, 아니면 사장단이 대신 입력할 수 있다
{ const emp = E[0]; const mkSt = (cyc, status) => ({ evTab: 'cycle', ca: { year: 2026, cycle: status ? { status } : null, plan: { members: [], noAccount: [], total: 0 }, canManage: true }, ec: Object.assign({}, st.ec, { sel: emp.id, draft: cyc }) });
  const withLead = Object.assign(emptyCycle(emp, 2026), { leadAgg: { areas: { achievement: 4, competency: 5, conduct: 3 }, n: 1, by: 'uL' }, peerAgg: { avg: 4, n: 3 } });
  const pl = evalPanelHtml(mkSt(withLead, 'closed')); const dots = (area, n) => new RegExp('data-ec-score="team:' + area + '\\|\\d+\\|' + n + '"[^>]*aria-pressed="true"[^>]*disabled|data-ec-score="team:' + area + '\\|\\d+\\|' + n + '"[^>]*disabled[^>]*aria-pressed="true"');
  ok(pl.includes('팀장 평가가 반영되었습니다') && /data-ec-score="team:achievement\|0\|4"[^>]*aria-pressed="true"/.test(pl) && /data-ec-score="team:competency\|0\|5"[^>]*aria-pressed="true"/.test(pl) && /data-ec-score="team:conduct\|0\|3"[^>]*aria-pressed="true"/.test(pl), '★ 서버가 집계한 팀장 평가(업적 4·역량 5·태도 3)가 점수 버튼에 눌린 상태로 보이고 반영됐다는 안내가 있음');
  ok(!/data-ec-score="team:[a-z]+\|\d+\|\d"(?![^>]*disabled)/.test(pl), '★ 서버 집계 팀장 평가의 점수 버튼은 모두 잠겨 있음(사장단이 이 화면에서 고칠 수 없음 — 조정은 대표 점수로)');
  const manual = Object.assign(emptyCycle(emp, 2026), { peerAgg: { avg: 4, n: 3 } }); const pm = evalPanelHtml(mkSt(manual, 'closed'));
  ok(/data-ec-score="team:achievement\|0\|5"(?![^>]*disabled)/.test(pm) && pm.includes('아직 집계되지 않았습니다') , '팀장 평가가 아직 집계되지 않았으면 기존처럼 사장단이 대신 입력할 수 있고 "동료평가 집계"를 누르라고 안내');
  const open = evalPanelHtml(mkSt(manual, 'open')); ok(open.includes('팀장 평가 진행 중입니다') && open.includes('내 평가'), '진행 중에는 팀장이 "내 평가"에서 입력하는 중이라는 안내');
  const dup = Object.assign(emptyCycle(emp, 2026), { leadAgg: { areas: null, n: 2, by: null } }); const pd = evalPanelHtml(mkSt(dup, 'closed')); ok(pd.includes('팀장 평가가 2건 제출되어') && /data-ec-score="team:achievement\|0\|5"(?![^>]*disabled)/.test(pd), '팀장 평가가 중복 제출됐으면 이유를 알리고 사장단이 대신 입력할 수 있게 둠');
}
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
