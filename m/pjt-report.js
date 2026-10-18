/* 모바일 PJT "공사일보" — 새 모바일 공사일보(대표님 2026-10-18: "새거 만들면서 장비 사용 시간도 넣자").
 * pjt.html 이 불러 쓰는 별도 파일 — 불러오기·실행이 실패해도 기존 공정·일정·근태·이력 화면은 그대로 동작하도록 pjt.html 쪽에서 감싼다.
 * 저장 형식·규칙은 **PC 와 완전히 같다**: PC 의 순수 규칙(app/modules/pjt/report.js · daily-note.js · adapter.js)을 그대로 불러 쓴다 — 모바일이 따로 만드는 규칙은 없고,
 * 여기서 하는 일은 ①서버에서 읽은 값으로 그날의 폼 모델을 만들고(저장된 일보가 있으면 그대로, 없으면 공정 체크·출역·공수로 미리 채움) ②모바일 입력칸의 값을 모델에 담아 저장 문서로 바꾸고 ③모바일 모양의 화면 문자열을 만드는 것이다.
 * 서버 읽기·쓰기는 호출하는 쪽(pjt.html)이 함수로 넘긴다(createMobileReport 의 io) — 이 파일은 Firestore 를 직접 부르지 않아 노드에서 시험한다. */
import { REPORT_FMT, WORK_SHIFTS, EQUIPS, cleanHrs, shiftOf, fromStored, toStored, isLegacyDoc, authorLabel, withEditor, dateText, attendanceSummary, autoContent, totalOf, perPersonOf, fmtAt } from '../app/modules/pjt/report.js?v=20261018h';
import { dayDoc, isDateKey } from '../app/modules/pjt/adapter.js?v=20261018h';
import { syncWithNote } from '../app/modules/pjt/daily-note.js?v=20261018h';

const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** 모바일 사이트 키 → 서버 프로젝트 id (경량 프로젝트 키는 reg_<문서id>, 고정 프로젝트 p4ph2·p4ph4 는 그대로) — 이력(pjt-log.js)과 같은 규칙 */
export const pjtIdOf = (siteKey) => (String(siteKey || '').indexOf('reg_') === 0 ? String(siteKey).slice(4) : String(siteKey || ''));
/** 그날의 일보가 저장되는 위치 [컬렉션, 문서 id] — PC 와 같은 어댑터. 잘못된 프로젝트·날짜면 null(쓰지 않는다) */
export const isRealDate = (k) => { if (!isDateKey(k)) return false; const [y, m, d] = String(k).split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };   // 형식(YYYY-MM-DD)만이 아니라 달력에 실제로 있는 날짜(2026-13-45·2026-02-30 은 아님)
export const reportDoc = (siteKey, dateKey) => (isRealDate(dateKey) ? dayDoc(pjtIdOf(siteKey), 'report', dateKey) : null);

