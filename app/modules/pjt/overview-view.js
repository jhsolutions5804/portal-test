/* PJT 전체 홈·종료 PJT 화면(표시만). 규칙은 overview.js, 불러오기·저장·이벤트는 overview-index.js. */
import { esc } from '../../core/ui.js?v=20261031f';
import { holidayName } from '../../shared/holidays.js?v=20261031f';
import { monthGrid, itemsForKey, dowOf } from './schedule.js?v=20261031f';
import { FIELDS } from './settings.js?v=20261031f';
import { colorOf, monthLabel, groupByDay, legendOf } from './overview.js?v=20261031f';
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const dayHead = (k) => { const [, m, d] = k.split('-').map(Number); return m + '/' + d; };
const offKind = (k) => (holidayName(k) || dowOf(k) === 0 ? 'red' : dowOf(k) === 6 ? 'sat' : '');
const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
const head = (right) => '<div class="jh-pjt__proj"><span class="jh-pjt__projlabel">🏗️ PJT 관리</span>' + (right || '') + '</div>';
const keysOf = (st) => st.projects.map((p) => p.key);

/** 신규 프로젝트 폼(설정 탭과 같은 기본정보 10칸) */
function newForm(st) {
  const f = st.form; const inp = (k, label) => '<div class="jh-ro__fld"' + (k === 'content' ? ' data-wide="1"' : '') + '><label>' + esc(label) + (k === 'name' ? ' <b>*</b>' : '') + '</label><input class="jh-input" data-ov-f="' + k + '" autocomplete="off"' + (k === 'startDate' ? ' type="date"' : k === 'qty' ? ' inputmode="numeric"' : '') + ' value="' + esc(f[k] || '') + '"></div>';
  return '<section class="jh-card"><div class="jh-panel__head"><h3>신규 프로젝트</h3></div><div class="jh-ro__form jh-ro__form--3">' + FIELDS.map(([k, l]) => inp(k, l)).join('') + '</div><div class="jh-field__hint jh-ro__pad">만든 뒤에는 프로젝트 ⚙️ 설정에서 참여 부서·개인을 정하고, 공정 탭에서 섹터·품목·단계를 정합니다. 모든 프로젝트가 같은 화면·같은 규칙입니다.</div><div class="jh-ro__fbar">' + (st.msg ? '<span class="jh-ro__msg" data-bad="1" role="alert">' + esc(st.msg) + '</span>' : '<span></span>') + '<span><button type="button" class="jh-btn" data-variant="secondary" data-ov-cancel>취소</button> <button type="button" class="jh-btn" data-variant="primary" data-ov-create' + (st.busy ? ' disabled' : '') + '>' + (st.busy ? '만드는 중...' : '만들기') + '</button></span></div></section>';
}
const legendHtml = (list, st) => '<div class="jh-ov__legend">' + (list.length ? list.map((p) => '<span><i style="background:' + colorOf(keysOf(st), p.key) + '"></i>' + esc(p.label) + '</span>').join('') : '<span class="jh-field__hint">이 기간에 일정이 없습니다.</span>') + '</div>';
const itemHtml = (st, s) => '<button type="button" class="jh-ov__it" style="--pc:' + colorOf(keysOf(st), s.pjtKey) + '" data-ov-sched="' + esc(s.pjtKey) + '" title="이 프로젝트의 일정 탭에서 보기·수정">' + (s.stime && s.stime !== '미정' ? '<b>' + esc(s.stime) + '</b> ' : '') + esc(s.text || '') + '<small>' + esc(s.pjtName || '') + '</small></button>';
/** 월 달력(왼쪽): 월 이동·이번 달, 프로젝트 색 범례, 날짜 칸(일정이 있는 날은 프로젝트 색 점) */
function monthly(st) {
  const weeks = monthGrid(st.y, st.m); const flat = weeks.flat().filter(Boolean); const map = groupByDay(st.items, flat);
  const dow = '<div class="jh-ov__dow">' + DOW.map((d, i) => '<span data-off="' + (i === 0 ? 'red' : i === 6 ? 'sat' : '') + '">' + d + '</span>').join('') + '</div>';
  const cells = weeks.flat().map((k) => { if (!k) return '<div class="jh-ov__mc" data-empty="1"></div>'; const its = map[k]; const dots = [...new Set(its.map((s) => s.pjtKey))].map((pk) => '<i style="background:' + colorOf(keysOf(st), pk) + '"></i>').join(''); const hn = holidayName(k); return '<button type="button" class="jh-ov__mc" data-ov-day="' + k + '"' + (k === st.sel ? ' aria-current="true"' : '') + (k === st.today ? ' data-today="1"' : '') + '><b data-off="' + offKind(k) + '">' + (+k.slice(8)) + '</b>' + (hn ? '<em>' + esc(hn) + '</em>' : '') + '<span class="jh-ov__dots">' + dots + '</span>' + (its.length ? '<small>' + its.length + '건</small>' : '') + '</button>'; }).join('');
  return '<div class="jh-ov__tool"><button type="button" class="jh-btn" data-variant="secondary" data-ov-shift="-1" aria-label="이전 달">‹</button><strong>' + monthLabel(st.y, st.m) + '</strong><button type="button" class="jh-btn" data-variant="secondary" data-ov-shift="1" aria-label="다음 달">›</button><span class="jh-ov__sp"></span><button type="button" class="jh-btn" data-variant="secondary" data-ov-today>이번 달</button></div>' + legendHtml(legendOf(map, st.projects), st) + dow + '<div class="jh-ov__month">' + cells + '</div>';
}
/** 왼쪽 달력 영역 안쪽 — 월 이동·날짜 선택 때 이 부분과 오른쪽 일정 목록만 다시 그린다 */
export function schedInner(st) {
  return '<div class="jh-panel__head"><h3>프로젝트 통합 일정</h3><span class="jh-field__hint">날짜를 누르면 오른쪽에 그날 일정이 나옵니다</span></div><div class="jh-ov__sched">' + monthly(st) + '</div>';
}
/** 오른쪽: 달력에서 고른 날짜의 일정 목록(프로젝트 색·이름 표시, 항목을 누르면 그 프로젝트의 일정 탭) */
export function detailInner(st) {
  if (!st.sel) return '<div class="jh-panel__head"><h3>선택한 날 일정</h3></div><div class="jh-field__hint jh-ro__pad">날짜를 누르면 그날의 일정이 나옵니다.</div>';
  const sel = groupByDay(st.items, [st.sel])[st.sel] || [];
  return '<div class="jh-panel__head"><h3>' + dayHead(st.sel) + ' (' + DOW[dowOf(st.sel)] + ')' + (holidayName(st.sel) ? ' · ' + esc(holidayName(st.sel)) : '') + ' 일정</h3></div><div class="jh-ov__detail">' + (sel.length ? sel.map((s) => itemHtml(st, s)).join('') : '<div class="jh-field__hint">이 날 일정이 없습니다.</div>') + '</div>';
}
/** PJT 전체 홈: 왼쪽에 통합 일정 월 달력, 가운데에 고른 날짜의 일정 목록, 오른쪽에 이력관리(내가 볼 수 있는 모든 프로젝트의 이력 요약 — 자리표시자를 이력 패널 부품이 채운다). 남은 폭이 좁으면 이력은 아래 한 줄, 더 좁으면 위아래 — 프로젝트 이동은 사이드 메뉴 */
export function overviewHtml(st) {
  if (!st.ready) return '<div class="jh-pjt jh-pjt--prog"><div class="jh-pjt__main jh-pjt__mainwide">' + head() + (st.err ? '<div class="jh-alert" data-tone="danger" role="alert">' + esc(st.err) + '</div>' : '<div class="jh-empty">불러오는 중...</div>') + '</div></div>';
  return '<div class="jh-pjt jh-pjt--prog"><div class="jh-pjt__main jh-pjt__mainwide">' + head(st.admin ? '<button type="button" class="jh-btn" data-variant="primary" data-ov-new style="margin-left:auto"' + (st.form ? ' disabled' : '') + '>＋ 신규 프로젝트</button>' : '') + (st.form ? newForm(st) : '')
    + '<div class="jh-ov__wrap"><div class="jh-ov__layout"><section class="jh-card jh-ov__main" id="ov-sched">' + schedInner(st) + '</section><aside class="jh-card jh-ov__detailcard" id="ov-detail" aria-label="선택한 날 일정">' + detailInner(st) + '</aside><div class="jh-ov__log" data-ov-log></div></div></div></div></div>';
}
/** 종료 PJT 목록 */
export function endedHtml(st) {
  if (!st.ready) return '<div class="jh-pjt jh-pjt--prog"><div class="jh-pjt__main jh-pjt__mainwide"><div class="jh-pjt__proj"><span class="jh-pjt__projlabel">🗄️ 종료 PJT</span></div>' + (st.err ? '<div class="jh-alert" data-tone="danger" role="alert">' + esc(st.err) + '</div>' : '<div class="jh-empty">불러오는 중...</div>') + '</div></div>';
  const row = (d) => { const info = [d.client, d.site].filter(Boolean); const ended = d.endedAt && d.endedAt.seconds > 946684800 ? new Date(d.endedAt.seconds * 1000) : null;   /* 2000년 이전 값은 날짜로 보지 않는다 */ const et = ended ? ended.getFullYear() + '-' + String(ended.getMonth() + 1).padStart(2, '0') + '-' + String(ended.getDate()).padStart(2, '0') : '';
    return '<tr data-ended="1"><td><strong>' + esc(d.name || '(이름 없음)') + '</strong></td><td>' + (info.length ? info.map((x) => '<span class="jh-pjt__chip" data-tone="gray">' + esc(x) + '</span>').join(' ') : '<span class="jh-field__hint">—</span>') + '</td><td>' + (et ? esc(et) : '<span class="jh-field__hint">—</span>') + '</td><td class="jh-ov__lcontent">' + (d.content ? esc(d.content) : '<span class="jh-field__hint">—</span>') + '</td>'
      + (st.admin ? '<td class="jh-ov__lact"><button type="button" class="jh-btn" data-variant="secondary" data-ov-resume="' + esc(d.id) + '"' + (st.busy ? ' disabled' : '') + '>재개</button> <button type="button" class="jh-btn" data-variant="danger" data-ov-del="' + esc(d.id) + '"' + (st.busy ? ' disabled' : '') + '>🗑 완전삭제</button></td>' : '') + '</tr>'; };
  return '<div class="jh-pjt jh-pjt--prog"><div class="jh-pjt__main jh-pjt__mainwide"><div class="jh-pjt__proj"><span class="jh-pjt__projlabel">🗄️ 종료 PJT</span><span class="jh-field__hint">' + (st.admin ? '재개하면 진행 중 프로젝트로 돌아갑니다. 완전삭제는 되돌릴 수 없습니다.' : '종료된 프로젝트 목록(재개·삭제는 관리자)') + '</span></div>' + (st.list.length ? '<div class="jh-ov__listbox"><table class="jh-ro__t jh-ov__list"><thead><tr><th>프로젝트</th><th>거래처·현장</th><th>종료일</th><th>내용</th>' + (st.admin ? '<th></th>' : '') + '</tr></thead><tbody>' + st.list.map(row).join('') + '</tbody></table></div>' : '<div class="jh-empty">종료된 프로젝트가 없습니다.</div>') + '</div></div>';
}
