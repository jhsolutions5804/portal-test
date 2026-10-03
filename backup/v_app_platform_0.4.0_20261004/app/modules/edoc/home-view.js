import { esc } from '../../core/ui.js?v=20261004g';
import { myTurn, canProxy, tabsOf } from './logic.js?v=20261004g';
import { docRowHtml } from './views.js?v=20261004g';

/** 홈에 보여 줄 문서 묶음 — 결재할 문서 / 수신함(참조·회람) / 내가 작성한 문서 / 게시된 문건 */
export function homeLists(docs, me) {
  const approve = docs.filter((d) => myTurn(d, me) || canProxy(d, me));
  const inbox = docs.filter((d) => tabsOf(d, me).cc && d.status !== 'draft' && d.status !== 'rejected');
  const mine = docs.filter((d) => d.authorUid === me.uid);
  const posted = docs.filter((d) => d.status === 'posted');
  return { approve, inbox, mine, posted };
}

const kpi = (label, n, hint, go, tone) => '<button type="button" class="jh-kpi" data-go="' + go + '"' + (tone ? ' data-tone="' + tone + '"' : '') + '>' +
  '<span class="jh-kpi__label">' + esc(label) + '</span><span class="jh-kpi__value">' + n + '<small> 건</small></span><span class="jh-kpi__hint">' + esc(hint) + ' ›</span></button>';
const h1 = (n) => (Number(n) || 0).toFixed(1) + 'h';
const stat = (label, value, tone) => '<div class="jh-kpi"' + (tone ? ' data-tone="' + tone + '"' : '') + '><span class="jh-kpi__label">' + esc(label) + '</span><span class="jh-kpi__value">' + value + '</span></div>';

/** 이번 달 근로시간 칸 */
export function worktimeHtml(w) {
  const head = '<div class="jh-panel__head"><h3>⏰ ' + esc(w.month || '') + ' 이번 달 근로시간</h3></div>';
  if (w.state === 'loading') return '<div class="jh-panel jh-card">' + head + '<div class="jh-empty">불러오는 중…</div></div>';
  if (w.state === 'unlinked') return '<div class="jh-panel jh-card">' + head + '<div class="jh-form"><div class="jh-alert" data-tone="info">계정이 근무자 명부와 연동되어 있지 않아 집계할 수 없습니다. 인사 담당자에게 연동을 요청해 주세요.</div></div></div>';
  if (w.state === 'error') return '<div class="jh-panel jh-card">' + head + '<div class="jh-form"><div class="jh-alert" data-tone="danger">근로시간을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div></div></div>';
  const s = w.summary;
  return '<div class="jh-panel jh-card">' + head + '<div class="jh-form"><div class="jh-kpi-grid" data-cols="3">' +
    stat('근무시간 누계', h1(s.total), 'accent') + stat('소정근로시간', h1(s.standard)) + stat('정규 잔여', h1(s.remain)) + '</div>' +
    (s.leaveHours > 0 ? '<span class="jh-field__hint">유급휴가 ' + h1(s.leaveHours) + ' 포함 (연차 1일=8h, 반차=4h)</span>' : '') +
    (s.overtime > 0 ? '<span class="jh-field__hint">소정근로시간을 ' + h1(s.overtime) + ' 초과했습니다. (초과근로 가능 잔여 ' + h1(s.otRemain) + ')</span>' : '') +
    '<div><a class="jh-link" href="' + esc(w.attendanceUrl || '../attendance/') + '">출퇴근 기록하러 가기 ›</a></div></div></div>';
}

/** 내 연차 현황 칸 */
export function leaveBoxHtml(l) {
  const head = '<div class="jh-panel__head"><h3>🌴 내 연차 현황</h3></div>';
  if (l.state === 'loading') return '<div class="jh-panel jh-card">' + head + '<div class="jh-empty">불러오는 중…</div></div>';
  if (l.state === 'nohire') return '<div class="jh-panel jh-card">' + head + '<div class="jh-form"><div class="jh-alert" data-tone="info">연차 현황 — 인사 명부에 입사일이 등록되어 있지 않습니다. 인사 담당자에게 입사일 등록을 요청해 주세요.</div></div></div>';
  if (l.state === 'error') return '<div class="jh-panel jh-card">' + head + '<div class="jh-form"><div class="jh-alert" data-tone="danger">연차 현황을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div></div></div>';
  const b = l.balance;
  return '<div class="jh-panel jh-card">' + head + '<div class="jh-form"><div class="jh-kpi-grid" data-cols="3">' +
    stat('부여', b.granted + '<small> 일</small>', 'accent') + stat('사용', b.used + '<small> 일</small>') + stat('잔여', b.remain + '<small> 일</small>') + '</div>' +
    '<span class="jh-field__hint">' + esc(b.detail || '') + (b.planned ? ' · 사용 중 예정분 ' + b.planned + '일 포함' : '') + '</span></div></div>';
}

const panel = (title, go, rows, me, empty) => '<section class="jh-panel jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3><button type="button" class="jh-link" data-go="' + go + '">전체 보기 ›</button></div>' +
  '<div class="jh-doclist">' + (rows.length ? rows.slice(0, 8).map((d) => docRowHtml(d, me, '')).join('') : '<div class="jh-empty">' + esc(empty) + '</div>') + '</div></section>';

/** 홈 전체. w·l 은 따로 채워질 수 있어(근태·명부 조회) 칸마다 자리 표시를 둔다 */
export function homeHtml(model) {
  const { me, lists } = model;
  return '<div class="jh-dashboard">' +
    '<header class="jh-form__head"><h2 class="jh-form__title">전자결재 홈</h2><p class="jh-form__sub">내 결재함 · 수신함 · 게시 문건</p></header>' +
    '<div class="jh-dashboard__grid"><div id="edoc-work">' + worktimeHtml(model.work) + '</div><div id="edoc-leavebox">' + leaveBoxHtml(model.leave) + '</div></div>' +
    '<div class="jh-kpi-grid">' + kpi('결재 요청', lists.approve.length, '확인하기', 'todo', 'accent') + kpi('수신함', lists.inbox.length, '보러가기', 'cc') +
      kpi('내 문서', lists.mine.length, '전체 보기', 'mine') + kpi('게시 문건', lists.posted.length, '조회하기', 'posted') + '</div>' +
    '<div class="jh-dashboard__grid">' +
      panel('✍️ 내가 결재해야 할 문서', 'todo', lists.approve, me, '결재 요청 문서가 없습니다') +
      panel('📨 수신함 (참조·회람)', 'cc', lists.inbox, me, '수신된 문서가 없습니다') +
      panel('📝 내가 작성한 문서', 'mine', lists.mine, me, '작성한 문서가 없습니다') +
      panel('📤 게시된 문건', 'posted', lists.posted, me, '게시된 문건이 없습니다') + '</div>' +
    '<div><button type="button" class="jh-btn" data-variant="primary" data-new>＋ 새 문서 작성</button></div></div>';
}
