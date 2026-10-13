/* PJT 공정 — 순수 규칙(화면·네트워크 없이 시험 가능). 모든 프로젝트가 같은 구조·같은 화면·같은 규칙이다(프로젝트마다 다른 것은 섹터·품목·단계의 내용뿐).
 *  구조: 프로젝트 → 그룹(섹터 — 섹터를 나누지 않는 프로젝트는 "전체" 하나) → 품목(장비) → 단계(열). 체크의 키는 항상 "<품목 id>_<열>" 이고, 단계는 "설치"처럼 하위 열 여러 개를 묶은 합성 단계일 수 있다(예: 내진스토퍼·다이크·실링·동판·결선).
 *  저장(동결): 날짜마다 그날 새로 체크한 키만 담는다 — pjt_registry/<id>/progress_days/<날짜> { groups: { <섹터 id>: { 키: true } } } — 누적 = 그 날짜까지 모든 날의 합집합. 영업기획 청구서 공정 연동이 같은 문서를 읽는다.
 *  계산: 공정율 = 체크된 칸 / (품목 수 × 열 수)(구포털 Ph2 calcZone 과 경량 recalcProgress 가 같은 식), 설치 = 하위 열이 모두 체크된 품목 수 / 전체 품목 수. */
export const keyOf = (itemId, col) => itemId + '_' + col;
const truthy = (m) => { const o = {}; Object.keys(m || {}).forEach((k) => { if (m[k] === true && k.indexOf('_') > 0) o[k] = true; }); return o; };
/** 단계 목록: 열(leafCols)을 앞에서부터 보며, 설치 하위 열(installCols)은 처음 나오는 자리에 합성 단계 "설치"(subs)로 묶는다 */
export function stagesOf(leafCols, installCols) {
  const inst = new Set(installCols || []); const out = []; let placed = false;
  (leafCols || []).forEach((c) => { if (inst.has(c)) { if (!placed) { out.push({ name: '설치', subs: (installCols || []).slice() }); placed = true; } } else out.push({ name: c, subs: null }); });
  return out;
}
/** 하루치 문서(progress_days/<날짜>)를 { 섹터 id: { 키: true } } 로 정리한다 */
export function normalizeDay(data) { const o = {}; const g = (data || {}).groups || {}; Object.keys(g).forEach((id) => { o[id] = truthy(g[id]); }); return o; }
/** 날짜 dateKey 까지의 누적(merged)·그날 새로 체크한 것(todayOnly)·그 전날까지(pastOnly) — days = { 날짜: { 그룹 id: { 키: true } } } */
export function stateAt(days, dateKey, groupId) {
  const past = {}, today = {}; const add = (dst, m) => { Object.keys(m || {}).forEach((k) => { if (m[k]) dst[k] = true; }); };
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
/** 칸 하나를 누를 수 있는지: 오늘은 누를 수 있고, 다른 날은 수정 모드일 때만. 이전 날짜에서 이미 체크된 칸은 누르지 못한다(그 날짜로 가서 고친다). */
export function cellState(st, key, isToday, editMode) {
  const done = !!(st.merged || {})[key]; const isNew = !!(st.todayOnly || {})[key]; const isPast = done && !isNew;
  return { done, isNew, isPast, canToggle: !isPast && (isToday || !!editMode) };   // 모든 프로젝트 같은 규칙: 이전 날짜에서 넘어온 칸은 잠그고(그 날짜로 가서 고침), 오늘은 바로·다른 날은 수정 모드에서
}
/** 칸 토글의 결과(그날 문서의 키 맵): 켜면 키를 더하고, 끄면 지운다(없는 키를 끄면 그대로) */
export function toggledDayChecks(dayChecks, key, on) { const o = Object.assign({}, truthy(dayChecks)); if (on) o[key] = true; else delete o[key]; return o; }
