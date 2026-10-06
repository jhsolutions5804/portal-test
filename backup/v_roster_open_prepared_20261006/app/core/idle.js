/* 자동 로그아웃(2시간 무동작) — 옛 포털에는 있고 새 플랫폼에는 없던 기능(홈 대장 H-05).
 * 옛 포털과 다른 점: ① 옛 모듈 화면(iframe) 안에서 일하는 것도 "활동"으로 센다 ② 1분 전에 알려 주고 "계속 사용"으로 연장할 수 있다
 * ③ 마지막 활동 시각을 이 기기의 localStorage 에 두어 같은 브라우저의 다른 창에서 일하고 있으면 이 창도 유지된다 ④ 시계 기준이라 잠자기·백그라운드 뒤에 돌아와도 즉시 판단한다. */
import { IS_TEST } from './config.js?v=20261006d';
import { esc } from './ui.js?v=20261006d';
import { idleStatus, createIdleWatch, IDLE_LIMIT_MS, IDLE_WARN_MS, durationText } from './idle-logic.js?v=20261006d';
export { idleStatus, createIdleWatch, IDLE_LIMIT_MS, IDLE_WARN_MS, durationText };

const KEY = 'jh_last_active';
export const OUT_FLAG = 'jh_idle_out';       // 자동 로그아웃 직후 로그인 화면에 안내를 띄우기 위한 표시(sessionStorage)
const EVENTS = ['click', 'keydown', 'mousemove', 'touchstart', 'scroll', 'wheel'];
const num = (k) => { try { const v = +localStorage.getItem(k); return v > 0 ? v : 0; } catch (e) { return 0; } };
let watch = null; let timer = null; let dlg = null; let listeners = [];
const PASSIVE = { mousemove: 1, scroll: 1, wheel: 1 };
/** 경고창이 떠 있는 동안에는 마우스 이동·스크롤(수동적 신호)을 무시한다 — 계속 사용 버튼으로 마우스를 옮기는 순간 경고가 사라져 뒤에 있는 화면을 잘못 누르는 일을 막는다.
 *  키 입력·클릭·터치(분명한 사용)는 활동으로 센다. */
export function touchActivity(ev) { if (!watch) return; if (watch.state === 'warn' && ev && PASSIVE[ev.type]) return; watch.touch(); }
/** 같은 출처의 문서(옛 모듈 화면 iframe)의 활동도 센다 */
export function attachActivity(doc) {
  if (!doc || !doc.addEventListener) return;
  EVENTS.forEach((e) => doc.addEventListener(e, touchActivity, { passive: true, capture: true }));
}
function showWarn(remainMs, onNow, onKeep) {
  const s = Math.max(1, Math.ceil(remainMs / 1000));
  if (!dlg) {
    dlg = document.createElement('div'); dlg.className = 'jh-dialog jh-idle'; dlg.setAttribute('role', 'alertdialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-labelledby', 'jh-idle-title');
    dlg.innerHTML = '<div class="jh-dialog__backdrop"></div><div class="jh-dialog__panel"><h3 class="jh-dialog__title" id="jh-idle-title">곧 자동 로그아웃됩니다</h3><div class="jh-dialog__body"><span data-idle-msg></span></div>' +
      '<div class="jh-dialog__actions"><button type="button" class="jh-btn" data-variant="ghost" data-idle-now>지금 로그아웃</button><button type="button" class="jh-btn" data-variant="primary" data-idle-keep>계속 사용</button></div></div>';
    document.body.appendChild(dlg);
    dlg.querySelector('[data-idle-now]').addEventListener('click', onNow); dlg.querySelector('[data-idle-keep]').addEventListener('click', onKeep); dlg.querySelector('[data-idle-keep]').focus();
  }
  dlg.querySelector('[data-idle-msg]').textContent = '활동이 없어 ' + s + '초 뒤 자동 로그아웃됩니다. 계속 사용하시겠습니까?';
}
function hideWarn() { if (dlg) { dlg.remove(); dlg = null; } }

/** 로그인한 동안 시작한다. onExpire = 실제 로그아웃(auth.logout). 반환값 = 중지 함수 */
export function startIdle({ onExpire }) {
  stopIdle();
  const limitMs = (IS_TEST && num('jh_idle_ms')) || IDLE_LIMIT_MS; const warnMs = (IS_TEST && num('jh_idle_warn_ms')) || IDLE_WARN_MS;   // 테섭에서만 시험용으로 줄일 수 있다
  const getLast = () => { try { return +localStorage.getItem(KEY) || 0; } catch (e) { return 0; } };
  const setLast = (t) => { try { localStorage.setItem(KEY, String(t)); } catch (e) { /* 저장 못 하면 이 창의 활동만 센다 */ } };
  setLast(Date.now());
  const doLogout = () => { try { sessionStorage.setItem(OUT_FLAG, String(limitMs)); } catch (e) { /* 표시 못 해도 로그아웃은 한다 */ } hideWarn(); onExpire(); };
  watch = createIdleWatch({ limitMs, warnMs, now: Date.now, getLast, setLast, onWarn: (r) => showWarn(r, doLogout, () => watch && watch.touch()), onActive: hideWarn, onExpire: doLogout });
  attachActivity(document);
  timer = setInterval(() => watch && watch.tick(), 1000);
  const vis = () => { if (!document.hidden && watch) watch.tick(); };
  document.addEventListener('visibilitychange', vis); listeners.push(() => document.removeEventListener('visibilitychange', vis));
  return stopIdle;
}
export function stopIdle() {
  if (watch) watch.stop(); watch = null; if (timer) clearInterval(timer); timer = null; hideWarn();
  EVENTS.forEach((e) => document.removeEventListener(e, touchActivity, true)); listeners.forEach((f) => f()); listeners = [];
}
