import { esc } from '../../core/ui.js?v=20261013zo';
import { holidayName } from '../../shared/holidays.js?v=20261013zo';
import { CATS, TAG_LABEL, TAG_COLOR, itemsForKey, rangeText, dotsFor, monthGrid, weekDays, dowOf } from './schedule.js?v=20261013zo';
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const hrs = Array.from({ length: 25 }, (_, i) => String(i).padStart(2, '0')), mins = ['00', '10', '20', '30', '40', '50'];
const sel = (attr, val, opts, suffix) => '<select class="jh-select jh-pjt__tsel" ' + attr + '>' + opts.map((o) => '<option value="' + o + '"' + (o === val ? ' selected' : '') + '>' + o + (suffix || '') + '</option>').join('') + '</select>';
const dayLabel = (k) => { const [, m, d] = k.split('-').map(Number); const h = holidayName(k); return m + '월 ' + d + '일 (' + DOW[dowOf(k)] + ')' + (h ? ' · ' + h : ''); };
const offKind = (k) => (holidayName(k) || dowOf(k) === 0 ? 'red' : dowOf(k) === 6 ? 'sat' : '');
const tagChip = (t) => '<span class="jh-pjt__tag" style="background:' + (TAG_COLOR[t] || TAG_COLOR.admin) + '22;color:' + (TAG_COLOR[t] || TAG_COLOR.admin) + '">' + esc(TAG_LABEL[t] || '기타') + '</span>';
function itemRow(st, u) {
  const manage = st.manage; const done = !!u.done; const todo = u.isTodo;
  const check = todo ? '<input type="checkbox" class="jh-pjt__sdone" data-sc-done="' + esc(u.id) + '"' + (done ? ' checked' : '') + (manage ? '' : ' disabled') + ' aria-label="완료">' : '';
  return '<div class="jh-pjt__srow" data-done="' + done + '">' + check + tagChip(u.tag || 'admin') + '<div class="jh-pjt__sbody"><div class="jh-pjt__stitle">' + (u.time ? '<span class="jh-pjt__stime">' + esc(u.time) + '</span> ' : '') + esc(u.text || '(내용 없음)') + '</div>'
    + '<div class="jh-field__hint">' + esc(rangeText(u)) + (u.place ? ' · 📍 ' + esc(u.place) : '') + (u.att ? ' · 👥 ' + esc(u.att) : '') + (u.reg ? ' · ' + esc(u.reg) : '') + '</div></div>'
    + (manage ? '<span class="jh-pjt__sact"><button type="button" class="jh-btn" data-variant="ghost" data-sc-edit="' + esc(u.id) + '">수정</button><button type="button" class="jh-btn" data-variant="ghost" data-sc-del="' + esc(u.id) + '">삭제</button></span>' : '') + '</div>';
}
function dayBlock(st, k, title) {
  const items = itemsForKey(st.items, k); const rows = items.map((u) => itemRow(st, u)).join('') || '<div class="jh-empty">이 날 등록된 일정이 없습니다.</div>';
  return '<section class="jh-card"><div class="jh-panel__head"><h3 class="jh-pjt__dayh" data-off="' + offKind(k) + '">' + esc(title || dayLabel(k)) + '</h3>' + (st.manage ? '<button type="button" class="jh-btn" data-variant="secondary" data-sc-new="' + esc(k) + '">＋ 일정</button>' : '') + '</div><div class="jh-pjt__pad">' + rows + '</div></section>';
}
function monthHtml(st) {
  const { y, m } = st.month; const weeks = monthGrid(y, m);
  const head = DOW.map((d, i) => '<div class="jh-pjt__calh" data-off="' + (i === 0 ? 'red' : i === 6 ? 'sat' : '') + '">' + d + '</div>').join('');
  const cells = weeks.flat().map((k) => { if (!k) return '<div class="jh-pjt__calc" data-empty="1"></div>'; const hn = holidayName(k); const dots = dotsFor(st.items, k).map((t) => '<span class="jh-pjt__dot" style="background:' + (TAG_COLOR[t] || TAG_COLOR.admin) + '"></span>').join('');
    const off = offKind(k) || (itemsForKey(st.items, k).some((x) => x.tag === 'off') ? 'red' : ''); return '<button type="button" class="jh-pjt__calc" data-sc-day="' + k + '" data-sel="' + (k === st.date) + '" data-today="' + (k === st.today) + '" data-off="' + off + '"><span class="jh-pjt__calnum">' + Number(k.slice(8)) + '</span>' + (hn ? '<span class="jh-pjt__calhol">' + esc(hn) + '</span>' : '') + '<span class="jh-pjt__dots">' + dots + '</span></button>'; }).join('');
  return '<section class="jh-card"><div class="jh-pjt__pad"><div class="jh-pjt__calgrid">' + head + cells + '</div></div></section>';
}
function listHtml(st, n) { return weekDays(st.date, n).map((k) => dayBlock(st, k)).join(''); }
function formHtml(st) {
  const f = st.form; const cats = CATS.map(([t, l]) => '<button type="button" class="jh-pjt__cat" data-sc-cat="' + t + '" aria-pressed="' + (f.tag === t) + '">' + esc(l) + '</button>').join('');
  const time = f.isTodo ? '' : '<div class="jh-pjt__bar"><span class="jh-plan__line"><span class="jh-field__hint">시작</span>' + sel('data-sc-f="sh"', f.sh, hrs, '시') + sel('data-sc-f="sm"', f.sm, mins, '분') + '</span><span class="jh-plan__line"><span class="jh-field__hint">종료</span>' + sel('data-sc-f="eh"', f.eh, hrs, '시') + sel('data-sc-f="em"', f.em, mins, '분') + '</span></div>';
  return '<section class="jh-card"><div class="jh-panel__head"><h3>' + (f.id ? '일정 수정' : '일정 등록') + '</h3></div><div class="jh-pjt__pad">'
    + '<input class="jh-input" data-sc-f="text" value="' + esc(f.text) + '" placeholder="일정 내용 (예: FCU 반입, 안전팀장 회의)" aria-label="내용">'
    + '<div class="jh-pjt__cats">' + cats + '</div><div class="jh-field__hint" data-sc-hint></div>'
    + '<div class="jh-pjt__bar"><span class="jh-plan__line"><input class="jh-input" type="date" data-sc-f="sdate" value="' + esc(f.sdate) + '" aria-label="시작일"><span>~</span><input class="jh-input" type="date" data-sc-f="edate" value="' + esc(f.edate) + '" aria-label="종료일"></span><label class="jh-plan__check"><input type="checkbox" data-sc-todo' + (f.isTodo ? ' checked' : '') + '> <span>할 일(시간 없음)</span></label></div>' + time
    + '<div class="jh-pjt__bar"><input class="jh-input" data-sc-f="place" value="' + esc(f.place) + '" placeholder="장소" aria-label="장소"><input class="jh-input" data-sc-f="att" value="' + esc(f.att) + '" placeholder="참석자" aria-label="참석자"><input class="jh-input" data-sc-f="reg" value="' + esc(f.reg) + '" placeholder="등록자" aria-label="등록자"></div>'
    + '<div class="jh-pjt__bar"><span></span><span class="jh-plan__line"><button type="button" class="jh-btn" data-variant="ghost" data-sc-act="cancel">취소</button><button type="button" class="jh-btn" data-variant="primary" data-sc-act="save">' + (f.id ? '수정 저장' : '등록하기') + '</button></span></div></div></section>';
}
/** 일정 탭: 달력(월)·주간·2주 보기, 날짜별 일정 목록, 등록·수정·삭제·완료(할 일). 모든 프로젝트 같은 화면 */
export function scheduleHtml(st) {
  if (!st.proj) return '<div class="jh-pjt"><div class="jh-alert" data-tone="warn" role="status">이 프로젝트를 열 수 없습니다. 위 메뉴에서 프로젝트를 고른 뒤 "일정" 탭을 여세요.</div></div>';
  if (!st.ready) return '<div class="jh-pjt"><div class="jh-pjt__proj"><span class="jh-pjt__projlabel">🏗️ ' + esc(st.label) + '</span><span class="jh-field__hint">일정</span></div><div class="jh-empty">불러오는 중...</div></div>';
  const views = [['month', '달력'], ['week', '주간'], ['two', '2주']]; const title = st.view === 'month' ? st.month.y + '년 ' + (st.month.m + 1) + '월' : (() => { const d = weekDays(st.date, st.view === 'two' ? 14 : 7); const md = (k) => Number(k.slice(5, 7)) + '/' + Number(k.slice(8)); return md(d[0]) + ' ~ ' + md(d[d.length - 1]); })();
  const bar = '<div class="jh-pjt__bar"><span class="jh-pjt__tabs" role="tablist">' + views.map(([k, l]) => '<button type="button" role="tab" class="jh-pjt__tab" data-sc-view="' + k + '" aria-selected="' + (st.view === k) + '">' + l + '</button>').join('') + '</span><span class="jh-pjt__datenav"><button type="button" class="jh-btn" data-variant="ghost" data-sc-nav="-1" aria-label="이전">‹</button><strong>' + esc(title) + '</strong><button type="button" class="jh-btn" data-variant="ghost" data-sc-nav="1" aria-label="다음">›</button><button type="button" class="jh-btn" data-variant="secondary" data-sc-nav="today">오늘</button></span>' + (st.manage ? '<button type="button" class="jh-btn" data-variant="primary" data-sc-new="' + esc(st.date) + '">＋ 일정 등록</button>' : '') + '</div>';
  const head = '<div class="jh-pjt__proj"><span class="jh-pjt__projlabel">🏗️ ' + esc(st.label) + '</span><span class="jh-field__hint">일정</span></div>';
  const body = st.view === 'month' ? '<div class="jh-pjt__split jh-pjt__splitcal"><div>' + monthHtml(st) + '</div><div>' + dayBlock(st, st.date) + '</div></div>' : listHtml(st, st.view === 'two' ? 14 : 7);
  return '<div class="jh-pjt jh-pjt--prog"><div class="jh-pjt__main jh-pjt__mainwide">' + head + bar + (st.readonly ? '<div class="jh-field__hint">조회만 할 수 있습니다(등록·수정은 관리자·PJT 담당 계정).</div>' : '') + (st.form ? formHtml(st) : '') + body + '</div></div>';
}
