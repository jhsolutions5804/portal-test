import { esc } from '../../core/ui.js?v=20261006g';
import { myTurn, canProxy, tabsOf } from './logic.js?v=20261006g';
import { docRowHtml } from './views.js?v=20261006g';
import { pipeCounts, todoCounts } from './home-stats.js?v=20261006g';

/** 홈에 보여 줄 문서 묶음 — 결재할 문서 / 수신함(참조·회람) / 내가 작성한 문서 / 게시된 문건 */
export function homeLists(docs, me) {
  const approve = docs.filter((d) => myTurn(d, me) || canProxy(d, me));
  const inbox = docs.filter((d) => tabsOf(d, me).cc && d.status !== 'draft' && d.status !== 'rejected');
  const mine = docs.filter((d) => d.authorUid === me.uid);
  const posted = docs.filter((d) => d.status === 'posted');
  return { approve, inbox, mine, posted };
}

const h1 = (n) => (Number(n) || 0).toFixed(1) + 'h';
const pct = (a, b) => (b > 0 ? Math.max(0, Math.min(100, Math.round((a / b) * 100))) : 0);
const stat = (label, value, tone) => '<div class="jh-kpi"' + (tone ? ' data-tone="' + tone + '"' : '') + '><span class="jh-kpi__label">' + esc(label) + '</span><span class="jh-kpi__value">' + value + '</span></div>';
const head = (t) => '<div class="jh-panel__head"><h3>' + t + '</h3></div>';
const note = (tone, text) => '<div class="jh-form"><div class="jh-alert" data-tone="' + tone + '">' + esc(text) + '</div></div>';

/** 이번 달 근로시간 칸 — 진행 막대 + 누계·소정·잔여 */
export function worktimeHtml(w) {
  const h = head('⏰ ' + esc(w.month || '') + ' 이번 달 근로시간');
  if (w.state === 'loading') return '<div class="jh-panel jh-card">' + h + '<div class="jh-empty">불러오는 중…</div></div>';
  if (w.state === 'unlinked') return '<div class="jh-panel jh-card">' + h + note('info', '계정이 근무자 명부와 연동되어 있지 않아 집계할 수 없습니다. 인사 담당자에게 연동을 요청해 주세요.') + '</div>';
  if (w.state === 'error') return '<div class="jh-panel jh-card">' + h + note('danger', '근로시간을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.') + '</div>';
  const s = w.summary; const p = pct(s.total, s.standard);
  return '<div class="jh-panel jh-card">' + h + '<div class="jh-form">' +
    '<div class="jh-progress" role="img" aria-label="소정근로시간 ' + h1(s.standard) + ' 중 ' + h1(s.total) + ' (' + p + '%)"' + (s.overtime > 0 ? ' data-tone="warn"' : '') + '><span class="jh-progress__bar" style="--p:' + p + '%"></span></div>' +
    '<div class="jh-kpi-grid" data-cols="3">' + stat('근무시간 누계', h1(s.total), 'accent') + stat('소정근로시간', h1(s.standard)) + stat('정규 잔여', h1(s.remain)) + '</div>' +
    (s.leaveHours > 0 ? '<span class="jh-field__hint">유급휴가 ' + h1(s.leaveHours) + ' 포함 (연차 1일=8h, 반차=4h)</span>' : '') +
    (s.overtime > 0 ? '<span class="jh-field__hint">소정근로시간을 ' + h1(s.overtime) + ' 초과했습니다. (초과근로 가능 잔여 ' + h1(s.otRemain) + ')</span>' : '') +
    '<div><a class="jh-link" href="' + esc(w.attendanceUrl || '#/attendance/input') + '">출퇴근 기록 확인·수정 ›</a></div></div></div>';
}

