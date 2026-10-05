import { calendarProvidersFor } from '../../core/registry.js?v=20261005f';
import { toast } from '../../core/ui.js?v=20261005f';
import { confirmDialog } from '../../core/dialog.js?v=20261005f';
import { loadHolidays } from '../../shared/workers-data.js?v=20261005f';
import { dateKey, parseMonth, monthKey, shiftMonth, gridRange, groupByDay, mergeResults, visibleEvents, makeEvent, canWrite } from './logic.js?v=20261005f';
import { leaveProvider, companyProvider, deleteCompanyEvent, setCompanyDone, invalidateCompany } from './data.js?v=20261005f';
import { gridHtml, dayHtml, noticeHtml, widgetFrameHtml, fullFrameHtml, blankDraft, draftOf } from './view.js?v=20261005f';
import { openEventForm } from './form.js?v=20261005f';

/** 일정 모듈 = 플랫폼 기본 모듈. 자기 일정(회사 일정·연차·휴무)을 내놓고, 다른 모듈이 manifest.calendar 로 등록한 일정도 한 달력에 모은다.
 *  사이드바에는 두지 않는다(nav:false) — 홈 맨 아래의 달력과 그 "전체 보기"로 쓴다. */
export const manifest = {
  id: 'calendar', order: 70, nav: false, title: '일정', icon: '📅', defaultHash: '#/calendar/month',
  calendar: [leaveProvider, companyProvider],
  widgets: [{ id: 'month', order: 90, mobileOrder: 2, wide: true, reserve: 'huge', mount: mountWidget }]
};

const OFF_KEY = 'jh_cal_off';
const readOff = () => { try { const a = JSON.parse(localStorage.getItem(OFF_KEY) || '[]'); return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []; } catch (e) { return []; } };
const saveOff = (a) => { try { localStorage.setItem(OFF_KEY, JSON.stringify(a)); } catch (e) { /* 저장 못 해도 이번 화면에서는 동작 */ } };
const cache = new Map();   // 달 → { t, merged }  (등록·수정·삭제·완료하면 비움)
const providersOf = (me) => calendarProvidersFor(me);
const isHoliday = (key) => !!(window.JH_HOLIDAYS && window.JH_HOLIDAYS[key]);
const clearCache = () => { cache.clear(); invalidateCompany(); };
const ckey = (me, y, m, weeks) => monthKey(y, m) + '|' + weeks + '|' + (me.isGuest ? 'g' : 'u');

async function loadMerged(me, y, m, weeks, force) {
  const hit = cache.get(ckey(me, y, m, weeks));
  if (!force && hit && Date.now() - hit.t < 60000) return hit.merged;
  const range = gridRange(y, m, weeks); const ps = providersOf(me);
  const results = await Promise.all(ps.map((p) => Promise.resolve().then(() => p.load(range, { me })).then((events) => ({ id: p.id, events: (events || []).map((e) => (e && e.source ? e : makeEvent(e))) }), (error) => ({ id: p.id, error }))));
  const merged = mergeResults(results); merged.range = range; cache.set(ckey(me, y, m, weeks), { t: Date.now(), merged }); return merged;
}

/** 달력 제어기 — 전체 화면과 홈 위젯(widget=true)이 같은 코드·같은 모양을 쓴다. 위젯은 6주 고정·URL 주소 갱신 없음이 다를 뿐이다.
 *  화면이 흔들리지 않도록: 틀은 한 번만 그리고, 달 이동·날짜 선택·불러오기에서는 달력/날짜 목록만 제자리에서 바꾼다.
 *  불러오는 동안에도 같은 크기의 달력(날짜만)을 보여 주고(aria-busy), 위젯은 6주 고정이라 달이 바뀌어도 높이가 같다. */
