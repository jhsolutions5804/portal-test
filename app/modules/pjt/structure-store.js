/* PJT 공정 구조의 읽기·쓰기 계획(순수) — 구조 데이터의 모양은 모든 프로젝트가 같고(shared/pjt-structure.js), 어디에 어떻게 쓰는지는 이 파일이 정한다.
 * 단일 출처: 프로젝트 문서의 progressStructure 필드(고정 프로젝트 = pjt_settings/<키>, 경량 = pjt_registry/<id>). 아직 없으면 구포털의 옛 구조(코드 상수 또는 경량의 stageList·품목 문서)에서 만든다.
 * 옛 화면 호환(경량): 단계 목록(stageList)과 품목 문서(이름·순서·섹터)도 함께 쓴다 — 기존 화면·공사일보가 계속 읽는다. 고정 프로젝트의 구포털 화면은 코드 상수를 쓰므로 거기에는 쓸 수 없다(영업기획은 이 구조를 읽는다). */
import { PROGRESS_PROFILES } from '../../shared/pjt-progress-data.js?v=20261013zs';
import { normalizeStructure, structureFromProfile } from '../../shared/pjt-structure.js?v=20261013zs';
const clone = (o) => JSON.parse(JSON.stringify(o));
/** 경량: 구조 데이터에 옛 화면에서 바뀐 것을 맞춘다 — 구조에 없는 품목 문서는 문서에 적힌 섹터(없으면 첫 섹터)에 더하고, 문서가 지워진 품목은 빼고, 옛 단계 목록(stageList)에서 늘거나 줄어든 단계를 반영 */
export function reconcileLight(S, itemDocs, stageList) {
  const o = clone(S); const docs = (itemDocs || []).slice().sort((a, b) => (a.order == null ? 9999 : a.order) - (b.order == null ? 9999 : b.order)); const have = new Set(docs.map((d) => d.id));
  o.groups.forEach((g) => { g.items = g.items.filter((i) => have.has(i.id)); }); const known = new Set(); o.groups.forEach((g) => g.items.forEach((i) => known.add(i.id)));
  if (!o.groups.length) o.groups.push({ id: 'g1', name: '전체', kw: [], items: [] });
  docs.forEach((d) => { if (!known.has(d.id)) (o.groups.find((g) => g.id === d.group) || o.groups[0]).items.push({ id: d.id, name: d.name || d.id }); });   // 품목 문서에 섹터가 적혀 있으면 그 섹터, 없으면 첫 섹터
  if (Array.isArray(stageList)) { const sl = stageList.map((s) => String(s || '').trim()).filter(Boolean); sl.forEach((s) => { if (o.stages.indexOf(s) === -1) o.stages.push(s); }); o.stages = o.stages.filter((s) => sl.indexOf(s) !== -1 || !sl.length); o.installCols = o.installCols.filter((c) => o.stages.indexOf(c) !== -1); }
  return normalizeStructure(o);
}
/** 프로젝트 구조 읽기 결과: key 는 'p4ph2'·'p4ph4'·'reg_<id>', projDoc 은 프로젝트 문서 데이터(없으면 null), itemDocs 는 경량 품목 문서([{ id, name, order, group }]) */
export function structureFor(key, projDoc, itemDocs) {
  const d = projDoc || {}; const fixed = key === 'p4ph2' || key === 'p4ph4';
  if (fixed) { if (d.progressStructure) return { S: normalizeStructure(d.progressStructure), source: 'data' }; return { S: structureFromProfile(PROGRESS_PROFILES[key]), source: 'code' }; }
  if (d.progressStructure) return { S: reconcileLight(normalizeStructure(d.progressStructure), itemDocs, d.stageList), source: 'data' };
  const groups = (d.progressGroups && d.progressGroups.length ? d.progressGroups : [{ id: 'g1', name: '전체' }]).map((g) => ({ id: String(g.id), name: g.name || '전체', kw: [], items: [] }));
  (itemDocs || []).slice().sort((a, b) => (a.order == null ? 9999 : a.order) - (b.order == null ? 9999 : b.order)).forEach((it) => { const g = groups.find((x) => x.id === it.group) || groups[0]; g.items.push({ id: it.id, name: it.name || it.id }); });
  return { S: normalizeStructure({ ppt: { client: d.client || '', title: '품목' }, stages: d.stageList || [], installCols: d.installCols || [], groups }), source: 'legacy' };
}
/** 저장 계획(실행은 화면 쪽): 쓰기 목록 [{ op: 'set'|'update'|'delete', col, id, data?, merge? }]. 'TS' 는 서버 시각 자리표시.
 *  고정 프로젝트: 설정 문서에 구조만. 경량: 품목 문서(이름·순서·섹터)와 단계 목록을 옛 화면 호환으로 함께 쓴 뒤 마지막에 구조 */
export function planSave(P, nextS, itemDocs, by) {
  const S = normalizeStructure(nextS); const writes = []; const meta = { progressStructureAt: 'TS', progressStructureBy: by || '' };
  if (P.kind === 'light') {
    const have = new Map((itemDocs || []).map((d) => [d.id, d])); const keep = new Set(); let order = 0;
    S.groups.forEach((g) => g.items.forEach((it) => { keep.add(it.id); const cur = have.get(it.id);
      if (!cur) writes.push({ op: 'set', col: P.progress.items, id: it.id, data: { name: it.name, stages: {}, order, group: g.id, createdAt: 'TS' } });
      else if (cur.name !== it.name || cur.order !== order || cur.group !== g.id) writes.push({ op: 'update', col: P.progress.items, id: it.id, data: { name: it.name, order, group: g.id } }); order++; }));
    (itemDocs || []).forEach((d) => { if (!keep.has(d.id)) writes.push({ op: 'delete', col: P.progress.items, id: d.id }); });
    writes.push({ op: 'update', col: P.settings.col, id: P.settings.id, data: Object.assign({ progressStructure: S, stageList: S.stages.slice() }, meta) });
  } else writes.push({ op: 'set', col: P.settings.col, id: P.settings.id, merge: true, data: Object.assign({ progressStructure: S }, meta) });
  return writes;
}
/** 새 경량 품목 id(문서 id): 시각 + 순번 — 같은 화면에서 한꺼번에 여러 개를 만들어도 겹치지 않는다 */
export function makeItemIdFactory(now) { let n = 0; const base = (now == null ? Date.now() : now).toString(36); return () => 'i' + base + (n++).toString(36); }
