/* 모바일 PJT "이력" — 변경·결정 이력 로그(설계 docs/pjt-log-design.md, 대표님 2026-10-16 Q7: 모바일 "+ 기록" 한 줄 입력, 사진 없음).
 * pjt.html 이 불러 쓰는 별도 파일 — 불러오기·실행이 실패해도 기존 공정·일정·근태 화면은 그대로 동작하도록 pjt.html 쪽에서 감싼다.
 * 규칙(분류·출처·금액 감지·버튼 권한)은 PC 와 같은 공용 파일(app/shared/pjt-log.js)을 쓴다. 읽기·쓰기는 서버 함수 pjtLogAct 만(참여자 판정은 서버).
 * 클릭은 인라인 코드에 문자열을 끼우지 않고 data- 속성 + onclick="lgClick(this)" 한 곳으로 받는다. 화면 조작(오버레이·입력칸)은 ui 어댑터로 분리해 노드에서 시험한다. */
import { CATEGORIES, INPUT_SOURCES, CATEGORY_ICON, STATUS_LABEL, STATUS_TONE, TITLE_MAX, titleHint, canSubmit, dueText, DUE_TONE, shortDate, actionsFor, friendlyError } from '../app/shared/pjt-log.js?v=20261026k';

const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** 모바일 사이트 키 → 서버 프로젝트 id (경량 프로젝트 키는 reg_<문서id>, 고정 프로젝트 p4ph2·p4ph4 는 그대로) */
export const pjtIdOf = (siteKey) => (String(siteKey || '').indexOf('reg_') === 0 ? String(siteKey).slice(4) : String(siteKey || ''));
const LAST_KEY = 'jh.pjtlog.lastProject';   // PC 와 같은 키 — 한쪽에서 고른 프로젝트가 다른 쪽 기본값이 된다
const STALE_MS = 30000, TOP_URGENT = 5, TOP_RECENT_HOME = 8, TOP_RECENT_TAB = 15, TOP_CHANGES = 5;

export const CSS = `
.lgbar{margin:0 20px 6px;display:flex;gap:8px}
.lgadd{flex:1;padding:12px;border:none;border-radius:12px;background:var(--blue);color:#fff;font-size:13.5px;font-weight:800;font-family:inherit;cursor:pointer}
.lgsec{font-size:12px;font-weight:800;color:#5c6f8a;margin:14px 22px 8px}
.lgrow{margin:0 20px 9px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;box-shadow:0 2px 8px rgba(30,50,80,.05)}
.lgrow[data-st="done"],.lgrow[data-st="closed"]{opacity:.72}
.lgtop{display:flex;gap:10px;align-items:flex-start}
.lgic{font-size:18px;line-height:1.3}
.lgbody{min-width:0;flex:1;overflow-wrap:anywhere}
.lgtt{font-size:13.5px;font-weight:700}
.lgmeta{font-size:11px;color:var(--sub);margin-top:3px}
.lgproj{font-weight:800;color:var(--blue);cursor:pointer}
.lgchips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.lgchip{font-size:10.5px;font-weight:800;padding:3px 9px;border-radius:7px;background:#eef2f7;color:#5c6f8a}
.lgchip.danger{background:#fdecea;color:#a5342a}
.lgchip.warn{background:#faeeda;color:#633806}
.lgchip.info{background:#e6f1fb;color:#0c447c}
.lgchip.accent{background:#e4f5ec;color:#126b45}
.lgbtns{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}
.lgbtn{padding:8px 13px;border-radius:10px;border:1px solid var(--line);background:#fff;font-size:12px;font-weight:700;color:#5c6f8a;font-family:inherit;cursor:pointer}
.lgbtn.pri{background:var(--blue);border-color:var(--blue);color:#fff}
.lghint{margin-top:6px;font-size:11.5px;font-weight:700;color:#a5342a}
.lgcnt{margin-top:4px;font-size:11px;color:#9aa8bc;text-align:right}
.lgmore{margin:0 22px 8px;font-size:11.5px;color:#9aa8bc;font-weight:600}
.lgsel{width:100%;border:1px solid var(--line);border-radius:11px;padding:11px 12px;font-size:14px;font-family:inherit;background:#f8fafc}
.sbtn-save[disabled]{opacity:.45}
`;

