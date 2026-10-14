/* PJT 전체 홈·종료 PJT 화면(표시만). 규칙은 overview.js, 불러오기·저장·이벤트는 overview-index.js. */
import { esc } from '../../core/ui.js?v=20261014zi';
import { holidayName } from '../../shared/holidays.js?v=20261014zi';
import { monthGrid, itemsForKey, dowOf } from './schedule.js?v=20261014zi';
import { FIELDS } from './settings.js?v=20261014zi';
import { colorOf, blockDays, blockLabel, monthLabel, groupByDay, legendOf, cardOf } from './overview.js?v=20261014zi';
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const dayHead = (k) => { const [, m, d] = k.split('-').map(Number); return m + '/' + d; };
const offKind = (k) => (holidayName(k) || dowOf(k) === 0 ? 'red' : dowOf(k) === 6 ? 'sat' : '');
const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
const head = (right) => '<div class="jh-pjt__proj"><span class="jh-pjt__projlabel">🏗️ PJT 관리</span>' + (right || '') + '</div>';
const keysOf = (st) => st.projects.map((p) => p.key);

/** 신규 프로젝트 폼(설정 탭과 같은 기본정보 10칸) */
function newForm(st) {
  const f = st.form; const inp = (k, label) => '<div class="jh-ro__fld"' + (k === 'content' ? ' data-wide="1"' : '') + '><label>' + esc(label) + (k === 'name' ? ' <b>*</b>' : '') + '</label><input class="jh-input" data-ov-f="' + k + '" autocomplete="off"' + (k === 'startDate' ? ' type="date"' : k === 'qty' ? ' inputmode="numeric"' : '') + ' value="' + esc(f[k] || '') + '"></div>';
  return '<section class="jh-card"><div class="jh-panel__head"><h3>신규 프로젝트</h3></div><div class="jh-ro__form">' + FIELDS.map(([k, l]) => inp(k, l)).join('') + '</div><div class="jh-field__hint jh-ro__pad">만든 뒤에는 프로젝트 ⚙️ 설정에서 참여 부서·개인을 정하고, 공정 탭에서 섹터·품목·단계를 정합니다. 모든 프로젝트가 같은 화면·같은 규칙입니다.</div><div class="jh-ro__fbar">' + (st.msg ? '<span class="jh-ro__msg" data-bad="1" role="alert">' + esc(st.msg) + '</span>' : '<span></span>') + '<span><button type="button" class="jh-btn" data-variant="secondary" data-ov-cancel>취소</button> <button type="button" class="jh-btn" data-variant="primary" data-ov-create' + (st.busy ? ' disabled' : '') + '>' + (st.busy ? '만드는 중...' : '만들기') + '</button></span></div></section>';
}
/** 프로젝트 카드: 공정율·D+·누적 공수·오늘 출역(통계는 늦게 도착하므로 "—"로 먼저 그린다) */
function projectCard(st, p) {
  const c = cardOf(p, st.stats[p.key], st.today); const col = colorOf(keysOf(st), p.key);
  const kpi = (label, val, extra) => '<div class="jh-ov__kpi"><strong>' + val + '</strong><span>' + label + '</span>' + (extra || '') + '</div>';
  return '<article class="jh-ov__card" style="--pc:' + col + '" data-ov-open="' + esc(p.key) + '" tabindex="0" role="link" aria-label="' + esc(c.name) + ' 프로젝트 홈 열기"><div class="jh-ov__ch"><span class="jh-ov__dot" aria-hidden="true"></span><h3>' + esc(c.name) + '</h3>' + (st.admin ? '<button type="button" class="jh-btn" data-variant="secondary" data-ov-set="' + esc(p.key) + '" title="설정(관리자)">⚙️</button>' : '') + '</div>'
    + '<div class="jh-ov__info">' + (c.info.length ? c.info.map((x) => '<span class="jh-pjt__chip" data-tone="gray">' + esc(x) + '</span>').join(' ') : '<span class="jh-field__hint">거래처·현장 미입력</span>') + '</div>'
    + '<div class="jh-ov__kpis">' + kpi('공정율', c.pct == null ? '—' : f1(c.pct) + '%', '<i class="jh-ov__bar"><b style="width:' + (c.pct == null ? 0 : Math.min(100, c.pct)) + '%"></b></i>') + kpi('시작일 D+', c.dplus) + kpi('누적 공수', c.total == null ? '—' : f1(c.total)) + kpi('오늘 출역', c.headcount == null ? '—' : c.headcount + '명') + '</div>'
    + '<div class="jh-ov__cf"><button type="button" class="jh-btn" data-variant="primary" data-ov-open="' + esc(p.key) + '">열기 →</button></div></article>';
}
const legendHtml = (list, st) => '<div class="jh-ov__legend">' + (list.length ? list.map((p) => '<span><i style="background:' + colorOf(keysOf(st), p.key) + '"></i>' + esc(p.label) + '</span>').join('') : '<span class="jh-field__hint">이 기간에 일정이 없습니다.</span>') + '</div>';
const itemHtml = (st, s) => '<button type="button" class="jh-ov__it" style="--pc:' + colorOf(keysOf(st), s.pjtKey) + '" data-ov-sched="' + esc(s.pjtKey) + '" title="이 프로젝트의 일정 탭에서 보기·수정">' + (s.stime && s.stime !== '미정' ? '<b>' + esc(s.stime) + '</b> ' : '') + esc(s.text || '') + '<small>' + esc(s.pjtName || '') + '</small></button>';
function weekly(st) {
  const days = blockDays(st.today, st.offset); const map = groupByDay(st.items, days);
  const cells = days.map((k) => { const hn = holidayName(k); const its = map[k]; return '<div class="jh-ov__day"' + (k === st.today ? ' data-today="1"' : '') + '><div class="jh-ov__dh" data-off="' + offKind(k) + '"><b>' + dayHead(k) + (k === st.today ? ' (오늘)' : '') + '</b><span>' + DOW[dowOf(k)] + (hn ? ' · ' + esc(hn) : '') + '</span></div>' + (its.length ? its.map((s) => itemHtml(st, s)).join('') : '<div class="jh-ov__none">—</div>') + '</div>'; }).join('');
  return '<div class="jh-ov__tool"><button type="button" class="jh-btn" data-variant="secondary" data-ov-shift="-1" aria-label="이전 2주">‹</button><strong>' + esc(blockLabel(days, st.offset)) + '</strong><button type="button" class="jh-btn" data-variant="secondary" data-ov-shift="1" aria-label="다음 2주">›</button><span class="jh-ov__sp"></span><button type="button" class="jh-btn" data-variant="secondary" data-ov-today>오늘</button><button type="button" class="jh-btn" data-variant="secondary" data-ov-png>🖼️ 이미지 저장</button></div>' + legendHtml(legendOf(map, st.projects), st) + '<div class="jh-ov__grid">' + cells + '</div>';
}
function monthly(st) {
  const weeks = monthGrid(st.y, st.m); const flat = weeks.flat().filter(Boolean); const map = groupByDay(st.items, flat);
  const dow = '<div class="jh-ov__dow">' + DOW.map((d, i) => '<span data-off="' + (i === 0 ? 'red' : i === 6 ? 'sat' : '') + '">' + d + '</span>').join('') + '</div>';
  const cells = weeks.flat().map((k) => { if (!k) return '<div class="jh-ov__mc" data-empty="1"></div>'; const its = map[k]; const dots = [...new Set(its.map((s) => s.pjtKey))].map((pk) => '<i style="background:' + colorOf(keysOf(st), pk) + '"></i>').join(''); const hn = holidayName(k); return '<button type="button" class="jh-ov__mc" data-ov-day="' + k + '"' + (k === st.sel ? ' aria-current="true"' : '') + (k === st.today ? ' data-today="1"' : '') + '><b data-off="' + offKind(k) + '">' + (+k.slice(8)) + '</b>' + (hn ? '<em>' + esc(hn) + '</em>' : '') + '<span class="jh-ov__dots">' + dots + '</span>' + (its.length ? '<small>' + its.length + '건</small>' : '') + '</button>'; }).join('');
  const sel = st.sel && map[st.sel] ? map[st.sel] : (st.sel ? itemsForKey(st.items, st.sel) : []); const detail = st.sel ? '<div class="jh-ov__detail"><h4>' + dayHead(st.sel) + ' (' + DOW[dowOf(st.sel)] + ')' + (holidayName(st.sel) ? ' · ' + esc(holidayName(st.sel)) : '') + '</h4>' + (sel.length ? sel.map((s) => itemHtml(st, s)).join('') : '<div class="jh-field__hint">이 날 일정이 없습니다.</div>') + '</div>' : '<div class="jh-field__hint jh-ro__pad">날짜를 누르면 그날의 일정이 나옵니다.</div>';
  return '<div class="jh-ov__tool"><button type="button" class="jh-btn" data-variant="secondary" data-ov-shift="-1" aria-label="이전 달">‹</button><strong>' + monthLabel(st.y, st.m) + '</strong><button type="button" class="jh-btn" data-variant="secondary" data-ov-shift="1" aria-label="다음 달">›</button><span class="jh-ov__sp"></span><button type="button" class="jh-btn" data-variant="secondary" data-ov-today>이번 달</button></div>' + legendHtml(legendOf(map, st.projects), st) + dow + '<div class="jh-ov__month">' + cells + '</div>' + detail;
}
/** 일정 영역 안쪽(주간/월간 탭 + 내용) — 주간·월간을 누를 때 이 부분만 다시 그린다(프로젝트 카드는 건드리지 않는다) */
export function schedInner(st) {
  const tabs = '<div class="jh-ro__ftabs" role="tablist" aria-label="일정 보기">' + [['weekly', '주간 (2주)'], ['monthly', '월간']].map(([k, l]) => '<button type="button" role="tab" class="jh-ro__ftab" data-ov-view="' + k + '" aria-selected="' + (st.view === k ? 'true' : 'false') + '">' + l + '</button>').join('') + '</div>';
  return '<div class="jh-panel__head"><h3>프로젝트 통합 일정</h3><span class="jh-field__hint">일정은 각 프로젝트의 일정 탭에서 등록·수정합니다(항목을 누르면 이동)</span></div>' + tabs + '<div class="jh-ov__sched">' + (st.view === 'monthly' ? monthly(st) : weekly(st)) + '</div>';
}
/** 프로젝트 카드 영역 안쪽 — 통계가 늦게 도착할 때 이 부분만 다시 그린다 */
export function railInner(st) {
  return st.projects.length ? st.projects.map((p) => projectCard(st, p)).join('') : '<div class="jh-alert" data-tone="warn" role="status">열 수 있는 프로젝트가 없습니다. ' + (st.admin ? '[＋ 신규 프로젝트]로 만들 수 있습니다.' : '참여자로 지정된 프로젝트만 보입니다.') + '</div>';
}
/** PJT 전체 홈: 왼쪽에 프로젝트 카드를 세로로, 오른쪽에 통합 일정(좁은 화면은 위아래) */
export function overviewHtml(st) {
  if (!st.ready) return '<div class="jh-pjt jh-pjt--prog"><div class="jh-pjt__main jh-pjt__mainwide">' + head() + (st.err ? '<div class="jh-alert" data-tone="danger" role="alert">' + esc(st.err) + '</div>' : '<div class="jh-empty">불러오는 중...</div>') + '</div></div>';
  return '<div class="jh-pjt jh-pjt--prog"><div class="jh-pjt__main jh-pjt__mainwide">' + head(st.admin ? '<button type="button" class="jh-btn" data-variant="primary" data-ov-new style="margin-left:auto"' + (st.form ? ' disabled' : '') + '>＋ 신규 프로젝트</button>' : '') + (st.form ? newForm(st) : '')
    + '<div class="jh-ov__layout"><aside class="jh-ov__rail" id="ov-rail" aria-label="프로젝트">' + railInner(st) + '</aside><section class="jh-card jh-ov__main" id="ov-sched">' + schedInner(st) + '</section></div></div></div>';
}
/** 종료 PJT 목록 */
export function endedHtml(st) {
  if (!st.ready) return '<div class="jh-pjt jh-pjt--prog"><div class="jh-pjt__main jh-pjt__mainwide"><div class="jh-pjt__proj"><span class="jh-pjt__projlabel">🗄️ 종료 PJT</span></div>' + (st.err ? '<div class="jh-alert" data-tone="danger" role="alert">' + esc(st.err) + '</div>' : '<div class="jh-empty">불러오는 중...</div>') + '</div></div>';
  const card = (d) => { const info = [d.client, d.site].filter(Boolean); const ended = d.endedAt && d.endedAt.seconds > 946684800 ? new Date(d.endedAt.seconds * 1000) : null;   /* 2000년 이전 값은 날짜로 보지 않는다 */ const et = ended ? ended.getFullYear() + '-' + String(ended.getMonth() + 1).padStart(2, '0') + '-' + String(ended.getDate()).padStart(2, '0') : '';
    return '<article class="jh-ov__card" data-ended="1"><div class="jh-ov__ch"><h3>' + esc(d.name || '(이름 없음)') + '</h3><span class="jh-pjt__chip" data-tone="gray">종료' + (et ? ' ' + et : '') + '</span></div><div class="jh-ov__info">' + (info.length ? info.map((x) => '<span class="jh-pjt__chip" data-tone="gray">' + esc(x) + '</span>').join(' ') : '') + '</div>' + (d.content ? '<div class="jh-field__hint">' + esc(d.content) + '</div>' : '')
      + (st.admin ? '<div class="jh-ov__cf"><button type="button" class="jh-btn" data-variant="secondary" data-ov-resume="' + esc(d.id) + '"' + (st.busy ? ' disabled' : '') + '>재개</button><button type="button" class="jh-btn" data-variant="danger" data-ov-del="' + esc(d.id) + '"' + (st.busy ? ' disabled' : '') + '>🗑 완전삭제</button></div>' : '') + '</article>'; };
  return '<div class="jh-pjt jh-pjt--prog"><div class="jh-pjt__main jh-pjt__mainwide"><div class="jh-pjt__proj"><span class="jh-pjt__projlabel">🗄️ 종료 PJT</span><span class="jh-field__hint">' + (st.admin ? '재개하면 진행 중 프로젝트로 돌아갑니다. 완전삭제는 되돌릴 수 없습니다.' : '종료된 프로젝트 목록(재개·삭제는 관리자)') + '</span></div>' + (st.list.length ? '<div class="jh-ov__cards">' + st.list.map(card).join('') + '</div>' : '<div class="jh-empty">종료된 프로젝트가 없습니다.</div>') + '</div></div>';
}
