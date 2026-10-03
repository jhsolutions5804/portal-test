import { esc } from './ui.js?v=20261004a';
import { LEGACY_PORTAL_URL, IS_TEST } from './config.js?v=20261004a';

export function renderLogin(root, { onSubmit, message }) {
  root.innerHTML =
    '<div class="jh-login"><form class="jh-login__card" id="jh-login-form" autocomplete="on">' +
      '<div class="jh-login__brand">JH Portal</div>' +
      '<p class="jh-login__sub">전자결재 v2 시험 화면 · 기존 포털과 같은 계정을 사용합니다.</p>' +
      '<label class="jh-field"><span class="jh-field__label">아이디</span><input class="jh-input" id="jh-id" name="username" autocomplete="username" required></label>' +
      '<label class="jh-field"><span class="jh-field__label">비밀번호</span><input class="jh-input" id="jh-pw" name="password" type="password" autocomplete="current-password" required></label>' +
      '<p class="jh-login__msg" id="jh-login-msg" role="alert">' + esc(message || '') + '</p>' +
      '<button class="jh-btn" data-variant="primary" id="jh-login-btn" type="submit">로그인</button>' +
    '</form></div>';
  root.querySelector('#jh-login-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = root.querySelector('#jh-login-btn'); const msg = root.querySelector('#jh-login-msg');
    btn.disabled = true; btn.textContent = '로그인 중…'; msg.textContent = '';
    try { await onSubmit(root.querySelector('#jh-id').value, root.querySelector('#jh-pw').value); }
    catch (e) { msg.textContent = e && e.message ? e.message : '로그인에 실패했습니다.'; btn.disabled = false; btn.textContent = '로그인'; }
  });
}

export function renderDenied(root, text, onLogout) {
  root.innerHTML = '<div class="jh-login"><div class="jh-login__card"><div class="jh-login__brand">JH Portal</div>' +
    '<p class="jh-login__sub">' + esc(text) + '</p>' +
    '<a class="jh-btn" data-variant="secondary" href="' + LEGACY_PORTAL_URL + '">기존 포털로 이동</a>' +
    '<button class="jh-btn" data-variant="ghost" id="jh-denied-logout" type="button">로그아웃</button></div></div>';
  root.querySelector('#jh-denied-logout').addEventListener('click', onLogout);
}

export function renderShell(root, me, mods, { onLogout }) {
  const items = mods.map(m =>
    '<a class="jh-nav__item" href="' + esc(m.defaultHash) + '" data-mod="' + esc(m.id) + '">' +
      '<span class="jh-nav__icon" aria-hidden="true">' + esc(m.icon || '') + '</span>' +
      '<span class="jh-nav__label">' + esc(m.title) + '</span>' +
      '<span class="jh-nav__badge" hidden></span></a>').join('');
  const who = esc(me.name || '') + (me.rank ? ' <small>' + esc(me.rank) + '</small>' : '');
  root.innerHTML =
    '<div class="jh-app">' +
      '<aside class="jh-sidebar">' +
        '<div class="jh-sidebar__brand">JH Portal' + (IS_TEST ? ' <span class="jh-chip" data-tone="warn">테섭</span>' : '') + '</div>' +
        '<nav class="jh-nav" aria-label="모듈">' + items + '</nav>' +
        '<div class="jh-sidebar__foot">' +
          '<a class="jh-nav__item" href="' + LEGACY_PORTAL_URL + '"><span class="jh-nav__icon" aria-hidden="true">←</span><span class="jh-nav__label">기존 포털</span></a>' +
          '<div class="jh-userchip">' + who + '</div>' +
          '<button class="jh-btn" data-variant="ghost" id="jh-logout" type="button">로그아웃</button>' +
        '</div>' +
      '</aside>' +
      '<div class="jh-body">' +
        '<header class="jh-topbar"><h1 class="jh-topbar__title" id="jh-title"></h1><div class="jh-userchip">' + who + '</div></header>' +
        '<main class="jh-main" id="jh-main"></main>' +
      '</div>' +
      '<nav class="jh-tabbar" aria-label="모듈 탭">' + items + '</nav>' +
    '</div>';
  root.querySelectorAll('#jh-logout').forEach(b => b.addEventListener('click', onLogout));
  return {
    main: root.querySelector('#jh-main'),
    setTitle(t) { root.querySelector('#jh-title').textContent = t; },
    setActive(id) { root.querySelectorAll('[data-mod]').forEach(a => a.classList.toggle('is-active', a.getAttribute('data-mod') === id)); },
    setBadge(id, n) {
      root.querySelectorAll('[data-mod="' + id + '"] .jh-nav__badge').forEach(b => { b.textContent = n > 99 ? '99+' : String(n); b.hidden = !n; });
    }
  };
}
