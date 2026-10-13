/* 시험 전용 도구 — 구포털 코드 상수(공정 프로파일)로 실제와 같은 공정 구조를 만든다. 운영 코드에는 이런 상수가 없다(구조는 프로젝트 문서의 데이터). */
import { PROGRESS_PROFILES } from '../app/shared/pjt-progress-data.js';
import { structureFromProfile, normalizeStructure } from '../app/shared/pjt-structure.js';
import { toRuntime } from '../app/modules/pjt/structure.js';
import { stagesOf } from '../app/modules/pjt/progress.js';
/** 'p4ph2' | 'p4ph4' → 화면이 쓰는 형식의 구조(섹터·장비·단계) */
export const fixedStructure = (key) => { const p = PROGRESS_PROFILES[key === 'p4ph4' ? 'p4ph4' : 'p4ph2']; return toRuntime(structureFromProfile(p), p.label, stagesOf); };
/** 섹터가 하나인 프로젝트 구조: doc = { stageList, installCols, name }, items = [{ id, name }] */
export const lightStructure = (doc, items) => { const d = doc || {}; const S = normalizeStructure({ ppt: { client: d.client || '', title: '' }, stages: d.stageList || [], installCols: d.installCols || [], groups: [{ id: 'g1', name: '전체', items: (items || []).map((x) => ({ id: x.id, name: x.name || x.id })) }] }); return toRuntime(S, d.name || '', stagesOf); };
export const profileData = () => PROGRESS_PROFILES;
