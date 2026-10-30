import { watchMe, login, logout, authErrorMessage } from './auth.js?v=20261030a';
import { register, visibleFor, get } from './registry.js?v=20261030a';
import { parseHash, onChange } from './router.js?v=20261030a';
import { renderLogin, renderDenied, renderShell } from './shell.js?v=20261030a';
import { hasMicrosoftCallback, finishMicrosoftLogin, startMicrosoftLogin, msErrorMessage } from './ms-auth.js?v=20261030a';
import { initTheme } from './theme.js?v=20261030a';
import { checkForUpdate } from './update.js?v=20261030a';
import { MODULES, installShellDocks } from '../modules/index.js?v=20261030a';
import { mountPlatformHome } from './home.js?v=20261030a';
import { startIdle, stopIdle, OUT_FLAG, IDLE_LIMIT_MS, durationText } from './idle.js?v=20261030a';
import { ensureTime24 } from '../shared/time24.js?v=20261030a';
import { installRecent, describeNow } from './recent.js?v=20261030a';
import { workTabs, resumeHash } from './worktabs.js?v=20261030a';
import { legacyProjectHash } from '../shared/pjt-key.js?v=20261030a';

initTheme();   // 이 기기에 저장된 화면 모드(자동·라이트·다크) 적용
MODULES.forEach((m) => register(Object.assign({}, m.manifest, { mount: m.mount })));

const root = document.getElementById('jh-root');
let me = null; let shell = null; let mods = []; let recent = null; let docsOff = null;   // recent: 화면 우측 floating 최근 사용 메뉴
const mainViews = new Map(); let curView = null; let labelTimers = [];   // 작업 탭: 화면별 본문(전자결재·재무회계 등)을 살려 둔다. 옛 모듈 틀(영업기획·인사총무·PJT)은 frame.js 가 같은 방식으로
const isDesktop = () => !!(window.matchMedia && window.matchMedia('(min-width: 900px)').matches);   // 폰은 하단 메뉴가 있고 새로고침 수단이 없어 지금까지처럼 매번 새로 그린다
/** 살려 두는 화면의 키: 화면이 아닌 값(문서 번호 등)은 넣지 않는다 — 전자결재는 결재함(목록·상세)·새 문서·홈·관리 */
function viewKeyOf(r) { const s0 = (r.segs && r.segs[0]) || ''; if (r.module === 'edoc') return '#/edoc/' + (['new', 'edit', 'home', 'admin'].indexOf(s0) !== -1 ? s0 : 'box'); return '#/' + r.module + '/' + s0; }
/** 화면이 다 그려진 뒤 탭 이름을 "모듈 › 프로젝트 › 메뉴"로 다듬는다 */
function scheduleLabel(full) { labelTimers.forEach(clearTimeout); labelTimers = [900, 2600, 6000].map((ms) => setTimeout(() => { if (location.hash !== full) return; const l = describeNow(document); const k = workTabs.currentKey(); if (l && k) workTabs.relabel(k, l); }, ms)); }

