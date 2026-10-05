import { calendarProvidersFor } from '../../core/registry.js?v=20261005c';
import { esc, toast } from '../../core/ui.js?v=20261005c';
import { confirmDialog } from '../../core/dialog.js?v=20261005c';
import { loadHolidays } from '../../shared/workers-data.js?v=20261005c';
import { dateKey, parseMonth, monthKey, shiftMonth, gridRange, groupByDay, mergeResults, visibleEvents, makeEvent, validateDraft, canWrite } from './logic.js?v=20261005c';
import { leaveProvider, companyProvider, createCompanyEvent, updateCompanyEvent, deleteCompanyEvent, setCompanyDone, invalidateCompany } from './data.js?v=20261005c';
import { barHtml, gridHtml, dayHtml, noticeHtml, formHtml, readForm, blankDraft, draftOf } from './view.js?v=20261005c';

/** 일정 모듈 = 플랫폼 기본 모듈. 자기 일정(회사 일정·연차·휴무)을 내놓고, 다른 모듈이 manifest.calendar 로 등록한 일정도 한 달력에 모은다. */
export const manifest = {
  id: 'calendar', order: 70, title: '일정', icon: '📅', defaultHash: '#/calendar/month',
  calendar: [leaveProvider, companyProvider],
  widgets: [{ id: 'month', order: 12, wide: true, mount: mountWidget }]
};

const OFF_KEY = 'jh_cal_off';
const readOff = () => { try { const a = JSON.parse(localStorage.getItem(OFF_KEY) || '[]'); return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []; } catch (e) { return []; } };
const saveOff = (a) => { try { localStorage.setItem(OFF_KEY, JSON.stringify(a)); } catch (e) { /* 저장 못 해도 이번 화면에서는 동작 */ } };
const cache = new Map();   // 달 → { t, merged }  (등록·수정·삭제하면 비움)
const providersOf = (me) => calendarProvidersFor(me);

async function loadMerged(me, y, m, force) {
  const key = monthKey(y, m); const hit = cache.get(key + '|' + (me.isGuest ? 'g' : 'u'));
  if (!force && hit && Date.now() - hit.t < 60000) return hit.merged;
  const range = gridRange(y, m); const ps = providersOf(me);
  const results = await Promise.all(ps.map((p) => Promise.resolve().then(() => p.load(range, { me })).then((events) => ({ id: p.id, events: (events || []).map((e) => (e && e.source ? e : makeEvent(e))) }), (error) => ({ id: p.id, error }))));
  const merged = mergeResults(results); merged.range = range; cache.set(key + '|' + (me.isGuest ? 'g' : 'u'), { t: Date.now(), merged }); return merged;
}
const clearCache = () => { cache.clear(); invalidateCompany(); };

function mkState(me, route, widget) {
  const now = new Date(); const q = route && route.query ? route.query : {}; const pm = parseMonth(widget ? '' : q.ym, now);
  return { y: pm.y, m: pm.m, today: dateKey(now), sel: widget ? dateKey(now) : (/^\d{4}-\d{2}-\d{2}$/.test(q.d || '') ? q.d : (pm.y === now.getFullYear() && pm.m === now.getMonth() + 1 ? dateKey(now) : monthKey(pm.y, pm.m) + '-01')),
    off: readOff(), events: [], failed: [], hidden: [], range: gridRange(pm.y, pm.m), loading: true, seq: 0 };
}
const isHoliday = (key) => !!(window.JH_HOLIDAYS && window.JH_HOLIDAYS[key]);
function byDayOf(S) { return groupByDay(visibleEvents(S.events, S.off), S.range, { isHoliday }); }

