import fs from 'node:fs';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const code = (html.match(/<script>\/\* 시작 감시[^]*?\*\/\n?([^]*?)<\/script>/) || [])[1];
ok(!!code && /DELAYS = \[2000, 5000, 10000\]/.test(code) && /location\.replace/.test(code), '시작 감시 스크립트가 index.html 에 있고 재시도 간격은 2·5·10초');
/** 가짜 브라우저로 실행: 시작 감시가 만든 타이머·재불러오기·저장소를 관찰한다 */
function run(opts) {
  const o = Object.assign({ stored: null, now: 1000000 }, opts || {}); const timers = [], intervals = [], listeners = {}, replaced = []; const store = {}; if (o.stored) store.jh_boot_retry = JSON.stringify(o.stored);
  const mk = (html) => { const c = { _attrs: {}, getAttribute(k) { return this._attrs[k] || null; }, children: [], appendChild() {}, firstChild: null }; const m = /data-boot="1"/.test(html); if (m) c._attrs['data-boot'] = '1'; return c; };
  const root = { children: [mk('')], textContent: '불러오는 중…', firstChild: null, _html: '' }; root.firstChild = root.children[0];
  Object.defineProperty(root, 'innerHTML', { set(v) { this._html = v; const c = mk(v); c.appendChild = (n) => { root.textContent += n && n.data !== undefined ? n.data : (n && n.textContent) || ''; }; this.children = [c]; this.firstChild = c; this.textContent = ''; }, get() { return this._html; } });
  const document = { getElementById: () => root, createTextNode: (t) => ({ data: t }), createElement: () => ({ style: {}, href: '', textContent: '' }) };
  const window = { addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); } };
  const sessionStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const location = { pathname: '/portal-test/app/', hash: '#/home', replace: (u) => replaced.push(u) };
  const DateX = { now: () => o.now };
  new Function('window', 'document', 'sessionStorage', 'location', 'setTimeout', 'setInterval', 'clearInterval', 'Date', code)(window, document, sessionStorage, location, (f, ms) => { timers.push({ f, ms }); return timers.length; }, (f, ms) => { intervals.push({ f, ms }); return intervals.length; }, () => {}, DateX);
  return { root, timers, intervals, listeners, replaced, store, fire: (t, ev) => (listeners[t] || []).forEach((f) => f(ev)), text: () => root.textContent };
}
let r = run(); r.fire('error', { target: { tagName: 'SCRIPT' } });
ok(r.timers.some((t) => t.ms === 2000) && /자동으로 다시 불러오는 중입니다… \(1\/3\)/.test(r.text()) && r.replaced.length === 0, '★ 시작 파일(스크립트)이 못 불러와지면 즉시 알아채 "자동으로 다시 불러오는 중 (1/3)" 표시, 2초 뒤 다시 불러옴 예약');
r.timers.find((t) => t.ms === 2000).f(); ok(r.replaced.length === 1 && /^\/portal-test\/app\/\?r=\d+#\/home$/.test(r.replaced[0]) && JSON.parse(r.store.jh_boot_retry).n === 1, '2초 뒤 같은 화면 주소(#/home 유지)로 새로 불러오고, 시도 횟수 1을 기록');
r = run({ stored: { n: 1, t: 1000000 - 5000 } }); r.fire('error', { target: { tagName: 'SCRIPT' } }); ok(r.timers.some((t) => t.ms === 5000) && /\(2\/3\)/.test(r.text()), '두 번째 시도는 5초 뒤(2/3)');
r = run({ stored: { n: 2, t: 1000000 - 5000 } }); r.fire('error', { target: { tagName: 'SCRIPT' } }); ok(r.timers.some((t) => t.ms === 10000) && /\(3\/3\)/.test(r.text()), '세 번째 시도는 10초 뒤(3/3)');
r = run({ stored: { n: 3, t: 1000000 - 5000 } }); r.fire('error', { target: { tagName: 'SCRIPT' } }); ok(!r.timers.some((t) => [2000, 5000, 10000].indexOf(t.ms) !== -1) && /화면을 불러오지 못했습니다/.test(r.text()) && r.replaced.length === 0, '★ 3번 다시 불러와도 안 되면 더 반복하지 않고(무한 반복 방지) "다시 불러오기" 링크를 보여 줌');
r = run({ stored: { n: 3, t: 1000000 - 130000 } }); r.fire('error', { target: { tagName: 'SCRIPT' } }); ok(r.timers.some((t) => t.ms === 2000), '2분이 지난 옛 시도 기록은 무시하고 처음부터(다음 배포 때 또 자동으로 시도)');
r = run(); r.fire('unhandledrejection', { reason: new TypeError('Failed to fetch dynamically imported module: https://x/app/core/boot.js') }); ok(r.timers.some((t) => t.ms === 2000), '동적으로 가져오는 모듈 실패(unhandledrejection)도 같은 방식으로 자동 재시도');
r = run(); r.fire('unhandledrejection', { reason: new Error('내 오류: 권한 없음') }); r.fire('error', { message: '화면 오류', target: {} }); ok(!r.timers.some((t) => t.ms === 2000) && r.replaced.length === 0, '시작과 무관한 오류(권한·화면 오류)로는 다시 불러오지 않음');
r = run(); r.fire('error', { target: { tagName: 'SCRIPT' } }); r.fire('error', { target: { tagName: 'SCRIPT' } }); r.fire('unhandledrejection', { reason: new TypeError('Failed to fetch dynamically imported module') }); ok(r.timers.filter((t) => t.ms === 2000).length === 1, '오류가 여러 번 와도 다시 불러오기는 한 번만 예약');
r = run({ stored: { n: 2, t: 1000000 } }); r.root.children = [{ getAttribute: () => null }, { getAttribute: () => null }]; r.intervals[0].f(); ok(!('jh_boot_retry' in r.store), '★ 앱이 정상으로 뜨면(화면이 그려지면) 시도 횟수 기록을 지움');
r = run(); const wd = r.timers.find((t) => t.ms === 15000); ok(!!wd, '15초 감시는 그대로'); wd.f(); ok(r.timers.some((t) => t.ms === 2000), '15초가 지나도 "불러오는 중…"이면 자동 재시도');
r = run(); r.root.children = [{ getAttribute: () => null }, { getAttribute: () => null }]; r.fire('error', { target: { tagName: 'SCRIPT' } }); ok(!r.timers.some((t) => t.ms === 2000), '이미 정상으로 뜬 뒤에는(다른 스크립트 오류 등) 화면을 지우거나 다시 불러오지 않음');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