/** 연차 링 그래프: 부여 대비 **남은** 비율이 호로 그려지고(다 쓰면 호가 사라짐), 가운데에 잔여 일수 */
export function ringHtml(used, granted, remain) {
  const R = 40; const C = 2 * Math.PI * R; const p = granted > 0 ? Math.max(0, Math.min(1, remain / granted)) : 0;
  return '<div class="jh-ring" role="img" aria-label="연차 부여 ' + granted + '일 중 사용 ' + used + '일, 잔여 ' + remain + '일">' +
    '<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="jh-ring__track" cx="50" cy="50" r="' + R + '"/>' +
    (p > 0 ? '<circle class="jh-ring__bar" cx="50" cy="50" r="' + R + '" stroke-dasharray="' + (C * p).toFixed(2) + ' ' + C.toFixed(2) + '"/>' : '') + '</svg>' +
    '<div class="jh-ring__center"><span>' + remain + '일</span><small>남음</small></div></div>';
}

/** 내 연차 현황 칸 — 링 그래프 + 부여·사용·잔여 */
export function leaveBoxHtml(l) {
  const h = head('🌴 내 연차 현황');
  if (l.state === 'loading') return '<div class="jh-panel jh-card">' + h + '<div class="jh-empty">불러오는 중…</div></div>';
  if (l.state === 'nohire') return '<div class="jh-panel jh-card">' + h + note('info', '연차 현황 — 인사 명부에 입사일이 등록되어 있지 않습니다. 인사 담당자에게 입사일 등록을 요청해 주세요.') + '</div>';
  if (l.state === 'error') return '<div class="jh-panel jh-card">' + h + note('danger', '연차 현황을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.') + '</div>';
  const b = l.balance;
  return '<div class="jh-panel jh-card">' + h + '<div class="jh-form"><div class="jh-statrow">' + ringHtml(b.used, b.granted, b.remain) +
    '<div class="jh-kpi-grid" data-cols="3">' + stat('부여', b.granted + '<small> 일</small>', 'accent') + stat('사용', b.used + '<small> 일</small>') + stat('잔여', b.remain + '<small> 일</small>') + '</div></div>' +
    '<span class="jh-field__hint">' + esc(b.detail || '') + (b.planned ? ' · 사용 중 예정분 ' + b.planned + '일 포함' : '') + '</span></div></div>';
}

/** 지금 할 일 카드 4개 */
export function todoHtml(t) {
  const card = (go, icon, label, n, hint, tone) => '<button type="button" class="jh-todo" data-go="' + go + '"' + (n > 0 && tone ? ' data-tone="' + tone + '"' : '') + (n === 0 ? ' data-zero="true"' : '') + '>' +
    '<span class="jh-todo__top"><span class="jh-todo__icon" aria-hidden="true">' + icon + '</span><span class="jh-todo__value">' + n + '</span></span>' +
    '<span class="jh-todo__label">' + esc(label) + '</span><span class="jh-todo__hint">' + esc(n > 0 ? hint : '없음') + ' ›</span></button>';
  return '<div class="jh-todo-grid">' +
    card('todo', '✍️', '결재 요청', t.approve, '확인하고 결재하기', 'accent') +
    card('rejected', '↩️', '반려된 내 문서', t.rejected, '수정해서 다시 상신', 'warn') +
    card('approved', '📤', '게시 대기', t.postWait, '승인 완료 · 게시하기', 'accent') +
    card('cc', '📨', '수신함', t.inbox, '참조·회람 보기', 'accent') + '</div>';
}

/** 문서 현황: 임시저장 → 결재 진행 → 승인 → 게시, 그리고 반려. 눌러서 결재함의 해당 상태 목록으로 */
export function pipelineHtml(model) {
  const { docs, me, scope } = model; const rows = pipeCounts(docs, me, scope);
  const seg = me.admin ? '<div class="jh-segmented" role="group" aria-label="현황 범위">' +
    [['mine', '내 문서'], ['all', '전체']].map(([k, l]) => '<button type="button" class="jh-segmented__item" data-scope="' + k + '" aria-pressed="' + (scope === k) + '">' + l + '</button>').join('') + '</div>' : '';
  return '<section class="jh-panel jh-card"><div class="jh-panel__head"><h3>📊 ' + (me.admin ? '문서 현황' : '내 문서 현황') + '</h3>' + seg + '</div><div class="jh-form">' +
    '<div class="jh-pipeline">' + rows.map((r) => '<button type="button" class="jh-pipe" data-status="' + r.key + '" data-pipe="' + r.key + '"><span class="jh-pipe__count">' + r.count + '</span><span class="jh-pipe__label">' + esc(r.label) + '</span></button>').join('') + '</div>' +
    '<span class="jh-field__hint">' + (scope === 'all' ? '내가 볼 수 있는 모든 문서의 상태별 건수입니다.' : '내가 작성한 문서의 상태별 건수입니다.') + ' 게시되지 않은 문서도 단계를 눌러 바로 볼 수 있습니다.</span></div></section>';
}

