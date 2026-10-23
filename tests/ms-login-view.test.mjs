// node tests/ms-login-view.test.mjs  (인자 없으면 저장소의 app/core 를 시험한다 — 자동 검사가 이 방식으로 부른다)
import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert'; import { createRequire } from 'node:module';
const core = process.argv[2] || new URL('../app/core/', import.meta.url).pathname; const { JSDOM } = createRequire(import.meta.url)('../scripts/dev/node_modules/jsdom');   // 저장소 규칙: 개발용 의존성은 scripts/dev 에 설치된다(자동 검사의 npm ci)
const shell = fs.readFileSync(path.join(core, 'shell.js'), 'utf8'); const ui = fs.readFileSync(path.join(core, 'ui.js'), 'utf8');
const fnSrc = shell.slice(shell.indexOf('export function renderLogin'), shell.indexOf('export function renderDenied')).replace('export function', 'function');
const escSrc = ui.slice(ui.indexOf('export function esc('), ui.indexOf('export function escMultiline')).replace('export function', 'function');
const make = new Function(escSrc + '\n' + fnSrc + '\nreturn renderLogin;')();
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const tick = () => new Promise((r) => setTimeout(r, 0));
function mount(opts) { const dom = new JSDOM('<div id="root"></div>'); const root = dom.window.document.getElementById('root'); make(root, opts); return { dom, root, d: dom.window.document, w: dom.window }; }

