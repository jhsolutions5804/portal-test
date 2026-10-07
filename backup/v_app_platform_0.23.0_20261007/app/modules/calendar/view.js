import { esc } from '../../core/ui.js?v=20261007j';
import { WEEKDAYS, ymd, dateKey, monthGrid, shiftMonth, fmtRange, expiryNote, expiryState, OWN_TAGS, TAG_LABEL, canWrite, canEditOwn, isHHMM, pad, VIEWS, dayLabel } from './logic.js?v=20261007j';
import { holidayName as holName } from '../../shared/holidays.js?v=20261007j';

export const SRC_LABEL = { pjt: 'PJT', leave: '연차·휴무', company: '회사', expiry: '만료', hr: '인사' };
const srcLabel = (s) => SRC_LABEL[s] || s;

/** 위쪽 막대: 이전/다음 · 제목 · 오늘 · 보기 방식 전환 · (목록 보기에서) 일정 등록 · 표시할 일정(켜기/끄기). 제목은 data-cal-title 로 제자리 갱신한다 */
export function barHtml(S, providers, me) {
  const on = providers.filter((p) => S.off.indexOf(p.id) === -1).length;
  const tg = providers.map((p) => '<button type="button" class="jh-cal__toggle" data-prov="' + esc(p.id) + '" aria-pressed="' + (S.off.indexOf(p.id) === -1) + '"><span class="jh-cal__dot" data-src="' + esc(p.id) + '" aria-hidden="true"></span>' + esc(p.label) + '</button>').join('');
  const views = '<div class="jh-segmented jh-cal__views" role="group" aria-label="보기 방식">' + VIEWS.map(([k, label]) => '<button type="button" class="jh-segmented__item" data-view="' + k + '" aria-pressed="' + (S.view === k) + '">' + label + '</button>').join('') + '</div>';
  return '<div class="jh-cal__bar"><div class="jh-cal__nav"><button type="button" class="jh-iconbtn" data-cal-nav="-1" aria-label="이전">‹</button><strong class="jh-cal__title" data-cal-title>' + esc(S.title || '') + '</strong><button type="button" class="jh-iconbtn" data-cal-nav="1" aria-label="다음">›</button>' +
    '<button type="button" class="jh-btn" data-variant="secondary" data-cal-today>오늘</button></div>' + views +
    (canWrite(me) ? '<button type="button" class="jh-btn" data-variant="secondary" data-new data-bar-new aria-label="일정 등록">＋<span class="jh-cal__newtxt"> 등록</span></button>' : '') +
    '<details class="jh-cal__filter" data-cal-filter><summary class="jh-cal__filter-sum" title="표시할 일정">표시 <span data-cal-filter-n>' + on + '/' + providers.length + '</span></summary><div class="jh-cal__legend" role="group" aria-label="표시할 일정">' + tg + '</div></details></div>';
}
/** 달력 본체(막대 · 알림 · 본문 + (월 보기에서) 선택한 날 목록). 전체 화면과 홈 위젯이 똑같이 쓴다 */
function bodyHtml(S, providers, me) {
  return '<div class="jh-cal" data-view="' + S.view + '"' + (S.widget ? ' data-in-widget="true"' : '') + '>' + barHtml(S, providers, me) + '<div data-cal-notice></div><div class="jh-cal__split"><div class="jh-cal__gridwrap" data-cal-grid aria-busy="true"></div>' +
    '<section class="jh-card jh-form jh-cal__dayarea" aria-live="polite" data-cal-day></section></div></div>';
}
export function fullFrameHtml(S, providers, me) { return bodyHtml(S, providers, me); }
/** 홈 위젯: 전체 화면과 같은 달력·같은 보기 방식. 카드 머리만 더한다 */
export function widgetFrameHtml(S, providers, me) {
  return '<section class="jh-panel jh-card" aria-label="일정"><div class="jh-panel__head"><h3>📅 일정</h3></div><div class="jh-form">' + bodyHtml(S, providers, me) + '</div></section>';
}
/** 목록 보기(안건·하루·3일): 날짜 머리글 아래 그날의 일정. 이름·시간이 눌러 보지 않아도 보인다.
 *  limit = 보여 줄 일정 줄 수(홈 위젯은 처음 5줄만 — 목록이 길어도 위젯이 커지지 않게). 날짜는 쪼개지 않고, 남은 줄 수는 "N건 더 보기"로 알린다 */
