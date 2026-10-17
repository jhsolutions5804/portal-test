import { functions, httpsCallable } from '../../core/firebase.js?v=20261016j';
import { confirmDialog } from '../../core/dialog.js?v=20261016j';
import { logHtml, logCompactHtml } from './log-view.js?v=20261016j';
import { titleHint, canSubmit, friendlyError } from '../../shared/pjt-log.js?v=20261016j';
/* 이력 패널 — 이력 탭(전체 화면)과 프로젝트 홈의 3단째(요약)가 같이 쓰는 부품. 상태·이벤트·서버 호출(pjtLogAct)을 이 안에서만 다룬다.
 * host = 이 패널이 그려지는 요소(이 요소에 직접 이벤트를 달기 때문에 바깥 화면이 다시 그려져도 요소만 옮겨 끼우면 상태가 유지된다).
 * o = { proj, label, me:{uid}, callLog?, compact? }. 반환 { ready, reload, state } */
export function createLogPanel(host, o) {
  const callLog = o.callLog || (async (payload) => (await httpsCallable(functions, 'pjtLogAct')(payload)).data);
  const st = { proj: o.proj, label: o.label || '', compact: !!o.compact, me: { uid: (o.me && o.me.uid) || '', manager: false }, loading: true, error: '', data: null, filter: {}, formOpen: false, form: { category: '', source: '', title: '', dueDate: '' }, busy: false, msg: '' };
  const paint = () => { const y = window.scrollY; host.innerHTML = st.compact ? logCompactHtml(st) : logHtml(st); window.scrollTo(0, y); };
  const load = async () => {
    try { const f = {}; Object.keys(st.filter).forEach((k) => { if (st.filter[k]) f[k] = st.filter[k]; }); const r = await callLog({ action: 'list', pjtId: st.proj, filter: f }); st.data = r; st.me.manager = r.canConfirm === true; st.error = ''; }
    catch (e) { st.error = friendlyError(e); st.data = null; }
    st.loading = false; paint();
  };
  const act = async (fn, okMsg) => { if (st.busy) return; st.busy = true; st.msg = ''; paint(); try { await fn(); if (okMsg) st.msg = okMsg; await load(); } catch (e) { st.msg = friendlyError(e); } st.busy = false; paint(); };
  const STATUS_OF = { done: 'done', closed: 'closed', hold: 'hold', reopen: 'confirmed' };
  host.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; let el;
    if (t.closest('[data-lg-toggle]')) { st.formOpen = !st.formOpen; paint(); return; }
    if (t.closest('[data-lg-retry]')) { st.loading = true; st.error = ''; paint(); await load(); return; }
    if ((el = t.closest('[data-lg-cat]'))) { st.form.category = el.getAttribute('data-lg-cat'); paint(); return; }
    if ((el = t.closest('[data-lg-src]'))) { st.form.source = el.getAttribute('data-lg-src'); paint(); return; }
    if (t.closest('[data-lg-freset]')) { st.filter = {}; st.loading = true; paint(); await load(); return; }
    if (t.closest('[data-lg-add]')) {
      const c = canSubmit(st.form); if (!c.ok) { st.msg = c.why; paint(); return; }
      await act(async () => { await callLog({ action: 'add', pjtId: st.proj, category: st.form.category, source: st.form.source, title: st.form.title, dueDate: st.form.dueDate || '' }); st.form = { category: st.form.category, source: st.form.source, title: '', dueDate: '' }; st.formOpen = false; }, '기록했습니다.'); return;
    }
    if ((el = t.closest('[data-lg-act]'))) {
      const a = el.getAttribute('data-lg-act'), id = el.getAttribute('data-lg-id');
      if (a === 'claim') return act(() => callLog({ action: 'claim', pjtId: st.proj, id }), '맡았습니다.');
      if (a === 'release') return act(() => callLog({ action: 'release', pjtId: st.proj, id }), '맡기를 취소했습니다.');
      if (a === 'confirm') return act(() => callLog({ action: 'confirm', pjtId: st.proj, id }), '확정했습니다.');
      if (a === 'impact') { const e = ((st.data && st.data.changes) || []).concat((st.data && st.data.entries) || []).find((x) => x.id === id); return act(() => callLog({ action: 'impact', pjtId: st.proj, id, checked: !(e && e.impactChecked) }), ''); }
      if (STATUS_OF[a]) {
        if (a === 'closed' || a === 'hold') { const ok = await confirmDialog({ title: a === 'closed' ? '종결' : '보류', body: a === 'closed' ? '이 항목을 종결합니다. 회신·조치가 끝났는지 확인하셨나요?' : '이 항목을 보류합니다. 기한 임박 목록에서 빠집니다.', confirmLabel: a === 'closed' ? '종결' : '보류' }); if (!ok) return; }
        return act(() => callLog({ action: 'setStatus', pjtId: st.proj, id, status: STATUS_OF[a] }), '');
      }
    }
  };
  host.onchange = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; let changed = true;
    if (t.hasAttribute('data-lg-fcat')) st.filter.category = t.value; else if (t.hasAttribute('data-lg-fsrc')) st.filter.source = t.value; else if (t.hasAttribute('data-lg-ffrom')) st.filter.from = t.value; else if (t.hasAttribute('data-lg-fto')) st.filter.to = t.value;
    else if (t.hasAttribute('data-lg-due')) { st.form.dueDate = t.value; paint(); changed = false; } else changed = false;
    if (changed) { st.loading = true; paint(); await load(); }
  };
  host.oninput = (ev) => {   // 쓰는 동안 글자 수·금액 안내를 서버 호출 없이 바로 갱신(입력칸은 다시 그리지 않아 커서가 유지된다)
    const t = ev.target; if (!(t instanceof Element) || !t.hasAttribute('data-lg-title')) return; st.form.title = t.value;
    const h = titleHint(t.value), c = canSubmit(st.form); const cnt = host.querySelector('[data-lg-count]'); if (cnt) cnt.textContent = String(t.value).trim().length + ' / 80';
    let hint = host.querySelector('[data-lg-hint]'); const field = t.closest('.jh-field');
    if (h) { if (!hint && field) { hint = document.createElement('div'); hint.className = 'jh-field__error'; hint.setAttribute('role', 'alert'); hint.setAttribute('data-lg-hint', ''); field.appendChild(hint); } if (hint) hint.textContent = h; t.setAttribute('aria-invalid', 'true'); } else { if (hint) hint.remove(); t.removeAttribute('aria-invalid'); }
    const add = host.querySelector('[data-lg-add]'); if (add) { if (c.ok && !st.busy) add.removeAttribute('disabled'); else add.setAttribute('disabled', ''); }
  };
  paint();
  return { ready: load(), reload: load, state: st };
}
