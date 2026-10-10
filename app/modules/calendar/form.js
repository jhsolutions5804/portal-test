import { validateDraft } from './logic.js?v=20261008j';
import { createCompanyEvent, updateCompanyEvent } from './data.js?v=20261008j';
import { formHtml, readForm } from './view.js?v=20261008j';
import { toast } from '../../core/ui.js?v=20261008j';

/** 일정 등록·수정 창. editing = 수정할 문서 번호(없으면 새로 등록). 저장에 성공하면 onSaved(draft) */
export function openEventForm({ me, draft, editing, onSaved }) {
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
    try { if (editing) await updateCompanyEvent(editing, d, me); else await createCompanyEvent(d, me); close(); toast(editing ? '일정을 고쳤습니다.' : '일정을 등록했습니다.'); if (onSaved) onSaved(d); }
    catch (e) { console.error('일정 저장', e); busy = false; draw(d, { _save: '저장하지 못했습니다. 권한이 없거나 연결이 불안정합니다. 잠시 후 다시 시도해 주세요.' }); }
  });
}
