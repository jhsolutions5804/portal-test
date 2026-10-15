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
  const x = p || {}; const billed = num(x.billed); if (!isFinite(billed) || billed <= 0) return null;
  const cost = [x.paid, x.labor, x.direct].map((v) => (isFinite(num(v)) ? num(v) : 0)).reduce((a, b) => a + b, 0);
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
  const sys = SYSTEM_EMPNOS.test(String(v.empNo || '').trim()); const rank = String(v.rank || '').trim();
  const exec = !sys && EXEC_RANKS.indexOf(rank) !== -1; const hr = !sys && !exec && !!(v.perms && v.perms.hrEval === true);
  const same = v.id != null && t.id != null && String(v.id) === String(t.id);
  const none = { level: 'none', viewScores: false, viewComments: false, viewPeerRaw: false, edit: false, confirm: false, manage: false, selfEval: false };
  if (exec) return { level: 'exec', viewScores: true, viewComments: true, viewPeerRaw: false, edit: true, confirm: rank === '대표', manage: true, selfEval: false };
  if (same) return Object.assign({}, none, { level: 'self', viewScores: !!c.published, viewComments: !!c.published, selfEval: true });
  if (hr) return { level: 'hr', viewScores: true, viewComments: true, viewPeerRaw: false, edit: false, confirm: false, manage: true, selfEval: false };
  return none;
}
