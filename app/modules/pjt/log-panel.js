import { functions, httpsCallable } from '../../core/firebase.js?v=20261031h';
import { confirmDialog } from '../../core/dialog.js?v=20261031h';
import { logHtml, logCompactHtml } from './log-view.js?v=20261031h';
import { titleHint, canSubmit, friendlyError } from '../../shared/pjt-log.js?v=20261031h';
/* 이력 패널 — 이력 탭(전체 화면)과 프로젝트 홈의 3단째(요약)가 같이 쓰는 부품. 상태·이벤트·서버 호출(pjtLogAct)을 이 안에서만 다룬다.
 * host = 이 패널이 그려지는 요소(이 요소에 직접 이벤트를 달기 때문에 바깥 화면이 다시 그려져도 요소만 옮겨 끼우면 상태가 유지된다).
 * o = { proj, label, me:{uid}, callLog?, compact?, all?, projects? }. all = PJT 메인 홈처럼 프로젝트를 고르기 전 화면(내가 볼 수 있는 모든 프로젝트의 이력, projects=[{key,label}] — 입력은 프로젝트를 골라서, 행의 버튼은 그 행의 프로젝트로 처리). 반환 { ready, reload, state } */
const LAST_KEY = 'jh.pjtlog.lastProject';
const lastProject = (projects) => { try { const k = window.localStorage.getItem(LAST_KEY); if (k && projects.some((p) => p.key === k)) return k; } catch (e) { /* 저장소를 못 쓰면 기본값 없음 */ } return projects.length === 1 ? projects[0].key : ''; };
const rememberProject = (k) => { try { window.localStorage.setItem(LAST_KEY, k); } catch (e) { /* 무시 */ } };
export function createLogPanel(host, o) {
  const callLog = o.callLog || (async (payload) => (await httpsCallable(functions, 'pjtLogAct')(payload)).data);
  const projects = Array.isArray(o.projects) ? o.projects : [];
  const st = { proj: o.proj || '', label: o.label || '', compact: !!o.compact, all: !!o.all, projects, me: { uid: (o.me && o.me.uid) || '', manager: false }, loading: true, error: '', data: null, filter: {}, formOpen: false, form: { category: '', source: '', title: '', dueDate: '', pjtId: o.all ? lastProject(projects) : '' }, busy: false, msg: '' };
  const pj = (el) => (st.all ? (el && el.getAttribute('data-lg-pjt')) || '' : st.proj);   // 행의 버튼이 가리키는 프로젝트(전체 모드는 행마다 다름)
  const paint = () => { const y = window.scrollY; host.innerHTML = st.compact ? logCompactHtml(st) : logHtml(st); window.scrollTo(0, y); };
  const load = async () => {
    try { const f = {}; Object.keys(st.filter).forEach((k) => { if (st.filter[k]) f[k] = st.filter[k]; }); const r = await callLog(st.all ? { action: 'listAll', filter: f } : { action: 'list', pjtId: st.proj, filter: f }); st.data = r; st.me.manager = r.canConfirm === true; st.error = ''; }
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
      const c = canSubmit(st.form, st.all); if (!c.ok) { st.msg = c.why; paint(); return; }
      const pid = st.all ? st.form.pjtId : st.proj; if (st.all) rememberProject(pid);
      await act(async () => { await callLog({ action: 'add', pjtId: pid, category: st.form.category, source: st.form.source, title: st.form.title, dueDate: st.form.dueDate || '' }); st.form = { category: st.form.category, source: st.form.source, title: '', dueDate: '', pjtId: pid }; st.formOpen = false; }, '기록했습니다.'); return;
    }
    if ((el = t.closest('[data-lg-act]'))) {
      const a = el.getAttribute('data-lg-act'), id = el.getAttribute('data-lg-id');
      const pid = pj(el); if (!pid) return;
      if (a === 'claim') return act(() => callLog({ action: 'claim', pjtId: pid, id }), '맡았습니다.');
      if (a === 'release') return act(() => callLog({ action: 'release', pjtId: pid, id }), '맡기를 취소했습니다.');
      if (a === 'confirm') return act(() => callLog({ action: 'confirm', pjtId: pid, id }), '확정했습니다.');
 if (a === 'calendar') return act(() => callLog({ action: 'calendarAdd', pjtId: pid, id }), '캘린더에 할 일로 넣었습니다.'); // 확인창 없이 한 번(일정을 지워도 이력은 남는 되돌릴 수 있는 일, 설계 §8-4). 서버가 일정 번호를 항목 번호로 정해 두 번 눌러도 하나
      if (a === 'impact') { const e = ((st.data && st.data.changes) || []).concat((st.data && st.data.entries) || []).find((x) => x.id === id); return act(() => callLog({ action: 'impact', pjtId: pid, id, checked: !(e && e.impactChecked) }), ''); }
      if (STATUS_OF[a]) {
        if (a === 'closed' || a === 'hold') { const ok = await confirmDialog({ title: a === 'closed' ? '종결' : '보류', body: a === 'closed' ? '이 항목을 종결합니다. 회신·조치가 끝났는지 확인하셨나요?' : '이 항목을 보류합니다. 기한 임박 목록에서 빠집니다.', confirmLabel: a === 'closed' ? '종결' : '보류' }); if (!ok || !ok.ok) return; } // confirmDialog 는 { ok, reason } 객체를 돌려준다 — 객체는 항상 참이라 ok.ok 를 봐야 취소가 걸러진다(2026-10-18 수정: 취소해도 실행되던 문제)
        return act(() => callLog({ action: 'setStatus', pjtId: pid, id, status: STATUS_OF[a] }), '');
      }
    }
  };
  host.onchange = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return; let changed = true;
    if (t.hasAttribute('data-lg-proj')) { st.form.pjtId = t.value; paint(); changed = false; }
    else if (t.hasAttribute('data-lg-fproj')) st.filter.pjtId = t.value;
    else if (t.hasAttribute('data-lg-fcat')) st.filter.category = t.value; else if (t.hasAttribute('data-lg-fsrc')) st.filter.source = t.value; else if (t.hasAttribute('data-lg-ffrom')) st.filter.from = t.value; else if (t.hasAttribute('data-lg-fto')) st.filter.to = t.value;
    else if (t.hasAttribute('data-lg-due')) { st.form.dueDate = t.value; paint(); changed = false; } else changed = false;
    if (changed) { st.loading = true; paint(); await load(); }
  };
  host.oninput = (ev) => {   // 쓰는 동안 글자 수·금액 안내를 서버 호출 없이 바로 갱신(입력칸은 다시 그리지 않아 커서가 유지된다)
    const t = ev.target; if (!(t instanceof Element) || !t.hasAttribute('data-lg-title')) return; st.form.title = t.value;
    const h = titleHint(t.value), c = canSubmit(st.form, st.all); const cnt = host.querySelector('[data-lg-count]'); if (cnt) cnt.textContent = String(t.value).trim().length + ' / 80';
    let hint = host.querySelector('[data-lg-hint]'); const field = t.closest('.jh-field');
    if (h) { if (!hint && field) { hint = document.createElement('div'); hint.className = 'jh-field__error'; hint.setAttribute('role', 'alert'); hint.setAttribute('data-lg-hint', ''); field.appendChild(hint); } if (hint) hint.textContent = h; t.setAttribute('aria-invalid', 'true'); if (field) field.setAttribute('data-invalid', 'true'); } else { if (hint) hint.remove(); t.removeAttribute('aria-invalid'); if (field) field.removeAttribute('data-invalid'); }   // 전역 규칙이 .jh-field[data-invalid] 일 때만 안내(.jh-field__error)를 보여 준다 — 이 속성이 없으면 안내가 숨겨진 채라 사용자가 왜 기록하기가 안 눌리는지 모른다
    const add = host.querySelector('[data-lg-add]'); if (add) { if (c.ok && !st.busy) add.removeAttribute('disabled'); else add.setAttribute('disabled', ''); }
  };
  paint();
  return { ready: load(), reload: load, state: st };
}
