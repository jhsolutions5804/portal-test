/* PJT 프로젝트 목록 규칙(순수) — 이 사람이 열 수 있는 프로젝트. 구포털 PJT 메뉴(legacy/list.js pjtNav·attendTargets)와 같은 판정이다: 종료되지 않은 프로젝트 중에서,
 * 프로젝트 문서의 참여자 지정(participants)이 없으면 PJT 권한 보유자 전체가, 있으면 지정된 부서·개인(그리고 관리자)만 접근한다(shared/pjt-access.js). 모든 프로젝트가 같은 규칙이다. */
import { canAccessProject } from '../../shared/pjt-access.js?v=20261031a';
/** dyn = { registry: [{ id, name, … 프로젝트 문서 }] }(종료된 프로젝트 제외) → [{ key(=등록 id), label(=프로젝트명), doc }] */
export function visibleProjects(me, dyn) {
  const out = []; ((dyn && dyn.registry) || []).forEach((r) => { if (canAccessProject(me, r)) out.push({ key: r.id, label: r.name || 'PJT', doc: r }); }); return out;
}
