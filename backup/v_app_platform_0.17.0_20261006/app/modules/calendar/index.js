import { calendarProvidersFor } from '../../core/registry.js?v=20261006f';
import { toast } from '../../core/ui.js?v=20261006f';
import { confirmDialog } from '../../core/dialog.js?v=20261006f';
import { loadHolidays } from '../../shared/workers-data.js?v=20261006f';
import { dateKey, parseMonth, monthKey, shiftMonth, gridRange, groupByDay, mergeResults, visibleEvents, makeEvent, canWrite, isView, defaultView, viewRange, shiftAnchor, listDates, rangeTitle, AGENDA_DAYS } from './logic.js?v=20261006f';
import { leaveProvider, companyProvider, deleteCompanyEvent, setCompanyDone, invalidateCompany } from './data.js?v=20261006f';
import { gridHtml, dayHtml, noticeHtml, widgetFrameHtml, fullFrameHtml, agendaHtml, blankDraft, draftOf } from './view.js?v=20261006f';
import { openEventForm } from './form.js?v=20261006f';

/** 일정 모듈 = 플랫폼 기본 모듈. 자기 일정(회사 일정·연차·휴무)을 내놓고, 다른 모듈이 manifest.calendar 로 등록한 일정도 한 달력에 모은다.
 *  사이드바에는 두지 않는다(nav:false) — 홈의 일정 위젯과 그 안의 보기 방식(안건·하루·3일·월)으로 쓴다. */
export const manifest = {
  id: 'calendar', order: 70, nav: false, title: '일정', icon: '📅', defaultHash: '#/calendar/month',
  calendar: [leaveProvider, companyProvider],
  widgets: [{ id: 'month', order: 90, mobileOrder: 3, wide: true, reserve: 'huge', mount: mountWidget }]
};

const OFF_KEY = 'jh_cal_off'; const VIEW_KEY = 'jh_cal_view';
const readOff = () => { try { const a = JSON.parse(localStorage.getItem(OFF_KEY) || '[]'); return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []; } catch (e) { return []; } };
const saveOff = (a) => { try { localStorage.setItem(OFF_KEY, JSON.stringify(a)); } catch (e) { /* 저장 못 해도 이번 화면에서는 동작 */ } };
const readView = () => { try { return localStorage.getItem(VIEW_KEY) || ''; } catch (e) { return ''; } };
const saveView = (v) => { try { localStorage.setItem(VIEW_KEY, v); } catch (e) { /* 저장 못 해도 이번 화면에서는 동작 */ } };
const isPhone = () => !!(window.matchMedia && window.matchMedia('(max-width: 899px)').matches);
const cache = new Map();   // 날짜 범위 → { t, merged }  (등록·수정·삭제·완료하면 비움)
const providersOf = (me) => calendarProvidersFor(me);
const isHoliday = (key) => !!(window.JH_HOLIDAYS && window.JH_HOLIDAYS[key]);
const clearCache = () => { cache.clear(); invalidateCompany(); };
const ckey = (me, range) => range.from + '|' + range.to + '|' + (me.isGuest ? 'g' : 'u');

/** 어떤 날짜 범위든 제공자 전부에서 불러와 합친다(월 달력·안건·하루·3일이 같은 함수를 쓴다). 60초 캐시 */
async function loadRange(me, range, force) {
  const hit = cache.get(ckey(me, range));
  if (!force && hit && Date.now() - hit.t < 60000) return hit.merged;
  const ps = providersOf(me);
  const results = await Promise.all(ps.map((p) => Promise.resolve().then(() => p.load(range, { me })).then((events) => ({ id: p.id, events: (events || []).map((e) => (e && e.source ? e : makeEvent(e))) }), (error) => ({ id: p.id, error }))));
  const merged = mergeResults(results); merged.range = range; cache.set(ckey(me, range), { t: Date.now(), merged }); return merged;
}

/** 달력 제어기 — 전체 화면과 홈 위젯(widget=true)이 같은 코드·같은 모양을 쓴다. 위젯은 월 보기가 6주 고정·URL 주소 갱신 없음이 다를 뿐이다.
 *  화면이 흔들리지 않도록: 틀은 한 번만 그리고, 이동·보기 전환·날짜 선택·불러오기에서는 본문만 제자리에서 바꾼다. */
