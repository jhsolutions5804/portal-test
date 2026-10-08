import { watchMe, login, logout, authErrorMessage } from './auth.js?v=20261008b';
import { register, visibleFor, get } from './registry.js?v=20261008b';
import { parseHash, onChange } from './router.js?v=20261008b';
import { renderLogin, renderDenied, renderShell } from './shell.js?v=20261008b';
import { initTheme } from './theme.js?v=20261008b';
import { checkForUpdate } from './update.js?v=20261008b';
import { MODULES } from '../modules/index.js?v=20261008b';
import { mountPlatformHome } from './home.js?v=20261008b';
import { startIdle, stopIdle, OUT_FLAG, IDLE_LIMIT_MS, durationText } from './idle.js?v=20261008b';
import { ensureTime24 } from '../shared/time24.js?v=20261008b';

initTheme();   // 이 기기에 저장된 화면 모드(자동·라이트·다크) 적용
MODULES.forEach((m) => register(Object.assign({}, m.manifest, { mount: m.mount })));

const root = document.getElementById('jh-root');
let me = null; let shell = null; let mods = [];

function route() {
  if (!me || !shell) return;
  const r = parseHash();
  if (!r.module || r.module === 'home') {   // 플랫폼 홈: 모듈이 등록한 위젯을 모아 보여 준다
    shell.showKeep(false); shell.setActive('home'); shell.setTitle('홈', '#/home'); shell.setQuickVisible(true); shell.setFab(null);
    mountPlatformHome(shell.main, { me, setBadge: shell.setBadge }); return;
  }
  const mod = get(r.module);
  if (!mod || mods.indexOf(mod) === -1) { location.replace('#/home'); return; }
  const keepMode = !!mod.keepAlive;   // 작업탭 유지 모듈(옛 모듈 어댑터)은 별도 층에 그려 다른 화면을 다녀와도 지워지지 않는다
  shell.showKeep(keepMode); if (!keepMode) shell.main.className = 'jh-main';
  shell.setActive(mod.nav === false ? 'home' : mod.id); shell.setTitle(mod.title, mod.defaultHash);   // 사이드바에 없는 모듈(출퇴근·일정)은 '홈'이 켜진 채로
  shell.setQuickVisible(!(mod.hideQuickOn && mod.hideQuickOn.indexOf(r.segs[0]) !== -1)); shell.setFab(mod.quick || null);
  mod.mount(keepMode ? shell.keep : shell.main, r, { me, setBadge: shell.setBadge });
}

async function doLogin(id, pw) {
  try { await login(id, pw); } catch (e) { throw new Error(authErrorMessage(e && e.code)); }
}
const REASONS = {
  'signed-out': '', 'not-registered': '등록되지 않은 계정입니다. 관리자에게 문의해 주세요.',
  'not-approved': '승인되지 않은 계정입니다.', error: '계정 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
  slow: '연결이 느립니다. 잠시 후 다시 시도해 주세요. (로그인되어 있다면 연결되는 대로 자동으로 이어집니다)'
};

ensureTime24();   // 시각 입력칸을 24시간(HH:MM) 입력으로(루트 time24.js, 옛 화면과 같은 동작)
let answered = false;   // 인증 응답이 한 번이라도 왔는가 — 6초 넘게 없으면 로딩 화면 대신 로그인 화면(응답이 늦게 오면 그때 이어서 처리)
setTimeout(() => { if (!answered) renderLogin(root, { onSubmit: doLogin, message: REASONS.slow }); }, 6000);
watchMe((user, reason) => {
  answered = true; me = user; shell = null;
  if (!me) {
    stopIdle(); let msg = REASONS[reason] || '';
    try { const f = sessionStorage.getItem(OUT_FLAG); if (f) { msg = durationText(+f > 0 ? +f : IDLE_LIMIT_MS) + ' 동안 활동이 없어 자동 로그아웃되었습니다.'; sessionStorage.removeItem(OUT_FLAG); } } catch (e) { /* 표시를 못 읽어도 로그인 화면은 보인다 */ }
    renderLogin(root, { onSubmit: doLogin, message: msg }); return;
  }
  mods = visibleFor(me);
  if (!mods.length) { renderDenied(root, '이 계정에는 사용할 수 있는 모듈이 없습니다.', logout); return; }
  shell = renderShell(root, me, mods, { onLogout: logout });
  startIdle({ onExpire: logout });   // 1시간 무동작 자동 로그아웃(옛 모듈 화면 안의 활동도 센다)
  route();
});
onChange(route);
checkForUpdate();   // 폰·앱 안 브라우저가 옛 화면을 붙들고 있으면 새 버전으로 바꾼다
