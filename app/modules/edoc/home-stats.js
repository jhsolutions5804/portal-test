import { tabsOf, availableActions, NO_POST_TYPES } from './logic.js?v=20261007g';

/** 문서 현황 단계: 임시저장 → 결재 진행 → 승인(게시 대기) → 게시, 그리고 반려 */
export const PIPE_STEPS = [
  { key: 'draft', label: '임시저장', statuses: ['draft'] },
  { key: 'waiting', label: '결재 진행', statuses: ['pending', 'reviewing'] },
  { key: 'approved', label: '승인 · 게시 대기', statuses: ['approved'] },
  { key: 'posted', label: '게시', statuses: ['posted'] },
  { key: 'rejected', label: '반려', statuses: ['rejected'] }
];

/** 현황 범위: mine = 내가 작성한 문서, all = 보이는 모든 문서(관리자) */
export function scopeDocs(docs, me, scope) {
  if (scope === 'all' && me.admin) return docs;
  return docs.filter((d) => d.authorUid === me.uid);
}
export function pipeCounts(docs, me, scope) {
  const list = scopeDocs(docs, me, scope);
  return PIPE_STEPS.map((s) => ({ key: s.key, label: s.label, count: list.filter((d) => s.statuses.indexOf(d.status) !== -1).length }));
}
/** 지금 할 일: 결재 요청 · 반려(내 문서) · 게시 대기 · 수신함. 업무일지는 승인으로 끝나고 게시하지 않으므로 게시 대기에서 뺀다 */
export function todoCounts(docs, me) {
  let approve = 0; let rejected = 0; let postWait = 0; let inbox = 0;
  docs.forEach((d) => {
    const t = tabsOf(d, me);
    if (t.todo) approve++;
    if (d.authorUid === me.uid && d.status === 'rejected') rejected++;
    if (d.status === 'approved' && NO_POST_TYPES.indexOf(d.dtype) === -1 && (d.authorUid === me.uid || availableActions(d, me).some((a) => a.key === 'post'))) postWait++;
    if (t.cc && d.status !== 'draft' && d.status !== 'rejected') inbox++;
  });
  return { approve, rejected, postWait, inbox };
}
