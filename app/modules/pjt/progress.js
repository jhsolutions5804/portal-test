/* PJT 공정 — 순수 규칙(화면·네트워크 없이 시험 가능). 모든 프로젝트가 같은 구조·같은 화면·같은 규칙이다(프로젝트마다 다른 것은 섹터·품목·단계의 내용과 저장 경로뿐).
 *  구조: 프로젝트 → 그룹(섹터 — 섹터를 나누지 않는 프로젝트는 "전체" 하나) → 품목(장비) → 단계(열). 체크의 키는 항상 "<품목 id>_<열>" 이고, 단계는 "설치"처럼 하위 열 여러 개를 묶은 합성 단계일 수 있다(예: 내진스토퍼·다이크·실링·동판·결선).
 *  저장(동결): 날짜마다 그날 새로 체크한 키만 담는다 — Ph2·Ph4: progress_checks_<날짜>/<섹터> { checks: { 키: true } }, 경량: pjt_registry/<id>/progress_checks/<날짜> { 키: true } — 누적 = 그 날짜까지 모든 날의 합집합. 영업기획 청구서 공정 연동이 같은 문서를 읽는다.
 *  계산: 공정율 = 체크된 칸 / (품목 수 × 열 수)(구포털 Ph2 calcZone 과 경량 recalcProgress 가 같은 식), 설치 = 하위 열이 모두 체크된 품목 수 / 전체 품목 수. */
