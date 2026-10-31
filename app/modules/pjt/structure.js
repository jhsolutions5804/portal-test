/* PJT 공정 구조(섹터·품목·단계) — 모든 프로젝트가 같은 형식·같은 편집 규칙을 쓴다(순수 규칙, 화면·네트워크 없음).
 * (형식·정리·프로파일 변환은 shared/pjt-structure.js — 영업기획과 같이 쓴다.) 형식 v1: { v: 1, unit: '대', stages: [단계 이름…](열 순서), installCols: [설치로 묶는 단계…], groups: [{ id, name, kw: [섹터 추정 키워드…], items: [{ id, name }…] }…] }
 * 체크 키는 "<품목 id>_<단계 이름>" 이라서 품목 id·단계 이름을 바꾸면 기존 체크가 이어지지 않는다 — 그래서 이름 변경은 막고(지우고 새로 추가), 지울 때는 영향(체크된 칸 수)을 알려 준다.
 * 저장 위치는 프로젝트마다 다르지만(어댑터/structure-store) 데이터 모양은 같다. */
import { STRUCTURE_VERSION, emptyStructure, normalizeStructure, structureFromProfile, toProfile } from '../../shared/pjt-structure.js?v=20261031h';
export { STRUCTURE_VERSION, emptyStructure, normalizeStructure, structureFromProfile, toProfile };
const num = (v) => parseInt(v, 10);
const clone = (o) => JSON.parse(JSON.stringify(o));
const itemNameOk = (s) => { const t = String(s == null ? '' : s).trim(); return t && !/[\/\\.#$\[\]]/.test(t) ? t : ''; };   // 품목 이름(=체크 키의 품목 id)은 밑줄을 쓸 수 있다(Ph4 장비 번호 EHU_4F10701) — 키는 정확히 "<품목>_<단계>" 로 만들고 단계 이름에 밑줄이 없어서 구분이 겹치지 않는다
const nameOk = (s) => { const t = String(s == null ? '' : s).trim(); return t && !/[\/\\.#$\[\]]/.test(t) && t.indexOf('_') === -1 ? t : ''; };   // 키에 쓰이므로 "_" 와 경로 문자(/ \ . # $ [ ])는 쓰지 못한다(키는 "<품목>_<단계>")
/** 화면·계산에서 쓰는 모양(progress.js 의 structure)으로: 단계(합성 포함)·열 목록을 덧붙인다 */
export function toRuntime(S, label, stagesOf) {
  const n = normalizeStructure(S); return { unit: n.unit, ppt: n.ppt, features: n.features, label: label || '', groups: n.groups.map((g) => ({ id: g.id, name: g.name, total: g.items.length, items: g.items.map((i) => ({ id: i.id, name: i.name })), kw: g.kw })), stages: stagesOf(n.stages, n.installCols), leafCols: n.stages.slice(), installCols: n.installCols.slice() };
}
/** 품목 이름 목록 문자열 → 이름들: 줄·쉼표·세미콜론으로 나누고(이름 안의 공백은 그대로), "801-839"·"801~839" 같은 숫자 범위는 하나씩 펼친다(앞자리 0 은 같은 자릿수일 때 유지, 한 번에 최대 500개) */
export function parseItemList(text) {
  const out = []; const push = (n) => { if (n && out.indexOf(n) === -1) out.push(n); };
  String(text == null ? '' : text).split(/[\n,;]+/).forEach((tok) => {
    const t = tok.trim(); if (!t) return; const m = /^(\d+)\s*[-~]\s*(\d+)$/.exec(t);
    if (m) { const a = num(m[1]), b = num(m[2]); if (a <= b && b - a < 500) { const pad = m[1].length === m[2].length && m[1][0] === '0' ? m[1].length : 0; for (let k = a; k <= b; k++) push(pad ? String(k).padStart(pad, '0') : String(k)); return; } }
    push(t);
  });
  return out;
}
/* ── 편집 연산: 모두 새 구조를 돌려주고 원본은 건드리지 않는다. 실패하면 { error } ── */
const fail = (error) => ({ error });
/** 선택 기능 켜기/끄기: layoutMap(장비 배치도)·weeklyReportPpt(주간 공정회의 PPT) */
export function setFeature(S, name, on) { if (name !== 'layoutMap' && name !== 'weeklyReportPpt') return { error: '알 수 없는 기능입니다.' }; const o = clone(S); o.features = Object.assign({}, o.features); o.features[name] = !!on; return { S: o }; }
/** 공정표 PPT 표지 문구(발주처·작업 이름) 변경 */
export function setPpt(S, field, value) { if (field !== 'client' && field !== 'title') return { error: '알 수 없는 항목입니다.' }; const o = clone(S); o.ppt = Object.assign({ client: '', title: '' }, o.ppt); o.ppt[field] = String(value == null ? '' : value).trim(); return { S: o }; }
export function addStage(S, name) { const n = nameOk(name); if (!n) return fail('단계 이름이 비었거나 쓸 수 없는 문자(_ / . # $ [ ])가 있습니다.'); if (S.stages.indexOf(n) !== -1) return fail('이미 있는 단계입니다.'); const o = clone(S); o.stages.push(n); return { S: o }; }
export function removeStage(S, name) { const o = clone(S); o.stages = o.stages.filter((s) => s !== name); o.installCols = o.installCols.filter((s) => s !== name); return { S: o }; }
export function moveStage(S, name, dir) { const o = clone(S); const i = o.stages.indexOf(name); const j = i + dir; if (i < 0 || j < 0 || j >= o.stages.length) return { S: o }; o.stages.splice(i, 1); o.stages.splice(j, 0, name); return { S: o }; }
export function toggleInstall(S, name, on) { if (S.stages.indexOf(name) === -1) return fail('없는 단계입니다.'); const o = clone(S); const has = o.installCols.indexOf(name) !== -1; if (on && !has) o.installCols.push(name); if (!on && has) o.installCols = o.installCols.filter((c) => c !== name); o.installCols.sort((a, b) => o.stages.indexOf(a) - o.stages.indexOf(b)); return { S: o }; }
export function addGroup(S, name) { const t = String(name || '').trim(); if (!t) return fail('섹터 이름을 입력하세요.'); if (S.groups.some((g) => g.name === t)) return fail('같은 이름의 섹터가 있습니다.'); const o = clone(S); let k = o.groups.length + 1; while (o.groups.some((g) => g.id === 'g' + k)) k++; o.groups.push({ id: 'g' + k, name: t, kw: [], items: [] }); return { S: o }; }
export function renameGroup(S, id, name) { const t = String(name || '').trim(); if (!t) return fail('섹터 이름을 입력하세요.'); if (S.groups.some((g) => g.id !== id && g.name === t)) return fail('같은 이름의 섹터가 있습니다.'); const o = clone(S); const g = o.groups.find((x) => x.id === id); if (g) g.name = t; return { S: o }; }
export function removeGroup(S, id) { const o = clone(S); o.groups = o.groups.filter((g) => g.id !== id); return { S: o }; }
/** 섹터에 품목 추가: 그 섹터 안에서 이름(=체크 키의 품목 id)이 겹치면 건너뛰고 알린다(다른 섹터에는 같은 번호가 있어도 된다). newId(이름) 로 id 를 정한다(기본: 이름 그대로) */
export function addItems(S, groupId, names, newId) {
  const o = clone(S); const g = o.groups.find((x) => x.id === groupId); if (!g) return fail('없는 섹터입니다.'); const have = new Set(); g.items.forEach((i) => { have.add(i.id); have.add(i.name); });
  const added = [], skipped = [], bad = []; (names || []).forEach((raw) => { const n = itemNameOk(raw); if (!n) { bad.push(String(raw)); return; } if (have.has(n)) { skipped.push(n); return; } const id = newId ? newId(n) : n; have.add(n); have.add(id); g.items.push({ id, name: n }); added.push(n); });
  return { S: o, added, skipped, bad };
}
export function removeItem(S, groupId, itemId) { const o = clone(S); const g = o.groups.find((x) => x.id === groupId); if (g) g.items = g.items.filter((i) => i.id !== itemId); return { S: o }; }
/** 변경 내용(확인 창·저장 계획용): 추가·삭제된 단계·섹터·품목, 설치 묶음 변경 */
export function diffStructure(prev, next) {
  const a = normalizeStructure(prev), b = normalizeStructure(next); const items = (S) => { const m = {}; S.groups.forEach((g) => g.items.forEach((i) => { m[g.id + '|' + i.id] = { name: i.name, group: g.id, id: i.id }; })); return m; }; const ia = items(a), ib = items(b);   // 섹터 + 품목 id 로 구분
  return { addedStages: b.stages.filter((s) => a.stages.indexOf(s) === -1), removedStages: a.stages.filter((s) => b.stages.indexOf(s) === -1), addedGroups: b.groups.filter((g) => !a.groups.some((x) => x.id === g.id)).map((g) => g.name), removedGroups: a.groups.filter((g) => !b.groups.some((x) => x.id === g.id)).map((g) => g.name), renamedGroups: b.groups.filter((g) => a.groups.some((x) => x.id === g.id && x.name !== g.name)).map((g) => g.name),
    addedItems: Object.keys(ib).filter((k) => !ia[k]).map((k) => ib[k]), removedItems: Object.keys(ia).filter((k) => !ib[k]).map((k) => ia[k]), installChanged: JSON.stringify(a.installCols) !== JSON.stringify(b.installCols), orderChanged: JSON.stringify(a.stages.filter((s) => b.stages.indexOf(s) !== -1)) !== JSON.stringify(b.stages.filter((s) => a.stages.indexOf(s) !== -1)), unitChanged: a.unit !== b.unit, pptChanged: JSON.stringify(a.ppt) !== JSON.stringify(b.ppt), featuresChanged: JSON.stringify(a.features) !== JSON.stringify(b.features) };
}
export const hasChanges = (d) => Object.keys(d).some((k) => (Array.isArray(d[k]) ? d[k].length : !!d[k]));
/** 변경이 가져오는 영향: 지워지는 단계·품목·섹터에 이미 체크된 칸 수(merged = { 섹터 id: { 키: true } }, 지금까지 누적). 체크 자체는 지우지 않고 더 이상 세지 않는다 */
export function impactOf(prev, diff, mergedByGroup) {
  const a = normalizeStructure(prev); let cells = 0; const rmItems = new Set(diff.removedItems.map((x) => x.group + '|' + x.id)), rmStages = new Set(diff.removedStages), rmGroups = new Set(a.groups.filter((g) => diff.removedGroups.indexOf(g.name) !== -1).map((g) => g.id));
  a.groups.forEach((g) => { const m = (mergedByGroup || {})[g.id] || {}; g.items.forEach((it) => a.stages.forEach((s) => { if (!m[it.id + '_' + s]) return; if (rmItems.has(g.id + '|' + it.id) || rmStages.has(s) || rmGroups.has(g.id)) cells++; })); });
  return { cells };
}
/** 저장 전 검사: 단계가 하나 이상, 섹터가 하나 이상, 설치 묶음은 있는 단계만 */
export function validateStructure(S) { const n = normalizeStructure(S); const errors = []; if (!n.stages.length) errors.push('단계가 하나도 없습니다.'); if (!n.groups.length) errors.push('섹터가 하나도 없습니다(나누지 않는 프로젝트는 "전체" 섹터 하나를 둡니다).'); return { ok: !errors.length, errors }; }
