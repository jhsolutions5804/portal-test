/* 영업기획·재무회계 일정 보드 — 저장·이벤트 연결. 화면은 schedule-view.js, 규칙은 schedule-logic.js. 보안 규칙: 관리자만, 자동 일정은 서버만.
 * 일정은 저장되면 서버 함수가 Outlook 공유 사서함으로 보낸다(포털 → Outlook 한 방향) — 이 파일은 Outlook 을 직접 부르지 않는다. */
import { db, collection, getDocs, query, where, addDoc, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp } from '../core/firebase.js?v=20261031i';
import { toast } from '../core/ui.js?v=20261031i';
import { confirmDialog } from '../core/dialog.js?v=20261031i';
import { pagerAction, pagerApply } from './pager.js?v=20261031i';
import { addDays } from './calendar-event.js?v=20261031i';
import { monthRange, shiftMonth, buildScheduleDoc, buildSeries, canEditDoc, seriesTargets } from './schedule-logic.js?v=20261031i';
import { kstToday, newState, emptyForm, boardHtml } from './schedule-view.js?v=20261031i';
export { SCHEDULE_CONFIG } from './schedule-logic.js?v=20261031i';

const friendly = (e) => (e && e.code === 'permission-denied') ? '이 일정은 관리자만 볼 수 있습니다.' : '일정을 불러오지 못했습니다: ' + ((e && e.message) || e);
/** 마운트 — root 에 그리고 이벤트를 연결한다. cfg = SCHEDULE_CONFIG.plan | .finance */
export async function mountScheduleBoard(root, route, ctx, cfg) {
  root.onclick = null; root.onchange = null; root.oninput = null;
  const st = newState(cfg, ctx && ctx.me, kstToday()); root.innerHTML = '<div id="sch-body"></div>'; const body = root.querySelector('#sch-body');
  const paint = () => { body.innerHTML = boardHtml(st); };
  const load = async () => {
    const r = monthRange(st.ym); st.err = '';
    try { const s = await getDocs(query(collection(db, cfg.col), where('sdate', '>=', addDays(r.from, -45)), where('sdate', '<=', r.to))); const rows = []; s.forEach((d) => rows.push({ id: d.id, d: d.data() })); st.rows = rows; }   // 앞 달에서 시작한 여러 날 일정까지
    catch (e) { st.err = friendly(e); st.rows = []; }
    st.loaded = true; paint();
  };
  const find = (id) => st.rows.find((x) => x.id === id);
  const save = async () => {
    if (st.busy) return; const f = st.form; if (!f) return; st.busy = true; paint();
    try {
      if (f.id) {
        const cur = find(f.id); const r = buildScheduleDoc(f, cfg, st.me); if (r.error) { toast(r.error); return; }
        const d = r.doc; await updateDoc(doc(db, cfg.col, f.id), { text: d.text, sdate: d.sdate, edate: d.edate, stime: d.stime, etime: d.etime, tag: d.tag, tagLabel: d.tagLabel, place: d.place, memo: d.memo, isTodo: d.isTodo, done: d.isTodo ? !!(cur && cur.d.done) : false, savedAt: serverTimestamp() });
      } else {
        const recurId = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); const r = buildSeries(f, cfg, st.me, f.recur, recurId); if (r.error) { toast(r.error); return; }
        if (r.docs.length === 1) await addDoc(collection(db, cfg.col), Object.assign({}, r.docs[0].doc, { savedAt: serverTimestamp() }));
        else { const b = writeBatch(db); r.docs.forEach((x) => b.set(doc(db, cfg.col, x.id), Object.assign({}, x.doc, { savedAt: serverTimestamp() }))); await b.commit(); }
        toast(r.docs.length > 1 ? r.docs.length + '건을 만들었습니다.' : '추가했습니다.');
      }
      st.form = null; await load();
    } catch (e) { toast('저장하지 못했습니다: ' + ((e && e.message) || e)); }
    finally { st.busy = false; paint(); }
  };
  const remove = async (ids, label) => {
    const ok = await confirmDialog({ title: '일정 삭제', body: label, confirmLabel: '삭제' }); if (!ok || !ok.ok) return;
    try { if (ids.length === 1) await deleteDoc(doc(db, cfg.col, ids[0])); else { for (let i = 0; i < ids.length; i += 400) { const b = writeBatch(db); ids.slice(i, i + 400).forEach((id) => b.delete(doc(db, cfg.col, id))); await b.commit(); } } toast(ids.length + '건을 삭제했습니다.'); await load(); }
    catch (e) { toast('삭제하지 못했습니다: ' + ((e && e.message) || e)); }
  };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    { const pa = pagerAction(ev); if (pa) { if (pagerApply(st.pg, pa)) paint(); return; } }
    const mo = t.closest('[data-sch-month]'); if (mo) { const v = mo.getAttribute('data-sch-month'); st.ym = v === 'today' ? kstToday().slice(0, 7) : shiftMonth(st.ym, Number(v)); st.loaded = false; paint(); await load(); return; }
    const vw = t.closest('[data-sch-view]'); if (vw) { st.view = vw.getAttribute('data-sch-view'); paint(); return; }
    if (t.closest('[data-sch-add]')) { st.form = emptyForm(cfg, st.ym === st.today.slice(0, 7) ? st.today : monthRange(st.ym).from); paint(); return; }
    const dy = t.closest('[data-sch-day]'); if (dy) { st.form = emptyForm(cfg, dy.getAttribute('data-sch-day')); paint(); return; }
    const ed = t.closest('[data-sch-edit]'); if (ed) { const x = find(ed.getAttribute('data-sch-edit')); if (x && canEditDoc(x.d)) { st.form = { id: x.id, text: x.d.text || '', sdate: x.d.sdate || '', edate: x.d.edate && x.d.edate !== x.d.sdate ? x.d.edate : '', stime: x.d.stime || '', etime: x.d.etime || '', tag: x.d.tag || cfg.defaultTag, place: x.d.place || '', memo: x.d.memo || '', isTodo: x.d.isTodo === true, recur: 'none' }; paint(); } return; }
    const dl = t.closest('[data-sch-del]'); if (dl) { const x = find(dl.getAttribute('data-sch-del')); if (x && canEditDoc(x.d)) await remove([x.id], '"' + x.d.text + '" 일정을 삭제할까요?' + (x.d.recurId ? ' (반복 일정 중 이 날짜 하나만 삭제됩니다.)' : '')); return; }
    const df = t.closest('[data-sch-delfuture]'); if (df) { const x = find(df.getAttribute('data-sch-delfuture')); if (x && x.d.recurId) { const all = []; try { const s = await getDocs(query(collection(db, cfg.col), where('recurId', '==', x.d.recurId))); s.forEach((d) => all.push({ id: d.id, d: d.data() })); } catch (e) { toast('반복 일정을 찾지 못했습니다.'); return; } const ids = seriesTargets(all, x.d.recurId, 'future', x.d.sdate); await remove(ids, '"' + x.d.text + '" 반복 일정을 ' + x.d.sdate + ' 부터 ' + ids.length + '건 모두 삭제할까요?'); } return; }
    if (t.closest('[data-sch-save]')) { await save(); return; }
    if (t.closest('[data-sch-cancel]')) { st.form = null; paint(); return; }
  };
  root.onchange = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    { const pa = pagerAction(ev); if (pa) { if (pagerApply(st.pg, pa)) paint(); return; } }
    if (t.matches('[data-sch-tag]')) { st.tag = t.value; paint(); return; }
    if (t.matches('[data-sch-hide]')) { st.hideDone = t.checked; paint(); return; }
    const dn = t.closest('[data-sch-done]'); if (dn) { const id = dn.getAttribute('data-sch-done'); const x = find(id); if (!x || !canEditDoc(x.d)) return; try { await updateDoc(doc(db, cfg.col, id), { done: dn.checked, savedAt: serverTimestamp() }); x.d.done = dn.checked; paint(); } catch (e) { toast('완료 표시를 저장하지 못했습니다: ' + ((e && e.message) || e)); dn.checked = !dn.checked; } return; }
    if (t.matches('[data-sf]') && st.form) { const k = t.getAttribute('data-sf'); st.form[k] = t.type === 'checkbox' ? t.checked : t.value; if (k === 'isTodo' || k === 'recur') paint(); }
  };
  root.oninput = (ev) => { const t = ev.target; if (t instanceof Element && t.matches('[data-sf]') && st.form && t.type !== 'checkbox' && t.tagName !== 'SELECT') st.form[t.getAttribute('data-sf')] = t.value; };
  paint(); await load();
}
