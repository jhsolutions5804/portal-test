/* PJT 공정 구조의 읽기·쓰기 계획(순수) — 구조 데이터의 모양은 모든 프로젝트가 같고(shared/pjt-structure.js), 어디에 어떻게 쓰는지는 이 파일이 정한다.
 * 단일 출처: 프로젝트 문서(pjt_registry/<id>)의 progressStructure 필드. 구조가 아직 없는 새 프로젝트는 단계·섹터가 비어 있는 구조로 시작하고, 공정 탭의 구조 설정에서 채운다. */
import { normalizeStructure, emptyStructure } from '../../shared/pjt-structure.js?v=20261031d';
/** 프로젝트 문서 → 공정 구조(정리된 형식). 없으면 비어 있는 구조 */
export function structureFor(projDoc) { const d = projDoc || {}; return { S: d.progressStructure ? normalizeStructure(d.progressStructure) : emptyStructure() }; }
/** 저장 계획(실행은 화면 쪽): 쓰기 목록 [{ op: 'set', col, id, data, merge }]. 'TS' 는 서버 시각 자리표시. 프로젝트 문서에 구조만 병합 저장한다 */
export function planSave(P, nextS, by) {
  const S = normalizeStructure(nextS); const meta = { progressStructureAt: 'TS', progressStructureBy: by || '' };
  return [{ op: 'set', col: P.settings.col, id: P.settings.id, merge: true, data: Object.assign({ progressStructure: S }, meta) }];
}
