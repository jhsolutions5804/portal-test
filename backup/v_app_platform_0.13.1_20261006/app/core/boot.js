import { watchMe, login, logout, authErrorMessage } from './auth.js?v=20261005g';
import { register, visibleFor, get } from './registry.js?v=20261005g';
import { parseHash, onChange } from './router.js?v=20261005g';
import { renderLogin, renderDenied, renderShell } from './shell.js?v=20261005g';
import { initTheme } from './theme.js?v=20261005g';
import { checkForUpdate } from './update.js?v=20261005g';
import { MODULES } from '../modules/index.js?v=20261005g';
import { mountPlatformHome } from './home.js?v=20261005g';

initTheme();   // 이 기기에 저장된 화면 모드(자동·라이트·다크) 적용
MODULES.forEach((m) => register(Object.assign({}, m.manifest, { mount: m.mount })));

const root = document.getElementById('jh-root');
let me = null; let shell = null; let mods = [];

function route() {
  if (!me || !shell) return;
  const r = parseHash();
  if (!r.module || r.module === 'home') {   // 플랫폼 홈: 모듈이 등록한 위젯을 모아 보여 준다
    shell.setActive('home'); shell.setTitle('홈', '#/home'); shell.setQuickVisible(true); shell.setFab(null);
    mountPlatformHome(shell.main, { me, setBadge: shell.setBadge }); return;
  }
  const mod = get(r.module);
  if (!mod || mods.indexOf(mod) === -1) { location.replace('#/home'); return; }
  shell.main.className = 'jh-main';   // 이전 모듈이 붙인 본문 모양(예: 옛 모듈 전체 화면)을 초기화
  const appEl = shell.main.closest('.jh-app'); if (appEl) appEl.removeAttribute('data-legacy');
  shell.setActive(mod.nav === false ? 'home' : mod.id); shell.setTitle(mod.title, mod.defaultHash);   // 사이드바에 없는 모듈(출퇴근·일정)은 '홈'이 켜진 채로
  shell.setQuickVisible(!(mod.hideQuickOn && mod.hideQuickOn.indexOf(r.segs[0]) !== -1)); shell.setFab(mod.quick || null);
  mod.mount(shell.main, r, { me, setBadge: shell.setBadge });
}

async function doLogin(id, pw) {
  try { await login(id, pw); } catch (e) { throw new Error(authErrorMessage(e && e.code)); }
}
const REASONS = {
  'signed-out': '', 'not-registered': '등록되지 않은 계정입니다. 관리자에게 문의해 주세요.',
  'not-approved': '승인되지 않은 계정입니다.', error: '계정 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
};

watchMe((user, reason) => {
  me = user; shell = null;
  if (!me) { renderLogin(root, { onSubmit: doLogin, message: REASONS[reason] || '' }); return; }
  mods = visibleFor(me);
  if (!mods.length) { renderDenied(root, '이 계정에는 사용할 수 있는 모듈이 없습니다.', logout); return; }
  shell = renderShell(root, me, mods, { onLogout: logout });
  route();
});
onChange(route);
checkForUpdate();   // 폰·앱 안 브라우저가 옛 화면을 붙들고 있으면 새 버전으로 바꾼다
