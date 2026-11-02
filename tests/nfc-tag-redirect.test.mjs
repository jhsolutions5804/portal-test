// 2026-11-02: 사무실 스티커의 테섭 주소(…/portal-test/m/tag.html)가 본섭 태그 페이지로 이어지는지 — m/tag.html 의 첫 일반 <script> 를 가짜 location 으로 실행해 본다
import { readFileSync } from 'node:fs'; import vm from 'node:vm';
const html = readFileSync(new URL('../m/tag.html', import.meta.url), 'utf8');
const m = /<script>\s*\/\*[\s\S]*?\*\/\s*([\s\S]*?)<\/script>/.exec(html);
let pass = 0, fail = 0; const ok = (c, msg) => { if (c) { pass++; console.log('OK   ' + msg); } else { fail++; console.log('FAIL ' + msg); } };
ok(!!m, '태그 페이지에 이동용 일반 스크립트가 있음');
function run(pathname, search = '', hash = '') {
  const calls = []; const attrs = {};
  const ctx = { location: { pathname, search, hash, replace: (u) => calls.push(u) }, document: { documentElement: { setAttribute: (k, v) => { attrs[k] = v; } } } };
  vm.runInNewContext(m[1], ctx); return { to: calls[0] || null, attrs };
}
let r = run('/portal-test/m/tag.html'); ok(r.to === 'https://portal.jhsol.kr/m/tag.html' && r.attrs['data-jh-redirect'] === '1', '테섭 주소로 들어오면 본섭 태그 페이지로 이동하고 표시를 남김');
r = run('/portal-test/m/tag.html', '?x=1', '#a'); ok(r.to === 'https://portal.jhsol.kr/m/tag.html?x=1#a', '뒤에 붙은 ?…·#… 도 그대로 넘김');
r = run('/m/tag.html'); ok(r.to === null && !r.attrs['data-jh-redirect'], '본섭 주소(/m/tag.html)에서는 아무 일도 하지 않음');
r = run('/portal-test/m/tag.html', '?stay=1'); ok(r.to === null, '테섭에서 ?stay=1 을 붙이면 이동하지 않음(테섭 시험용)');
r = run('/portal-test/m/tag.html', '?a=1&stay=1'); ok(r.to === null, '?a=1&stay=1 도 이동하지 않음');
r = run('/portal-test/m/tag.html', '?stay=10'); ok(r.to !== null, 'stay=10 같은 다른 값은 이동함(정확히 stay=1 만 예외)');
r = run('/portal-test/m/other.html'); ok(r.to === null, '다른 페이지(/portal-test/m/other.html)는 건드리지 않음');
r = run('/portal-test/app/'); ok(r.to === null, '테섭 앱 화면(/portal-test/app/)은 건드리지 않음');
ok(/hasAttribute\('data-jh-redirect'\)\) return;/.test(html), '이동 중에는 태그 처리(run)를 하지 않음(기기 토큰·서버 호출 방지)');
ok(html.includes("../app/core/firebase.js") && !html.includes('portal.jhsol.kr/app/'), '태그 페이지는 상대 경로(../app/)라 본섭에 그대로 복사해도 본섭 파일을 씀');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