const TABS = [['approve', '결재할 문서', 'todo'], ['inbox', '수신함', 'cc'], ['mine', '내 문서', 'mine'], ['posted', '게시 문건', 'posted']];
/** 최근 문서: 네 가지 목록을 한 칸에서 탭으로 전환 */
export function recentHtml(model) {
  const { lists, me, tab } = model; const rows = lists[tab] || [];
  const empty = { approve: '결재 요청 문서가 없습니다', inbox: '수신된 문서가 없습니다', mine: '작성한 문서가 없습니다', posted: '게시된 문건이 없습니다' }[tab];
  const cur = TABS.find((t) => t[0] === tab) || TABS[0];
  return '<section class="jh-panel jh-card"><div class="jh-panel__head"><h3>🕘 최근 문서</h3><button type="button" class="jh-link" data-go="' + cur[2] + '">전체 보기 ›</button></div>' +
    '<div class="jh-edoc-tabs" role="tablist">' + TABS.map((t) => '<button type="button" class="jh-tab' + (t[0] === tab ? ' is-active' : '') + '" role="tab" aria-selected="' + (t[0] === tab) + '" data-recent="' + t[0] + '">' + t[1] + '<span class="jh-tab__count">' + (lists[t[0]] || []).length + '</span></button>').join('') + '</div>' +
    '<div class="jh-doclist">' + (rows.length ? rows.slice(0, 8).map((d) => docRowHtml(d, me, '')).join('') : '<div class="jh-empty">' + esc(empty) + '</div>') + '</div></section>';
}

/** 홈 전체. 근로시간·연차는 따로 채워질 수 있어(명부·근태 조회) 칸마다 자리 표시를 둔다 */
export function homeHtml(model) {
  return '<div class="jh-dashboard">' +
    '<div class="jh-pagehead"><header class="jh-form__head"><h2 class="jh-form__title">전자결재 홈</h2><p class="jh-form__sub">내 근무 현황과 결재 문서를 한눈에</p></header>' +
      '<div class="jh-pagehead__actions">' + (model.me && model.me.admin ? '<button type="button" class="jh-btn" data-variant="ghost" data-admin>⚙ 관리자 설정</button>' : '') + '<button type="button" class="jh-btn jh-pc-only" data-variant="primary" data-new>＋ 새 문서 작성</button></div></div>' +
    '<div class="jh-dashboard__grid"><div id="edoc-work">' + worktimeHtml(model.work) + '</div><div id="edoc-leavebox">' + leaveBoxHtml(model.leave) + '</div></div>' +
    '<div id="edoc-todo">' + todoHtml(model.todo) + '</div>' +
    '<div id="edoc-pipe">' + pipelineHtml(model) + '</div>' +
    '<div id="edoc-recent">' + recentHtml(model) + '</div></div>';
}

/** 카드·단계·"전체 보기"가 가는 결재함 주소(홈과 플랫폼 홈 위젯이 함께 쓴다) */
export function homeTarget(go, me) {
  return ({
    todo: '#/edoc/box', cc: '#/edoc/box?tab=cc', mine: '#/edoc/box?tab=mine', posted: me.admin ? '#/edoc/box?tab=all&status=posted' : '#/edoc/box?tab=all',
    rejected: '#/edoc/box?tab=mine&status=rejected', approved: me.admin ? '#/edoc/box?tab=all&type=nodaily&status=approved' : '#/edoc/box?tab=mine&type=nodaily&status=approved'
  })[go];
}
