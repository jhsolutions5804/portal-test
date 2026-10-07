/* PJT(프로젝트)별 참여자 지정 — 순수 규칙.
 * 각 프로젝트 문서(pjt_settings/{p4ph2|p4ph4}, pjt_registry/{id})의 participants = { teams: [부서 이름…], members: [계정 uid…] }.
 *  · 지정이 없으면(둘 다 비어 있음) 지금까지처럼 "PJT 권한(perms.pjt) 보유자 전체"가 접근한다 — 아무도 접근을 잃지 않는다.
 *  · 지정이 있으면 그 부서 소속(계정의 dept 가 팀 이름과 같음)이거나 개인으로 지정된 사람만 접근한다. 관리자는 항상 접근.
 * 옛 PJT 화면(FAB·SUP·경량·옛 PJT 홈)에는 같은 규칙의 pjtAllowed()가 들어 있고, 시험이 두 규칙이 같은 결과를 내는지 확인한다. */
const strs = (a) => (Array.isArray(a) ? [...new Set(a.map((x) => String(x == null ? '' : x).trim()).filter(Boolean))] : []);
export function participantsOf(proj) { const p = (proj && proj.participants) || {}; return { teams: strs(p.teams), members: strs(p.members) }; }
export const isRestricted = (proj) => { const p = participantsOf(proj); return p.teams.length + p.members.length > 0; };
/** me = { uid, admin, perms, dept } */
export function canAccessProject(me, proj) {
  if (!me) return false; if (me.admin) return true;
  const p = participantsOf(proj);
  if (!p.teams.length && !p.members.length) return !!(me.perms && me.perms.pjt);
  return p.members.indexOf(me.uid) !== -1 || (!!me.dept && p.teams.indexOf(String(me.dept).trim()) !== -1);
}
/** 일정처럼 "보여도 되는" 정보: 지정이 없으면 예전처럼 열려 있고, 지정이 있으면 참여자만 */
export const canSeeProject = (me, proj) => !isRestricted(proj) || canAccessProject(me, proj);
/** projects = [{ key, …프로젝트 문서 }] → 이 사람이 접근할 수 있는 key 목록 */
export const accessibleKeys = (me, projects) => (projects || []).filter((p) => canAccessProject(me, p)).map((p) => p.key);
/** 저장 전 정리: 중복·빈 값 제거, 이름 순서 유지 */
export const normalizeParticipants = (p) => participantsOf({ participants: p });
