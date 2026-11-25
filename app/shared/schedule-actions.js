/* 영업기획·재무회계 일정 — 홈 달력에서 바로 등록·수정·삭제·완료할 때 쓰는 동작(일정 메뉴 보드와 같은 규칙·같은 저장소).
 * 보드(schedule-board.js)는 한 화면 전체를 그리지만 여기는 창(대화상자)·한 건 단위다. 저장하면 서버 함수가 Outlook 공유 사서함으로 보낸다(포털 → Outlook 한 방향). */
import { db, collection, getDocs, query, where, addDoc, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp } from '../core/firebase.js?v=20261125g';
import { toast } from '../core/ui.js?v=20261125g';
import { confirmDialog } from '../core/dialog.js?v=20261125g';
import { buildScheduleDoc, buildSeries, seriesTargets } from './schedule-logic.js?v=20261125g';
import { formHtml } from './schedule-view.js?v=20261125g';

/** 등록·수정 창. form = emptyForm(cfg, 날짜) 또는 formFromEvent(일정). done = 수정할 때 현재 완료 여부. 저장에 성공하면 onSaved() */
export function openScheduleDialog({ cfg, me, form, done, onSaved }) {
  const st = { cfg, me: me || {}, form: Object.assign({}, form), busy: false };
  const wrap = document.createElement('div'); wrap.className = 'jh-dialog'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
  const prevOverflow = document.body.style.overflow; const prevFocus = document.activeElement;
  function onKey(ev) { if (ev.key === 'Escape') { ev.preventDefault(); close(); } }
  function close() { document.removeEventListener('keydown', onKey, true); wrap.remove(); document.body.style.overflow = prevOverflow; if (prevFocus && prevFocus.focus) prevFocus.focus(); }
  const draw = () => { wrap.innerHTML = '<div class="jh-dialog__backdrop" data-sch-cancel></div><div class="jh-dialog__panel jh-sch__dialog" style="max-width:40rem;max-height:90vh;overflow:auto">' + formHtml(st) + '</div>'; };
  const save = async () => {
    if (st.busy) return; const f = st.form; st.busy = true; draw();
    try {
      if (f.id) {
        const r = buildScheduleDoc(f, cfg, st.me); if (r.error) { toast(r.error); st.busy = false; draw(); return; }
        const d = r.doc; await updateDoc(doc(db, cfg.col, f.id), { text: d.text, sdate: d.sdate, edate: d.edate, stime: d.stime, etime: d.etime, tag: d.tag, tagLabel: d.tagLabel, place: d.place, memo: d.memo, isTodo: d.isTodo, done: d.isTodo ? !!done : false, savedAt: serverTimestamp() });
        toast('저장했습니다.');
      } else {
        const recurId = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); const r = buildSeries(f, cfg, st.me, f.recur, recurId); if (r.error) { toast(r.error); st.busy = false; draw(); return; }
        if (r.docs.length === 1) await addDoc(collection(db, cfg.col), Object.assign({}, r.docs[0].doc, { savedAt: serverTimestamp() }));
        else { const b = writeBatch(db); r.docs.forEach((x) => b.set(doc(db, cfg.col, x.id), Object.assign({}, x.doc, { savedAt: serverTimestamp() }))); await b.commit(); }
        toast(r.docs.length > 1 ? r.docs.length + '건을 만들었습니다.' : '추가했습니다.');
      }
      close(); if (onSaved) onSaved();
    } catch (e) { console.error('일정 저장', e); toast('저장하지 못했습니다: ' + ((e && e.message) || e)); st.busy = false; draw(); }
  };
  draw(); document.body.appendChild(wrap); document.body.style.overflow = 'hidden'; document.addEventListener('keydown', onKey, true);
  wrap.addEventListener('input', (ev) => { const t = ev.target; if (t instanceof Element && t.matches('[data-sf]') && t.type !== 'checkbox' && t.tagName !== 'SELECT') st.form[t.getAttribute('data-sf')] = t.value; });
  wrap.addEventListener('change', (ev) => { const t = ev.target; if (!(t instanceof Element) || !t.matches('[data-sf]')) return; const k = t.getAttribute('data-sf'); st.form[k] = t.type === 'checkbox' ? t.checked : t.value; if (k === 'isTodo' || k === 'recur') draw(); });
  wrap.addEventListener('click', (ev) => { const t = ev.target; if (!(t instanceof Element)) return; if (t.closest('[data-sch-cancel]')) { close(); return; } if (t.closest('[data-sch-save]')) save(); });
}

/** 일정 한 건 삭제(확인 창 포함). scope = 'one' | 'future'(반복 일정을 이 날짜부터 모두). 지웠으면 true */
export async function deleteScheduleEvent(cfg, e, scope) {
  let ids = [e.ref]; let label = '"' + e.title + '" 일정을 삭제할까요?' + (e.recurId ? ' (반복 일정 중 이 날짜 하나만 삭제됩니다.)' : '');
  if (scope === 'future') {
    if (!e.recurId) return false; const all = [];
    try { const s = await getDocs(query(collection(db, cfg.col), where('recurId', '==', e.recurId))); s.forEach((d) => all.push({ id: d.id, d: d.data() })); } catch (err) { toast('반복 일정을 찾지 못했습니다.'); return false; }
    ids = seriesTargets(all, e.recurId, 'future', e.start); label = '"' + e.title + '" 반복 일정을 ' + e.start + ' 부터 ' + ids.length + '건 모두 삭제할까요?';
  }
  const ok = await confirmDialog({ title: '일정 삭제', body: label, confirmLabel: '삭제' }); if (!ok || !ok.ok) return false;
  try {
    if (ids.length === 1) await deleteDoc(doc(db, cfg.col, ids[0]));
    else for (let i = 0; i < ids.length; i += 400) { const b = writeBatch(db); ids.slice(i, i + 400).forEach((id) => b.delete(doc(db, cfg.col, id))); await b.commit(); }
    toast(ids.length + '건을 삭제했습니다.'); return true;
  } catch (err) { console.error('일정 삭제', err); toast('삭제하지 못했습니다: ' + ((err && err.message) || err)); return false; }
}

/** 할 일 완료 표시 저장 */
export async function setScheduleDone(cfg, id, done) { await updateDoc(doc(db, cfg.col, id), { done: !!done, savedAt: serverTimestamp() }); }
