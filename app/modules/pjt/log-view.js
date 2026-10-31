import { esc } from '../../core/ui.js?v=20261031d';
import { CATEGORIES, INPUT_SOURCES, SOURCES, CATEGORY_ICON, STATUS_LABEL, STATUS_TONE, TITLE_MAX, titleHint, canSubmit, dueText, DUE_TONE, shortDate, actionsFor, inCalendar } from '../../shared/pjt-log.js?v=20261031d';
/* PJT 이력 탭 화면(문자열) — 설계 docs/pjt-log-design.md §3. 화면 순서: 기한 임박 요청 → 변경사항 → 전체 이력, 맨 위에 한 줄 입력.
 * st = { proj, label, me:{uid,manager}, loading, error, data:{urgent,changes,entries,total,today,canConfirm}, filter:{category,source,from,to}, formOpen, form:{category,source,title,dueDate}, busy, msg } */
const chip = (text, tone) => '<span class="jh-badge"' + (tone ? ' data-tone="' + tone + '"' : '') + '>' + esc(text) + '</span>';
const btn = (act, id, label, variant, pjt) => '<button type="button" class="jh-btn" data-variant="' + (variant || 'ghost') + '" data-lg-act="' + esc(act) + '" data-lg-id="' + esc(id) + '"' + (pjt ? ' data-lg-pjt="' + esc(pjt) + '"' : '') + '>' + esc(label) + '</button>';

/** 항목 한 줄 — 분류 아이콘·제목·메타(날짜·출처·작성자·맡은 사람)·상태 칩·기한 칩·버튼 */
function row(e, st, opts) {
  const me = st.me || {}; const due = e.due || null; const dt = dueText(due);
  const meta = [shortDate(e.date), e.source, e.auto ? '자동 기록' : (e.createdByName || ''), e.claimedByName ? '👤 ' + e.claimedByName + ' 맡음' : (opts && opts.showUnclaimed ? '맡은 사람 없음' : '')].filter(Boolean).map(esc).join(' · ');
  const acts = actionsFor(e, me).map((a) => btn(a.act, e.id, a.label, a.act === 'claim' ? 'secondary' : 'ghost', e.pjtId || '')).join('');
  const pjtChip = st.all && e.pjtId ? '<a class="jh-pjt__lgproj" href="#/pjt/' + encodeURIComponent(e.pjtId) + '/log" title="이 프로젝트의 이력 탭">🏗️ ' + esc(e.pjtLabel || '') + '</a>' : '';
  return '<div class="jh-pjt__lgrow" data-lg-row="' + esc(e.id) + '" data-status="' + esc(e.status) + '">'
    + '<span class="jh-pjt__lgicon" aria-hidden="true">' + (CATEGORY_ICON[e.category] || '•') + '</span>'
    + '<div class="jh-pjt__lgbody"><div class="jh-pjt__lgtitle">' + esc(e.title) + (e.restricted ? ' ' + chip('대외비', 'warn') : '') + '</div>'
    + '<div class="jh-field__hint">' + pjtChip + (pjtChip ? ' · ' : '') + esc(e.category) + ' · ' + meta + '</div></div>'
    + '<div class="jh-pjt__lgside">' + (dt ? chip(dt, DUE_TONE[due.tone] || '') + (e.dueDate ? '<span class="jh-field__hint">' + esc(shortDate(e.dueDate)) + '</span>' : '') : '') + (e.status !== 'confirmed' ? chip(STATUS_LABEL[e.status] || e.status, STATUS_TONE[e.status] || '') : '') + (e.replyDetected ? chip('회신됨', 'info') : '') + (inCalendar(e) ? chip('📅 캘린더에 있음', 'accent') : '') + '</div>'
    + (acts ? '<div class="jh-pjt__lgacts">' + acts + '</div>' : '') + '</div>';
}
const card = (title, body, count, note, scroll) => '<section class="jh-card jh-pjt__lgcard"><div class="jh-panel__head"><h3 class="jh-pjt__dayh">' + esc(title) + (count != null ? ' <span class="jh-field__hint">' + count + '건</span>' : '') + '</h3></div><div class="jh-pjt__pad' + (scroll ? ' jh-pjt__lgscroll' : '') + '">' + (note ? '<div class="jh-field__hint">' + esc(note) + '</div>' : '') + body + '</div></section>';
const empty = (t) => '<div class="jh-empty">' + esc(t) + '</div>';

