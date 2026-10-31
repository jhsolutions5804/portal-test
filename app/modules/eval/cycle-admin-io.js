/* 평가 회차 — 불러오기·단계 전환·과제 배정(서버 generateTasks)·동료평가 집계(서버 aggregatePeers). 저장은 eval_cycles/{연도} 한 문서(보안 규칙이 단계 전이를 강제한다).
 * 서버 함수가 아직 배포되지 않았거나 실패하면 그대로 알린다(된 것처럼 보이지 않는다). */
import { canManageCycle } from '../../shared/eval-perm.js?v=20261031c';
import { canMove, MOVE_TEXT, MOVE_WARN, STATE_TEXT, buildMembers, taskWarnings } from './cycle-admin.js?v=20261031c';
/** deps: { db, collection, getDocs, getDoc, setDoc, doc, serverTimestamp, callEval, toast, confirmDialog, paint, st, ctx, year } — callEval(data) = 서버 evalAct 호출 */
export function createCycleAdminController(deps) {
  const { db, collection, getDocs, getDoc, setDoc, doc, serverTimestamp, callEval, toast, confirmDialog, paint, st, ctx } = deps; const me = (ctx && ctx.me) || {}; const year = deps.year || 2026;
  const canManage = canManageCycle(me);   // 사장단 직급 + 관리자 계정(보안 규칙이 요구하는 조건과 맞춤) — 인사팀은 열람만
  st.ca = { year, cycle: null, plan: { members: [], noAccount: [], total: 0 }, taskCount: null, progress: null, aggregated: '', canManage, busy: false };
  const load = async (workers, users) => {
    const ca = st.ca; ca.plan = buildMembers(year, workers, users);
    try { const c = await getDoc(doc(db, 'eval_cycles/' + year)); ca.cycle = c.exists() ? c.data() : null; } catch (e) { ca.cycle = null; }
    try { const s = await getDocs(collection(db, 'eval_tasks')); let n = 0; s.forEach((d) => { if (d.id.indexOf(year + '__') === 0) n++; }); ca.taskCount = n; } catch (e) { ca.taskCount = null; }
  };
  const setStatus = async (to) => {
    const ca = st.ca; const from = ca.cycle && ca.cycle.status; if (from && !canMove(from, to)) { toast('이 단계로 바꿀 수 없습니다.'); return false; }
    try { await setDoc(doc(db, 'eval_cycles/' + year), { status: to, year, updatedAt: serverTimestamp(), updatedBy: me.uid || '' }); ca.cycle = Object.assign({}, ca.cycle || {}, { status: to, year }); return true; }
    catch (e) { toast('저장하지 못했습니다' + (e && e.code === 'permission-denied' ? ' — 권한이 없거나 되돌릴 수 없는 단계입니다.' : '. 연결을 확인하고 다시 시도해 주세요.')); return false; }
  };
  const onClick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return false; const b = t.closest('[data-cy-act]'); if (!b) return false; const ca = st.ca; const act = b.getAttribute('data-cy-act');
    if (!ca.canManage) { toast('회차 관리는 사장단만 할 수 있습니다.'); return true; } if (ca.busy) return true;
    if (act === 'create') { ca.busy = true; if (await setStatus('draft')) toast('평가 회차를 만들었습니다(준비).'); ca.busy = false; paint(); return true; }
    if (act.indexOf('move:') === 0) {
      const to = act.slice(5); const from = ca.cycle && ca.cycle.status; if (!canMove(from, to)) { toast('이 단계로 바꿀 수 없습니다.'); return true; }
      if (to === 'open' && !ca.taskCount) { toast('먼저 "과제 배정"을 해서 직원에게 평가를 배정해 주세요.'); return true; }
      const ok = await confirmDialog({ title: MOVE_TEXT[to] + '?', body: MOVE_WARN[to] + (to === 'closed' || to === 'published' ? ' 되돌릴 수 없습니다.' : ''), confirmLabel: MOVE_TEXT[to], variant: to === 'closed' ? 'danger' : undefined }); if (!ok || !ok.ok) return true;
      ca.busy = true; if (await setStatus(to)) toast('평가가 "' + STATE_TEXT[to] + '" 단계가 되었습니다.'); ca.busy = false; paint(); return true;
    }
    if (act === 'tasks') {
      const warns = taskWarnings(ca.plan); const ok = await confirmDialog({ title: '과제를 배정할까요?', body: '평가 대상 ' + ca.plan.total + '명 중 포털 계정이 연결된 ' + (ca.plan.total - ca.plan.noAccount.length) + '명에게 자기평가·동료평가(같은 팀)·팀장 1차 평가를 배정합니다. 이미 배정된 과제는 같은 내용으로 다시 만들어집니다.' + (warns.length ? ' (시작 전 확인 항목 ' + warns.length + '건이 있습니다)' : ''), confirmLabel: '배정' }); if (!ok || !ok.ok) return true;
      ca.busy = true; try { const r = await callEval({ action: 'generateTasks', year, members: ca.plan.members.map((m) => ({ uid: m.uid, workerId: m.workerId, team: m.team, name: m.name, isLead: m.isLead })) }); ca.taskCount = r.tasks; toast('과제를 배정했습니다: ' + r.tasks + '명' + (r.skipped && r.skipped.length ? ' (계정이 없어 건너뜀 ' + r.skipped.length + '명)' : '')); } catch (e) { toast(e.message || '과제를 배정하지 못했습니다. 서버 함수가 배포되어 있는지 확인해 주세요.'); } ca.busy = false; paint(); return true;
    }
    if (act === 'aggregate') {
      const ok = await confirmDialog({ title: '동료평가를 집계할까요?', body: '마감된 회차의 제출을 서버가 평균으로 만들어 정기평가 결과에 넣습니다. 평가자가 2명 미만인 직원은 평균이 비어 있게 됩니다. 개인별 점수는 누구에게도 보이지 않습니다.', confirmLabel: '집계' }); if (!ok || !ok.ok) return true;
      ca.busy = true; try { const r = await callEval({ action: 'aggregatePeers', year, targets: ca.plan.members.map((m) => m.workerId) }); const res = Object.values(r.results || {}); const done = res.filter((x) => x.avg != null).length; ca.aggregated = '평균 ' + done + '명 반영 · ' + (res.length - done) + '명은 평가자 2명 미만으로 비어 있음'; toast('집계했습니다: ' + ca.aggregated); } catch (e) { toast(e.message || '집계하지 못했습니다. 서버 함수가 배포되어 있는지, 평가가 마감되었는지 확인해 주세요.'); } ca.busy = false; paint(); return true;
    }
    return false;
  };
  return { load, onClick };
}