/** 새 일보의 빈 폼(저장된 일보가 없을 때) — PC 의 loadDay 와 같은 값: 작성자는 로그인 계정, 내용은 그날 공정 체크로, 인원·공수는 출역·공수로 미리 채운다 */
export function newForm(me, att, structure, newChecks) {
  const a = att || {};
  return { legacy: false, author: authorLabel(me), checkIn: '', checkOut: '', shift: '', equipText: '', content: structure ? autoContent(structure, newChecks || {}) : '', tomorrow: '', headcount: a.headcount || 0, manday: a.manday || 0, mandayTotal: a.mandayTotal || 0, equip: [], eqNo: {}, eqHrs: {}, note: '' };
}
/** 저장된 일보가 있으면 그것을(작성자가 비어 있으면 로그인 계정으로), 없으면 새 폼 */
export function formFor(stored, me, att, structure, newChecks) {
  if (stored) { const f = fromStored(stored); if (!f.author) f.author = authorLabel(me); return f; }
  return newForm(me, att, structure, newChecks);
}
/** 모바일 입력칸에서 읽은 값 → 모델에 반영. 옛 형식(legacy)은 고치지 않는다. 시간(시:분)·장비별 차량번호·사용 시간까지 PC 의 readForm 과 같은 규칙 */
export function applyInputs(form, v) {
  const f = Object.assign({}, form); if (!f || f.legacy) return f; const x = v || {};
  ['author', 'content', 'tomorrow', 'note'].forEach((k) => { if (x[k] !== undefined) f[k] = String(x[k]); });
  if (x.headcount !== undefined) f.headcount = parseInt(x.headcount, 10) || 0;
  if (x.manday !== undefined) f.manday = parseFloat(x.manday) || 0;
  const hm = (h, m) => (h && m ? h + ':' + m : (h ? h + ':00' : ''));
  if (x.ciH !== undefined || x.ciM !== undefined) f.checkIn = hm(x.ciH, x.ciM);
  if (x.coH !== undefined || x.coM !== undefined) f.checkOut = hm(x.coH, x.coM);
  if (x.eqNo) f.eqNo = Object.assign({}, f.eqNo, x.eqNo);
  if (x.eqHrs) f.eqHrs = Object.assign({}, f.eqHrs, x.eqHrs);
  f.shift = ''; f.mandayTotal = totalOf(f.headcount, f.manday); return f;
}
/** 저장할 문서 — PC 와 같은 toStored. 이미 있는 일보를 최초 작성자가 아닌 사람이 고치면 수정자로 기록(PC 와 같은 withEditor) */
export function docToSave(form, ctx, exists, me, nowIso) {
  const f = Object.assign({}, form);
  if (exists) f.editors = withEditor(f.editors, f.author, authorLabel(me), nowIso);
  return toStored(f, ctx);
}
/** 장비 하나를 켜거나 끈다(지게차·크레인) — 끄면 그 장비의 번호·시간도 비운다(PC 의 장비 버튼과 같은 동작) */
export function toggleEquip(form, name) {
  if (EQUIPS.indexOf(name) === -1) return form; const f = Object.assign({}, form); const on = (f.equip || []).indexOf(name) !== -1;
  f.equip = on ? f.equip.filter((e) => e !== name) : (f.equip || []).concat(name);
  if (on) { f.eqNo = Object.assign({}, f.eqNo); delete f.eqNo[name]; f.eqHrs = Object.assign({}, f.eqHrs); delete f.eqHrs[name]; }
  return f;
}

/* ── 모바일 화면(순수 문자열) ──────────────────────────────────────────────
 * 클릭·입력은 인라인 코드에 값을 끼우지 않고 data- 속성 + 전역 함수(rpClick·rpInput) 한 곳으로 받는다(이력 모듈과 같은 방식). */