/** 한 줄 입력 폼 — 분류 칩 5개·출처 칩·한 줄 요약·기한(선택). 금액이 들어가면 입력 중에 바로 안내 */
export function formHtml(st, bare) {
  const f = st.form || {}; const hint = titleHint(f.title); const can = canSubmit(f, !!st.all);
  const projSel = st.all ? '<div class="jh-field"><label class="jh-field__label" for="lg-proj">프로젝트</label><select id="lg-proj" class="jh-select" data-lg-proj><option value="">프로젝트를 선택하세요</option>' + (st.projects || []).map((p) => '<option value="' + esc(p.key) + '"' + (f.pjtId === p.key ? ' selected' : '') + '>' + esc(p.label) + '</option>').join('') + '</select></div>' : '';
  const seg = (attr, list, cur) => '<div class="jh-chiplist" role="radiogroup">' + list.map((v) => '<button type="button" class="jh-chip" role="radio" aria-pressed="' + (cur === v) + '" ' + attr + '="' + esc(v) + '">' + (CATEGORY_ICON[v] ? CATEGORY_ICON[v] + ' ' : '') + esc(v) + '</button>').join('') + '</div>';
  const open = bare ? '<div class="jh-pjt__lgform">' : '<section class="jh-card"><div class="jh-panel__head"><h3 class="jh-pjt__dayh">＋ 기록</h3></div><div class="jh-pjt__pad jh-pjt__lgform">';
  return open
    + projSel + '<div class="jh-field"><span class="jh-field__label">분류</span>' + seg('data-lg-cat', CATEGORIES, f.category) + '</div>'
    + '<div class="jh-field"><span class="jh-field__label">출처</span>' + seg('data-lg-src', INPUT_SOURCES, f.source) + '</div>'
    + '<div class="jh-field"' + (hint ? ' data-invalid="true"' : '') + '><label class="jh-field__label" for="lg-title">한 줄 요약 <span class="jh-field__hint">(금액·단가는 적지 않습니다)</span></label><input id="lg-title" class="jh-input" data-lg-title maxlength="200" autocomplete="off" placeholder="예) 4층 B구역 배관 검사 11/5 → 11/7로 변경" value="' + esc(f.title || '') + '"' + (hint ? ' aria-invalid="true"' : '') + '>'
    + '<div class="jh-field__hint" data-lg-count>' + String(f.title || '').trim().length + ' / ' + TITLE_MAX + '</div>' + (hint ? '<div class="jh-field__error" role="alert" data-lg-hint>' + esc(hint) + '</div>' : '') + '</div>'
    + '<div class="jh-field"><label class="jh-field__label" for="lg-due">기한 <span class="jh-field__hint">(회신·조치가 필요한 날, 없으면 비워 두세요)</span></label><input id="lg-due" class="jh-input" type="date" data-lg-due value="' + esc(f.dueDate || '') + '"></div>'
    + '<div class="jh-actionbar"><button type="button" class="jh-btn" data-variant="primary" data-lg-add' + (can.ok && !st.busy ? '' : ' disabled') + '>기록하기</button>' + (can.ok ? '' : '<span class="jh-field__hint">' + esc(can.why) + '</span>') + '</div>'
    + (bare ? '</div>' : '</div></section>');
}
/** 전체 이력 필터 줄 */
function filterHtml(st) {
  const f = st.filter || {}; const opt = (list, cur, all) => '<option value="">' + all + '</option>' + list.map((v) => '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
  return '<div class="jh-filters"><select class="jh-select" data-lg-fcat aria-label="분류">' + opt(CATEGORIES, f.category, '모든 분류') + '</select><select class="jh-select" data-lg-fsrc aria-label="출처">' + opt(SOURCES, f.source, '모든 출처') + '</select>'
    + '<input class="jh-input" type="date" data-lg-ffrom aria-label="시작일" value="' + esc(f.from || '') + '"><span class="jh-field__hint">~</span><input class="jh-input" type="date" data-lg-fto aria-label="종료일" value="' + esc(f.to || '') + '">'
    + ((f.category || f.source || f.from || f.to) ? '<button type="button" class="jh-btn" data-variant="ghost" data-lg-freset>필터 해제</button>' : '') + '</div>';
}
/** 맨 위 헤더 — 다른 PJT 탭과 같은 모양(🏗️ 프로젝트 이름 + 탭 이름) */
const projHead = (st) => '<div class="jh-pjt__proj"><span class="jh-pjt__projlabel">🏗️ ' + esc(st.label || '') + '</span><span class="jh-field__hint">이력</span></div>';
/** 이력 탭 전체 */
export function logHtml(st) {
  if (!st.proj) return '<div class="jh-pjt"><div class="jh-alert" data-tone="warn" role="status">이 프로젝트를 열 수 없습니다. 위 메뉴에서 프로젝트를 고른 뒤 "이력" 탭을 여세요(참여자로 지정된 프로젝트만 열립니다).</div></div>';
  if (st.error) return '<div class="jh-pjt">' + projHead(st) + '<div class="jh-alert" data-tone="danger" role="alert">' + esc(st.error) + '</div></div>';
  const d = st.data;
  if (st.loading || !d) return '<div class="jh-pjt" aria-busy="true">' + projHead(st) + '<div class="jh-skeleton" style="height:var(--u-220)"></div></div>';
  const msg = st.msg ? '<div class="jh-alert" data-tone="info" role="status">' + esc(st.msg) + '</div>' : '';
  const urgent = card('기한 임박 요청', (d.urgent || []).map((e) => row(e, st, { showUnclaimed: true })).join('') || empty('기한이 있는 요청이 없습니다.'), (d.urgent || []).length, '마감이 가까운 순서입니다. 맡을 사람이 없는 요청은 "내가 맡기"를 눌러 주세요.', true);
  const changes = card('변경사항', (d.changes || []).map((e) => row(e, st)).join('') || empty('일정·범위·수량 변경이 없습니다.'), (d.changes || []).length, '영향 확인이 안 된 변경이 위에 옵니다. 공정·월간 보고서에 반영했으면 "영향 확인"을 눌러 주세요.', true);
  const all = card('전체 이력', filterHtml(st) + ((d.entries || []).map((e) => row(e, st)).join('') || empty('조건에 맞는 이력이 없습니다.')) + (d.total > (d.entries || []).length ? '<div class="jh-field__hint">최근 ' + d.entries.length + '건만 보입니다. 필터로 좁혀 주세요. (전체 ' + d.total + '건)</div>' : ''), d.total);
  const head = '<div class="jh-pjt__lghead">' + projHead(st) + '<button type="button" class="jh-btn" data-variant="' + (st.formOpen ? 'ghost' : 'primary') + '" data-lg-toggle aria-expanded="' + !!st.formOpen + '">' + (st.formOpen ? '입력 닫기' : '＋ 기록') + '</button></div>';
  return '<div class="jh-pjt jh-pjt__lg">' + head + msg + (st.formOpen ? formHtml(st) : '') + '<div class="jh-pjt__lgtop">' + urgent + changes + '</div>' + all + '</div>';
}

/** 프로젝트 홈 3단째의 요약 이력 — 기한 임박 최대 5건 + 최근 이력 최대 8건. 변경사항 묶음·필터·전체 목록은 이력 탭("전체 보기")에서. 서버가 안 되면 홈이 시끄럽지 않게 주의 안내와 다시 시도만 */
export function logCompactHtml(st) {
  const tools = '<span class="jh-pjt__lgtools"><button type="button" class="jh-btn" data-variant="' + (st.formOpen ? 'ghost' : 'secondary') + '" data-lg-toggle aria-expanded="' + !!st.formOpen + '">' + (st.formOpen ? '닫기' : '＋ 기록') + '</button>' + (st.all ? '' : '<a class="jh-btn" data-variant="ghost" href="#/pjt/' + encodeURIComponent(st.proj) + '/log">전체 보기 ›</a>') + '</span>';
  const wrap = (inner, busy) => '<section class="jh-card jh-pjt__lg--compact"' + (busy ? ' aria-busy="true"' : '') + '><div class="jh-panel__head"><h3>🗂️ 이력</h3>' + tools + '</div><div class="jh-pjt__pad">' + inner + '</div></section>';
  if (st.error) return wrap('<div class="jh-alert" data-tone="warn" role="status">이력을 불러오지 못했습니다: ' + esc(st.error) + ' <button type="button" class="jh-btn" data-variant="ghost" data-lg-retry>다시 시도</button></div>');
  const d = st.data; if (st.loading || !d) return wrap('<div class="jh-skeleton" style="height:var(--u-120)"></div>', true);
  const msg = st.msg ? '<div class="jh-alert" data-tone="info" role="status">' + esc(st.msg) + '</div>' : '';
  const fsel = st.all && (st.projects || []).length > 1 ? '<div class="jh-filters"><select class="jh-select" data-lg-fproj aria-label="프로젝트"><option value="">모든 프로젝트</option>' + st.projects.map((p) => '<option value="' + esc(p.key) + '"' + ((st.filter || {}).pjtId === p.key ? ' selected' : '') + '>' + esc(p.label) + '</option>').join('') + '</select></div>' : '';
  const urgentAll = d.urgent || [], urgent = urgentAll.slice(0, 5), shown = new Set(urgentAll.map((e) => e.id));   // 기한 임박 요청에 속한 항목은 5건을 넘어 숨겨진 것도 "최근 이력"에 다시 나오지 않게 전체 기준으로 거른다
  const recent = (d.entries || []).filter((e) => !shown.has(e.id)).slice(0, 8);
  const sec = (title, rows, more, emptyText) => '<div class="jh-field__hint jh-pjt__lgsec">' + esc(title) + '</div>' + (rows.length ? rows.map((e) => row(e, st, { showUnclaimed: true })).join('') : empty(emptyText)) + (more ? '<div class="jh-field__hint">' + esc(more) + '</div>' : '');
  return wrap(msg + (st.formOpen ? formHtml(st, true) : '') + fsel
    + sec('기한 임박 요청 ' + urgentAll.length + '건', urgent, urgentAll.length > 5 ? '외 ' + (urgentAll.length - 5) + (st.all ? '건은 프로젝트를 골라 좁혀 보세요.' : '건은 "전체 보기"에서 볼 수 있습니다.') : '', '기한이 있는 요청이 없습니다.')
    + sec('최근 이력', recent, '', '아직 기록이 없습니다. ＋ 기록으로 첫 이력을 남겨 보세요.'));
}