function createCalendar(el, me, widget, route) {
  const now = new Date(); const q = (route && route.query) || {}; const today = dateKey(now);
  const asked = isView(q.v) ? q.v : (q.ym && !q.v ? 'month' : '');   // 주소에 보기가 있으면 그것, 월(ym)만 있으면 월 보기(옛 링크), 없으면 저장된 선택 → 기기별 기본
  const view = widget ? defaultView(isPhone(), readView()) : (asked || defaultView(isPhone(), readView()));
  const pm = parseMonth(widget ? '' : q.ym, now); const weeks = widget ? 6 : 0;
  const S = { view, y: pm.y, m: pm.m, today, off: readOff(), events: [], failed: [], hidden: [], loading: true, seq: 0, weeks, extra: 0, limit: widget ? 5 : Infinity, title: '', sel: '', anchor: '', range: null };
  S.sel = widget ? today : (/^\d{4}-\d{2}-\d{2}$/.test(q.d || '') ? q.d : (pm.y === now.getFullYear() && pm.m === now.getMonth() + 1 ? today : monthKey(pm.y, pm.m) + '-01'));
  S.anchor = S.view === 'agenda' && !(q.d && !widget) ? today : S.sel;
  const providers = providersOf(me);
  const rangeOf = () => (S.view === 'month' ? gridRange(S.y, S.m, weeks) : viewRange(S.view, S.anchor, S.extra));
  S.range = rangeOf(); S.title = S.view === 'month' ? S.y + '년 ' + S.m + '월' : rangeTitle(S.view, S.range);
  el.onclick = null; el.onchange = null; el.oninput = null;
  el.innerHTML = widget ? widgetFrameHtml(S, providers, me) : fullFrameHtml(S, providers, me);
  const $ = (s) => el.querySelector(s); const root = $('.jh-cal'); const grid = $('[data-cal-grid]'); const dayEl = $('[data-cal-day]'); const noteEl = $('[data-cal-notice]'); const titleEl = $('[data-cal-title]'); const filter = $('[data-cal-filter]');
  if (filter) filter.open = !isPhone();   // 폰에서는 접어 둔다(화면을 덜 차지하고 칩이 잘리지 않게), PC는 펼침
  let bd = {};
  const reserve = () => { if (widget) el.setAttribute('data-reserve', S.view === 'month' ? 'huge' : 'medium'); };   // 월 보기만 높은 자리를 미리 잡는다
  const recompute = () => { bd = groupByDay(visibleEvents(S.events, S.off), S.range, { isHoliday }); };
  const paintTitle = () => { S.title = S.view === 'month' ? S.y + '년 ' + S.m + '월' : rangeTitle(S.view, S.range); titleEl.textContent = S.title; };
  const paintViews = () => { root.setAttribute('data-view', S.view); el.querySelectorAll('[data-view]').forEach((b) => { if (b.classList.contains('jh-segmented__item')) b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === S.view)); }); reserve(); };
  const paintFilterN = () => { const n = $('[data-cal-filter-n]'); if (n) n.textContent = providers.filter((p) => S.off.indexOf(p.id) === -1).length + '/' + providers.length; };
  const paintBody = () => {
    if (S.view === 'month') { grid.innerHTML = gridHtml(S, bd); dayEl.innerHTML = S.loading ? '' : dayHtml(S, bd, me); }
    else { const dates = listDates(S.view, bd, S.range, S.today); grid.innerHTML = agendaHtml(S, bd, me, dates, S.view === 'agenda' && !S.loading, S.limit); dayEl.innerHTML = ''; }
    grid.setAttribute('aria-busy', S.loading ? 'true' : 'false');
  };
  const paintNote = () => { noteEl.innerHTML = noticeHtml(S, me); };
  const urlSync = () => { if (widget) return; const p = S.view === 'month' ? 'ym=' + monthKey(S.y, S.m) + '&d=' + S.sel : 'd=' + S.anchor; history.replaceState(history.state, '', '#/calendar/month?v=' + S.view + '&' + p); };
  const paintAll = () => { recompute(); paintViews(); paintTitle(); paintBody(); paintNote(); paintFilterN(); };
  const selectDay = (key) => {   // 월 보기에서 날짜를 누를 때는 달력을 다시 그리지 않고 선택 표시만 옮긴다(깜박임·스크롤 튐 없음)
    S.sel = key; const old = grid.querySelector('[aria-current="date"]'); if (old) old.removeAttribute('aria-current');
    const nw = grid.querySelector('[data-day="' + key + '"]'); if (nw) nw.setAttribute('aria-current', 'date'); dayEl.innerHTML = dayHtml(S, bd, me); urlSync();
  };
  const load = async (force) => {
    const seq = ++S.seq; S.range = rangeOf(); const hit = !force && cache.get(ckey(me, S.range));
    S.loading = !(hit && Date.now() - hit.t < 60000); S.events = S.loading ? [] : hit.merged.events; paintAll();   // 불러오는 동안에도 같은 모양(날짜만)
    if (!S.loading) { S.failed = hit.merged.failed; S.hidden = hit.merged.hidden; paintNote(); urlSync(); return; }
    try { const [mg] = await Promise.all([loadRange(me, S.range, force), loadHolidays()]); if (seq !== S.seq) return; S.events = mg.events; S.failed = mg.failed; S.hidden = mg.hidden; }
    catch (e) { if (seq !== S.seq) return; console.error('일정 불러오기', e); S.events = []; S.failed = providers.map((p) => p.id); }
    S.loading = false; paintAll(); urlSync();
  };
  const goMonth = (y, m, sel) => { S.y = y; S.m = m; S.sel = sel || ((y === +today.slice(0, 4) && m === +today.slice(5, 7)) ? today : monthKey(y, m) + '-01'); load(false); };
  const afterSaved = (d) => { clearCache(); S.sel = d.start; const p = parseMonth(d.start.slice(0, 7), new Date()); S.y = p.y; S.m = p.m; if (S.view !== 'month') { S.anchor = d.start; S.extra = 0; } load(true); };
  const setView = (v) => {
    if (!isView(v) || v === S.view) return; const prev = S.view; S.view = v; saveView(v); S.extra = 0; S.limit = widget ? 5 : Infinity;
    if (v === 'month') { const base = prev === 'month' ? S.sel : S.anchor; const p = parseMonth(base.slice(0, 7), now); S.y = p.y; S.m = p.m; S.sel = base; }
    else { S.anchor = prev === 'month' ? S.sel : S.anchor; if (v === 'agenda' && prev === 'month' && S.sel.slice(0, 7) === today.slice(0, 7) && S.sel <= today) S.anchor = today; }
    load(false);
  };

  // 처리기는 addEventListener 가 아니라 el.onclick/onchange 로 붙인다: 전체 화면은 지속되는 본문 요소(#jh-main)에 그려지는데,
  // addEventListener 는 다른 화면으로 가도 남아 홈 위젯의 같은 버튼을 두 번 처리했다(등록 창이 두 개). 속성 처리기는 다음 화면이 el.onclick = null 로 지운다.
  el.onclick = async (ev) => {
    const t = ev.target;
    const vb = t.closest('.jh-segmented__item[data-view]'); if (vb) { setView(vb.getAttribute('data-view')); return; }
    const nav = t.closest('[data-cal-nav]'); if (nav) { const d = +nav.getAttribute('data-cal-nav'); if (S.view === 'month') { const n = shiftMonth(S.y, S.m, d); goMonth(n.y, n.m); } else { S.anchor = shiftAnchor(S.view, S.anchor, d); S.extra = 0; load(false); } return; }
    if (t.closest('[data-cal-today]')) { if (S.view === 'month') { const n = new Date(); goMonth(n.getFullYear(), n.getMonth() + 1, dateKey(n)); } else { S.anchor = today; S.extra = 0; load(false); } return; }
    const mb = t.closest('[data-more]'); if (mb) { if (+mb.getAttribute('data-hidden') > 0) { S.limit += 5; paintBody(); } else { S.extra += AGENDA_DAYS; load(false); } return; }   // 가려 둔 줄이 있으면 먼저 펼치고, 다 보였으면 14일 더 불러옴
    const pv = t.closest('[data-prov]'); if (pv) { const id = pv.getAttribute('data-prov'); S.off = S.off.indexOf(id) === -1 ? S.off.concat(id) : S.off.filter((x) => x !== id); saveOff(S.off); pv.setAttribute('aria-pressed', String(S.off.indexOf(id) === -1)); recompute(); paintBody(); paintFilterN(); return; }
    const dy = t.closest('[data-day]'); if (dy) { const key = dy.getAttribute('data-day'); if (dy.hasAttribute('data-out')) { const p = key.split('-'); goMonth(+p[0], +p[1], key); } else selectDay(key); return; }
    if (t.closest('[data-new]')) { if (canWrite(me)) openEventForm({ me, draft: blankDraft(S.view === 'month' ? S.sel : (S.anchor || today)), editing: null, onSaved: afterSaved }); return; }
    const ed = t.closest('[data-edit]'); if (ed) { const e = S.events.find((x) => x.source === 'company' && x.ref === ed.getAttribute('data-edit')); if (e) openEventForm({ me, draft: draftOf(e), editing: e.ref, onSaved: afterSaved }); return; }
    const dl = t.closest('[data-del]'); if (dl) {
      const e = S.events.find((x) => x.source === 'company' && x.ref === dl.getAttribute('data-del')); if (!e) return;
      const r = await confirmDialog({ title: '일정 삭제', body: '"' + e.title + '" 일정을 삭제할까요? 되돌릴 수 없습니다.', confirmLabel: '삭제', variant: 'danger' }); if (!r.ok) return;
      try { await deleteCompanyEvent(e.ref); clearCache(); toast('일정을 삭제했습니다.'); load(true); } catch (err) { console.error(err); toast('삭제하지 못했습니다.'); }
    }
  };
  el.onchange = async (ev) => {
    const c = ev.target.closest('[data-done]'); if (!c || !canWrite(me)) return; const ref = c.getAttribute('data-done');
    try { await setCompanyDone(ref, c.checked); const e = S.events.find((x) => x.ref === ref); if (e) e.done = c.checked; clearCache(); recompute(); paintBody(); }
    catch (err) { console.error(err); c.checked = !c.checked; toast('완료 표시를 저장하지 못했습니다.'); }
  };
  return load(false);
}

/* 전체 화면 */
export function mount(root, route, ctx) { root.className = 'jh-main'; return createCalendar(root, ctx.me, false, route); }
/* 플랫폼 홈 위젯 */
async function mountWidget(slot, ctx) { return createCalendar(slot, ctx.me, true, null); }