export const CSS = `
.rpbar{margin:0 20px 8px;display:flex;align-items:center;gap:8px}
.rpbar .rpd{flex:1;text-align:center;font-size:15px;font-weight:800;color:var(--ink)}
.rpnav{width:38px;height:38px;border:1px solid var(--line);border-radius:11px;background:#fff;font-size:15px;font-weight:800;color:#5c6f8a;font-family:inherit;cursor:pointer}
.rptoday{padding:0 12px;height:38px;border:1px solid var(--line);border-radius:11px;background:#fff;font-size:12.5px;font-weight:800;color:var(--blue);font-family:inherit;cursor:pointer}
.rpstat{margin:0 20px 10px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.rpbadge{font-size:11px;font-weight:800;padding:3px 10px;border-radius:8px;background:#eef2f7;color:#5c6f8a}
.rpbadge.ok{background:#e4f5ec;color:#126b45}.rpbadge.warn{background:#faeeda;color:#633806}
.rpcard{margin:0 20px 12px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;box-shadow:0 2px 8px rgba(30,50,80,.05)}
.rpf{margin-bottom:13px}.rpf:last-child{margin-bottom:0}
.rpf>label{display:block;font-size:12px;font-weight:800;color:#5c6f8a;margin-bottom:6px}
.rpf>label small{font-weight:600;color:#9aa8bc}
.rpin,.rpta,.rpsel{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:11px;padding:11px 12px;font-size:14px;font-family:inherit;background:#f8fafc;color:var(--ink)}
.rpta{min-height:96px;resize:vertical;line-height:1.5}
.rpin[readonly]{background:#f1f4f8;color:#6b7c93}
.rprow{display:flex;gap:8px;align-items:center}.rprow>*{min-width:0}
.rptime{display:flex;gap:6px;align-items:center}.rptime .rpsel{padding:11px 6px;text-align:center}
.rpshift{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.rpchip{padding:8px 13px;border:1px solid var(--line);border-radius:10px;background:#fff;font-size:12.5px;font-weight:700;color:#5c6f8a;font-family:inherit;cursor:pointer}
.rpchip.on{background:var(--blue);border-color:var(--blue);color:#fff}
.rpeq{margin-bottom:9px;border:1px solid var(--line);border-radius:12px;padding:10px;background:#fff}
.rpeq[data-on="true"]{border-color:var(--blue);background:#f4f8ff}
.rpeqrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.rpeqrow .rpin{flex:1 1 130px}.rphrs{display:flex;align-items:center;gap:5px;flex:0 0 auto}.rphrs .rpin{width:68px;text-align:right}
.rpunit{font-size:12.5px;color:#6b7c93;font-weight:700;white-space:nowrap}
.rpsave{display:block;width:calc(100% - 40px);margin:4px 20px 18px;padding:15px;border:none;border-radius:14px;background:var(--blue);color:#fff;font-size:15px;font-weight:800;font-family:inherit;cursor:pointer}
.rpsave[disabled]{opacity:.5}
.rpread{white-space:pre-wrap;word-break:break-word;font-size:13.5px;line-height:1.55;color:var(--ink)}
.rpkv{display:flex;gap:10px;font-size:13px;margin-bottom:6px}.rpkv b{flex:0 0 74px;color:#5c6f8a}
.rpmsg{margin:0 20px 10px}
`;
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINS = ['00', '10', '20', '30', '40', '50'];
const opt = (v, cur, label) => '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + esc(label == null ? v : label) + '</option>';
const splitHm = (t) => { const m = /^(\d\d):(\d\d)$/.exec(String(t || '')); return m ? { h: m[1], m: m[2] } : { h: '', m: '' }; };
/** 날짜 막대 — ◀ 날짜 ▶ + 오늘 */
export function dateBarHtml(dateKey) {
  return '<div class="rpbar"><button type="button" class="rpnav" aria-label="전날" data-rp="prev" onclick="rpClick(this)">◀</button><div class="rpd">' + esc(dateText(dateKey)) + '</div><button type="button" class="rpnav" aria-label="다음날" data-rp="next" onclick="rpClick(this)">▶</button><button type="button" class="rptoday" data-rp="today" onclick="rpClick(this)">오늘</button></div>';
}
/** 장비 한 칸 — 지게차·크레인 칩을 켜면 그 아래에 차량번호와 사용 시간(시간) 칸이 나온다 */
function equipHtml(f, dis) {
  return EQUIPS.map((n) => { const on = (f.equip || []).indexOf(n) !== -1;
    return '<div class="rpeq" data-on="' + on + '"><div class="rpeqrow"><button type="button" class="rpchip' + (on ? ' on' : '') + '" data-rp="eq" data-n="' + esc(n) + '" aria-pressed="' + on + '"' + dis + ' onclick="rpClick(this)">' + esc(n) + '</button>'
      + (on ? '<input class="rpin" data-rp-in="eqno" data-n="' + esc(n) + '" value="' + esc((f.eqNo || {})[n] || '') + '" placeholder="차량번호 (예: 00가0000)" aria-label="' + esc(n) + ' 차량번호" autocomplete="off"' + dis + ' oninput="rpInput(this)"><span class="rphrs"><input class="rpin" data-rp-in="eqhrs" data-n="' + esc(n) + '" type="number" inputmode="decimal" min="0" max="24" step="0.5" value="' + esc((f.eqHrs || {})[n] || '') + '" placeholder="0" aria-label="' + esc(n) + ' 사용 시간(시간)"' + dis + ' oninput="rpInput(this)"><span class="rpunit">시간</span></span>' : '') + '</div></div>'; }).join('');
}
/** 옛 양식 일보(읽기 전용) — 구포털에서 쓴 일보. 새 양식으로 편집을 눌러야 고칠 수 있다 */
export function legacyHtml(f) {
  const kv = (k, v) => '<div class="rpkv"><b>' + esc(k) + '</b><span>' + esc(v || '—') + '</span></div>';
  return '<div class="rpcard">' + kv('작성자', f.author) + kv('투입 인원', f.headcount ? f.headcount + '명' : '') + kv('사용 장비', f.equipText) + '</div>'
    + '<div class="rpcard"><div class="rpf"><label>금일 작업</label><div class="rpread">' + esc(f.content || '—') + '</div></div><div class="rpf"><label>명일 예정</label><div class="rpread">' + esc(f.tomorrow || '—') + '</div></div><div class="rpf"><label>특이사항</label><div class="rpread">' + esc(f.note || '—') + '</div></div></div>'
    + '<button type="button" class="rpsave" data-rp="edit" onclick="rpClick(this)">새 양식으로 편집</button>';
}
/** 작성 폼(새 양식) */
export function formHtml(f, o) {
  const dis = o && o.busy ? ' disabled' : ''; const ci = splitHm(f.checkIn), co = splitHm(f.checkOut); const cur = shiftOf(f.checkIn, f.checkOut);
  const shifts = '<div class="rpshift">' + WORK_SHIFTS.map((s) => '<button type="button" class="rpchip' + (cur === s.name ? ' on' : '') + '" data-rp="shift" data-n="' + esc(s.name) + '"' + dis + ' onclick="rpClick(this)">' + esc(s.name) + '</button>').join('') + '</div>';
  const sel = (key, list, v) => '<select class="rpsel" data-rp-in="' + key + '" aria-label="' + key + '"' + dis + ' onchange="rpInput(this)"><option value="">--</option>' + list.map((x) => opt(x, v)).join('') + '</select>';
  return '<div class="rpcard">'
    + '<div class="rpf"><label>작성자 <small>(로그인 계정 · 처음 쓴 사람 그대로)</small></label><input class="rpin" value="' + esc(f.author) + '" readonly aria-label="작성자"></div>'
    + '<div class="rpf"><label>근무시간 <small>(구분을 고르면 시간이 채워집니다)</small></label>' + shifts + '<div class="rptime">' + sel('ciH', HOURS, ci.h) + ':' + sel('ciM', MINS, ci.m) + '<span>~</span>' + sel('coH', HOURS, co.h) + ':' + sel('coM', MINS, co.m) + '</div></div>'
    + '<div class="rpf"><label>금일 작업</label><textarea class="rpta" data-rp-in="content" placeholder="금일 작업 내용" aria-label="금일 작업"' + dis + ' oninput="rpInput(this)">' + esc(f.content) + '</textarea></div>'
    + '<div class="rpf"><label>명일 예정</label><textarea class="rpta" data-rp-in="tomorrow" placeholder="명일 작업 예정" aria-label="명일 예정"' + dis + ' oninput="rpInput(this)">' + esc(f.tomorrow) + '</textarea></div></div>'
    + '<div class="rpcard"><div class="rpf"><label>투입 인원 · 공수 <small>(출역·공수 탭 값으로 자동 채움 · 고칠 수 있음)</small></label><div class="rprow"><input class="rpin" data-rp-in="headcount" type="number" inputmode="numeric" min="0" value="' + esc(f.headcount) + '" aria-label="투입 인원"' + dis + ' oninput="rpInput(this)"><span class="rpunit">명 ×</span><input class="rpin" data-rp-in="manday" type="number" inputmode="decimal" min="0" step="0.1" value="' + esc(f.manday) + '" aria-label="1인당 공수"' + dis + ' oninput="rpInput(this)"><span class="rpunit">공수 = <b id="rp-total">' + esc(f.mandayTotal) + '</b></span></div></div>'
    + '<div class="rpf"><label>사용 장비 <small>(지게차·크레인은 둘 다 고를 수 있고, 누르면 차량번호와 사용 시간 칸이 나옵니다)</small></label>' + equipHtml(f, dis) + '</div>'
    + '<div class="rpf"><label>특이사항</label><textarea class="rpta" data-rp-in="note" placeholder="특이사항 (없으면 비워 두세요)" aria-label="특이사항"' + dis + ' oninput="rpInput(this)">' + esc(f.note) + '</textarea></div></div>'
    + (((f.editors || []).length) ? '<div class="rpmsg" style="font-size:11.5px;color:#9aa8bc">수정: ' + (f.editors || []).map((e) => esc(e.by) + (e.at ? ' ' + esc(fmtAt(e.at)) : '')).join(' · ') + '</div>' : '')
    + '<button type="button" class="rpsave" id="rp-save" data-rp="save"' + dis + ' onclick="rpClick(this)">저장</button>';
}
/** 한 날짜의 본문 전체(날짜 막대 + 상태 배지 + 읽기/작성) */
export function bodyHtml(s) {
  const bar = dateBarHtml(s.date);
  if (s.error && !s.form) return bar + '<div class="rpmsg"><div class="banner soft">일보를 불러오지 못했습니다: ' + esc(s.error) + ' <b data-rp="retry" onclick="rpClick(this)" style="color:var(--blue);cursor:pointer">다시 시도</b></div></div>';
  if (s.loading || !s.form) return bar + '<div class="empty">불러오는 중...</div>';
  const f = s.form; const badge = f.legacy ? '<span class="rpbadge warn">옛 양식 · 조회</span>' : (s.exists ? '<span class="rpbadge ok">작성됨</span>' : '<span class="rpbadge">작성 전</span>');
  return bar + '<div class="rpstat">' + badge + (s.exists || f.legacy ? '' : '<span class="rpunit">공정 체크·출역으로 미리 채웠습니다</span>') + '</div>' + (s.msg ? '<div class="rpmsg"><div class="banner soft">' + esc(s.msg) + '</div></div>' : '')
    + (f.legacy ? legacyHtml(f) : formHtml(f, { busy: s.busy }));
}


