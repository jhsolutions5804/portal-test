/* 인사평가 규칙 — 정기평가 + 수시평가 (설계서 docs/hr-evaluation-design.md, 대표님 확정 2026-10-15).
   화면·저장소와 무관한 순수 함수만 둔다(시험: tests/hr-evaluation.test.mjs). 점수는 모두 소수 첫째 자리로 반올림. */
export const RANK_ORDER = ['대표', '부사장', '전무', '상무', '이사', '부장', '차장', '과장', '대리', '주임', '사원'];
export const EXEC_RANKS = ['대표', '부사장'];                       // 사장단(평가 대상 아님·평가자)
export const SYSTEM_EMPNOS = /^(admin|test)$/i;                      // 시스템·시험 계정
const r1 = (n) => Math.round(n * 10) / 10;
const num = (v) => (v == null || v === '' ? NaN : Number(v));
const isKey = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

/** 정기평가 영역 비중: PJT팀은 동료 20, 비프로젝트 팀은 동료 없이 역량 40 */
export const REGULAR_WEIGHTS = { pjt: { achievement: 40, competency: 20, conduct: 20, peer: 20 }, nonpjt: { achievement: 40, competency: 40, conduct: 20, peer: 0 } };
export const WEIGHTS_BY = (teamType) => REGULAR_WEIGHTS[teamType === 'pjt' ? 'pjt' : 'nonpjt'];
/** 수시평가 현장 6항목(공정 목표·일정·품질·안전·협업(동료 평균)·보고 충실도(자동)) */
export const ADHOC_ITEMS = ['progress', 'schedule', 'quality', 'safety', 'collab', 'report'];
/** 합산·확정 비율(대표님 결정: 수시 40, 팀 점수 대 대표 점수 5:5, 현장 대 사장단 5:5, 사장단 안에서 개인 60 : 프로젝트 성과 40) */
export const RATIOS = { adhocInRegular: 0.4, ceo: 0.5, adhocSite: 0.5, execPerson: 0.6 };
export const GRADES = [['S', 90], ['A', 80], ['B', 65], ['C', -Infinity]];
export const gradeOf = (score) => { if (score == null || score === '') return ''; const s = Number(score); if (!isFinite(s)) return ''; return GRADES.find((g) => s >= g[1])[0]; };   // 점수가 없으면 등급도 없음(null·빈 값을 0점으로 보지 않는다)

/** 평가 기간: 전년 10월 1일 ~ 당해 9월 30일 (2026년분 = 2025-10-01 ~ 2026-09-30) */
export function evalPeriod(year) { const y = Number(year); if (!Number.isInteger(y) || y < 2000 || y > 2100) return null; return { from: (y - 1) + '-10-01', to: y + '-09-30' }; }
/** 평가 대상인가: 재직·평가 기간 끝(9/30) 이하 입사·사장단/시스템 계정 제외. 당해 4분기(10월~) 입사자는 제외 */
export function isEvalTarget(worker, year) {
  const w = worker || {}; const p = evalPeriod(year); if (!p) return false;
  if (SYSTEM_EMPNOS.test(String(w.empNo || '').trim()) || EXEC_RANKS.indexOf(String(w.rank || '').trim()) !== -1) return false;
  if (w.resigned === true || (w.resignDate && isKey(w.resignDate) && w.resignDate < p.from)) return false;
  const hire = String(w.hireDate || ''); if (!isKey(hire)) return false;
  return hire <= p.to;
}

