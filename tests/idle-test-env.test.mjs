import fs from 'node:fs';
import vm from 'node:vm';
/* 테섭(주소에 /portal-test/)은 자동 로그아웃 없음, 본섭 주소는 그대로 1시간(대표님 2026-10-24 "테섭은 로그아웃 제한시간 없애줘"). 이 파일은 옛 화면(classic.html)의 자동 로그아웃 코드를 그대로 꺼내 가짜 환경에서 실행해 확인한다. 새 플랫폼·폰용 가드는 tests/idle-test-env.test.py(크로미움). */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const html = fs.readFileSync(new URL('../classic.html', import.meta.url), 'utf8');
const a = html.indexOf('/* ── 자동 로그아웃 (1시간 무동작) ── */'), b = html.indexOf('// ── hr → portal_users 연동 수신기 ──');
ok(a > 0 && b > a, 'classic.html 에서 자동 로그아웃 구간을 찾았다');
const block = html.slice(a, b);
function run(pathname, loggedIn) {
  const timers = [], listeners = {}, toasts = [], logouts = [];
  const ctx = { location: { pathname }, document: { addEventListener: (e, f) => { listeners[e] = f; } }, setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].cleared = true; }, toast: (m) => toasts.push(m), doLogout: () => logouts.push(1) };
  vm.createContext(ctx);
  vm.runInContext('let me = ' + (loggedIn ? '{ uid: "u" }' : 'null') + ';\n' + block + '\nglobalThis.__reset = resetAutoLogout;', ctx);
  ctx.__reset(); const live = timers.filter((t) => !t.cleared);
  return { timers, live, listeners, toasts, logouts };
}
{ const r = run('/portal-test/classic.html', true); ok(r.live.length === 0 && r.toasts.length === 0 && r.logouts.length === 0, '★ 테섭 주소(/portal-test/classic.html)에서 로그인 상태여도 자동 로그아웃 타이머가 만들어지지 않는다'); }
{ const r = run('/portal-test/classic.html', true); Object.values(r.listeners).forEach((f) => f()); ok(r.timers.length === 0, '★ 활동 이벤트(클릭·키·이동)가 와도 테섭에서는 타이머가 생기지 않는다'); }
{ const r = run('/classic.html', true); ok(r.live.length === 1 && r.live[0].ms === 3600000, '★ 본섭 주소(/classic.html)는 그대로 1시간(3,600,000ms) 타이머가 걸린다'); r.live[0].f(); ok(r.toasts.length === 1 && /1시간 동안 활동이 없어/.test(r.toasts[0]), '본섭: 만료되면 안내를 띄우고'); const t2 = r.timers[r.timers.length - 1]; t2.f(); ok(r.logouts.length === 1, '본섭: 2초 뒤 실제로 로그아웃한다'); }
{ const r = run('/portal/classic.html', true); ok(r.live.length === 1, '본섭이 하위 폴더(/portal/…)여도 /portal-test/ 가 아니면 자동 로그아웃이 켜진다'); }
{ const r = run('/portal-test-old/classic.html', true); ok(r.live.length === 1, '이름이 비슷한 주소(/portal-test-old/)는 테섭으로 오인하지 않는다'); }
{ const r = run('/classic.html', false); ok(r.live.length === 0, '로그인하지 않은 상태에서는 어디서든 타이머가 없다(기존 동작)'); }
console.log('\n' + (fail ? fail + '건 실패 / 통과 ' + pass : '전부 통과 (' + pass + '건)')); process.exit(fail ? 1 : 0);
