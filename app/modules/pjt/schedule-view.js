import { esc } from '../../core/ui.js?v=20261030a';
import { holidayName } from '../../shared/holidays.js?v=20261030a';
import { CATS, TAG_LABEL, TAG_COLOR, itemsForKey, rangeText, dotsFor, monthGrid, twoWeeks, dowOf } from './schedule.js?v=20261030a';
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
/** 2주 달력: 주 단위 두 줄, 칸마다 그날 일정 제목을 보여 준다(달력 형태 — 날짜별 카드 목록 아님) */
function twoHtml(st) {
  const days = twoWeeks(st.date);
  const head = DOW.map((d, i) => '<div class="jh-pjt__calh" data-off="' + (i === 0 ? 'red' : i === 6 ? 'sat' : '') + '">' + d + '</div>').join('');
  const cells = days.map((k, i) => { const its = itemsForKey(st.items, k); const hn = holidayName(k); const off = offKind(k) || (its.some((x) => x.tag === 'off') ? 'red' : ''); const md = Number(k.slice(5, 7)) + '/' + Number(k.slice(8));
    const shown = its.slice(0, 3).map((u) => '<span class="jh-pjt__calit" style="--tc:' + (TAG_COLOR[u.tag] || TAG_COLOR.admin) + '" title="' + esc((u.time ? u.time + ' ' : '') + (u.text || '')) + '">' + (u.time && u.time !== '00~24' ? '<b>' + esc(String(u.time).slice(0, 5)) + '</b> ' : '') + esc(u.text || '(내용 없음)') + '</span>').join('') + (its.length > 3 ? '<span class="jh-field__hint">+' + (its.length - 3) + '건</span>' : '');
    return '<button type="button" class="jh-pjt__calc jh-pjt__calc--two" data-sc-day="' + k + '" data-sel="' + (k === st.date) + '" data-today="' + (k === st.today) + '" data-off="' + off + '"><span class="jh-pjt__calnum">' + (i === 0 || k.slice(8) === '01' ? md : Number(k.slice(8))) + '</span>' + (hn ? '<span class="jh-pjt__calhol">' + esc(hn) + '</span>' : '') + '<span class="jh-pjt__calits">' + shown + '</span></button>'; }).join('');
  return '<section class="jh-card"><div class="jh-pjt__pad"><div class="jh-pjt__calgrid">' + head + cells + '</div></div></section>';
}
/** 일정 등록·수정 창 — 구포털 등록 창과 같은 순서: 내용 → 카테고리 → 할 일(00~24시) → 시작·종료(날짜 + 시 + 분) → 장소 → 참석자 → 등록자 → 등록하기. 할 일을 켜면 시간 칸이 00시~24시로 잠긴다 */
function formHtml(st) {
  const f = st.form; const cats = CATS.map(([t, l]) => '<button type="button" class="jh-pjt__cat" data-sc-cat="' + t + '" aria-pressed="' + (f.tag === t) + '">' + esc(l) + '</button>').join('');
  const dis = f.isTodo ? ' disabled' : ''; const row = (label, opt, inner) => '<div class="jh-pjt__frow"><label class="jh-pjt__flabel">' + label + (opt ? ' <span class="jh-field__hint">' + opt + '</span>' : '') + '</label>' + inner + '</div>';
  const three = (d, h, m) => '<div class="jh-pjt__f3"><input class="jh-input" type="date" data-sc-f="' + d + '" value="' + esc(f[d]) + '">' + sel('data-sc-f="' + h + '"' + dis, f[h], hrs, '시') + sel('data-sc-f="' + m + '"' + dis, f[m], mins, '분') + '</div>';
  return '<section class="jh-card jh-pjt__sform"><div class="jh-panel__head"><h3>' + (f.id ? '일정 수정' : '일정 등록') + '</h3><button type="button" class="jh-btn" data-variant="ghost" data-sc-act="cancel" aria-label="닫기">✕</button></div><div class="jh-pjt__pad">'
    + row('일정 내용', '(공란 가능)', '<input class="jh-input" data-sc-f="text" value="' + esc(f.text) + '" placeholder="예: FCU 야간 설치 작업"><div class="jh-field__hint" data-sc-hint></div>')
    + row('카테고리', '(자동 추정 · 탭해서 변경)', '<div class="jh-pjt__cats">' + cats + '</div>')
    + '<div class="jh-pjt__frow"><label class="jh-pjt__todo" data-on="' + !!f.isTodo + '"><input type="checkbox" data-sc-todo' + (f.isTodo ? ' checked' : '') + '> <span>할 일 (00~24시 · 체크리스트로 등록)</span></label></div>'
    + row('시작', '', three('sdate', 'sh', 'sm')) + row('종료', '(다중일 가능 · 같은 날이면 비워도 됨)', three('edate', 'eh', 'em'))
    + row('장소', '(공란 가능)', '<input class="jh-input" data-sc-f="place" value="' + esc(f.place) + '" placeholder="예: 가동 1층 대회의실">') + row('참석자', '(공란 가능)', '<input class="jh-input" data-sc-f="att" value="' + esc(f.att) + '" placeholder="예: 서민우 팀장, 김혁">') + row('등록자', '(상세에서만 표시)', '<input class="jh-input" data-sc-f="reg" value="' + esc(f.reg) + '" placeholder="본인 이름">')
    + '<button type="button" class="jh-btn jh-pjt__fsave" data-variant="primary" data-sc-act="save">' + (f.id ? '수정 저장' : '등록하기') + '</button></div></section>';
}
/** 일정 탭: 달력(월)·2주 달력 보기, 그날 일정 목록, 등록·수정·삭제·완료(할 일). 모든 프로젝트 같은 화면 */
export function scheduleHtml(st) {
  if (!st.proj) return '<div class="jh-pjt"><div class="jh-alert" data-tone="warn" role="status">이 프로젝트를 열 수 없습니다. 위 메뉴에서 프로젝트를 고른 뒤 "일정" 탭을 여세요.</div></div>';
  if (!st.ready) return '<div class="jh-pjt"><div class="jh-pjt__proj"><span class="jh-pjt__projlabel">🏗️ ' + esc(st.label) + '</span><span class="jh-field__hint">일정</span></div><div class="jh-empty">불러오는 중...</div></div>';
  const view = st.view === 'two' ? 'two' : 'month';   // 보기는 달력(월)·2주 달력 두 가지(주간 보기는 없앴다)
  const views = [['month', '달력'], ['two', '2주']]; const title = view === 'month' ? st.month.y + '년 ' + (st.month.m + 1) + '월' : (() => { const d = twoWeeks(st.date); const md = (k) => Number(k.slice(5, 7)) + '/' + Number(k.slice(8)); return md(d[0]) + ' ~ ' + md(d[d.length - 1]); })();
  const bar = '<div class="jh-pjt__bar"><span class="jh-pjt__tabs" role="tablist">' + views.map(([k, l]) => '<button type="button" role="tab" class="jh-pjt__tab" data-sc-view="' + k + '" aria-selected="' + (view === k) + '">' + l + '</button>').join('') + '</span><span class="jh-pjt__datenav"><button type="button" class="jh-btn" data-variant="ghost" data-sc-nav="-1" aria-label="이전">‹</button><strong>' + esc(title) + '</strong><button type="button" class="jh-btn" data-variant="ghost" data-sc-nav="1" aria-label="다음">›</button><button type="button" class="jh-btn" data-variant="secondary" data-sc-nav="today">오늘</button></span>' + (st.manage ? '<button type="button" class="jh-btn" data-variant="primary" data-sc-new="' + esc(st.date) + '">＋ 일정 등록</button>' : '') + '</div>';
  const head = '<div class="jh-pjt__proj"><span class="jh-pjt__projlabel">🏗️ ' + esc(st.label) + '</span><span class="jh-field__hint">일정</span></div>';
  // 달력(월)·2주 달력 모두: 왼쪽 달력(스크롤해도 화면에 고정), 오른쪽은 그날 목록 — 등록·수정 창은 목록 자리에 나온다
  const body = '<div class="jh-pjt__split jh-pjt__splitcal"><div class="jh-pjt__calcol">' + (view === 'month' ? monthHtml(st) : twoHtml(st)) + '</div><div>' + (st.form ? formHtml(st) : dayBlock(st, st.date)) + '</div></div>';
  return '<div class="jh-pjt jh-pjt--prog"><div class="jh-pjt__main jh-pjt__mainwide">' + head + bar + (st.readonly ? '<div class="jh-field__hint">조회만 할 수 있습니다(등록·수정은 관리자·PJT 담당 계정).</div>' : '') + body + '</div></div>';
}