/** 영역 점수 = 항목 평균(5점 척도) ÷ 5 × 영역 비중. 항목이 하나도 없으면 null */
export function areaScore(items, weight) {
  const v = (items || []).map(num).filter((n) => isFinite(n)); if (!v.length || !(weight > 0)) return v.length ? 0 : null;
  if (v.some((n) => n < 1 || n > 5)) return null;
  return r1(v.reduce((a, b) => a + b, 0) / v.length / 5 * weight);
}
/** 정기평가 팀 점수(100점): 영역별 점수 합. 비중이 있는 영역에 입력이 없으면 null(미완성) */
export function regularTeamScore(input, teamType) {
  const w = WEIGHTS_BY(teamType); const x = input || {}; let sum = 0;
  for (const k of ['achievement', 'competency', 'conduct', 'peer']) { if (!(w[k] > 0)) continue; const s = areaScore(x[k], w[k]); if (s == null) return null; sum += s; }
  return r1(sum);
}
/** 동료평가 집계(익명 평균): 평가자 점수(각 5점 평균) 목록 → 평균. 2명 미만이면 반영 안 함(null), 4명 이상이면 최고·최저 제외 */
export function peerAverage(scores) {
  const v = (scores || []).map(num).filter((n) => isFinite(n) && n >= 1 && n <= 5).sort((a, b) => a - b); const n = v.length;
  if (n < 2) return null; const use = n >= 4 ? v.slice(1, -1) : v;
  return Math.round(use.reduce((a, b) => a + b, 0) / use.length * 100) / 100;
}
/** 수시평가 평가자: 참여자 중 가장 상급자(관리자 제외). 직급이 같으면 입사일이 빠른 사람, 그래도 같으면 이름 순 */
export function pickAdhocEvaluator(participants) {
  const idx = (r) => { const i = RANK_ORDER.indexOf(String(r || '').trim()); return i === -1 ? 99 : i; };
  const list = (participants || []).filter((p) => p && !p.admin && !SYSTEM_EMPNOS.test(String(p.empNo || '').trim()) && EXEC_RANKS.indexOf(String(p.rank || '').trim()) === -1);
  if (!list.length) return null;
  return list.slice().sort((a, b) => idx(a.rank) - idx(b.rank) || String(a.hireDate || '9999').localeCompare(String(b.hireDate || '9999')) || String(a.name || '').localeCompare(String(b.name || ''), 'ko'))[0];
}

/** 수시 현장 점수(100점): 6항목 5점 척도 평균 ÷ 5 × 100 — 협업은 동료 평균으로 채우고, 보고 충실도는 자동 집계 값(1~5)을 받는다 */
export function adhocSiteScore(items) {
  const x = items || {}; const v = ADHOC_ITEMS.map((k) => num(x[k]));
  if (v.some((n) => !isFinite(n) || n < 1 || n > 5)) return null;
  return r1(v.reduce((a, b) => a + b, 0) / v.length / 5 * 100);
}
/** 사장단 점수(100점): 3명 각자 (개인 점수·프로젝트 성과 점수, 5점 척도) → 사람별 개인 60% + 성과 40% → 사장단 평균 */
export function execScore(rates) {
  const v = (rates || []).filter((r) => r && isFinite(num(r.person)) && isFinite(num(r.project)) && r.person >= 1 && r.person <= 5 && r.project >= 1 && r.project <= 5);
  if (!v.length) return null;
  const each = v.map((r) => (r.person * RATIOS.execPerson + r.project * (1 - RATIOS.execPerson)) / 5 * 100);
  return r1(each.reduce((a, b) => a + b, 0) / each.length);
}
/** 수시 최종 = 현장 점수 50% + 사장단 점수 50% (둘 중 하나가 없으면 null) */
export function adhocFinal(site, exec) { if (site == null || exec == null || !isFinite(site) || !isFinite(exec)) return null; return r1(site * RATIOS.adhocSite + exec * (1 - RATIOS.adhocSite)); }