/* ───────── 전체 화면 ───────── */
export function mount(root, route, ctx) {
  const me = ctx.me; const S = mkState(me, route, false); root.onclick = null; root.onchange = null; root.oninput = null;
  const providers = providersOf(me);
  const urlSync = () => history.replaceState(history.state, '', '#/calendar/month?ym=' + monthKey(S.y, S.m) + (S.sel ? '&d=' + S.sel : ''));
  const paint = () => {
    const bd = byDayOf(S);
    root.innerHTML = '<div class="jh-cal">' + barHtml(S, providers, false) + '<div data-cal-notice>' + noticeHtml(S, me) + '</div>' +
      '<div class="jh-cal__split"><div data-cal-grid>' + (S.loading ? '<div class="jh-skeleton" style="height:var(--u-320)" aria-busy="true"></div>' : gridHtml(S, bd, false)) + '</div>' +
      '<section class="jh-card jh-form" aria-live="polite" data-cal-day>' + dayHtml(S, bd, me, false) + '</section></div></div>';
  };
  const repaintParts = () => { const bd = byDayOf(S); const g = root.querySelector('[data-cal-grid]'); if (g) g.innerHTML = gridHtml(S, bd, false); const d = root.querySelector('[data-cal-day]'); if (d) d.innerHTML = dayHtml(S, bd, me, false); const n = root.querySelector('[data-cal-notice]'); if (n) n.innerHTML = noticeHtml(S, me); };
  const load = async (force) => {
    const seq = ++S.seq; S.loading = true; paint();
    try { const [mg] = await Promise.all([loadMerged(me, S.y, S.m, force), loadHolidays()]); if (seq !== S.seq) return; S.events = mg.events; S.failed = mg.failed; S.hidden = mg.hidden; S.range = mg.range; }
    catch (e) { if (seq !== S.seq) return; console.error('일정 불러오기', e); S.events = []; S.failed = providers.map((p) => p.id); }
    S.loading = false; paint(); urlSync();
  };
  const goMonth = (y, m) => { S.y = y; S.m = m; S.sel = (y === +S.today.slice(0, 4) && m === +S.today.slice(5, 7)) ? S.today : monthKey(y, m) + '-01'; S.range = gridRange(y, m); load(false); };

  const openForm = (draft, editing) => {
    const wrap = document.createElement('div'); wrap.className = 'jh-dialog'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-labelledby', 'jh-cal-form-title');
    const prevOverflow = document.body.style.overflow; const prevFocus = document.activeElement; let busy = false;
    const close = () => { document.removeEventListener('keydown', onKey, true); wrap.remove(); document.body.style.overflow = prevOverflow; if (prevFocus && prevFocus.focus) prevFocus.focus(); };
    const draw = (d, errs) => { wrap.innerHTML = formHtml(d, errs, !!editing); const t = wrap.querySelector('#cf-title'); if (t && !errs) t.focus(); };
    function onKey(ev) { if (ev.key === 'Escape') { ev.preventDefault(); close(); } }
    draw(draft); document.body.appendChild(wrap); document.body.style.overflow = 'hidden'; document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('change', (ev) => { if (ev.target.id === 'cf-todo') { const tm = wrap.querySelector('#cf-times'); if (tm) tm.hidden = ev.target.checked; } });
    wrap.addEventListener('click', async (ev) => {
      if (ev.target.closest('[data-cancel]')) { close(); return; }
      if (!ev.target.closest('[data-save]') || busy) return;
      const d = readForm(wrap); const errs = validateDraft(d);
      if (Object.keys(errs).length) { draw(d, errs); return; }
      busy = true; const btn = wrap.querySelector('[data-save]'); if (btn) { btn.disabled = true; btn.textContent = '저장 중…'; }
      try { if (editing) await updateCompanyEvent(editing, d, me); else await createCompanyEvent(d, me); clearCache(); close(); S.sel = d.start; toast(editing ? '일정을 고쳤습니다.' : '일정을 등록했습니다.');
        const pm = parseMonth(d.start.slice(0, 7), new Date()); if (pm.y !== S.y || pm.m !== S.m) { S.y = pm.y; S.m = pm.m; S.range = gridRange(pm.y, pm.m); } load(true); }
      catch (e) { console.error('일정 저장', e); busy = false; draw(d, { _save: '저장하지 못했습니다. 권한이 없거나 연결이 불안정합니다. 잠시 후 다시 시도해 주세요.' }); }
    });
  };
  root.addEventListener('click', async (ev) => {
    const t = ev.target;
    const nav = t.closest('[data-cal-nav]'); if (nav) { const n = shiftMonth(S.y, S.m, +nav.getAttribute('data-cal-nav')); goMonth(n.y, n.m); return; }
    if (t.closest('[data-cal-today]')) { const n = new Date(); S.y = n.getFullYear(); S.m = n.getMonth() + 1; S.sel = dateKey(n); S.range = gridRange(S.y, S.m); load(false); return; }
    const pv = t.closest('[data-prov]'); if (pv) { const id = pv.getAttribute('data-prov'); S.off = S.off.indexOf(id) === -1 ? S.off.concat(id) : S.off.filter((x) => x !== id); saveOff(S.off); const bar = root.querySelector('.jh-cal__bar'); if (bar) bar.outerHTML = barHtml(S, providers, false); repaintParts(); return; }
    const dy = t.closest('[data-day]'); if (dy) { S.sel = dy.getAttribute('data-day'); const inMonth = !dy.hasAttribute('data-out'); if (!inMonth) { const p = S.sel.split('-'); goMonth(+p[0], +p[1]); S.sel = dy.getAttribute('data-day'); return; } repaintParts(); urlSync(); return; }
    if (t.closest('[data-new]')) { if (canWrite(me)) openForm(blankDraft(S.sel), null); return; }
    const ed = t.closest('[data-edit]'); if (ed) { const e = S.events.find((x) => x.source === 'company' && x.ref === ed.getAttribute('data-edit')); if (e) openForm(draftOf(e), e.ref); return; }
    const dl = t.closest('[data-del]'); if (dl) {
      const e = S.events.find((x) => x.source === 'company' && x.ref === dl.getAttribute('data-del')); if (!e) return;
      const r = await confirmDialog({ title: '일정 삭제', body: '"' + e.title + '" 일정을 삭제할까요? 되돌릴 수 없습니다.', confirmLabel: '삭제', variant: 'danger' }); if (!r.ok) return;
      try { await deleteCompanyEvent(e.ref); clearCache(); toast('일정을 삭제했습니다.'); load(true); } catch (err) { console.error(err); toast('삭제하지 못했습니다.'); }
    }
  });
  root.addEventListener('change', async (ev) => {
    const c = ev.target.closest('[data-done]'); if (!c || !canWrite(me)) return; const ref = c.getAttribute('data-done');
    try { await setCompanyDone(ref, c.checked); const e = S.events.find((x) => x.ref === ref); if (e) e.done = c.checked; clearCache(); repaintParts(); } catch (err) { console.error(err); c.checked = !c.checked; toast('완료 표시를 저장하지 못했습니다.'); }
  });
  load(false);
}

