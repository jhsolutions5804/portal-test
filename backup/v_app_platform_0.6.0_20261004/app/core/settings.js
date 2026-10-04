import { esc } from './ui.js?v=20261004l';
import { MODES, getMode, setMode, effectiveTheme } from './theme.js?v=20261004l';

const HINT = {
  auto: () => '이 기기의 라이트/다크 설정을 따릅니다. (지금: ' + (effectiveTheme() === 'dark' ? '다크' : '라이트') + ')',
  light: () => '기기 설정과 관계없이 항상 밝은 화면으로 봅니다.',
  dark: () => '기기 설정과 관계없이 항상 어두운 화면으로 봅니다.'
};

/** 화면 설정 창. trigger: 닫을 때 포커스를 돌려줄 버튼 */
export function openSettings(trigger) {
  if (document.getElementById('jh-settings-dialog')) return;
  const wrap = document.createElement('div');
  wrap.className = 'jh-dialog'; wrap.id = 'jh-settings-dialog';
  wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-labelledby', 'jh-settings-title');
  const draw = () => {
    const cur = getMode();
    wrap.innerHTML =
      '<div class="jh-dialog__backdrop" data-close></div>' +
      '<div class="jh-dialog__panel">' +
        '<h3 class="jh-dialog__title" id="jh-settings-title">화면 설정</h3>' +
        '<div class="jh-dialog__body"><div class="jh-field"><span class="jh-field__label">화면 모드</span>' +
          '<div class="jh-segmented" role="group" aria-label="화면 모드">' +
            MODES.map((m) => '<button type="button" class="jh-segmented__item" data-mode="' + esc(m.key) + '" aria-pressed="' + (m.key === cur) + '">' + esc(m.label) + '</button>').join('') +
          '</div>' +
          '<span class="jh-field__hint" id="jh-theme-hint" aria-live="polite">' + esc(HINT[cur]()) + '</span>' +
        '</div></div>' +
        '<div class="jh-dialog__actions"><button type="button" class="jh-btn" data-variant="primary" data-close>닫기</button></div>' +
      '</div>';
  };
  draw();
  document.body.appendChild(wrap);
  const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  const focusPressed = () => { const b = wrap.querySelector('[aria-pressed="true"]'); if (b) b.focus(); };
  focusPressed();
  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    wrap.remove(); document.body.style.overflow = prevOverflow;
    if (trigger && trigger.focus) trigger.focus();
  };
  function onKey(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); close(); return; }
    if (ev.key !== 'Tab') return;
    const f = [...wrap.querySelectorAll('button')].filter((b) => !b.disabled);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', onKey, true);
  wrap.addEventListener('click', (ev) => {
    const mode = ev.target.closest('[data-mode]');
    if (mode) { setMode(mode.getAttribute('data-mode')); draw(); focusPressed(); return; }
    if (ev.target.closest('[data-close]')) close();
  });
}