/** 정기평가에 수시평가 합산(방식 B): 정기 점수 × 60% + 수시 평균 × 40%. 수시가 없으면 정기 점수만 */
export function combineRegular(base, adhocScores) {
  if (base == null || !isFinite(base)) return null;
  const v = (adhocScores || []).map(num).filter((n) => isFinite(n)); if (!v.length) return r1(base);
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  return r1(base * (1 - RATIOS.adhocInRegular) + avg * RATIOS.adhocInRegular);
}
/** 최종 확정: 팀 점수 50% + 대표 점수 50%. 대표가 "팀 결과 그대로 승인"(ceoScore 없음/같은 값)이면 팀 점수 그대로 */
export function finalizeScore(teamScore, ceoScore) {
  if (teamScore == null || !isFinite(teamScore)) return null;
  if (ceoScore == null || ceoScore === '' || !isFinite(num(ceoScore))) return r1(teamScore);
  return r1(teamScore * (1 - RATIOS.ceo) + Number(ceoScore) * RATIOS.ceo);
}

/** 프로젝트 실현 마진율(%) — 프로젝트마다 따로. 1단계: (청구 − 지급) ÷ 청구, 2단계: 노무비 차감, 3단계: 직접비 차감. 청구가 0 이하이면 null */
export function projectMargin(p) {
  const x = p || {}; const billed = typeof x.done === 'number' ? x.done : NaN; if (!isFinite(billed) || billed <= 0) return null;
  // 실투입비 = 지급 누계(노무 포함 — 따로 또 빼면 이중 차감) + 직접비(전표의 프로젝트 표시 현장 원가) + 자체 인력 인건비(공수 비율 배분). 옛 labor 입력은 받지 않는다
  const cost = [x.paid, x.direct, x.ownLabor].map((v) => (isFinite(num(v)) ? num(v) : 0)).reduce((a, b) => a + b, 0);
  return Math.round((billed - cost) / billed * 1000) / 10;
}
export const DEFAULT_MARGIN_BANDS = [{ min: 3, score: 5 }, { min: 1, score: 4 }, { min: -1, score: 3 }, { min: -3, score: 2 }, { min: -Infinity, score: 1 }];
/** 목표 마진율 대비 점수(1~5): 차이(%p)를 구간에 대입. 구간은 프로젝트별로 바꿀 수 있다 */
export function marginScore(target, actual, bands) {
  const t = num(target), a = num(actual); if (!isFinite(t) || !isFinite(a)) return null;
  const diff = Math.round((a - t) * 10) / 10; const b = (bands && bands.length ? bands : DEFAULT_MARGIN_BANDS).slice().sort((p, q) => q.min - p.min);
  const hit = b.find((x) => diff >= x.min); return hit ? hit.score : null;
}
/** 프로젝트 성과 요약: 목표·실현 마진율·차이·점수(프로젝트 단위로 한 번 계산해 참여자 전원에게 공통으로 보여 준다) */
export function projectPerformance(p) {
  const x = p || {}; const actual = projectMargin(x); const t = num(x.target);
  return { target: isFinite(t) ? t : null, actual, diff: actual != null && isFinite(t) ? Math.round((actual - t) * 10) / 10 : null, score: actual != null ? marginScore(x.target, actual, x.bands) : null };
}

/** 열람·조작 권한(설계서 8절, 대표님 2026-10-15 "인사팀은 인사평가를 볼 수 있어야 업무 처리하지"):
 *  - 사장단(대표·부사장): 모든 점수·코멘트를 보고 평가를 입력·수정. 최종 확정은 대표만.
 *  - 인사팀(직원 관리에서 hrEval 권한을 받은 사람): **다른 사람의** 점수·코멘트를 모두 보고 양식 배포·진행 관리·집계·평가표 출력 등 운영 업무를 한다. 평가 입력·수정·확정은 못 한다.
 *  - 본인: 자기평가를 쓰고, 본인 결과는 **확정·공개된 뒤에만** 본다(인사팀이라도 본인 평가는 공개 전까지 가림 — 이해 충돌 방지).
 *  - 동료평가의 평가자별 점수는 누구에게도 보이지 않는다(평균만). 그 밖의 직원은 아무것도 못 본다. */