/* ───────── 플랫폼 홈 위젯(작은 월 달력) ───────── */
async function mountWidget(slot, ctx) {
  const me = ctx.me; const S = mkState(me, null, true); const providers = providersOf(me);
  const paint = () => {
    const bd = byDayOf(S);
    slot.innerHTML = '<section class="jh-panel jh-card" aria-label="일정"><div class="jh-form"><div class="jh-cal">' + barHtml(S, providers, true).replace('</div></div>', '</div><a class="jh-link" href="#/calendar/month?ym=' + monthKey(S.y, S.m) + '">전체 보기 ›</a></div>') +
      '<div data-cal-notice>' + noticeHtml(S, me) + '</div>' + (S.loading ? '<div class="jh-skeleton" style="height:var(--u-220)" aria-busy="true"></div>' : gridHtml(S, bd, true)) + '<div data-cal-day>' + (S.loading ? '' : dayHtml(S, bd, me, true)) + '</div></div></div></section>';
  };
  const load = async () => {
    const seq = ++S.seq; S.loading = true; paint();
    try { const [mg] = await Promise.all([loadMerged(me, S.y, S.m, false), loadHolidays()]); if (seq !== S.seq) return; S.events = mg.events; S.failed = mg.failed; S.hidden = mg.hidden; S.range = mg.range; }
    catch (e) { if (seq !== S.seq) return; S.events = []; S.failed = providers.map((p) => p.id); }
    S.loading = false; paint();
  };
  slot.addEventListener('click', (ev) => {
    const t = ev.target; const nav = t.closest('[data-cal-nav]'); if (nav) { const n = shiftMonth(S.y, S.m, +nav.getAttribute('data-cal-nav')); S.y = n.y; S.m = n.m; S.sel = monthKey(n.y, n.m) + '-01'; S.range = gridRange(n.y, n.m); load(); return; }
    if (t.closest('[data-cal-today]')) { const n = new Date(); S.y = n.getFullYear(); S.m = n.getMonth() + 1; S.sel = dateKey(n); S.range = gridRange(S.y, S.m); load(); return; }
    const dy = t.closest('[data-day]'); if (dy) { S.sel = dy.getAttribute('data-day'); const p = S.sel.split('-'); if (+p[1] !== S.m || +p[0] !== S.y) { S.y = +p[0]; S.m = +p[1]; S.range = gridRange(S.y, S.m); load(); } else paint(); }
  });
  await load();
}