function route() {
  if (!me || !shell) return;
  const legacy = legacyProjectHash(location.hash); if (legacy) { location.replace(legacy); return; }   // 옛 북마크 #/pjt/reg_<id> → #/pjt/<id>
  const r = parseHash();
  if (curView) { curView.scroll = window.scrollY; curView = null; }   // 떠나는 화면의 스크롤 위치
  if (!r.module || r.module === 'home') {   // 플랫폼 홈: 모듈이 등록한 위젯을 모아 보여 준다
    workTabs.leave(); shell.showKeep(false); shell.setActive('home'); shell.setTitle('홈', '#/home'); shell.setQuickVisible(true); shell.setFab(null);
    mountPlatformHome(shell.main, { me, setBadge: shell.setBadge }); return;
  }
  const mod = get(r.module);
  if (!mod || mods.indexOf(mod) === -1) { location.replace('#/home'); return; }
  const keepMode = !!mod.keepAlive;   // 옛 모듈 어댑터는 별도 층에 그려 다른 화면을 다녀와도 지워지지 않는다(그 안의 화면별 영역은 frame.js 가 살려 둔다)
  const viewMode = !keepMode && isDesktop();   // 일반 모듈: 데스크톱에서는 화면별 본문을 살려 둔다
  if (!viewMode) { shell.showKeep(keepMode); if (!keepMode) { workTabs.leave(); shell.main.className = 'jh-main'; shell.main.removeAttribute('data-sided'); } }
  shell.setActive(mod.nav === false ? 'home' : mod.id); shell.setTitle(mod.title, mod.defaultHash);   // 사이드바에 없는 모듈(출퇴근·일정)은 '홈'이 켜진 채로
  shell.setQuickVisible(!(mod.hideQuickOn && mod.hideQuickOn.indexOf(r.segs[0]) !== -1)); shell.setFab(mod.quick || null);
  if (recent) recent.touch(location.hash, mod.title);   // 최근 사용 메뉴에 기록(이름은 화면이 그려진 뒤 더 정확하게 고친다)
  const ctx = { me, setBadge: shell.setBadge };
  if (viewMode) {
    const key = viewKeyOf(r); const full = location.hash; let v = mainViews.get(key);
    if (!v) { v = { el: shell.newView(key), hash: null, scroll: 0 }; mainViews.set(key, v); }
    shell.showView(v.el); curView = v;
    workTabs.note({ key, hash: full, label: mod.title, mod: mod.id }, {
      drop: () => { shell.dropView(key); mainViews.delete(key); if (curView === v) curView = null; },
      reload: () => { v.hash = null; if (workTabs.currentKey() === key) route(); }   // 처음 상태로 다시 불러오기
    });
    if (v.hash === full) window.scrollTo(0, v.scroll || 0);   // 같은 화면·같은 주소로 돌아옴: 다시 그리지 않고 그대로
    else { v.hash = full; v.el.className = 'jh-main'; mod.mount(v.el, r, ctx); }
  } else mod.mount(keepMode ? shell.keep : shell.main, r, ctx);
  scheduleLabel(location.hash);
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
let msNote = '';   // Microsoft 로그인 실패 안내(로그인 화면에 한 번 표시)
if (hasMicrosoftCallback()) { try { await finishMicrosoftLogin(); } catch (e) { console.warn('Microsoft 로그인', e && (e.msCode || e.message)); msNote = msErrorMessage(e); } }   // watchMe 보다 먼저
let answered = false;   // 인증 응답이 한 번이라도 왔는가 — 6초 넘게 없으면 로딩 화면 대신 로그인 화면(응답이 늦게 오면 그때 이어서 처리)
setTimeout(() => { if (!answered) renderLogin(root, { onSubmit: doLogin, onMicrosoft: () => startMicrosoftLogin(), message: REASONS.slow }); }, 6000);
watchMe((user, reason) => {
  answered = true; me = user; shell = null; recent = null; if (docsOff) { docsOff(); docsOff = null; } workTabs.reset(); mainViews.clear(); curView = null; const oldRecent = document.getElementById('jh-recent'); if (oldRecent) oldRecent.remove();
  if (!me) {
    stopIdle(); let msg = REASONS[reason] || '';
    try { const f = sessionStorage.getItem(OUT_FLAG); if (f) { msg = durationText(+f > 0 ? +f : IDLE_LIMIT_MS) + ' 동안 활동이 없어 자동 로그아웃되었습니다.'; sessionStorage.removeItem(OUT_FLAG); } } catch (e) { /* 표시를 못 읽어도 로그인 화면은 보인다 */ }
    renderLogin(root, { onSubmit: doLogin, onMicrosoft: () => startMicrosoftLogin(), message: msg || msNote }); msNote = ''; return;
  }
  mods = visibleFor(me);
  if (!mods.length) { renderDenied(root, '이 계정에는 사용할 수 있는 모듈이 없습니다.', logout); return; }
  shell = renderShell(root, me, mods, { onLogout: logout }); recent = installRecent(me); docsOff = installShellDocks(shell, me); workTabs.attach(shell.tabsEl, { navigate: (h) => { location.hash = h; } }); shell.setResume((m) => (isDesktop() ? resumeHash(workTabs.list(), workTabs.currentKey(), m) : null));   // 사이드바로 돌아오면 직전에 작업하던 화면으로(데스크톱)
  startIdle({ onExpire: logout });   // 1시간 무동작 자동 로그아웃(옛 모듈 화면 안의 활동도 센다)
  route();
});
onChange(route);
checkForUpdate();   // 폰·앱 안 브라우저가 옛 화면을 붙들고 있으면 새 버전으로 바꾼다