export function evalAccess(viewer, target, ctx) {
  const v = viewer || {}, t = target || {}, c = ctx || {};
  const rank = String(v.rank || '').trim();
  const exec = EXEC_RANKS.indexOf(rank) !== -1;   // 대표·부사장(대표님이 쓰는 관리자 계정 포함)
  const hr = !exec && (v.admin === true || !!(v.perms && v.perms.hrEval === true));   // 인사 모듈 접근자(관리자)이거나 직원 관리에서 "인사평가" 권한을 받은 사람
  const same = v.id != null && t.id != null && String(v.id) === String(t.id);
  const none = { level: 'none', viewScores: false, viewComments: false, viewPeerRaw: false, edit: false, confirm: false, manage: false, selfEval: false };
  // 입력·확정은 직급이 아니라 보안 규칙(isCycleManager)과 같은 "사장단 계정"(viewer.canManage — withManage 가 붙임)이어야 한다. 직급만 사장단인 계정(관리자 시스템 계정 등)은 열람·운영은 되지만 저장이 규칙에서 거부되므로 입력을 열지 않는다.
  if (exec) return { level: 'exec', viewScores: true, viewComments: true, viewPeerRaw: false, edit: v.canManage === true, confirm: v.canManage === true && rank === '대표', manage: true, selfEval: false };
  if (same) return Object.assign({}, none, { level: 'self', viewScores: !!c.published, viewComments: !!c.published, selfEval: true });
  if (hr) return { level: 'hr', viewScores: true, viewComments: true, viewPeerRaw: false, edit: false, confirm: false, manage: true, selfEval: false };
  return none;
}

/* ───────── 부서(팀)별 평가 기준·정기평가 기록(cycle) — 화면용 순수 규칙 ───────── */
export const COMPETENCY_ITEMS = ['문제해결', '직무 전문성', '협업·소통', '책임감·추진력'];
export const LEADER_ITEM = '리더십';                                   // 과장 이상 추가
export const CONDUCT_ITEMS = ['근태 성실', '안전교육·검진 유효', '보고 적시성', '규정 준수'];
export const PEER_ITEMS = ['협업·소통', '신뢰·책임감', '업무 지원'];
export const AREA_LABELS = { achievement: '업적', competency: '역량', conduct: '태도·근태·안전', peer: '동료평가' };
/** 부서별 정기 업적 항목(설계서 4절). PJT팀의 정기 업적은 프로젝트 활동을 뺀 연간 지표(프로젝트 활동은 수시평가가 맡는다) */
export const TEAM_CRITERIA = {
  'PJT팀': { type: 'pjt', achievement: ['연간 안전교육 이수', '자격 취득·기술 습득', '후배 지도·팀 운영'] },
  '인사총무팀': { type: 'nonpjt', achievement: ['업무 정확도(급여·계약·4대보험·신고)', '기한 준수', '총무 관리(임대·차량·갱신)', '직원 지원·개선', '개인정보 준수'] },
  '영업기획팀': { type: 'nonpjt', achievement: ['견적 발행 적시성', '청구·수금 관리', '정산서 오류율'] },
  '재무회계팀': { type: 'nonpjt', achievement: ['전표 정확도', '월 마감 기한 준수', '분류 대기 잔여', '세무 자료 적시 제공'] },
};
const GENERIC_CRITERIA = { type: 'nonpjt', achievement: ['업무 정확도', '기한 준수', '개선 기여'] };
export function teamCriteria(dept) { const d = String(dept || '').trim(); return TEAM_CRITERIA[d] || (/^PJT\s*\d+\s*팀$/.test(d) ? TEAM_CRITERIA['PJT팀'] : GENERIC_CRITERIA); }
export const teamTypeOf = (dept) => teamCriteria(dept).type;
export function competencyItems(rank) { const i = RANK_ORDER.indexOf(String(rank || '').trim()); return i !== -1 && i <= RANK_ORDER.indexOf('과장') ? COMPETENCY_ITEMS.concat([LEADER_ITEM]) : COMPETENCY_ITEMS.slice(); }
export function areaItems(dept, rank) { return { achievement: teamCriteria(dept).achievement.slice(), competency: competencyItems(rank), conduct: CONDUCT_ITEMS.slice() }; }
export const blankAreas = (items) => ({ achievement: items.achievement.map(() => null), competency: items.competency.map(() => null), conduct: items.conduct.map(() => null) });
export function emptyCycle(w, year) { const x = w || {}; const items = areaItems(x.dept, x.rank); return { year: Number(year), workerId: x.id || '', name: x.name || '', dept: x.dept || '', rank: x.rank || '', teamType: teamTypeOf(x.dept), team: { by: '', areas: blankAreas(items) }, peers: {}, self: { text: '' }, exec: {}, ceo: { approved: false, score: null, comment: '' }, confirmed: false }; }
/** 5점 척도 값 설정(범위 밖·빈 값은 null) — 원본을 바꾸지 않고 복사본을 돌려준다 */
export function setRating(areas, area, idx, val) { const a = JSON.parse(JSON.stringify(areas || {})); if (!Array.isArray(a[area])) return a; const n = Number(val); a[area][idx] = n >= 1 && n <= 5 && Number.isInteger(n) ? n : null; return a; }
const itemAvg = (arr, need) => { const v = (arr || []).map(num); if (v.length < need || v.slice(0, need).some((n) => !isFinite(n))) return null; return v.slice(0, need).reduce((a, b) => a + b, 0) / need; };
const hasInput = (areas) => !!areas && ['achievement', 'competency', 'conduct'].some((k) => (areas[k] || []).some((n) => isFinite(num(n))));
export const STATUS_LABEL = { none: '미시작', rating: '입력 중', team_done: '팀 평가 완료', confirmed: '확정' };
/** 정기평가 기록 요약: 팀 점수·동료 평균·대표 반영·최종 점수·등급·진행 상태.
 *  PJT팀 = 팀장(1차) 점수 + 동료 평균, 비프로젝트 팀 = 사장단 각자 점수의 평균. 대표가 확정하기 전에는 최종 점수를 내지 않는다 */