/** 항목 한 칸 — 분류 아이콘·제목·메타(프로젝트·분류·날짜·출처·작성자·맡은 사람)·칩(기한·상태·회신됨)·버튼(권한별) */
function row(e, me, ctx) {
  const pid = e.pjtId || ctx.pjtId || ''; const due = e.due || null; const dt = dueText(due);
  const proj = ctx.showProject && e.pjtId ? '<span class="lgproj" data-lg="go" data-p="' + esc(e.pjtId) + '" onclick="lgClick(this)">🏗️ ' + esc(e.pjtLabel || '') + '</span> · ' : '';
  const meta = [e.category, shortDate(e.date), e.source, e.auto ? '자동 기록' : (e.createdByName || ''), e.claimedByName ? '👤 ' + e.claimedByName + ' 맡음' : (ctx.showUnclaimed ? '맡은 사람 없음' : '')].filter(Boolean).map(esc).join(' · ');
  const chips = (dt ? '<span class="lgchip ' + esc(DUE_TONE[due.tone] || '') + '">' + esc(dt) + '</span>' + (e.dueDate ? '<span class="lgchip">' + esc(shortDate(e.dueDate)) + '</span>' : '') : '')
    + (e.status !== 'confirmed' ? '<span class="lgchip ' + esc(STATUS_TONE[e.status] || '') + '">' + esc(STATUS_LABEL[e.status] || e.status) + '</span>' : '') + (e.replyDetected ? '<span class="lgchip info">회신됨</span>' : '') + (e.restricted ? '<span class="lgchip warn">대외비</span>' : '');
  const btns = actionsFor(e, me).map((a) => '<button type="button" class="lgbtn' + (a.act === 'claim' ? ' pri' : '') + '" data-lg="act" data-a="' + esc(a.act) + '" data-id="' + esc(e.id) + '" data-p="' + esc(pid) + '" onclick="lgClick(this)">' + esc(a.label) + '</button>').join('');
  return '<div class="lgrow" data-st="' + esc(e.status) + '"><div class="lgtop"><span class="lgic" aria-hidden="true">' + (CATEGORY_ICON[e.category] || '•') + '</span><div class="lgbody"><div class="lgtt">' + esc(e.title) + '</div><div class="lgmeta">' + proj + meta + '</div></div></div>'
    + (chips ? '<div class="lgchips">' + chips + '</div>' : '') + (btns ? '<div class="lgbtns">' + btns + '</div>' : '') + '</div>';
}
const sec = (t) => '<div class="lgsec">' + esc(t) + '</div>';
const empty = (t) => '<div class="empty">' + esc(t) + '</div>';
/** 본문(서버가 준 목록 → 기한 임박 / 변경사항(프로젝트 탭만) / 최근 이력) */
export function bodyHtml(d, me, ctx) {
  const urgentAll = d.urgent || [], urgent = urgentAll.slice(0, TOP_URGENT), shown = new Set(urgentAll.map((e) => e.id));
  let out = sec('기한 임박 요청 ' + urgentAll.length + '건') + (urgent.length ? urgent.map((e) => row(e, me, Object.assign({ showUnclaimed: true }, ctx))).join('') : empty('기한이 있는 요청이 없습니다.'))
    + (urgentAll.length > TOP_URGENT ? '<div class="lgmore">외 ' + (urgentAll.length - TOP_URGENT) + '건은 ' + (ctx.showProject ? '프로젝트별 이력에서' : '이 화면을 아래로 내려') + ' 확인하세요.</div>' : '');
  if (!ctx.showProject) {   // 프로젝트 탭: 변경사항(일정·범위·수량) — 영향 확인이 안 된 것이 위로
    const ch = (d.changes || []).filter((e) => !shown.has(e.id)).slice(0, TOP_CHANGES); ch.forEach((e) => shown.add(e.id));   // 위에 보인 기한 임박 항목은 다시 안 나오고, 변경사항에 나온 것은 최근 이력에서 뺀다
    out += sec('변경사항') + (ch.length ? ch.map((e) => row(e, me, ctx)).join('') : empty('일정·범위·수량 변경이 없습니다.'));
  }
  const recent = (d.entries || []).filter((e) => !shown.has(e.id)).slice(0, ctx.showProject ? TOP_RECENT_HOME : TOP_RECENT_TAB);
  return out + sec('최근 이력') + (recent.length ? recent.map((e) => row(e, me, ctx)).join('') : empty('아직 기록이 없습니다. ＋ 기록으로 첫 이력을 남겨 보세요.'));
}
/** "＋ 기록" 오버레이 폼 — 기존 일정 입력 폼(sform-ov)과 같은 모양. 분류·출처 칩, 한 줄 요약(금액 입력 안내), 기한(선택). 프로젝트는 고정(프로젝트 탭)이거나 선택(PJT 홈) */
export function formHtml(f, projects) {
  const chips = (kind, list, cur) => '<div class="stagrow">' + list.map((v) => '<div class="stag' + (cur === v ? ' on' : '') + '" style="' + (cur === v ? 'background:var(--blue);border-color:var(--blue);color:#fff' : '') + '" data-lg="pick" data-k="' + kind + '" data-v="' + esc(v) + '" onclick="lgClick(this)">' + (CATEGORY_ICON[v] ? CATEGORY_ICON[v] + ' ' : '') + esc(v) + '</div>').join('') + '</div>';
  const proj = f.fixed ? '' : '<div class="sfield"><label for="lg-proj">프로젝트</label><select class="lgsel" id="lg-proj" data-lg-in="proj" onchange="lgInput(this)"><option value="">프로젝트를 선택하세요</option>' + projects.map((p) => '<option value="' + esc(p.key) + '"' + (f.pjtId === p.key ? ' selected' : '') + '>' + esc(p.label) + '</option>').join('') + '</select></div>';
  const hint = titleHint(f.title), can = canSubmit(f, !f.fixed);
  return '<div class="sform-ov" id="lgform-ov" data-lg="close-bg" onclick="lgClick(this,event)"><div class="sform"><h3>＋ 기록</h3>' + proj
    + '<div class="sfield"><label>분류</label>' + chips('cat', CATEGORIES, f.category) + '</div><div class="sfield"><label>출처</label>' + chips('src', INPUT_SOURCES, f.source) + '</div>'
    + '<div class="sfield"><label for="lg-title">한 줄 요약 (금액·단가는 적지 않습니다)</label><input id="lg-title" maxlength="200" autocomplete="off" placeholder="예) 4층 B구역 배관 검사 11/5 → 11/7로 변경" value="' + esc(f.title) + '" data-lg-in="title" oninput="lgInput(this)">'
    + '<div class="lghint" id="lg-hint"' + (hint ? '' : ' style="display:none"') + '>' + esc(hint) + '</div><div class="lgcnt" id="lg-cnt">' + String(f.title || '').trim().length + ' / ' + TITLE_MAX + '</div></div>'
    + '<div class="sfield"><label for="lg-due">기한 (회신·조치가 필요한 날, 없으면 비워 두세요)</label><input type="date" id="lg-due" value="' + esc(f.dueDate) + '" data-lg-in="due" onchange="lgInput(this)"></div>'
    + '<div class="sform-btns"><button type="button" class="sbtn-cancel" data-lg="close" onclick="lgClick(this)">취소</button><button type="button" class="sbtn-save" id="lg-save" data-lg="submit" onclick="lgClick(this)"' + (can.ok ? '' : ' disabled') + '>기록하기</button></div></div></div>';
}

