/* 프로젝트 공정율 불러오기(공용) — 날짜별 체크를 모두 읽어 계산한다(월간 공수 보기의 프로젝트별 진행률). 읽기 전용. 규칙은 progress.js·structure.js. */
import { db, collection, getDocs } from '../../core/firebase.js?v=20261031c';
import { pathsFor } from './adapter.js?v=20261031c';
import { structureFor } from './structure-store.js?v=20261031c';
import { toRuntime } from './structure.js?v=20261031c';
import { normalizeDay, stateAt, calcAll, stagesOf } from './progress.js?v=20261031c';
/** regDoc = pjt_registry 문서(+id), name = 프로젝트 이름, today = 'YYYY-MM-DD' → 공정율(0~100) 또는 null(계산 실패) */
export async function loadProgressPct(regDoc, name, today) {
  try {
    const P = pathsFor(regDoc.id || regDoc.key); const sr = structureFor(regDoc); const S = toRuntime(sr.S, name, stagesOf); const days = {};
    try { (await getDocs(collection(db, P.progress.days))).forEach((x) => { days[x.id] = normalizeDay(x.data()); }); } catch (e) { /* 체크가 아직 없음 */ }
    const states = {}; S.groups.forEach((g) => { states[g.id] = stateAt(days, today, g.id); }); const pct = calcAll(S, states).pct; return typeof pct === 'number' && isFinite(pct) ? pct : null;
  } catch (e) { return null; }
}
