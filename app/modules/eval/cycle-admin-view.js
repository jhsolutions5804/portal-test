/* 평가 회차 카드(정기평가 운영 화면 맨 위) — 마크업만. 사장단만 단계 전환·과제 생성·집계 버튼이 켜지고, 인사팀은 상태만 본다. 저장·서버 호출은 cycle-admin-io.js */
import { esc } from '../../core/ui.js?v=20261031a';
import { STATE_TEXT, STATES, nextState, MOVE_TEXT, taskWarnings } from './cycle-admin.js?v=20261031a';
const chip = (text, tone) => '<span class="jh-chip" data-tone="' + tone + '">' + esc(text) + '</span>';
const TONE = { draft: 'muted', open: 'accent', closed: 'warn', published: 'accent' };

export function cycleCardHtml(st) {
  const ca = st.ca; const status = (ca.cycle && ca.cycle.status) || ''; const can = !!ca.canManage; const next = status ? nextState(status) : 'open';
  const steps = STATES.map((s, i) => '<li class="jh-eval-step" data-now="' + (s === status) + '" data-done="' + (status ? STATES.indexOf(s) < STATES.indexOf(status) : false) + '"><span>' + (i + 1) + '</span>' + esc(STATE_TEXT[s]) + '</li>').join('');
  const head = '<div class="jh-hr__bar">' + (status ? chip('현재 ' + STATE_TEXT[status], TONE[status]) : chip('회차 없음(아직 만들지 않음)', 'warn')) + '<span class="jh-field__hint">' + esc(ca.year) + '년 평가 회차</span></div><ol class="jh-eval-steps" aria-label="평가 진행 단계">' + steps + '</ol>';
  const warns = taskWarnings(ca.plan || { members: [], noAccount: [], total: 0 });
  const wHtml = warns.length && (!status || status === 'draft' || status === 'open') ? '<div class="jh-field__hint" data-tone="warn"><strong>시작 전 확인</strong><ul>' + warns.map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul></div>' : '';
  const stat = status ? '<div class="jh-field__hint">배정된 직원 ' + esc(ca.taskCount == null ? '-' : ca.taskCount) + '명' + (ca.progress ? ' · 제출 ' + esc(ca.progress.done) + ' / ' + esc(ca.progress.total) + '건' : '') + '</div>' : '';
  const dis = can ? '' : ' disabled'; const btn = (act, label, extra) => '<button type="button" class="jh-btn" data-variant="' + (extra || 'secondary') + '" data-cy-act="' + act + '"' + dis + '>' + esc(label) + '</button>';
  const acts = [];
  if (!status) acts.push(btn('create', '회차 만들기(준비)'));
  if (status === 'draft' || status === 'open') acts.push(btn('tasks', status === 'draft' ? '과제 배정' : '과제 다시 배정'));
  if (next && status) acts.push(btn('move:' + next, MOVE_TEXT[next], 'primary'));
  if (status === 'closed' || status === 'published') acts.push(btn('aggregate', '동료평가 집계'));
  const aggNote = status === 'closed' || status === 'published' ? '<div class="jh-field__hint">동료평가는 <strong>마감 후 한 번에</strong> 집계합니다. 평가자 2명 미만이면 평균을 만들지 않고, 개인 점수는 누구도 볼 수 없습니다.' + (ca.aggregated ? ' 마지막 집계: ' + esc(ca.aggregated) : '') + '</div>' : '';
  const lock = status === 'closed' || status === 'published' ? '<div class="jh-field__hint">마감된 회차는 <strong>다시 열 수 없습니다</strong>(다시 열어 재집계하면 평균 변화로 개인 점수가 드러나기 때문입니다).</div>' : '';
  const note = can ? '' : '<div class="jh-field__hint">회차 관리는 사장단만 할 수 있습니다. 인사팀은 진행 상황을 볼 수 있습니다.</div>';
  return '<section class="jh-card"><div class="jh-panel__head"><h3>평가 회차</h3></div><div class="jh-hr__pad">' + head + stat + wHtml + '<div class="jh-hr__bar">' + acts.join('') + '</div>' + aggNote + lock + note + '</div></section>';
}