/** 화면 조작 어댑터(브라우저용) — 시험에서는 가짜로 바꾼다 */
export function domUi(doc) {
  const $ = (id) => (doc ? doc.getElementById(id) : null);
  return {
    injectStyles() { if (!doc || $('lg-style')) return; const s = doc.createElement('style'); s.id = 'lg-style'; s.textContent = CSS; doc.head.appendChild(s); },
    showForm(html) { if (!doc) return; const ex = $('lgform-ov'); if (ex) ex.remove(); doc.body.insertAdjacentHTML('beforeend', html); },
    hideForm() { const ex = $('lgform-ov'); if (ex) ex.remove(); },
    readForm() { const t = $('lg-title'), d = $('lg-due'); return { title: t ? t.value : null, dueDate: d ? d.value : null }; },
    setHint(text) { const h = $('lg-hint'); if (h) { h.textContent = text; h.style.display = text ? '' : 'none'; } },
    setCount(n) { const c = $('lg-cnt'); if (c) c.textContent = n + ' / ' + TITLE_MAX; },
    setSaveEnabled(on) { const b = $('lg-save'); if (b) { if (on) b.removeAttribute('disabled'); else b.setAttribute('disabled', ''); } }
  };
}

/** 모바일 이력 기능. o = { call(payload)→data, rerender(), isGuest, getUid(), siteKeyOf(pjtId)→사이트 키, goProject(siteKey), ui?, storage?, now?, confirm?, alert? } */
export function createMobileLog(o) {
  const call = o.call, rerender = o.rerender || (() => {}), now = o.now || (() => Date.now()); const ui = o.ui || domUi(typeof document !== 'undefined' ? document : null);
  const storage = o.storage !== undefined ? o.storage : (typeof localStorage !== 'undefined' ? localStorage : null);
  const confirmFn = o.confirm || ((m) => (typeof confirm === 'function' ? confirm(m) : true)), alertFn = o.alert || ((m) => { if (typeof alert === 'function') alert(m); });
  const st = { all: { data: null, error: '', loading: false, at: 0 }, proj: {}, form: null, busy: false, msg: '', manager: false };
  const me = () => ({ uid: (o.getUid && o.getUid()) || '', manager: st.manager });
  const fresh = (s) => s.at && now() - s.at <= STALE_MS;
  async function loadAll() { const s = st.all; if (s.loading) return; s.loading = true; try { const r = await call({ action: 'listAll', filter: {} }); s.data = r; s.error = ''; st.manager = r.canConfirm === true; } catch (e) { s.error = friendlyError(e); } s.loading = false; s.at = now(); rerender(); }
  async function loadProj(id) { const s = st.proj[id] || (st.proj[id] = { data: null, error: '', loading: false, at: 0 }); if (s.loading) return; s.loading = true; try { const r = await call({ action: 'list', pjtId: id, filter: {} }); s.data = r; s.error = ''; st.manager = r.canConfirm === true; } catch (e) { s.error = friendlyError(e); } s.loading = false; s.at = now(); rerender(); }
  const lastProject = (projects) => { try { const k = storage && storage.getItem(LAST_KEY); if (k && projects.some((p) => p.key === k)) return k; } catch (e) { /* 저장소를 못 쓰면 기본값 없음 */ } return projects.length === 1 ? projects[0].key : ''; };
  const rememberProject = (k) => { try { if (storage) storage.setItem(LAST_KEY, k); } catch (e) { /* 무시 */ } };
  const projectChoices = () => ((st.all.data && st.all.data.projects) || []).map((p) => ({ key: p.id, label: p.name }));
  const retryBar = (s, scope, p) => '<div class="banner soft">이력을 불러오지 못했습니다: ' + esc(s.error) + ' <b data-lg="retry" data-scope="' + scope + '" data-p="' + esc(p || '') + '" onclick="lgClick(this)" style="color:var(--blue);cursor:pointer">다시 시도</b></div>';
  const msgBar = () => (st.msg ? '<div class="banner soft">' + esc(st.msg) + '</div>' : '');
  const section = (s, scope, p, ctx) => { if (!s.data) return s.error ? retryBar(s, scope, p) : empty('불러오는 중...'); return msgBar() + bodyHtml(s.data, me(), ctx); };
  const addBar = (p) => '<div class="lgbar"><button type="button" class="lgadd" data-lg="open" data-p="' + esc(p || '') + '" onclick="lgClick(this)">＋ 기록</button></div>';

  /** PJT 홈(프로젝트를 고르기 전) — 내가 볼 수 있는 모든 진행 중 프로젝트의 이력. 손님 계정은 서버가 거절하므로 안 그림 */
  function homeHtml() { if (o.isGuest) return ''; ui.injectStyles(); if (!st.all.loading && !fresh(st.all)) loadAll(); return '<div class="lbl">🗂️ 이력관리</div>' + addBar('') + section(st.all, 'all', '', { showProject: true }); }
  /** 프로젝트 화면의 "이력" 탭 — 그 프로젝트만 */
  function siteHtml(pjtId) { if (o.isGuest) return ''; ui.injectStyles(); const s = st.proj[pjtId]; if (!s || (!s.loading && !fresh(s))) loadProj(pjtId); return addBar(pjtId) + (s ? section(s, 'proj', pjtId, { pjtId }) : empty('불러오는 중...')); }

  const capture = () => { if (!st.form) return; const r = ui.readForm(); if (r.title != null) st.form.title = r.title; if (r.dueDate != null) st.form.dueDate = r.dueDate; };
  const showForm = () => { ui.showForm(formHtml(st.form, projectChoices())); };
  async function openForm(pjtId) {
    if (o.isGuest) { alertFn('GUEST 계정은 이력을 기록할 수 없습니다. (조회만 가능)'); return; }
    if (!pjtId && !st.all.data) await loadAll();
    st.form = { fixed: !!pjtId, pjtId: pjtId || lastProject(projectChoices()), category: '', source: '', title: '', dueDate: '' }; showForm();
  }
  const closeForm = () => { st.form = null; ui.hideForm(); };
  function onInput(field, value) {
    if (!st.form) return;
    if (field === 'title') { st.form.title = value; ui.setHint(titleHint(value)); ui.setCount(String(value).trim().length); ui.setSaveEnabled(canSubmit(st.form, !st.form.fixed).ok); }
    else if (field === 'due') st.form.dueDate = value;
    else if (field === 'proj') { capture(); st.form.pjtId = value; showForm(); }
  }
  async function submit() {
    if (!st.form || st.busy) return; capture(); const f = st.form; const c = canSubmit(f, !f.fixed); if (!c.ok) { alertFn(c.why); return; }
    st.busy = true; ui.setSaveEnabled(false);
    try {
      await call({ action: 'add', pjtId: f.pjtId, category: f.category, source: f.source, title: f.title, dueDate: f.dueDate || '' });
      if (!f.fixed) rememberProject(f.pjtId); st.msg = '기록했습니다.'; closeForm(); await refresh(f.pjtId);
    } catch (e) { alertFn(friendlyError(e)); ui.setSaveEnabled(true); }
    st.busy = false; rerender();
  }
  /** 보여 준 적 있는 목록을 다시 읽는다(전체·그 프로젝트) */
  async function refresh(pjtId) { st.msg = st.msg || ''; await Promise.all([st.all.at ? loadAll() : null, st.proj[pjtId] ? loadProj(pjtId) : null].filter(Boolean)); }
  const STATUS_OF = { done: 'done', closed: 'closed', hold: 'hold', reopen: 'confirmed' };
  async function act(a, id, pjtId) {
    if (st.busy || !pjtId || !id) return;
    if (a === 'closed' && !confirmFn('이 항목을 종결합니다. 회신·조치가 끝났는지 확인하셨나요?')) return;
    if (a === 'hold' && !confirmFn('이 항목을 보류합니다. 기한 임박 목록에서 빠집니다.')) return;
    let payload;
    if (a === 'claim' || a === 'release' || a === 'confirm') payload = { action: a, pjtId, id };
    else if (a === 'impact') { const pool = [].concat((st.all.data && st.all.data.entries) || [], (st.proj[pjtId] && st.proj[pjtId].data && (st.proj[pjtId].data.changes || []).concat(st.proj[pjtId].data.entries || [])) || []); const e = pool.find((x) => x.id === id); payload = { action: 'impact', pjtId, id, checked: !(e && e.impactChecked) }; }
    else if (STATUS_OF[a]) payload = { action: 'setStatus', pjtId, id, status: STATUS_OF[a] };
    else return;
    st.busy = true; st.msg = '';
    try { await call(payload); await refresh(pjtId); } catch (e) { alertFn(friendlyError(e)); }
    st.busy = false; rerender();
  }
  function click(d) {
    const k = d && d.lg; if (!k) return;
    if (k === 'open') return openForm(d.p || '');
    if (k === 'close' || k === 'close-bg') return closeForm();
    if (k === 'pick') { capture(); if (st.form) { st.form[d.k === 'cat' ? 'category' : 'source'] = d.v; showForm(); } return; }
    if (k === 'submit') return submit();
    if (k === 'act') return act(d.a, d.id, d.p);
    if (k === 'go') return o.goProject && o.goProject(o.siteKeyOf ? o.siteKeyOf(d.p) : d.p);
    if (k === 'retry') { if (d.scope === 'all') { st.all.at = 0; return loadAll(); } const s = st.proj[d.p]; if (s) s.at = 0; return loadProj(d.p); }
  }
  /** pjt.html 의 인라인 onclick/oninput 이 부르는 전역 함수 연결 */
  function attachGlobals(win) {
    win.lgClick = (el, ev) => { if (ev && el.getAttribute('data-lg') === 'close-bg' && ev.target !== el) return; return click({ lg: el.getAttribute('data-lg'), p: el.getAttribute('data-p'), a: el.getAttribute('data-a'), id: el.getAttribute('data-id'), k: el.getAttribute('data-k'), v: el.getAttribute('data-v'), scope: el.getAttribute('data-scope') }); };
    win.lgInput = (el) => onInput(el.getAttribute('data-lg-in'), el.value);
  }
  return { homeHtml, siteHtml, click, onInput, attachGlobals, state: st, pjtIdOf };
}
