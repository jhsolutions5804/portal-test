/* PJT 공정 구조의 공용 부분(형식·정리·변환) — PJT 모듈(공정 탭·구조 설정)과 영업기획(청구서 공정 연동)이 같이 쓴다. 순수 규칙.
 * 형식 v1: { v: 1, unit: '대', stages: [단계 이름…](열 순서), installCols: [설치로 묶는 단계…], groups: [{ id, name, kw: [섹터 추정 키워드…], items: [{ id, name }…] }…] }
 * 저장: 프로젝트 문서의 progressStructure 필드(고정 프로젝트는 pjt_settings/<키>, 경량은 pjt_registry/<id>). 아직 없으면 구포털 코드 상수(공정 프로파일)에서 만든 것과 같다. */
const num = (v) => parseInt(v, 10);
export const STRUCTURE_VERSION = 1;
export const emptyStructure = () => ({ v: STRUCTURE_VERSION, unit: '대', ppt: { client: '', title: '' }, features: {}, stages: [], installCols: [], groups: [] });
const nameOk = (s) => { const t = String(s == null ? '' : s).trim(); return t && !/[\/\\.#$\[\]]/.test(t) && t.indexOf('_') === -1 ? t : ''; };   // 키에 쓰이므로 "_" 와 경로 문자(/ \ . # $ [ ])는 쓰지 못한다(키는 "<품목>_<단계>")
/** 저장된 구조를 정리해 돌려준다(모르는 필드·형식 오류 제거, 설치 묶음은 있는 단계만) */
export function normalizeStructure(data) {
  const d = data || {}; const stages = []; (d.stages || []).forEach((s) => { const n = nameOk(typeof s === 'string' ? s : s && s.name); if (n && stages.indexOf(n) === -1) stages.push(n); });
  const groups = (d.groups || []).map((g, i) => { const seen = new Set(); return { id: String(g && g.id != null ? g.id : 'g' + (i + 1)), name: String((g && g.name) || '').trim() || '전체', kw: ((g && g.kw) || []).map((k) => String(k)).filter(Boolean), items: ((g && g.items) || []).map((it) => ({ id: String(it && it.id != null ? it.id : ''), name: String((it && it.name) || (it && it.id) || '').trim() })).filter((it) => it.id && !seen.has(it.id) && seen.add(it.id)) }; });   // 품목 id 는 섹터 안에서만 유일하면 된다(Ph2 는 3F FIZ 와 2F 제조부속실이 같은 장비 번호를 따로 가진다 — 체크는 섹터별로 저장)
  const ppt = { client: String((d.ppt && d.ppt.client) || '').trim(), title: String((d.ppt && d.ppt.title) || '').trim() };   // 공정표 PPT 표지: 발주처 이름, 작업 이름(예: FCU 설치)
  const features = {}; ['layoutMap', 'weeklyReportPpt'].forEach((f) => { if (d.features && typeof d.features[f] === 'boolean') features[f] = d.features[f]; });   // 선택 기능 켜기/끄기(장비 배치도·주간 공정회의 PPT) — 정하지 않으면 프로젝트 기본값
  return { v: STRUCTURE_VERSION, unit: String(d.unit || '대'), ppt, features, stages, installCols: (d.installCols || []).filter((c) => stages.indexOf(c) !== -1 && true).filter((c, i, a) => a.indexOf(c) === i), groups };
}
/** 구포털 코드 상수(공정 프로파일)에서 구조를 만든다 — 구조 데이터가 아직 없는 프로젝트의 시작점 */
export function structureFromProfile(profile) {
  return normalizeStructure({ unit: '대', ppt: { client: profile.client || '', title: profile.pptTitle || '' }, stages: profile.checkCols, installCols: profile.installCols, groups: profile.zones.map((z) => ({ id: z.id, name: z.name, kw: z.kw || [], items: z.eqs.map((e) => ({ id: e, name: e })) })) });
}

/** 영업기획 공정 연동이 읽는 프로파일 모양으로: 섹터(zones: id·name·total·eqs·kw), 열(checkCols), 설치 묶음(installCols) — 컬렉션 이름 등은 base 에서 이어받는다 */
export function toProfile(S, base) {
  const n = normalizeStructure(S); return Object.assign({}, base || {}, { checkCols: n.stages.slice(), installCols: n.installCols.slice(), zones: n.groups.map((g) => ({ id: g.id, name: g.name, total: g.items.length, eqs: g.items.map((i) => i.id), kw: g.kw.slice() })) });
}