// 화면 구성 — 탭 두 개(직원 계정 로그인 | Guest 계정 로그인, 대표님 2026-10-23 "직원 계정 로그인 | Guest 계정 로그인")
let v = mount({ onSubmit: async () => {}, onMicrosoft: async () => {}, message: '' });
const tabs = [...v.d.querySelectorAll('[role=tab]')], panels = [...v.d.querySelectorAll('[role=tabpanel]')];
const btn = v.d.getElementById('jh-ms-btn'), form = v.d.getElementById('jh-login-form');
ok(tabs.length === 2 && tabs[0].textContent.trim() === '직원 계정 로그인' && tabs[1].textContent.trim() === 'Guest 계정 로그인', '★ 탭이 두 개이고 이름은 "직원 계정 로그인"·"Guest 계정 로그인"');
ok(tabs.every((t) => t.type === 'button') && tabs[0].getAttribute('aria-selected') === 'true' && tabs[1].getAttribute('aria-selected') === 'false', '★ 처음에는 직원 계정 로그인 탭이 선택돼 있다(탭 버튼은 폼 제출과 섞이지 않는 type=button)');
ok(panels.length === 2 && !panels[0].hidden && panels[1].hidden && panels[0].contains(btn) && panels[1].contains(form), '★ 직원 패널에 Microsoft 버튼이 보이고 Guest 패널(아이디·비밀번호 폼)은 숨겨져 있다');
ok(tabs.every((t, i) => t.getAttribute('aria-controls') === panels[i].id && panels[i].getAttribute('aria-labelledby') === t.id), '탭과 패널이 aria 로 서로 연결돼 있다(스크린리더)');
ok(btn && btn.textContent === 'Microsoft로 로그인' && btn.type === 'button' && !btn.closest('form'), 'Microsoft 버튼은 폼 밖(게스트 폼 제출과 섞이지 않음)');
ok(form.querySelector('#jh-id') && form.querySelector('#jh-pw[type=password]') && form.querySelector('#jh-login-btn[type=submit]'), 'Guest 패널에 아이디·비밀번호 칸과 로그인 버튼이 있다');
ok(v.d.getElementById('jh-login-msg').getAttribute('role') === 'alert' && !panels.some((pn) => pn.contains(v.d.getElementById('jh-login-msg'))), '안내 칸은 alert 이고 두 패널 밖(두 탭이 같이 쓴다)');
tabs[1].click(); await tick();
ok(tabs[1].getAttribute('aria-selected') === 'true' && tabs[0].getAttribute('aria-selected') === 'false' && panels[0].hidden && !panels[1].hidden, '★ Guest 탭을 누르면 선택이 바뀌고 직원 패널이 숨고 Guest 패널(아이디·비밀번호)이 보인다');
tabs[0].click(); await tick();
ok(tabs[0].getAttribute('aria-selected') === 'true' && !panels[0].hidden && panels[1].hidden, '직원 탭을 다시 누르면 되돌아온다');
tabs[0].focus(); tabs[0].dispatchEvent(new v.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await tick();
ok(tabs[1].getAttribute('aria-selected') === 'true' && v.d.activeElement === tabs[1], '키보드 → 로 다음 탭(Guest)으로 이동하고 포커스도 따라간다');
tabs[1].dispatchEvent(new v.w.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); await tick();
ok(tabs[0].getAttribute('aria-selected') === 'true' && v.d.activeElement === tabs[0], '키보드 ← 로 이전 탭(직원)으로 이동');
tabs[0].dispatchEvent(new v.w.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); await tick();
ok(tabs[0].getAttribute('aria-selected') === 'true', '첫 탭에서 ← 를 눌러도 그대로(순환하지 않고 던지지 않는다)');
// 메시지 이스케이프
v = mount({ onSubmit: async () => {}, onMicrosoft: async () => {}, message: '<img src=x onerror=alert(1)>안내' });
ok(v.d.querySelectorAll('img').length === 0 && v.d.getElementById('jh-login-msg').textContent.includes('<img'), '안내문의 HTML 은 글자로만 표시');
// Microsoft 버튼 동작
let called = 0; v = mount({ onSubmit: async () => {}, onMicrosoft: async () => { called++; await new Promise(() => {}); } });   // 화면이 넘어가 끝나지 않는 상황
v.d.getElementById('jh-ms-btn').click(); await tick();
ok(called === 1 && v.d.getElementById('jh-ms-btn').disabled && v.d.getElementById('jh-ms-btn').textContent.includes('이동'), '클릭 → 한 번만 호출, 버튼 잠금·이동 중 표시');
v.d.getElementById('jh-ms-btn').click(); await tick(); ok(called === 1, '잠긴 버튼 중복 클릭 무시');
v = mount({ onSubmit: async () => {}, onMicrosoft: async () => { throw new Error('x'); } }); v.d.getElementById('jh-ms-btn').click(); await tick();
ok(v.d.getElementById('jh-login-msg').textContent.includes('시작하지 못했습니다') && !v.d.getElementById('jh-ms-btn').disabled && v.d.getElementById('jh-ms-btn').textContent === 'Microsoft로 로그인', '시작 실패 → 안내문, 버튼 복구');
// 게스트 폼
const got = []; v = mount({ onSubmit: async (id, pw) => { got.push([id, pw]); throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.'); }, onMicrosoft: async () => {} });
v.d.getElementById('jh-tab-guest').click(); v.d.getElementById('jh-id').value = 'kt.lee'; v.d.getElementById('jh-pw').value = 'pw!'; v.d.getElementById('jh-login-form').dispatchEvent(new v.w.Event('submit', { cancelable: true })); await tick();
ok(JSON.stringify(got) === JSON.stringify([['kt.lee', 'pw!']]), '게스트 폼 제출 → onSubmit(아이디, 비밀번호)');
ok(v.d.getElementById('jh-login-msg').textContent.includes('올바르지 않습니다') && !v.d.getElementById('jh-login-btn').disabled && v.d.getElementById('jh-login-btn').textContent === '로그인', '실패 → 안내문, 버튼 복구');
const ev = new v.w.Event('submit', { cancelable: true }); v.d.getElementById('jh-login-form').dispatchEvent(ev); ok(ev.defaultPrevented, '폼 기본 제출(페이지 이동) 차단');
console.log('로그인 화면 시험 ' + n + '건 통과');