export function cycleSummary(cycle, info) {
  const c = cycle || {}, i = info || {}; const type = i.teamType === 'pjt' ? 'pjt' : 'nonpjt'; const it = i.items || areaItems(i.dept, i.rank);
  const complete = (r) => !!r && ['achievement', 'competency', 'conduct'].every((k) => itemAvg(r[k], it[k].length) != null);
  let teamScore = null, peerAvg = null, raters = 0, input = false, leadFrom = 'none', leadN = 0;
  if (type === 'pjt') {
    // 동료평가는 직원들이 "내 평가"에서 낸 점수를 서버(evalAct aggregatePeers)가 마감 뒤에 집계해 둔 값(peerAgg: 평균·평가자 수)만 쓴다 — 평가자별 점수는 화면에도 오가지 않는다(익명).
    // 평가자가 2명 미만이면 서버가 평균을 비워(null) 두므로 팀 점수를 내지 않는다. 옛 방식(관리자가 평가자별로 대신 입력한 c.peers)은 더 이상 읽지 않는다.
    const pa = c.peerAgg || {}; const paAvg = Number(pa.avg); peerAvg = (pa.avg !== null && pa.avg !== undefined && pa.avg !== '' && isFinite(paAvg) && paAvg >= 1 && paAvg <= 5) ? paAvg : null;
    const paN = Number(pa.n); raters = isFinite(paN) && paN > 0 ? Math.floor(paN) : 0;
    // 팀장의 1차 평가: 서버가 마감 후 집계해 둔 값(leadAgg)이 올바르면 그것을 쓰고(서버만 쓰므로 위조 불가), 없으면 사장단이 화면에서 대신 입력한 값(team.areas)을 쓴다(팀장이 제출하지 않아도 평가가 막히지 않게)
    const la = leadAreasOf(c.leadAgg, it); leadFrom = la ? 'lead' : (c.team && c.team.areas && hasInput(c.team.areas) ? 'manual' : 'none'); leadN = Number(c.leadAgg && c.leadAgg.n) || 0;
    const r = la || (c.team && c.team.areas); input = hasInput(r) || raters > 0;
    if (complete(r) && peerAvg != null) teamScore = regularTeamScore({ achievement: r.achievement, competency: r.competency, conduct: r.conduct, peer: [peerAvg] }, 'pjt');
  } else {
    const all = Object.values(c.exec || {}); input = all.some((e) => hasInput(e && e.areas)); const done = all.filter((e) => complete(e && e.areas)); raters = done.length;
    const sc = done.map((e) => regularTeamScore(e.areas, 'nonpjt')).filter((x) => x != null); teamScore = sc.length ? r1(sc.reduce((a, b) => a + b, 0) / sc.length) : null;
  }
  const ceo = c.ceo || {}; const ceoScore = ceo.approved ? null : (ceo.score != null && ceo.score !== '' && isFinite(num(ceo.score)) ? Number(ceo.score) : null);
  const decided = !!(ceo.approved || ceoScore != null);
  const final = c.confirmed === true && decided ? finalizeScore(teamScore, ceoScore) : null;
  input = input || !!(c.self && String(c.self.text || '').trim());
  const status = final != null ? 'confirmed' : teamScore != null ? 'team_done' : input ? 'rating' : 'none';
  return { type, teamScore, peerAvg, raters, leadFrom, leadN, ceoScore, decided, final, grade: final == null ? '' : gradeOf(final), status };
}
/** 서버(evalAct)만 쓰는 필드 — 화면은 읽기만 한다. 저장 본문에 넣으면 ① 패널을 열어 둔 사이 서버가 새로 집계한 값을 화면의 옛 복제본이 덮어쓰고 ② 관리자가 동료 평균을 임의로 저장(위조)할 수 있다. */
export const SERVER_ONLY_FIELDS = ['peerAgg', 'leadAgg'];
/** 저장할 문서 본문: 화면 상태의 복사본에서 서버 전용 필드를 뺀다(원본은 바꾸지 않는다) */
export function saveBody(draft) { const o = Object.assign({}, draft || {}); SERVER_ONLY_FIELDS.forEach((k) => { delete o[k]; }); return o; }
/** 서버가 마감 후 집계해 둔 팀장 1차 평가(leadAgg: 영역 점수 업적·역량·태도 각 1~5 정수) → 세부 항목 점수 배열. 영역 안의 모든 항목에 같은 영역 점수를 채우므로
 *  영역 평균이 팀장이 준 영역 점수와 정확히 같고, 팀·직급마다 항목 개수가 달라도(과장 이상은 리더십 추가) 어긋나지 않는다. 모양이 올바르지 않으면 null. */