export function agendaHtml(S, byDay, me, dates, canMore, limit) {
  const max = limit == null ? Infinity : limit; let shown = 0; let hidden = 0; let secs = '';
  dates.forEach((k) => {
    const list = byDay[k] || [];
    if (shown >= max && list.length) { hidden += list.length; return; }
    if (shown >= max && !list.length && S.view === 'agenda') return;   // 한도를 넘은 뒤의 빈 날(오늘)은 생략
    const hol = holName(k); shown += list.length;
    secs += '<section class="jh-cal__daysec"' + (k === S.today ? ' data-today="true"' : '') + '><h3 class="jh-cal__dayh">' + esc(dayLabel(k, S.today)) + (hol ? ' <small>' + esc(hol) + '</small>' : '') + '</h3>' +
      (list.length ? '<ul class="jh-cal__list">' + list.map((e) => rowHtml(e, S, me)).join('') + '</ul>' : '<p class="jh-cal__none">일정 없음</p>') + '</section>';
  });
  const more = hidden > 0 ? '<button type="button" class="jh-btn" data-variant="secondary" data-more data-hidden="' + hidden + '">일정 ' + hidden + '건 더 보기</button>'
    : (canMore ? '<button type="button" class="jh-btn" data-variant="secondary" data-more data-hidden="0">이후 일정 더 보기</button>' : '');
  return '<div class="jh-cal__agenda">' + (secs || '<div class="jh-empty">이 기간에 일정이 없습니다.</div>') + more + '</div>';
}
/** 월 달력(일정 이름이 칸 안에 보임). S.weeks 가 있으면 그 주 수로 고정(홈 위젯은 6주 — 달이 바뀌어도 높이가 같다) */
export function gridHtml(S, byDay) {
  const head = WEEKDAYS.map((w, i) => '<div class="jh-cal__wd" data-dow="' + i + '">' + w + '</div>').join('');
  const cells = monthGrid(S.y, S.m, S.weeks || 0).map((wk) => wk.map((c) => {
    const items = byDay[c.key] || []; const hol = holName(c.key); const isHol = !!hol;
    let inner = '<span class="jh-cal__num">' + c.day + '</span>';
    if (hol) inner += '<span class="jh-cal__hol">' + esc(hol) + '</span>';
    inner += items.slice(0, 2).map((e) => '<span class="jh-cal__ev" data-src="' + esc(e.source) + '" data-done="' + (e.done ? 'true' : 'false') + '">' + esc((e.startTime ? e.startTime + ' ' : '') + e.title) + '</span>').join('');
    if (items.length > 2) inner += '<span class="jh-cal__more">+' + (items.length - 2) + '건</span>';
    const label = c.key.replace(/-/g, '.') + (hol ? ' ' + hol : '') + ' · 일정 ' + items.length + '건';
    return '<button type="button" class="jh-cal__day" data-day="' + c.key + '" data-dow="' + c.dow + '"' + (c.inMonth ? '' : ' data-out="true"') + (isHol ? ' data-hol="true"' : '') + (c.key === S.today ? ' data-today="true"' : '') + (c.key === S.sel ? ' aria-current="date"' : '') + ' aria-label="' + esc(label) + '">' + inner + '</button>';
  }).join('')).join('');
  return '<div class="jh-cal__grid" role="group" aria-label="' + S.y + '년 ' + S.m + '월 달력">' + head + cells + '</div>';
}
function rowHtml(e, S, me) {
  const own = canEditOwn(e, me); const exp = e.source === 'expiry' ? expiryState(e.start, S.today) : null;
  const meta = [e.project, e.place, e.extra && e.source === 'pjt' ? '참석 ' + e.extra : ''].filter(Boolean).map(esc).join(' · ');
  const todo = e.isTodo && own ? '<label class="jh-cal__todo"><input type="checkbox" data-done="' + esc(e.ref) + '"' + (e.done ? ' checked' : '') + '> 완료</label>' : (e.isTodo ? '<span class="jh-chip">할 일' + (e.done ? ' · 완료' : '') + '</span>' : '');
  const acts = own ? '<span class="jh-cal__acts"><button type="button" class="jh-btn" data-variant="ghost" data-edit="' + esc(e.ref) + '">수정</button><button type="button" class="jh-btn" data-variant="ghost" data-del="' + esc(e.ref) + '">삭제</button></span>' : '';
  const go = e.link ? '<a class="jh-link" href="' + esc(e.link) + '">원본으로 이동 ›</a>' : '';
  return '<li class="jh-cal__row" data-src="' + esc(e.source) + '"' + (exp ? ' data-exp="' + exp.state + '"' : '') + '><span class="jh-cal__time">' + esc(fmtRange(e)) + '</span><div class="jh-cal__what"><div class="jh-cal__name' + (e.done ? ' is-done' : '') + '">' + esc(e.title) + '</div>' +
    '<div class="jh-cal__meta"><span class="jh-chip" data-src="' + esc(e.source) + '">' + esc(srcLabel(e.source)) + '</span> ' + (e.tagLabel !== srcLabel(e.source) ? '<span class="jh-chip">' + esc(e.tagLabel) + '</span>' : '') + (exp ? ' <span class="jh-chip" data-tone="' + (exp.state === 'ok' ? 'info' : 'warn') + '">' + esc(expiryNote(e.start, S.today)) + '</span>' : '') + (meta ? ' ' + meta : '') + '</div>' + todo + go + '</div>' + acts + '</li>';
}
/** 선택한 날의 일정 */
export function dayHtml(S, byDay, me) {
  const key = S.sel; if (!key) return ''; const list = byDay[key] || []; const d = new Date(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)); const hol = holName(key);
  const head = '<div class="jh-cal__dayhead"><h3 class="jh-detail__h">' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + WEEKDAYS[d.getDay()] + ')' + (hol ? ' <small>' + esc(hol) + '</small>' : '') + ' <small>' + list.length + '건</small></h3>' +
    (canWrite(me) ? '<button type="button" class="jh-btn" data-variant="primary" data-new>＋ 이 날짜에 등록</button>' : '') + '</div>';
    const body = list.length ? '<ul class="jh-cal__list">' + list.map((e) => rowHtml(e, S, me)).join('') + '</ul>' : '<div class="jh-empty">이 날짜에 등록된 일정이 없습니다.</div>';
  return head + body;
}
export function noticeHtml(S, me) {
  const parts = [];
  if (S.failed.length) parts.push('<div class="jh-alert" data-tone="warn" role="status">일부 일정(' + S.failed.map((id) => esc(srcLabel(id))).join(', ') + ')을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>');
  if (me && me.isGuest) parts.push('<p class="jh-field__hint">GUEST 계정은 일정을 조회만 할 수 있습니다.</p>');
  return parts.join('');
}
const hmOpts = (max, step, sel) => { let o = '<option value="">--</option>'; for (let i = 0; i < max; i += step) o += '<option value="' + pad(i) + '"' + (sel === pad(i) ? ' selected' : '') + '>' + pad(i) + '</option>'; return o; };
const timeHtml = (id, v, label) => { const h = isHHMM(v) ? v.slice(0, 2) : ''; const m = isHHMM(v) ? v.slice(3) : ''; return '<div class="jh-field"><span class="jh-field__label">' + label + '</span><div class="jh-cal__time-pick"><select class="jh-select" id="' + id + '-h" aria-label="' + label + ' 시">' + hmOpts(24, 1, h) + '</select><span>:</span><select class="jh-select" id="' + id + '-m" aria-label="' + label + ' 분">' + hmOpts(60, 10, m) + '</select></div></div>'; };
/** 등록·수정 창 */
export function formHtml(draft, errors, editing) {
  const e = errors || {}; const err = (k) => (e[k] ? '<span class="jh-field__error" role="alert">' + esc(e[k]) + '</span>' : ''); const inv = (k) => (e[k] ? ' data-invalid="true"' : '');
  const tags = OWN_TAGS.map((t) => '<option value="' + t + '"' + (draft.tag === t ? ' selected' : '') + '>' + esc(TAG_LABEL[t]) + '</option>').join('');
  return '<div class="jh-dialog__backdrop" data-cancel></div><div class="jh-dialog__panel jh-cal__form"><h3 class="jh-dialog__title" id="jh-cal-form-title">' + (editing ? '일정 수정' : '일정 등록') + '</h3><div class="jh-dialog__body">' +
    '<label class="jh-field"' + inv('title') + '><span class="jh-field__label">제목</span><input class="jh-input" id="cf-title" maxlength="100" value="' + esc(draft.title) + '">' + err('title') + '</label>' +
    '<label class="jh-field"' + inv('tag') + '><span class="jh-field__label">분류</span><select class="jh-select" id="cf-tag">' + tags + '</select>' + err('tag') + '</label>' +
    '<div class="jh-cal__two"><label class="jh-field"' + inv('start') + '><span class="jh-field__label">시작일</span><input class="jh-input" type="date" id="cf-start" value="' + esc(draft.start) + '">' + err('start') + '</label>' +
    '<label class="jh-field"' + inv('end') + '><span class="jh-field__label">종료일 (하루면 비움)</span><input class="jh-input" type="date" id="cf-end" value="' + esc(draft.end) + '">' + err('end') + '</label></div>' +
    '<label class="jh-cal__check"><input type="checkbox" id="cf-todo"' + (draft.isTodo ? ' checked' : '') + '> 할 일 (시각 없이 체크리스트로)</label>' +
    '<div class="jh-cal__two" id="cf-times"' + (draft.isTodo ? ' hidden' : '') + '>' + timeHtml('cf-s', draft.startTime, '시작 시각') + timeHtml('cf-e', draft.endTime, '종료 시각') + '</div>' + (e.time ? '<div class="jh-alert" data-tone="danger" role="alert">' + esc(e.time) + '</div>' : '') +
    '<label class="jh-field"' + inv('place') + '><span class="jh-field__label">장소</span><input class="jh-input" id="cf-place" maxlength="120" value="' + esc(draft.place) + '">' + err('place') + '</label>' +
    '<label class="jh-field"' + inv('memo') + '><span class="jh-field__label">메모</span><textarea class="jh-textarea" id="cf-memo" maxlength="600">' + esc(draft.memo) + '</textarea>' + err('memo') + '</label>' +
    (e._save ? '<div class="jh-alert" data-tone="danger" role="alert">' + esc(e._save) + '</div>' : '') +
    '</div><div class="jh-dialog__actions"><button type="button" class="jh-btn" data-variant="ghost" data-cancel>취소</button><button type="button" class="jh-btn" data-variant="primary" data-save>' + (editing ? '저장' : '등록') + '</button></div></div>';
}
export function readForm(root) {
  const v = (id) => (root.querySelector('#' + id) ? root.querySelector('#' + id).value : ''); const t = (p) => (v(p + '-h') && v(p + '-m') ? v(p + '-h') + ':' + v(p + '-m') : (v(p + '-h') || v(p + '-m') ? 'x' : ''));
  return { title: v('cf-title'), tag: v('cf-tag'), start: v('cf-start'), end: v('cf-end'), isTodo: !!(root.querySelector('#cf-todo') || {}).checked, startTime: t('cf-s'), endTime: t('cf-e'), place: v('cf-place'), memo: v('cf-memo') };
}
export const blankDraft = (key) => ({ title: '', tag: 'meeting', start: key || dateKey(new Date()), end: '', isTodo: false, startTime: '', endTime: '', place: '', memo: '' });
export function draftOf(e) { return { title: e.title, tag: OWN_TAGS.indexOf(e.tag) !== -1 ? e.tag : 'etc', start: e.start, end: e.end === e.start ? '' : e.end, isTodo: e.isTodo, startTime: e.startTime, endTime: e.endTime, place: e.place, memo: e.memo }; }
