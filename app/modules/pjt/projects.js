/* PJT 프로젝트 목록 규칙(순수) — 이 사람이 열 수 있는 프로젝트. 구포털 PJT 메뉴(legacy/list.js pjtNav·attendTargets)와 같은 판정이다: 종료되지 않은 고정 PJT + 종료되지 않은 경량 PJT 중에서,
 * 프로젝트 문서의 참여자 지정(participants)이 없으면 PJT 권한 보유자 전체가, 있으면 지정된 부서·개인(그리고 관리자)만 접근한다(shared/pjt-access.js). */
import { canAccessProject } from '../../shared/pjt-access.js?v=20261013ze';
import { FIXED_KEYS, pathsFor } from './adapter.js?v=20261013ze';
/** dyn = { ended: { p4ph2: bool, p4ph4: bool }, settings: { p4ph2: 프로젝트 문서, … }, registry: [{ id, name, … 프로젝트 문서 }] } → [{ key, label, doc }] */
export function visibleProjects(me, dyn) {
  const d = dyn || { ended: {}, settings: {}, registry: [] }; const out = [];
  FIXED_KEYS.forEach((k) => { if (!(d.ended && d.ended[k]) && canAccessProject(me, (d.settings || {})[k])) out.push({ key: k, label: pathsFor(k).label, doc: (d.settings || {})[k] || null }); });
  (d.registry || []).forEach((r) => { if (canAccessProject(me, r)) out.push({ key: 'reg_' + r.id, label: r.name || 'PJT', doc: r }); });
  return out;
}