import { PROGRESS_PROFILES, PAST_PROGRESS_DAILY } from '../../shared/pjt-progress-data.js?v=20261013zo';
export const keyOf = (itemId, col) => itemId + '_' + col;
const truthy = (m) => { const o = {}; Object.keys(m || {}).forEach((k) => { if (m[k] === true && k.indexOf('_') > 0) o[k] = true; }); return o; };
/** 단계 목록: 열(leafCols)을 앞에서부터 보며, 설치 하위 열(installCols)은 처음 나오는 자리에 합성 단계 "설치"(subs)로 묶는다 */
export function stagesOf(leafCols, installCols) {
  const inst = new Set(installCols || []); const out = []; let placed = false;
  (leafCols || []).forEach((c) => { if (inst.has(c)) { if (!placed) { out.push({ name: '설치', subs: (installCols || []).slice() }); placed = true; } } else out.push({ name: c, subs: null }); });
  return out;
}
/** Ph2·Ph4: 코드 상수(공정 프로파일)에서 구조를 만든다 — 섹터가 그룹, 섹터의 장비가 품목 */
export function fixedStructure(key) {
  const p = PROGRESS_PROFILES[key === 'p4ph4' ? 'p4ph4' : 'p4ph2']; if (!p) return null;
  return { unit: '대', label: p.label, groups: p.zones.map((z) => ({ id: z.id, name: z.name, total: z.total, items: z.eqs.map((e) => ({ id: e, name: e })) })), stages: stagesOf(p.checkCols, p.installCols), leafCols: p.checkCols.slice(), installCols: p.installCols.slice() };
}
/** 경량PJT: 프로젝트 문서(stageList, 선택적 installCols)와 품목 목록(items: [{id, name, order}])으로 구조를 만든다 — 그룹은 하나(이름 없음) */
export function lightStructure(doc, items) {
  const d = doc || {}; const list = (d.stageList || []).filter((s) => String(s || '').trim()); const inst = (d.installCols || []).filter((c) => list.indexOf(c) !== -1);
  const its = (items || []).slice().sort((a, b) => (a.order == null ? 9999 : a.order) - (b.order == null ? 9999 : b.order)).map((x) => ({ id: x.id, name: x.name || x.id }));
  return { unit: '대', label: d.name || '', groups: [{ id: '', name: '전체', total: its.length, items: its }], stages: stagesOf(list, inst), leafCols: list.slice(), installCols: inst };
}
/** 하루치 문서를 { 그룹 id: { 키: true } } 로 정리한다. fixed: [{ id: 섹터, data: { checks } }…], light: 문서 데이터 하나({ 키: true, updatedAt… }) */
export function normalizeDayFixed(docs) { const o = {}; (docs || []).forEach((d) => { o[d.id] = truthy((d.data || {}).checks); }); return o; }
export function normalizeDayLight(data) { return { '': truthy(data) }; }
/** 날짜 dateKey 까지의 누적(merged)·그날 새로 체크한 것(todayOnly)·그 전날까지(pastOnly) — days = { 날짜: { 그룹 id: { 키: true } } }. p4ph2 는 코드 상수(과거 공정)도 합친다(그날까지) */
export function stateAt(days, dateKey, groupId, structureKey) {
  const past = {}, today = {}; const add = (dst, m) => { Object.keys(m || {}).forEach((k) => { if (m[k]) dst[k] = true; }); };
  if (structureKey === 'p4ph2') Object.keys(PAST_PROGRESS_DAILY).forEach((d) => { if (d < dateKey) add(past, (PAST_PROGRESS_DAILY[d] || {})[groupId]); else if (d === dateKey) add(today, (PAST_PROGRESS_DAILY[d] || {})[groupId]); });
  Object.keys(days || {}).forEach((d) => { const m = ((days || {})[d] || {})[groupId]; if (d < dateKey) add(past, m); else if (d === dateKey) add(today, m); });
  const merged = Object.assign({}, past, today); return { merged, todayOnly: today, pastOnly: Object.keys(past).reduce((o, k) => { if (!today[k]) o[k] = true; return o; }, {}) };
}
/** 그룹 하나의 계산(구포털 calcZone): 열별 체크 수, 합성 단계(설치)의 하위 체크 수와 완료 품목 수, 칸 기준 공정율, 품목별 공정율 */
export function calcGroup(group, structure, merged) {
  const cols = structure.leafCols; const items = group.items; const m = merged || {}; const checked = (it, c) => !!m[keyOf(it.id, c)];
  const colCount = {}; cols.forEach((c) => { colCount[c] = items.filter((it) => checked(it, c)).length; });
  const totalChecked = items.reduce((s, it) => s + cols.filter((c) => checked(it, c)).length, 0); const mx = items.length * cols.length;
  const stages = structure.stages.map((st) => {
    if (!st.subs) return { name: st.name, done: colCount[st.name] || 0, total: items.length, pct: items.length ? (colCount[st.name] || 0) / items.length * 100 : 0, subs: null };
    const subChecked = st.subs.reduce((s, c) => s + (colCount[c] || 0), 0); const done = items.filter((it) => st.subs.every((c) => checked(it, c))).length;
    return { name: st.name, done, total: items.length, pct: items.length && st.subs.length ? subChecked / (items.length * st.subs.length) * 100 : 0, subs: st.subs.slice(), subChecked };
  });
  const itemPct = {}; items.forEach((it) => { itemPct[it.id] = cols.length ? Math.round(cols.filter((c) => checked(it, c)).length / cols.length * 100) : 0; });
  return { totalChecked, mx, pct: mx ? totalChecked / mx * 100 : 0, colCount, stages, itemPct, doneItems: items.filter((it) => cols.length && cols.every((c) => checked(it, c))).length };
}
/** 프로젝트 전체: 그룹별 계산 + 칸 기준 전체 공정율, 총 품목 수, 완료 품목 수, 평균 품목 진행률 */
export function calcAll(structure, statesByGroup) {
  const groups = structure.groups.map((g) => ({ group: g, calc: calcGroup(g, structure, (statesByGroup[g.id] || {}).merged) }));
  const checked = groups.reduce((s, x) => s + x.calc.totalChecked, 0), mx = groups.reduce((s, x) => s + x.calc.mx, 0); const items = groups.reduce((s, x) => s + x.group.items.length, 0);
  const itemPcts = groups.reduce((a, x) => a.concat(x.group.items.map((it) => x.calc.itemPct[it.id])), []);
  return { groups, pct: mx ? checked / mx * 100 : 0, items, doneItems: groups.reduce((s, x) => s + x.calc.doneItems, 0), avgItemPct: itemPcts.length ? itemPcts.reduce((a, b) => a + b, 0) / itemPcts.length : 0 };
}
/** 칸 하나를 누를 수 있는지: 오늘은 누를 수 있고, 다른 날은 수정 모드일 때만. 이전 날짜에서 이미 체크된 칸은 누르지 못한다(그 날짜로 가서 고친다). 날짜가 기록되지 않은 옛 체크(경량 품목의 현재 상태)는 그날 체크한 것으로 본다 */
export function cellState(st, key, isToday, editMode) {
  const done = !!(st.merged || {})[key]; const isNew = !!(st.todayOnly || {})[key]; const isPast = done && !isNew;
  return { done, isNew, isPast, canToggle: !isPast && (isToday || !!editMode) };   // 모든 프로젝트 같은 규칙: 이전 날짜에서 넘어온 칸은 잠그고(그 날짜로 가서 고침), 오늘은 바로·다른 날은 수정 모드에서
}
/** 칸 토글의 결과(그날 문서의 키 맵): 켜면 키를 더하고, 끄면 지운다(없는 키를 끄면 그대로) */
export function toggledDayChecks(dayChecks, key, on) { const o = Object.assign({}, truthy(dayChecks)); if (on) o[key] = true; else delete o[key]; return o; }
/** 경량PJT 품목의 현재 상태(items.stages — 구포털 공사일보 자동 반영과 호환): 단계를 켜거나 끈 새 맵 */
export function lightItemStages(stages, stage, on) { const o = Object.assign({}, stages || {}); o[stage] = !!on; return o; }
/** 경량PJT 프로젝트 문서의 progress(%): 품목 × 단계 중 현재 상태가 켜진 칸 비율 — 구포털 recalcProgress 와 같은 식 */
export function lightProgress(structure, itemStages) { let total = 0, done = 0; structure.groups[0].items.forEach((it) => structure.leafCols.forEach((s) => { total++; if ((itemStages[it.id] || {})[s]) done++; })); return total ? done / total * 100 : 0; }
/** 읽어야 할 날짜(가장 이른 시작일부터 dateKey 까지) — Ph2·Ph4 는 날짜마다 컬렉션이 따로라 하루씩 읽는다 */
export function daysThrough(startKey, dateKey) {
  const out = []; const [sy, sm, sd] = String(startKey).split('-').map(Number), [ey, em, ed] = String(dateKey).split('-').map(Number); if (!sy || !ey) return out;
  for (let t = Date.UTC(sy, sm - 1, sd), e = Date.UTC(ey, em - 1, ed); t <= e; t += 86400000) { const d = new Date(t); out.push(d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0')); }
  return out;
}
export const PROGRESS_START = { p4ph2: '2026-06-17', p4ph4: '2026-03-27' };   // 본섭 데이터에서 가장 이른 공정 체크(Ph2 는 코드 상수의 첫 날, Ph4 는 첫 컬렉션)
/** 경량PJT 품목의 현재 상태(items.stages)를 체크 키 맵으로: { '<품목 id>_<단계>': true } — 오늘 화면은 이것을 기준으로 하고(날짜별 문서가 없는 오래된 프로젝트도 보이도록), 다른 날짜는 날짜별 문서의 누적을 쓴다 */
export function lightKeysFromItems(items) { const o = {}; (items || []).forEach((it) => Object.keys(it.stages || {}).forEach((s) => { if (it.stages[s] === true) o[keyOf(it.id, s)] = true; })); return o; }
/** 경량PJT 의 보고 있는 날짜 상태: 오늘이면 현재 상태 + 날짜별 누적, 다른 날짜면 날짜별 누적(구포털과 같음) */
export function lightState(days, dateKey, items, isToday) { const s = stateAt(days, dateKey, '', 'light'); if (!isToday) return s; const cur = lightKeysFromItems(items); return { merged: Object.assign({}, s.merged, cur), todayOnly: Object.assign({}, s.todayOnly, cur), pastOnly: {} }; }