export function leadAreasOf(leadAgg, items) {
  const a = leadAgg && typeof leadAgg === 'object' ? leadAgg.areas : null; if (!a || typeof a !== 'object' || !items) return null;
  const out = {}; for (const k of ['achievement', 'competency', 'conduct']) { const v = a[k]; if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5 || !Array.isArray(items[k])) return null; out[k] = items[k].map(() => v); }
  return out;
}
/** 정기평가 패널의 팀장 1차 평가 상태 안내 — sm = cycleSummary 결과(leadFrom: 'lead'(서버 집계) | 'manual'(사장단 입력) | 'none', leadN: 제출 건수), cycleStatus = 평가 회차 상태 */
export function leadNote(sm, cycleStatus) {
  const s = sm || {}; const st = String(cycleStatus || ''); const n = Number(s.leadN) || 0;
  if (s.leadFrom === 'lead') return { tone: 'ok', text: '팀장 평가가 반영되었습니다(마감 후 서버가 집계한 값, 영역별 점수 — 이 화면에서는 고칠 수 없습니다). 조정이 필요하면 대표 점수로 반영해 주세요.' };
  if (n > 1) return { tone: 'low', text: '팀장 평가가 ' + n + '건 제출되어 어느 것을 쓸지 정할 수 없습니다. 영역 점수를 반영하지 않았으니 인사팀에 확인해 주세요(사장단이 아래에 대신 입력할 수 있습니다).' };
  if (st === 'closed' || st === 'published') return s.leadFrom === 'manual' ? { tone: 'wait', text: '팀장이 평가를 제출하지 않았거나 아직 집계되지 않았습니다. 지금은 사장단이 입력한 점수를 씁니다("동료평가 집계"를 누르면 제출된 팀장 평가를 반영합니다).' } : { tone: 'wait', text: '팀장 평가가 아직 집계되지 않았습니다. 평가 회차 카드의 "동료평가 집계"를 눌러 주세요(팀장이 제출하지 않았다면 사장단이 아래에 대신 입력할 수 있습니다).' };
  if (st === 'open') return { tone: 'wait', text: '팀장 평가 진행 중입니다. 평가를 마감한 뒤 집계하면 반영됩니다.' };
  return { tone: 'wait', text: '평가 회차가 시작되면 팀장이 "내 평가"에서 입력하고, 마감 후 집계하면 반영됩니다.' };
}
/** 정기평가 화면의 동료평가 집계 상태 안내 — 서버가 집계해 둔 값(peerAgg)만 본다. cycleStatus = 평가 회차 상태(draft·open·closed·published·'' )
 *  반환: { tone: 'ok'|'wait'|'low', text } */