function createCalendar(el, me, widget, route) {
  const now = new Date(); const q = (route && route.query) || {}; const pm = parseMonth(widget ? '' : q.ym, now); const weeks = widget ? 6 : 0;
  const S = { y: pm.y, m: pm.m, today: dateKey(now), off: readOff(), events: [], failed: [], hidden: [], loading: true, seq: 0, weeks, range: gridRange(pm.y, pm.m, weeks), sel: '' };
  S.sel = widget ? S.today : (/^\d{4}-\d{2}-\d{2}$/.test(q.d || '') ? q.d : (pm.y === now.getFullYear() && pm.m === now.getMonth() + 1 ? S.today : monthKey(pm.y, pm.m) + '-01'));
  const providers = providersOf(me);
  el.onclick = null; el.onchange = null; el.oninput = null;
  el.innerHTML = widget ? widgetFrameHtml(S, providers) : fullFrameHtml(S, providers);
  const $ = (s) => el.querySelector(s); const grid = $('[data-cal-grid]'); const dayEl = $('[data-cal-day]'); const noteEl = $('[data-cal-notice]'); const titleEl = $('[data-cal-title]');
  let bd = {};
  const recompute = () => { bd = groupByDay(visibleEvents(S.events, S.off), S.range, { isHoliday }); };
  const paintTitle = () => { titleEl.textContent = S.y + '년 ' + S.m + '월'; };
  const paintGrid = () => { grid.innerHTML = gridHtml(S, bd); grid.setAttribute('aria-busy', S.loading ? 'true' : 'false'); };
  const paintDay = () => { dayEl.innerHTML = S.loading ? '' : dayHtml(S, bd, me); };
  const paintNote = () => { noteEl.innerHTML = noticeHtml(S, me); };
  const urlSync = () => { if (!widget) history.replaceState(history.state, '', '#/calendar/month?ym=' + monthKey(S.y, S.m) + (S.sel ? '&d=' + S.sel : '')); };
  const paintAll = () => { recompute(); paintTitle(); paintGrid(); paintDay(); paintNote(); };
  const selectDay = (key) => {   // 날짜를 누를 때는 달력을 다시 그리지 않고 선택 표시만 옮긴다(깜박임·스크롤 튐 없음)
    S.sel = key; const old = grid.querySelector('[aria-current="date"]'); if (old) old.removeAttribute('aria-current');
    const nw = grid.querySelector('[data-day="' + key + '"]'); if (nw) nw.setAttribute('aria-current', 'date'); paintDay(); urlSync();
  };
  const load = async (force) => {
    const seq = ++S.seq; S.range = gridRange(S.y, S.m, weeks); const hit = !force && cache.get(ckey(me, S.y, S.m, weeks));
    S.loading = !(hit && Date.now() - hit.t < 60000); S.events = S.loading ? [] : hit.merged.events; recompute(); paintTitle(); paintGrid(); paintDay();   // 불러오는 동안에도 같은 크기의 달력(날짜만)
    if (!S.loading) { S.failed = hit.merged.failed; S.hidden = hit.merged.hidden; paintNote(); urlSync(); return; }
    try { const [mg] = await Promise.all([loadMerged(me, S.y, S.m, weeks, force), loadHolidays()]); if (seq !== S.seq) return; S.events = mg.events; S.failed = mg.failed; S.hidden = mg.hidden; S.range = mg.range; }
    catch (e) { if (seq !== S.seq) return; console.error('일정 불러오기', e); S.events = []; S.failed = providers.map((p) => p.id); }
    S.loading = false; paintAll(); urlSync();
  };
  const goMonth = (y, m, sel) => { S.y = y; S.m = m; S.sel = sel || ((y === +S.today.slice(0, 4) && m === +S.today.slice(5, 7)) ? S.today : monthKey(y, m) + '-01'); load(false); };
  const afterSaved = (d) => { clearCache(); S.sel = d.start; const p = parseMonth(d.start.slice(0, 7), new Date()); S.y = p.y; S.m = p.m; load(true); };

  // 처리기는 addEventListener 가 아니라 el.onclick/onchange 로 붙인다: 전체 화면은 지속되는 본문 요소(#jh-main)에 그려지는데,
  // addEventListener 는 다른 화면으로 가도 남아 홈 위젯의 같은 버튼을 두 번 처리했다(등록 창이 두 개). 속성 처리기는 다음 화면이 el.onclick = null 로 지운다.
  el.onclick = async (ev) => {
    const t = ev.target;
    const nav = t.closest('[data-cal-nav]'); if (nav) { const n = shiftMonth(S.y, S.m, +nav.getAttribute('data-cal-nav')); goMonth(n.y, n.m); return; }
    if (t.closest('[data-cal-today]')) { const n = new Date(); goMonth(n.getFullYear(), n.getMonth() + 1, dateKey(n)); return; }
    const pv = t.closest('[data-prov]'); if (pv) { const id = pv.getAttribute('data-prov'); S.off = S.off.indexOf(id) === -1 ? S.off.concat(id) : S.off.filter((x) => x !== id); saveOff(S.off); pv.setAttribute('aria-pressed', String(S.off.indexOf(id) === -1)); recompute(); paintGrid(); paintDay(); return; }
    const dy = t.closest('[data-day]'); if (dy) { const key = dy.getAttribute('data-day'); if (dy.hasAttribute('data-out')) { const p = key.split('-'); goMonth(+p[0], +p[1], key); } else selectDay(key); return; }
    if (t.closest('[data-new]')) { if (canWrite(me)) openEventForm({ me, draft: blankDraft(S.sel), editing: null, onSaved: afterSaved }); return; }
    const ed = t.closest('[data-edit]'); if (ed) { const e = S.events.find((x) => x.source === 'company' && x.ref === ed.getAttribute('data-edit')); if (e) openEventForm({ me, draft: draftOf(e), editing: e.ref, onSaved: afterSaved }); return; }
    const dl = t.closest('[data-del]'); if (dl) {
      const e = S.events.find((x) => x.source === 'company' && x.ref === dl.getAttribute('data-del')); if (!e) return;
      const r = await confirmDialog({ title: '일정 삭제', body: '"' + e.title + '" 일정을 삭제할까요? 되돌릴 수 없습니다.', confirmLabel: '삭제', variant: 'danger' }); if (!r.ok) return;
      try { await deleteCompanyEvent(e.ref); clearCache(); toast('일정을 삭제했습니다.'); load(true); } catch (err) { console.error(err); toast('삭제하지 못했습니다.'); }
    }
  };
  el.onchange = async (ev) => {
    const c = ev.target.closest('[data-done]'); if (!c || !canWrite(me)) return; const ref = c.getAttribute('data-done');
    try { await setCompanyDone(ref, c.checked); const e = S.events.find((x) => x.ref === ref); if (e) e.done = c.checked; clearCache(); recompute(); paintGrid(); paintDay(); }
    catch (err) { console.error(err); c.checked = !c.checked; toast('완료 표시를 저장하지 못했습니다.'); }
  };
  return load(false);
}

/* 전체 화면 */
export function mount(root, route, ctx) { root.className = 'jh-main'; return createCalendar(root, ctx.me, false, route); }
/* 플랫폼 홈 위젯(작은 월 달력) */
async function mountWidget(slot, ctx) { return createCalendar(slot, ctx.me, true, null); }
