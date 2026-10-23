// node tests/ms-login-profile.test.mjs  (인자 없으면 저장소의 app/core 를 시험한다 — 자동 검사가 이 방식으로 부른다)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import assert from 'node:assert'; import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url';
const core = process.argv[2] || new URL('../app/core/', import.meta.url).pathname; const { JSDOM } = createRequire(import.meta.url)('../scripts/dev/node_modules/jsdom');   // 저장소 규칙: 개발용 의존성은 scripts/dev 에 설치된다(자동 검사의 npm ci)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-'));
const rd = (f) => fs.readFileSync(path.join(core, f), 'utf8');
fs.writeFileSync(path.join(tmp, 'profile.mjs'), rd('profile.js').replace(/from '\.\/firebase\.js\?v=[^']+'/, "from './stub-fb.mjs'").replace(/from '\.\/ui\.js\?v=[^']+'/, "from './ui.mjs'").replace(/from '\.\/profile-logic\.js\?v=[^']+'/, "from './logic.mjs'").replace(/from '\.\.\/shared\/identity\.js\?v=[^']+'/, "from './stub-id.mjs'"));
fs.writeFileSync(path.join(tmp, 'ui.mjs'), rd('ui.js')); fs.writeFileSync(path.join(tmp, 'logic.mjs'), rd('profile-logic.js'));
fs.writeFileSync(path.join(tmp, 'stub-fb.mjs'), "const f=()=>{}; export const auth={currentUser:null}, db={}, doc=f, getDoc=async()=>({exists:()=>false,data:()=>({})}), getDocs=async()=>({forEach(){}}), updateDoc=async()=>{}, collection=f, query=f, where=f, updatePassword=async()=>{}, reauthenticateWithCredential=async()=>{}, EmailAuthProvider={credential:()=>({})};");
fs.writeFileSync(path.join(tmp, 'stub-id.mjs'), "export const revealOwn=async()=>({}), maskView=()=>'', identityErrorText=()=>'';");
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const dom = new JSDOM('<body></body>'); globalThis.document = dom.window.document; globalThis.window = dom.window;
const { openProfile } = await import(pathToFileURL(path.join(tmp, 'profile.mjs')).href);
const base = { name: '홍길동', rank: '사원', dept: 'PJT팀', empNo: '26001', email: 'hy.lee@jhsol.kr', uid: 'U' };
async function open(me) { document.body.innerHTML = ''; document.body.style.overflow = ''; openProfile(me, null); await new Promise((r) => setTimeout(r, 0)); return document.getElementById('jh-profile-dialog'); }
let w = await open(Object.assign({}, base, { isGuest: false, pwLogin: false }));
ok(w && !w.querySelector('[data-save-pw]') && !w.querySelector('#pf-cur') && !w.textContent.includes('비밀번호 변경'), '정규 직원: 비밀번호 변경 없음');
ok(w.querySelector('[data-save-phone]') && w.querySelector('details[aria-label="내 인사 정보"]'), '정규 직원: 전화번호·내 인사 정보는 그대로');
w = await open(Object.assign({}, base, { isGuest: true, pwLogin: false })); ok(w.querySelector('[data-save-pw]') && w.querySelector('#pf-cur') && w.querySelector('[data-save-phone]'), 'GUEST: 비밀번호 변경 표시');
w = await open(Object.assign({}, base, { isGuest: false, pwLogin: true })); ok(w.querySelector('[data-save-pw]'), 'pwLogin 계정: 비밀번호 변경 표시');
w = await open(Object.assign({}, base, {})); ok(!w.querySelector('[data-save-pw]'), '플래그가 없으면(undefined) 숨김');
console.log('내 정보 창 시험 ' + n + '건 통과');
