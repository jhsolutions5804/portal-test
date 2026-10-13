/* 이전 1단계(Node): 옛 코드 상수(Ph2·Ph4 공정 프로파일·과거 공정)와 옛 경량 프로젝트 데이터로 "공정 구조 데이터"를 만든다 — 앱의 정리 규칙(normalizeStructure)을 그대로 써서 화면이 읽는 형식과 같게 한다.
 * 입력 /tmp/mig_in.json = { light: [{ id, doc, items: [{ id, name, order, group, stages }] }] } → 출력 /tmp/mig_out.json */
import fs from 'node:fs';
import { PROGRESS_PROFILES, PAST_PROGRESS_DAILY } from '../../app/shared/pjt-progress-data.js';
import { structureFromProfile, normalizeStructure } from '../../app/shared/pjt-structure.js';
const inp = JSON.parse(fs.readFileSync('/tmp/mig_in.json', 'utf8'));
const out = { structures: {}, past: PAST_PROGRESS_DAILY, notes: {} };
const FIXED = { p4ph2: { client: '귀뚜라미 범양냉방', title: 'FCU 설치', features: { layoutMap: true, weeklyReportPpt: true } }, p4ph4: { client: '귀뚜라미 범양냉방', title: 'EHU 설치', features: {} } };
Object.keys(FIXED).forEach((k) => { out.structures[k] = normalizeStructure(Object.assign(structureFromProfile(PROGRESS_PROFILES[k]), { ppt: { client: FIXED[k].client, title: FIXED[k].title }, features: FIXED[k].features })); });
const order = (a, b) => (a.order == null ? 9999 : a.order) - (b.order == null ? 9999 : b.order);
inp.light.forEach(({ id, doc, items }) => {
  const sorted = (items || []).slice().sort(order); const stageList = (doc.stageList || []).map((s) => String(s || '').trim()).filter(Boolean);
  let S;
  if (doc.progressStructure) {   // 이미 구조 데이터가 있으면 그 위에 품목 문서·단계 목록의 변경을 맞춘다(옛 화면과의 조정)
    S = JSON.parse(JSON.stringify(normalizeStructure(doc.progressStructure))); const have = new Set(sorted.map((d) => d.id));
    S.groups.forEach((g) => { g.items = g.items.filter((i) => have.has(i.id)); }); const known = new Set(); S.groups.forEach((g) => g.items.forEach((i) => known.add(i.id)));
    if (!S.groups.length) S.groups.push({ id: 'g1', name: '전체', kw: [], items: [] });
    sorted.forEach((d) => { if (!known.has(d.id)) (S.groups.find((g) => g.id === d.group) || S.groups[0]).items.push({ id: d.id, name: d.name || d.id }); });
    if (stageList.length) { stageList.forEach((s) => { if (S.stages.indexOf(s) === -1) S.stages.push(s); }); S.stages = S.stages.filter((s) => stageList.indexOf(s) !== -1); S.installCols = (S.installCols || []).filter((c) => S.stages.indexOf(c) !== -1); }
  } else {
    const groups = (doc.progressGroups && doc.progressGroups.length ? doc.progressGroups : [{ id: 'g1', name: '전체' }]).map((g) => ({ id: String(g.id), name: g.name || '전체', kw: [], items: [] }));
    sorted.forEach((it) => { (groups.find((x) => x.id === it.group) || groups[0]).items.push({ id: it.id, name: it.name || it.id }); });
    S = { stages: stageList, installCols: (doc.installCols || []).filter((c) => stageList.indexOf(c) !== -1), groups };
  }
  S.ppt = { client: doc.client || '', title: '품목' }; S.features = S.features || {};
  out.structures[id] = normalizeStructure(S);
  const gmap = {}; out.structures[id].groups.forEach((g) => g.items.forEach((i) => { gmap[i.id] = g.id; })); out.notes[id] = { groups: out.structures[id].groups.map((g) => g.id), itemGroup: gmap };
});
fs.writeFileSync('/tmp/mig_out.json', JSON.stringify(out));
console.log('구조 생성:', Object.keys(out.structures).map((k) => k + '(섹터 ' + out.structures[k].groups.length + ', 품목 ' + out.structures[k].groups.reduce((s, g) => s + g.items.length, 0) + ', 단계 ' + out.structures[k].stages.length + ')').join(' · '));
