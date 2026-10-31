/* 영업기획·재무회계 일정 보드 — 순수 화면 부분(파이어베이스·네트워크 없이 시험 가능). 저장·이벤트는 schedule-board.js.
 * 월 이동 · 목록/달력 보기 · 구분 필터 · 추가·수정·삭제·완료 체크 · 반복(매월·매년, 미리 펼쳐 저장) · 자동 일정(정산서) 읽기 전용 표시 · 쪽 나누기(10줄 단위). */
import { esc } from '../core/ui.js?v=20261031i';
import { pageInfo, pagerSync, pagerHtml } from './pager.js?v=20261031i';
import { RECUR_KINDS, RECUR_MAX, monthRange, monthItems, groupByDate, summarize, isAuto, canEditDoc } from './schedule-logic.js?v=20261031i';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export const kstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
export const dayLabel = (s) => { const d = new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)); return s.slice(5, 7) + '/' + s.slice(8, 10) + '(' + DOW[d.getDay()] + ')'; };
export const chip = (t, tone) => '<span class="jh-chip"' + (tone ? ' data-tone="' + tone + '"' : '') + '>' + esc(t) + '</span>';
const opt = (v, cur, label) => '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label == null ? v : label) + '</option>';
export const newState = (cfg, me, today) => ({ cfg, me: me || {}, today: today || kstToday(), ym: (today || kstToday()).slice(0, 7), view: 'list', tag: '', hideDone: false, rows: [], loaded: false, err: '', form: null, busy: false, pg: {} });
export const emptyForm = (cfg, date) => ({ id: '', text: '', sdate: date, edate: '', stime: '', etime: '', tag: cfg.defaultTag, place: '', memo: '', isTodo: false, recur: 'none' });
/** 보이는 일정: 그 달 + 구분 거름 + (완료 숨기기) */
export function visibleItems(st) {
  return monthItems(st.rows, st.ym).filter((x) => (!st.tag || x.d.tag === st.tag) && !(st.hideDone && x.d.done));
}
/** 일정 한 줄 */
export function rowHtml(x, st) {
  const d = x.d; const auto = isAuto(d); const edit = canEditDoc(d); const multi = d.edate && d.edate !== d.sdate;
  const when = d.isTodo ? '마감' : (d.stime ? d.stime + (d.etime ? '~' + d.etime : '') : '종일');
  const range = multi ? ' · ' + d.sdate.slice(5).replace('-', '/') + '~' + d.edate.slice(5).replace('-', '/') : '';
  const check = d.isTodo && edit ? '<label class="jh-sch__chk"><input type="checkbox" data-sch-done="' + esc(x.id) + '"' + (d.done ? ' checked' : '') + ' aria-label="완료"></label>' : '<span class="jh-sch__chk"></span>';
  const ser = d.recurId ? '<button type="button" class="jh-btn" data-variant="ghost" data-sch-delfuture="' + esc(x.id) + '">이후 모두 삭제</button>' : '';
  const acts = edit ? '<span class="jh-sch__acts"><button type="button" class="jh-btn" data-variant="ghost" data-sch-edit="' + esc(x.id) + '">수정</button><button type="button" class="jh-btn" data-variant="ghost" data-sch-del="' + esc(x.id) + '">삭제</button>' + ser + '</span>' : '<span class="jh-sch__acts jh-field__hint">정산서에서 자동 반영</span>';
  return '<li class="jh-sch__row' + (d.done ? ' is-done' : '') + '">' + check + '<span class="jh-sch__main"><span class="jh-sch__title">' + esc(d.text) + '</span><span class="jh-field__hint">' + esc(when + range + (d.place ? ' · ' + d.place : '') + (d.memo ? ' · ' + d.memo : '')) + '</span></span>' + chip(d.tagLabel || '일정', auto ? 'accent' : '') + (d.isTodo ? chip(d.done ? '완료' : '할 일', d.done ? 'muted' : 'warn') : '') + (d.recurId ? chip('반복 ' + (d.recurNo || '') + '/' + (d.recurTotal || ''), 'muted') : '') + acts + '</li>';
}
/** 목록 보기 — 날짜별 묶음, 10줄 단위 쪽 나누기 */
export function listHtml(st) {
  const items = visibleItems(st); if (!items.length) return '<div class="jh-empty">' + (st.rows.length && monthItems(st.rows, st.ym).length ? '조건에 맞는 일정이 없습니다.' : '이 달에는 일정이 없습니다.') + '</div>';
  const info = pageInfo(items.length, pagerSync(st.pg, 'sched-' + st.cfg.key, [st.ym, st.tag, st.hideDone ? 1 : 0].join('|'))); const slice = items.slice(info.from, info.to);
  return groupByDate(slice).map((g) => '<div class="jh-sch__day' + (g.date === st.today ? ' is-today' : '') + '"><h4 class="jh-sch__daylabel">' + esc(dayLabel(g.date)) + (g.date === st.today ? ' ' + chip('오늘', 'accent') : '') + '</h4><ul class="jh-sch__list">' + g.items.map((x) => rowHtml(x, st)).join('') + '</ul></div>').join('') + pagerHtml(info, 'sched-' + st.cfg.key);
}
/** 달력 보기 — 일요일 시작, 칸마다 제목 3개까지 */
export function gridHtml(st) {
  const r = monthRange(st.ym); if (!r) return ''; const first = new Date(+r.from.slice(0, 4), +r.from.slice(5, 7) - 1, 1); const lead = first.getDay(); const last = +r.to.slice(8, 10);
  const items = visibleItems(st); const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null); for (let d = 1; d <= last; d++) cells.push(st.ym + '-' + String(d).padStart(2, '0')); while (cells.length % 7) cells.push(null);
  const head = DOW.map((w, i) => '<div class="jh-sch__dow' + (i === 0 ? ' is-sun' : '') + '">' + w + '</div>').join('');
  const body = cells.map((c) => { if (!c) return '<div class="jh-sch__cell is-blank"></div>'; const on = items.filter((x) => x.d.sdate <= c && (x.d.edate || x.d.sdate) >= c); const show = on.slice(0, 3);
    return '<button type="button" class="jh-sch__cell' + (c === st.today ? ' is-today' : '') + '" data-sch-day="' + c + '"><span class="jh-sch__num">' + +c.slice(8) + '</span>' + show.map((x) => '<span class="jh-sch__tag' + (x.d.done ? ' is-done' : '') + (isAuto(x.d) ? ' is-auto' : '') + '">' + esc(x.d.text) + '</span>').join('') + (on.length > 3 ? '<span class="jh-field__hint">+' + (on.length - 3) + '건</span>' : '') + '</button>'; }).join('');
  return '<div class="jh-sch__grid" role="grid">' + head + body + '</div><div class="jh-field__hint jh-sch__hint">날짜 칸을 누르면 그 날짜로 일정을 추가합니다. 정산서에서 온 자동 일정은 점선으로 표시됩니다.</div>';
}
/** 입력 양식(추가·수정) */
export function formHtml(st) {
  const f = st.form; if (!f) return ''; const cfg = st.cfg; const todo = f.isTodo === true || f.isTodo === 'true'; const isNew = !f.id;
  return '<div class="jh-card jh-sch__form"><div class="jh-gen__pad"><h4 class="jh-gen__sub">' + (isNew ? '일정 추가' : '일정 수정') + '</h4><div class="jh-gen__grid">'
    + '<div class="jh-field jh-gen__wide"><label class="jh-field__label">제목 *</label><input class="jh-input" data-sf="text" maxlength="100" value="' + esc(f.text) + '" placeholder="예: 견적서 작성, 카드 결제"></div>'
    + '<div class="jh-field"><label class="jh-field__label">구분</label><select class="jh-select" data-sf="tag">' + cfg.tags.map((t) => opt(t[0], f.tag, t[1])).join('') + '</select></div>'
    + '<div class="jh-field"><label class="jh-field__label">' + (todo ? '마감일 *' : '시작일 *') + '</label><input class="jh-input" type="date" data-sf="sdate" value="' + esc(f.sdate) + '"></div>'
    + (todo ? '' : '<div class="jh-field"><label class="jh-field__label">종료일(여러 날일 때)</label><input class="jh-input" type="date" data-sf="edate" value="' + esc(f.edate) + '"></div><div class="jh-field"><label class="jh-field__label">시작 시간(선택)</label><input class="jh-input" type="time" data-sf="stime" value="' + esc(f.stime) + '"></div><div class="jh-field"><label class="jh-field__label">종료 시간(선택)</label><input class="jh-input" type="time" data-sf="etime" value="' + esc(f.etime) + '"></div>')
    + '<div class="jh-field"><label class="jh-field__label">장소(선택)</label><input class="jh-input" data-sf="place" maxlength="120" value="' + esc(f.place) + '"></div>'
    + '<div class="jh-field jh-gen__wide"><label class="jh-field__label">메모(선택, 금액·계좌번호는 쓰지 마세요 — 제목과 함께 Outlook 공유 사서함으로도 갑니다)</label><input class="jh-input" data-sf="memo" maxlength="600" value="' + esc(f.memo) + '"></div>'
    + '<div class="jh-field"><label class="jh-sch__todo"><input type="checkbox" data-sf="isTodo"' + (todo ? ' checked' : '') + '> 할 일(마감일까지, 완료 체크)</label></div>'
    + (isNew ? '<div class="jh-field"><label class="jh-field__label">반복</label><select class="jh-select" data-sf="recur">' + RECUR_KINDS.map((k) => opt(k[0], f.recur, k[1])).join('') + '</select>' + (f.recur !== 'none' ? '<div class="jh-field__hint">' + (f.recur === 'monthly' ? RECUR_MAX.monthly + '개월' : RECUR_MAX.yearly + '년') + '분을 한 번에 만듭니다. 끝나기 전에 다시 만들어 주세요.</div>' : '') + '</div>' : '')
    + '</div><div class="jh-gen__bar"><button type="button" class="jh-btn" data-variant="primary" data-sch-save' + (st.busy ? ' disabled' : '') + '>' + (isNew ? '추가' : '저장') + '</button><button type="button" class="jh-btn" data-variant="ghost" data-sch-cancel>취소</button></div></div></div>';
}
/** 전체 화면 */
export function boardHtml(st) {
  const cfg = st.cfg; const sm = summarize(st.rows, st.today);
  const bar = '<div class="jh-sch__bar"><div class="jh-sch__month"><button type="button" class="jh-btn" data-variant="ghost" data-sch-month="-1" aria-label="이전 달">‹</button><strong>' + esc(st.ym) + '</strong><button type="button" class="jh-btn" data-variant="ghost" data-sch-month="1" aria-label="다음 달">›</button><button type="button" class="jh-btn" data-variant="ghost" data-sch-month="today">오늘</button></div>'
    + '<div class="jh-segmented" role="group" aria-label="보기"><button type="button" class="jh-segmented__item" data-sch-view="list" aria-pressed="' + (st.view === 'list') + '">목록</button><button type="button" class="jh-segmented__item" data-sch-view="grid" aria-pressed="' + (st.view === 'grid') + '">달력</button></div>'
    + '<select class="jh-select jh-sch__sel" data-sch-tag aria-label="구분">' + opt('', st.tag, '구분 전체') + cfg.tags.map((t) => opt(t[0], st.tag, t[1])).join('') + '</select>'
    + '<label class="jh-field__hint"><input type="checkbox" data-sch-hide' + (st.hideDone ? ' checked' : '') + '> 완료 숨기기</label>'
    + '<button type="button" class="jh-btn" data-variant="primary" data-sch-add>+ 일정 추가</button></div>';
  const chips = '<div class="jh-sch__sum">' + chip('오늘 ' + sm.today + '건', sm.today ? 'accent' : 'muted') + chip('7일 안 마감 ' + sm.soon + '건', sm.soon ? 'warn' : 'muted') + chip('지난 미완료 ' + sm.over + '건', sm.over ? 'danger' : 'muted') + '</div>';
  const body = st.err ? '<div class="jh-alert" data-tone="danger" role="alert">' + esc(st.err) + '</div>' : !st.loaded ? '<div class="jh-skeleton" style="height:var(--u-220)"></div>' : (st.view === 'grid' ? gridHtml(st) : listHtml(st));
  return '<div class="jh-sch"><div class="jh-card"><div class="jh-gen__pad"><h3 class="jh-gen__sub">' + esc(cfg.title) + '</h3>' + bar + chips + '</div></div>' + formHtml(st) + '<div class="jh-card"><div class="jh-gen__pad">' + body + '</div></div>'
    + '<div class="jh-field__hint jh-sch__note">저장한 일정은 몇 초 안에 ' + esc(cfg.mailbox) + '으로 자동 반영됩니다(포털 → Outlook 한 방향 — Outlook 에서 고치면 다음 포털 수정 때 덮어써집니다). 홈 캘린더에는 이 권한이 있는 분에게만 보입니다.</div></div>';
}