/* ── 통제기 ─────────────────────────────────────────────────────────────────
 * o = { me(): 로그인 정보 {name, rank, admin, perms}, today(): 오늘 YYYY-MM-DD, rerender(), isGuest,
 *       io: { readDay(siteKey, date) → { stored, att:{checks,md}, active:[근로자 id], newChecks, structure },
 *             save(siteKey, date, doc) → 저장, syncDaily(siteKey, date, doc, label) → 업무일지 연동 결과 },
 *       labelOf(siteKey), now? }
 * 서버 접근은 모두 io 로 주입한다(이 파일은 Firestore 를 부르지 않는다 → 노드에서 시험). */
export function createMobileReport(o) {
  const rerender = o.rerender || (() => {}); const now = o.now || (() => new Date().toISOString());
  const st = { site: '', date: '', form: null, stored: null, exists: false, loading: false, busy: false, error: '', msg: '', seq: 0, structure: null };
  const guard = () => !!o.isGuest;
  const me = () => o.me() || {};
  async function load(site, date) {
    if (!site || !isRealDate(date)) return; st.site = site; st.date = date; st.loading = true; st.error = ''; st.msg = ''; st.form = null; const my = ++st.seq; rerender();
    try {
      const d = await o.io.readDay(site, date);
      if (my !== st.seq) return;                                   // 그 사이 다른 날짜를 골랐으면 늦게 도착한 응답은 버린다(화면을 덮지 않게)
      st.stored = d.stored || null; st.exists = !!d.stored; st.structure = d.structure || null;
      const att = d.att ? attendanceSummary(d.att.checks || [], d.att.md || {}, d.active || null) : { headcount: 0, manday: 0, mandayTotal: 0 };
      st.form = formFor(d.stored, me(), att, d.structure, d.newChecks); st.loading = false;
    } catch (e) { if (my !== st.seq) return; st.loading = false; st.error = (e && (e.code || e.message)) || '알 수 없는 오류'; }
    rerender();
  }
  function html(site) {
    if (guard()) return '<div class="empty">GUEST 계정은 공사일보를 볼 수 없습니다.</div>';
    if (st.site !== site || !st.date) { st.site = site; st.date = o.today(); load(site, st.date); }
    return bodyHtml({ date: st.date, form: st.form, exists: st.exists, loading: st.loading, busy: st.busy, error: st.error, msg: st.msg });
  }
  /** 입력칸의 값을 모델에 반영(화면은 다시 그리지 않는다 — 타이핑 중 키보드가 사라지지 않게). 합계만 제자리에서 갱신 */
  function onInput(field, value, n) {
    if (!st.form || st.form.legacy) return; const f = st.form;
    if (field === 'eqno') f.eqNo = Object.assign({}, f.eqNo, { [n]: String(value) });
    else if (field === 'eqhrs') f.eqHrs = Object.assign({}, f.eqHrs, { [n]: String(value) });
    else if (['ciH', 'ciM', 'coH', 'coM'].indexOf(field) !== -1) {   // 근무시간: 바뀐 칸 하나만 넘기면 나머지(시 또는 분)를 잃어 종료 시간이 지워진다 → 현재 시·분을 함께 넘겨 합친다. 구분 칩 표시가 바뀌므로 다시 그린다
      const isIn = field[0] === 'c' && field[1] === 'i'; const cur = (isIn ? f.checkIn : f.checkOut) || ''; const hm = /^(\d\d):(\d\d)$/.exec(cur); const h = field.endsWith('H') ? value : (hm ? hm[1] : ''); const m = field.endsWith('M') ? value : (hm ? hm[2] : '');
      Object.assign(st.form, applyInputs(f, isIn ? { ciH: h, ciM: m } : { coH: h, coM: m })); rerender(); return; }
    else Object.assign(st.form, applyInputs(f, { [field]: value }));
    if (field === 'headcount' || field === 'manday') { const el = typeof document !== 'undefined' ? document.getElementById('rp-total') : null; if (el) el.textContent = String(st.form.mandayTotal); }
  }
  async function save() {
    if (!st.form || st.form.legacy || st.busy || guard()) return; const d = reportDoc(st.site, st.date); if (!d) { st.msg = '날짜나 프로젝트가 올바르지 않아 저장하지 않았습니다.'; rerender(); return; }
    st.busy = true; st.msg = ''; rerender(); const doc = docToSave(st.form, { dateKey: st.date, site: o.labelOf ? o.labelOf(st.site) : '' }, st.exists, me(), now());
    try {
      await o.io.save(st.site, st.date, doc); st.stored = doc; st.exists = true; st.form = fromStored(doc); st.msg = '저장했습니다.';
      const note = await syncWithNote(doc.content, () => o.io.syncDaily(st.site, st.date, doc, (o.labelOf ? o.labelOf(st.site) : '') + ' 공사일보 (' + dateText(st.date) + ')'));   // 저장하면 전자결재 업무일지도 만든다 — 실패해도 일보 저장은 막지 않고 결과를 화면에 알린다(PC 와 같음)
      if (note) st.msg = '저장했습니다. ' + note;
    } catch (e) { st.msg = '저장 실패: ' + ((e && (e.code || e.message)) || ''); }
    st.busy = false; rerender();
  }
  const shiftTo = (n) => { if (!st.form || st.form.legacy) return; const w = WORK_SHIFTS.find((x) => x.name === n); if (w) { st.form.checkIn = w.from; st.form.checkOut = w.to; rerender(); } };
  const shiftDate = (delta) => { const [y, m, d] = st.date.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + delta)); return t.getUTCFullYear() + '-' + String(t.getUTCMonth() + 1).padStart(2, '0') + '-' + String(t.getUTCDate()).padStart(2, '0'); };
  function click(d) {
    const k = d && d.rp; if (!k) return;
    if (k === 'prev') return load(st.site, shiftDate(-1)); if (k === 'next') return load(st.site, shiftDate(1)); if (k === 'today') return load(st.site, o.today());
    if (k === 'retry') return load(st.site, st.date); if (k === 'save') return save();
    if (k === 'shift') return shiftTo(d.n);
    if (k === 'eq') { if (!st.form || st.form.legacy) return; st.form = toggleEquip(st.form, d.n); rerender(); return; }
    if (k === 'edit') { if (st.form && st.form.legacy) { st.form = Object.assign({}, st.form, { legacy: false, equip: [], eqNo: {}, eqHrs: {} }); rerender(); } }   // 옛 양식 → 새 양식으로 이어서 편집(장비 글자는 칩으로 다시 고른다)
  }
  function attachGlobals(win) {
    win.rpClick = (el) => click({ rp: el.getAttribute('data-rp'), n: el.getAttribute('data-n') });
    win.rpInput = (el) => onInput(el.getAttribute('data-rp-in'), el.value, el.getAttribute('data-n'));
  }
  return { html, click, onInput, attachGlobals, load, state: st, save };
}

export { REPORT_FMT, WORK_SHIFTS, EQUIPS, cleanHrs, shiftOf, fromStored, toStored, isLegacyDoc, authorLabel, withEditor, dateText, attendanceSummary, totalOf, perPersonOf, fmtAt, isDateKey, esc };
