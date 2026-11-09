import { esc } from './ui.js?v=20261109o';

/** 확인 창. opts: { title, body(HTML 아님·일반 글), confirmLabel, variant('primary'|'danger'), reason:{label, placeholder, required} }
 *  → Promise<{ ok:boolean, reason:string }> */
export function confirmDialog(opts) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'jh-dialog'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-labelledby', 'jh-confirm-title');
    const r = opts.reason;
    wrap.innerHTML =
      '<div class="jh-dialog__backdrop" data-cancel></div>' +
      '<div class="jh-dialog__panel">' +
        '<h3 class="jh-dialog__title" id="jh-confirm-title">' + esc(opts.title) + '</h3>' +
        '<div class="jh-dialog__body">' + esc(opts.body || '').replace(/\n/g, '<br>') +
          (r ? '<div class="jh-field" id="jh-confirm-field"><label class="jh-field__label" for="jh-confirm-reason">' + esc(r.label || '사유') + '</label>' +
            '<textarea class="jh-textarea" id="jh-confirm-reason" maxlength="1000" placeholder="' + esc(r.placeholder || '') + '"></textarea>' +
            '<span class="jh-field__error">' + esc((r.label || '사유') + '을(를) 입력해 주세요.') + '</span></div>' : '') +
        '</div>' +
        '<div class="jh-dialog__actions"><button type="button" class="jh-btn" data-variant="ghost" data-cancel>취소</button>' +
          '<button type="button" class="jh-btn" data-variant="' + esc(opts.variant || 'primary') + '" data-ok>' + esc(opts.confirmLabel || '확인') + '</button></div>' +
      '</div>';
    document.body.appendChild(wrap);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const prevFocus = document.activeElement;
    const area = wrap.querySelector('#jh-confirm-reason');
    (area || wrap.querySelector('[data-ok]')).focus();
    const done = (ok) => {
      const reason = area ? area.value.trim() : '';
      if (ok && r && r.required && !reason) { wrap.querySelector('#jh-confirm-field').setAttribute('data-invalid', 'true'); area.focus(); return; }
      document.removeEventListener('keydown', onKey, true); wrap.remove(); document.body.style.overflow = prev;
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      resolve({ ok, reason });
    };
    function onKey(ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); done(false); return; }
      if (ev.key !== 'Tab') return;
      const f = [...wrap.querySelectorAll('button, textarea')]; const first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('click', (ev) => { if (ev.target.closest('[data-ok]')) done(true); else if (ev.target.closest('[data-cancel]')) done(false); });
    if (area) area.addEventListener('input', () => wrap.querySelector('#jh-confirm-field').removeAttribute('data-invalid'));
  });
}

/** 정보 창(상세 보기). opts: { title, bodyHtml(이미 esc 처리한 HTML), actions:[{key,label,variant}] } — 닫기 키(Esc)·바깥 누르기는 null. → Promise<string|null>(누른 단추의 key) */
export function infoDialog(opts) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'jh-dialog'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-labelledby', 'jh-info-title');
    const acts = opts.actions && opts.actions.length ? opts.actions : [{ key: 'close', label: '닫기', variant: 'primary' }];
    wrap.innerHTML = '<div class="jh-dialog__backdrop" data-cancel></div><div class="jh-dialog__panel">' +
      '<h3 class="jh-dialog__title" id="jh-info-title">' + esc(opts.title) + '</h3><div class="jh-dialog__body">' + (opts.bodyHtml || '') + '</div>' +
      '<div class="jh-dialog__actions">' + acts.map((a) => '<button type="button" class="jh-btn" data-variant="' + esc(a.variant || 'ghost') + '" data-act-key="' + esc(a.key) + '">' + esc(a.label) + '</button>').join('') + '</div></div>';
    document.body.appendChild(wrap);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; const prevFocus = document.activeElement;
    const first = wrap.querySelector('[data-act-key]'); if (first) first.focus();
    const done = (key) => { document.removeEventListener('keydown', onKey, true); wrap.remove(); document.body.style.overflow = prev; if (prevFocus && prevFocus.focus) prevFocus.focus(); resolve(key); };
    function onKey(ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); done(null); return; }
      if (ev.key !== 'Tab') return;
      const f = [...wrap.querySelectorAll('button')]; const a = f[0], z = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === a) { ev.preventDefault(); z.focus(); } else if (!ev.shiftKey && document.activeElement === z) { ev.preventDefault(); a.focus(); }
    }
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('click', (ev) => { const b = ev.target.closest('[data-act-key]'); if (b) done(b.getAttribute('data-act-key')); else if (ev.target.closest('[data-cancel]')) done(null); });
  });
}

