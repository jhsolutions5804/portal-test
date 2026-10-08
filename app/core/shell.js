import { esc } from './ui.js?v=20261008g';
import { openSettings } from './settings.js?v=20261008g';
import { openProfile } from './profile.js?v=20261008g';
import { phoneTabs } from './nav.js?v=20261008g';
import { LEGACY_PORTAL_URL, IS_TEST } from './config.js?v=20261008g';

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
  const items = mods.filter(m => m.nav !== false).map(m =>
    '<a class="jh-nav__item" href="' + esc(m.defaultHash) + '" data-mod="' + esc(m.id) + '">' +
      '<span class="jh-nav__icon" aria-hidden="true">' + esc(m.icon || '') + '</span>' +
      '<span class="jh-nav__label">' + esc(m.title) + '</span>' +
      '<span class="jh-nav__badge" hidden></span></a>').join('');
  const homeItem = '<a class="jh-nav__item" href="#/home" data-mod="home"><span class="jh-nav__icon" aria-hidden="true">🏠</span><span class="jh-nav__label">홈</span></a>';
  // 폰 하단 막대: 홈 · (전자결재 · PJT) · 더보기. 더보기 시트에는 나머지 모듈과 화면 설정·기존 포털·로그아웃. 모듈 전용 '빠른 작업'(새 문서 작성)은 그 모듈 화면의 떠 있는 버튼(FAB)으로
  const pt = phoneTabs(mods);
  const tabItems = homeItem + pt.tabs.map(m =>
    '<a class="jh-nav__item" href="' + esc(m.defaultHash) + '" data-mod="' + esc(m.id) + '"><span class="jh-nav__icon" aria-hidden="true">' + esc(m.mobileTab.icon || m.icon || '') + '</span>' +
      '<span class="jh-nav__label">' + esc(m.mobileTab.label || m.title) + '</span><span class="jh-nav__badge" hidden></span></a>').join('') +
    '<button type="button" class="jh-nav__item" data-open-more aria-haspopup="dialog"><span class="jh-nav__icon" aria-hidden="true">⋯</span><span class="jh-nav__label">더보기</span></button>';
  const moreItems = pt.more.map(m => '<a class="jh-sheet__item" href="' + esc(m.defaultHash) + '" data-sheet-link><span class="jh-nav__icon" aria-hidden="true">' + esc(m.icon || '') + '</span>' + esc(m.title) + '</a>').join('');
  const who = esc(me.name || '') + (me.rank ? ' <small>' + esc(me.rank) + '</small>' : '');
  root.innerHTML =
    '<div class="jh-app">' +
      '<aside class="jh-sidebar">' +
        '<div class="jh-sidebar__brand">JH Portal' + (IS_TEST ? ' <span class="jh-chip" data-tone="warn">테섭</span>' : '') + '</div>' +
        '<nav class="jh-nav" aria-label="모듈">' + homeItem + items + '</nav>' +
        '<div class="jh-sidebar__foot">' +
          '<a class="jh-nav__item" href="' + LEGACY_PORTAL_URL + '"><span class="jh-nav__icon" aria-hidden="true">←</span><span class="jh-nav__label">기존 포털</span></a>' +
          '<button type="button" class="jh-nav__item" data-open-profile><span class="jh-nav__icon" aria-hidden="true">👤</span><span class="jh-nav__label">내 정보</span></button>' +
        '<button type="button" class="jh-nav__item" data-open-settings><span class="jh-nav__icon" aria-hidden="true">⚙</span><span class="jh-nav__label">화면 설정</span></button>' +
          '<div class="jh-userchip">' + who + '</div>' +
          '<button class="jh-btn" data-variant="ghost" id="jh-logout" type="button">로그아웃</button>' +
        '</div>' +
      '</aside>' +
      '<div class="jh-body">' +
        '<header class="jh-topbar"><h1 class="jh-topbar__title"><a id="jh-title" href="#/home"></a></h1><div class="jh-topbar__tools"><div class="jh-userchip">' + who + '</div><button type="button" class="jh-iconbtn" data-open-profile aria-label="내 정보">👤</button><button type="button" class="jh-iconbtn" data-open-settings aria-label="화면 설정">⚙</button></div></header>' +
        '<main class="jh-main" id="jh-main"></main>' +
        '<div class="jh-keep" id="jh-keep" hidden></div>' +
      '</div>' +
      '<nav class="jh-tabbar" aria-label="하단 메뉴">' + tabItems + '</nav>' +
      '<a class="jh-fab" id="jh-fab" hidden></a>' +
      '<div class="jh-sheet" id="jh-sheet" role="dialog" aria-modal="true" aria-label="더보기" hidden><div class="jh-sheet__backdrop" data-sheet-close></div><div class="jh-sheet__panel">' +
        moreItems + (moreItems ? '<div class="jh-sheet__sep"></div>' : '') +
        '<button type="button" class="jh-sheet__item" data-open-profile data-sheet-link><span class="jh-nav__icon" aria-hidden="true">👤</span>내 정보</button>' +
        '<button type="button" class="jh-sheet__item" data-open-settings data-sheet-link><span class="jh-nav__icon" aria-hidden="true">⚙</span>화면 설정</button>' +
        '<a class="jh-sheet__item" href="' + LEGACY_PORTAL_URL + '"><span class="jh-nav__icon" aria-hidden="true">←</span>기존 포털</a>' +
        '<button type="button" class="jh-sheet__item" id="jh-sheet-logout"><span class="jh-nav__icon" aria-hidden="true">⎋</span>로그아웃</button>' +
        '<div class="jh-userchip">' + who + '</div></div></div>' +
    '</div>';
  root.querySelectorAll('#jh-logout').forEach(b => b.addEventListener('click', onLogout));
  const sheet = root.querySelector('#jh-sheet'); const moreBtn = root.querySelector('[data-open-more]');
  const closeSheet = () => { if (sheet.hidden) return; sheet.hidden = true; document.removeEventListener('keydown', onSheetKey, true); document.body.style.overflow = ''; if (moreBtn) moreBtn.focus(); };
  function onSheetKey(ev) { if (ev.key === 'Escape') { ev.preventDefault(); closeSheet(); } }
  const openSheet = () => { sheet.hidden = false; document.body.style.overflow = 'hidden'; document.addEventListener('keydown', onSheetKey, true); const f = sheet.querySelector('.jh-sheet__item'); if (f) f.focus(); };
  if (moreBtn) moreBtn.addEventListener('click', openSheet);
  sheet.addEventListener('click', (ev) => { if (ev.target.closest('[data-sheet-close]') || ev.target.closest('[data-sheet-link]')) closeSheet(); });
  root.querySelector('#jh-sheet-logout').addEventListener('click', () => { closeSheet(); onLogout(); });
  window.addEventListener('hashchange', closeSheet);
  const fab = root.querySelector('#jh-fab'); let fabQuick = null; let barVisible = true;
  const paintFab = () => { if (fabQuick && barVisible) { fab.setAttribute('href', fabQuick.hash); fab.innerHTML = '<span aria-hidden="true">' + esc(fabQuick.icon || '＋') + '</span> ' + esc(fabQuick.label); fab.hidden = false; } else fab.hidden = true; };
  root.querySelectorAll('[data-open-settings]').forEach(b => b.addEventListener('click', () => openSettings(b)));
  root.querySelectorAll('[data-open-profile]').forEach(b => b.addEventListener('click', () => openProfile(me, b)));
  const mainEl = root.querySelector('#jh-main'); const keepEl = root.querySelector('#jh-keep'); const appEl = root.querySelector('.jh-app');
  return {
    main: mainEl,
    /** 작업탭 유지 층: 옛 모듈 화면(iframe)을 떠나도 지우지 않고 숨겨 두는 자리. 이 층을 켜면 일반 본문(main)은 숨는다 */
    keep: keepEl,
    showKeep(v) { mainEl.hidden = !!v; keepEl.hidden = !v; appEl.toggleAttribute('data-legacy', !!v); },
    setTitle(t, hash) { const a = root.querySelector('#jh-title'); a.textContent = t; if (hash) a.setAttribute('href', hash); },
    /** 작성·인쇄 화면에서는 하단 '새 문서 작성' 막대를 숨긴다(같은 일을 이미 하고 있으므로) */
    setQuickVisible(v) { barVisible = !!v; root.querySelectorAll('.jh-tabbar').forEach(n => { n.hidden = !v; }); root.querySelector('.jh-app').toggleAttribute('data-noquick', !v); paintFab(); },
    /** 모듈 화면의 떠 있는 '빠른 작업' 버튼(폰 전용). null 이면 숨김 */
    setFab(q) { fabQuick = q || null; paintFab(); },
    setActive(id) { root.querySelectorAll('[data-mod]').forEach(a => a.classList.toggle('is-active', a.getAttribute('data-mod') === id)); const inTab = id === 'home' || pt.tabs.some(m => m.id === id); if (moreBtn) moreBtn.classList.toggle('is-active', !inTab); },
    setBadge(id, n) {
      root.querySelectorAll('[data-mod="' + id + '"] .jh-nav__badge').forEach(b => { b.textContent = n > 99 ? '99+' : String(n); b.hidden = !n; });
    }
  };
}