export function peerAggNote(sm, cycleStatus) {
  const s = sm || {}; const n = Number(s.raters) || 0; const st = String(cycleStatus || '');
  if (s.peerAvg != null) return { tone: 'ok', text: '동료 평균 ' + s.peerAvg + ' / 5 (평가자 ' + n + '명, 평가자별 점수는 볼 수 없음)' };
  if (n > 0 && n < 2) return { tone: 'low', text: '동료 평가자가 ' + n + '명뿐이라 평균을 반영하지 않습니다(2명 이상 필요). 익명 보호를 위해 평균을 만들지 않았습니다.' };
  if (st === 'closed' || st === 'published') return { tone: 'wait', text: '아직 집계되지 않았습니다. 평가 회차 카드의 "동료평가 집계"를 눌러 주세요.' };
  if (st === 'open') return { tone: 'wait', text: '동료평가 진행 중입니다. 평가를 마감한 뒤 집계하면 평균이 표시됩니다(진행 중에 집계하면 개인 점수를 짐작할 수 있어 막아 두었습니다).' };
  return { tone: 'wait', text: '평가 회차가 시작되면 동료평가가 진행되고, 마감 후 집계하면 평균이 표시됩니다.' };
}
/** 팀의 1차 평가자: 직원 관리에서 "팀장"으로 지정된 사람, 없으면 팀 최상급자(관리자 제외)로 대신한다 */
export function teamLeaderOf(dept, members, users) {
  const d = String(dept || '').trim(); const list = members || [];
  const flagged = (users || []).find((u) => u && u.teamLead === true && String(u.dept || '').trim() === d);
  if (flagged) { const w = list.find((m) => (m.portalUid && m.portalUid === flagged.uid) || (m.empNo && flagged.empNo && String(m.empNo) === String(flagged.empNo))); return { workerId: w ? w.id : '', name: (w && w.name) || flagged.name || '', uid: flagged.uid || '', source: 'flag' }; }
  const top = pickAdhocEvaluator(list.map((m) => ({ name: m.name, rank: m.rank, hireDate: m.hireDate, empNo: m.empNo, id: m.id })));
  return top ? { workerId: top.id || '', name: top.name || '', uid: '', source: 'rank' } : { workerId: '', name: '', uid: '', source: 'none' };
}

