/* 실행예산 저장·읽기 — 읽기·쓰기·시계·서버 시각·저장자를 전부 주입한다(가짜로 시험). 시험: tests/plan-budget-save.test.mjs · 계산·검증: budget.js · 설계: 비공개 저장소 app-docs/execution-budget-design.md (대기열 1-3-9).
 * 주입(deps): read(id) → { exists, data } · write(id, data) · now() → 저장 시각 글자 · stamp() → 서버 시각 표시(serverTimestamp()) · by() → 저장자 uid. now·by·stamp 는 없어도 된다(시각은 기본 ISO, 저장자는 빈 글자, 서버 시각은 붙이지 않는다).
 * 규칙: ① 저장 전에 반드시 읽는다 ② 내가 불러온 개정 번호(baseRev)와 지금 저장된 번호가 다르면 덮어쓰지 않고 충돌(conflict)로 거절한다 ③ 저장된 문서가 깨져 있으면(corrupt) 읽기도 저장도 거절한다(그 위에 쓰지 않는다) ④ 권한 없음은 오류가 아니라 denied ⑤ 어떤 경우에도 던지지 않고 결과 객체로 돌려준다. */
import { budgetDocId, buildBudgetSave, budgetFromDoc } from './budget.js?v=20261031h';
const isO = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (error, extra) => Object.assign({ ok: false, error }, extra || {});
const NO_STORE = '저장소 연결이 없어 실행예산을 읽거나 저장할 수 없습니다.';
const codeOf = (e) => (e && typeof e === 'object' ? String(e.code || e.message || '') : String(e || '')).replace(/^firestore\//, '').slice(0, 80);
const hasFn = (deps, k) => isO(deps) && typeof deps[k] === 'function';
const callStr = (deps, k, fallback) => { try { const v = hasFn(deps, k) ? deps[k]() : ''; return typeof v === 'string' && v ? v : fallback; } catch (e) { return fallback; } };
/** 읽기 — 문서가 없으면 { ok:true, budget:null } */
export async function loadBudget(deps, pjtId) {
  const id = budgetDocId(pjtId); if (!id) return fail('프로젝트를 확인해 주세요.');
  if (!hasFn(deps, 'read')) return fail(NO_STORE);
  let snap;
  try { snap = await deps.read(id); } catch (e) { const c = codeOf(e); return fail('읽기 실패: ' + c, { denied: c === 'permission-denied' }); }
  if (!isO(snap) || snap.exists !== true) return { ok: true, budget: null };
  const p = budgetFromDoc(snap.data);
  return p.ok ? { ok: true, budget: p.budget } : fail(p.error, { corrupt: true });
}
/** 저장 — a = { pjtId, rows, baseRev(내가 불러온 개정 번호, 처음이면 0), note } */
export async function saveBudget(deps, a) {
  if (!isO(a)) return fail('저장 정보가 올바르지 않습니다.');
  if (!Number.isInteger(a.baseRev) || a.baseRev < 0) return fail('불러온 개정 번호를 확인할 수 없습니다. 다시 불러온 뒤 저장해 주세요.');
  if (!hasFn(deps, 'read') || !hasFn(deps, 'write')) return fail(NO_STORE);
  const cur = await loadBudget(deps, a.pjtId); if (!cur.ok) return cur;
  const curRev = cur.budget ? cur.budget.rev : 0;
  if (curRev !== a.baseRev) return fail('다른 곳에서 먼저 바뀌었습니다(현재 r' + curRev + '). 새로 불러온 뒤 다시 저장해 주세요.', { conflict: true });
  const plan = buildBudgetSave(cur.budget, a.rows, { pjtId: a.pjtId, note: a.note, now: callStr(deps, 'now', new Date().toISOString()), by: callStr(deps, 'by', '') });
  if (!plan.ok) return plan;
  if (plan.unchanged) return { ok: true, unchanged: true, rev: plan.rev };
  const data = Object.assign({}, plan.doc);
  try { if (hasFn(deps, 'stamp')) data.updatedAt = deps.stamp(); } catch (e) { /* 서버 시각 표시 실패는 저장을 막지 않는다 */ }
  try { await deps.write(plan.doc.pjtId, data); } catch (e) { const c = codeOf(e); return fail('저장 실패: ' + c, { denied: c === 'permission-denied' }); }
  return { ok: true, unchanged: false, rev: plan.doc.rev, budget: plan.doc };
}