/* ───────── 수시평가(프로젝트 종료 시) — 화면용 순수 규칙 (설계서 5·6절) ───────── */
export const ADHOC_LABELS = { progress: '담당 공정 목표 달성', schedule: '일정 준수', quality: '품질(재작업·검사)', safety: '안전수칙 준수·위험 제보', collab: '협업·소통(동료 평균)', report: '보고 충실도(공사일보·출역)' };
export const ADHOC_ENTRY_ITEMS = ['progress', 'schedule', 'quality', 'safety', 'report'];   // 평가자가 입력 — 협업(collab)은 동료평가 평균으로 자동
/** 프로젝트 참여자: 명부(workers)에서 활동 중이고 평가 대상(사장단·관리자 시스템 계정 제외)인 근로자 */
export function adhocParticipants(roster, hrWorkers) {
  const byId = new Map((hrWorkers || []).map((w) => [w.id, w]));
  return (roster || []).filter((r) => r && r.active !== false).map((r) => byId.get(r.id)).filter((w) => w && w.status !== 'resigned' && EXEC_RANKS.indexOf(String(w.rank || '').trim()) === -1 && !SYSTEM_EMPNOS.test(String(w.empNo || '').trim()));
}
export function emptyAdhoc(w, pjt) { const x = w || {}, p = pjt || {}; return { pjtId: p.id || '', pjtName: p.name || '', workerId: x.id || '', name: x.name || '', rank: x.rank || '', items: { progress: null, schedule: null, quality: null, safety: null, report: null }, peers: {}, exec: {}, evaluator: '', confirmed: false }; }
/** 수시평가 기록 요약: 협업 = 동료 3항목 평균의 평균(2명 미만이면 없음), 현장 점수·사장단 점수·최종 점수. 사장단 점수는 사장단 각자 (개인 점수, 그 프로젝트 성과 점수) 로 계산 */
export function adhocSummary(rec, proj) {
  const r = rec || {}, p = proj || {};
  const peerOne = Object.values(r.peers || {}).map((a) => itemAvg(a, PEER_ITEMS.length)).filter((x) => x != null); const collab = peerAverage(peerOne);
  const it = Object.assign({}, r.items || {}, { collab });
  const site = adhocSiteScore(it);
  const rates = Object.keys(r.exec || {}).map((uid) => ({ person: num(r.exec[uid] && r.exec[uid].person), project: num(p.exec && p.exec[uid] && p.exec[uid].project) })).filter((x) => isFinite(x.person) && isFinite(x.project));
  const exec = execScore(rates); const final = r.confirmed === true ? adhocFinal(site, exec) : null;
  const any = ADHOC_ENTRY_ITEMS.some((k) => isFinite(num((r.items || {})[k]))) || peerOne.length > 0 || Object.keys(r.exec || {}).length > 0;
  return { collab, site, exec, execRaters: rates.length, final, grade: final == null ? '' : gradeOf(final), status: final != null ? 'confirmed' : (site != null && exec != null) ? 'team_done' : any ? 'rating' : 'none' };
}
/** 프로젝트 성과(마진율): 목표 마진율·청구·지급·노무비·직접비를 프로젝트마다 따로 입력/집계 → 실현 마진율·차이·점수 */
export function adhocProjectPerf(proj) {
  const p = proj || {}; const s = p.snapshot || {}; const v = p.saved && typeof p.saved === 'object' ? p.saved : null;
  if (v && typeof v.actual === 'number' && Number.isFinite(v.actual)) {
    const t = num(p.target); const actual = v.actual;
    return { target: isFinite(t) ? t : null, actual, diff: isFinite(t) ? Math.round((actual - t) * 10) / 10 : null, score: isFinite(t) ? marginScore(p.target, actual, p.bands) : null, confirmed: true, asOf: typeof v.asOf === 'string' ? v.asOf : '', estimated: v.estimated === true };
  }
  return Object.assign(projectPerformance({ target: p.target, done: s.done, paid: s.paid, direct: s.direct, ownLabor: s.ownLabor, bands: p.bands }), { confirmed: false, asOf: '', estimated: false });
}
