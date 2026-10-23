import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import crypto from 'node:crypto'; import { pathToFileURL } from 'node:url';
/* Microsoft 로그인 시험 페이지(대기열 00-0, 대표님 2026-10-23 "ㅇㅇ" — 시험 페이지 먼저).
 * 실제 로그인 화면을 바꾸기 전에, 별도 주소에서 Microsoft 로그인 → 서버 함수 msLogin 호출까지만 해 본다. 로그인(signInWithCustomToken)은 하지 않으므로 지금 세션과 기존 로그인은 그대로다.
 * 핵심 약속 세 가지: ① 어떤 경우에도 Firebase 로그인을 호출하지 않는다 ② id_token·커스텀 토큰 글자를 화면 결과에 담지 않는다 ③ state 가 "mstest." 로 시작할 때만 진입 파일이 시험 페이지로 보낸다.
 * 공개 저장소라 가짜 값만 쓴다. 기대값은 모두 손으로 적었다. */
const VER = (fs.readFileSync(new URL('../app/modules/plan/index.js', import.meta.url), 'utf8').match(/margin-link\.js\?v=([0-9a-z]+)/) || [])[1];
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => { const s = JSON.stringify(a) === JSON.stringify(b); ok(s, m + (s ? '' : ' ← 실제: ' + JSON.stringify(a) + ' / 기대: ' + JSON.stringify(b))); };
// 시험 대상 불러오기: 모듈이 firebase·pkce 를 가져오므로 가짜로 바꿔 임시 폴더에 둔다
const core = new URL('../app/core/', import.meta.url).pathname;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mst-'));
const rw = (s) => s.replace(/from '\.\/firebase\.js\?v=[^']+'/, "from './stub-firebase.mjs'").replace(/from '\.\/ms-pkce\.js\?v=[^']+'/, "from './ms-pkce.mjs'");
fs.writeFileSync(path.join(tmp, 'ms-login-test.mjs'), rw(fs.readFileSync(path.join(core, 'ms-login-test.js'), 'utf8')));
fs.copyFileSync(path.join(core, 'ms-pkce.js'), path.join(tmp, 'ms-pkce.mjs'));
fs.writeFileSync(path.join(tmp, 'stub-firebase.mjs'), "export const functions={name:'FN'}; export const httpsCallable=(f,n)=>(d)=>globalThis.__callable(n,d); export const auth={name:'AUTH'}; export const signInWithCustomToken=()=>{ globalThis.__signedIn=(globalThis.__signedIn||0)+1; };");
const BASE = 'https://x.github.io'; const loc = { origin: BASE, pathname: '/portal-test/app/ms-login-test.html', search: '', hash: '', assigned: [], assign(u) { this.assigned.push(u); } };
globalThis.location = loc; globalThis.history = { replaceState(_s, _t, url) { const u = new URL(url, BASE); loc.pathname = u.pathname; loc.search = u.search; loc.hash = u.hash; } };
const store = new Map(); globalThis.sessionStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const log = { fetch: [], callable: [] }; let fetchReply, callableReply;
globalThis.fetch = async (url, opts) => { log.fetch.push({ url, opts }); return fetchReply(); };
globalThis.__callable = async (n, d) => { log.callable.push([n, d]); return callableReply(); }; globalThis.__signedIn = 0;
const T = await import(pathToFileURL(path.join(tmp, 'ms-login-test.mjs')).href);
const reset = () => { log.fetch.length = log.callable.length = 0; loc.assigned.length = 0; loc.search = ''; loc.hash = ''; loc.pathname = '/portal-test/app/ms-login-test.html'; store.clear(); globalThis.__signedIn = 0; };
const b64u = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const mkTok = (claims) => b64u({ alg: 'RS256', kid: 'k' }) + '.' + b64u(claims) + '.' + 'sig'.repeat(30);
const NOW = Math.floor(Date.now() / 1000);
console.log('── 서버 응답 해석(interpretResult): 어느 단계까지 통과했는지');
const I = (code, message) => T.interpretResult({ code, message });
eq(T.interpretResult({ token: 'x' }).level, 'ok', '★ 토큰이 오면 성공(검증·계정·토큰 발급 모두 통과)');
ok(/IAM|토큰 발급/.test(T.interpretResult({ token: 'x' }).text) && /로그인하지/.test(T.interpretResult({ token: 'x' }).text), '성공 설명에 토큰 발급(IAM) 통과와 "로그인하지 않았다"가 있다');
eq([I('functions/not-found', 'no-account').level, I('not-found', 'no-account').level], ['warn', 'warn'], '★ no-account 는 경고(검증은 통과, 이 계정이 테섭에 없음) — 코드 앞의 functions/ 가 있든 없든');
ok(/검증.*통과/.test(I('functions/not-found', 'no-account').text) && /IAM.*확인되지/.test(I('functions/not-found', 'no-account').text), '★ no-account 설명: 검증은 통과했지만 IAM 은 아직 확인되지 않았다');
eq(I('functions/permission-denied', 'wrong-tenant').level, 'bad', 'wrong-tenant 는 실패(회사 계정이 아님)');
eq(I('functions/permission-denied', 'wrong-domain').level, 'bad', 'wrong-domain 도 실패');
for (const m of ['not-approved', 'disabled', 'guest-not-allowed']) eq(I('functions/permission-denied', m).level, 'warn', m + ' 는 경고(검증은 통과, 포털 쪽 상태 문제)');
eq(I('functions/not-found', 'not-registered').level, 'warn', 'not-registered 는 경고(포털 문서 없음)');
eq(I('functions/unauthenticated', 'invalid-token').level, 'bad', 'invalid-token 은 실패');
eq(I('functions/unauthenticated', 'nonce-mismatch').level, 'bad', 'nonce-mismatch 는 실패');
eq(I('functions/unauthenticated', 'stale-token').level, 'bad', 'stale-token 은 실패');
ok(I('functions/internal', 'internal').level === 'bad' && /signBlob|Token Creator|로그/.test(I('functions/internal', 'internal').text), '★ internal 은 실패이고 IAM(signBlob·Token Creator)·함수 로그 확인을 안내한다');
ok(I('functions/failed-precondition', 'server-not-configured').level === 'bad', 'server-not-configured 는 실패');
ok(I(undefined, undefined).level === 'bad' && I(null, null).level === 'bad' && T.interpretResult(null).level === 'bad' && T.interpretResult(undefined).level === 'bad', '이상한 응답(빈 값·null·undefined)은 실패이고 던지지 않는다');
ok(typeof I('x', '뭔가 이상한 코드').text === 'string' && I('x', '뭔가 이상한 코드').text.includes('뭔가 이상한 코드'), '모르는 코드는 코드 그대로 보여 준다');
console.log('── 토큰 본문의 표시용 클레임(claimsOf): 일부만, 토큰 글자는 담지 않는다');
{ const tok = mkTok({ tid: 'TENANT', preferred_username: 'Hong@JHSOL.KR', aud: 'CLIENT', iss: 'https://x/TENANT/v2.0', amr: ['pwd', 'mfa'], nonce: 'N'.repeat(20), iat: NOW, exp: NOW + 3600, oid: 'secret-oid', name: '홍길동', email: 'e@x' });
  const c = T.claimsOf(tok); eq([c.tid, c.preferred_username, c.aud, c.amr, c.mfa], ['TENANT', 'Hong@JHSOL.KR', 'CLIENT', ['pwd', 'mfa'], true], '★ 테넌트·사용자·앱·인증 방법(amr)·MFA 여부를 뽑는다');
  ok(c.iat === NOW && c.exp === NOW + 3600 && c.ageSec >= 0 && c.ageSec < 60, '발급·만료 시각과 발급 뒤 경과 초(60초 미만)');
  ok(!('oid' in c) && !('name' in c) && !('email' in c) && !JSON.stringify(c).includes('secret-oid') && !JSON.stringify(c).includes('홍길동'), '★ 표시에 쓰지 않는 값(oid·이름·email)은 담지 않는다'); }
eq(T.claimsOf(mkTok({ tid: 'T', amr: ['pwd'] })).mfa, false, 'amr 에 mfa 가 없으면 MFA 아님');
eq(T.claimsOf(mkTok({ tid: 'T' })).amr, [], 'amr 가 아예 없으면 빈 목록(v2 토큰에 안 올 수 있음 — 설계서의 알려진 한계)');
for (const bad of [null, undefined, '', 'x', 'a.b', 'a.!!!.c', 7, {}]) { let r, threw = false; try { r = T.claimsOf(bad); } catch (e) { threw = true; } ok(!threw && r && typeof r === 'object' && r.error === true, '이상한 토큰(' + JSON.stringify(bad) + ')은 던지지 않고 오류 표시');  }
{ const mid = b64u({ tid: 'T', preferred_username: 'a@jhsol.kr' }); eq([T.claimsOf('h.' + mid).error, T.claimsOf('h.' + mid + '.s.extra').error, T.claimsOf(mid).error], [true, true, true], '★ 세 조각이 아니면(2조각·4조각·1조각) 가운데가 올바른 JSON 이어도 오류로 본다 — 토큰 모양이 아니다'); }
console.log('── 시작: 시험용 state 접두사와 등록된 리디렉션 주소');
reset(); await T.startTest(); const au = new URL(loc.assigned[0]), q = au.searchParams;
ok(au.origin + au.pathname === 'https://login.microsoftonline.com/548fcb48-1ab8-4c47-8242-bc098ea80416/oauth2/v2.0/authorize', '★ 회사 테넌트의 인증 주소(공개 값)');
ok(q.get('client_id') === '3669b1e5-34e9-4630-a357-ac512a878a90' && q.get('response_type') === 'code' && q.get('code_challenge_method') === 'S256' && q.get('scope') === 'openid profile email', '앱 ID·코드 흐름·S256·범위');
ok(q.get('redirect_uri') === BASE + '/portal-test/app/', '★ 리디렉션 주소는 Entra 에 등록된 .../app/ (시험 페이지 주소가 아님 — 등록 안 된 주소는 Microsoft 가 거부한다)');
ok(q.get('state').startsWith('mstest.') && q.get('state') === store.get('mst_state'), '★ state 는 "mstest." 로 시작(진입 파일이 시험 페이지로 보내는 표지)이고 저장값과 같다');
ok(q.get('nonce') === store.get('mst_nonce') && store.get('mst_verifier').length >= 43, 'nonce·verifier 저장');
ok(q.get('code_challenge') === crypto.createHash('sha256').update(store.get('mst_verifier')).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), '챌린지 = SHA256(verifier)');
ok(!['ms_verifier', 'ms_state', 'ms_nonce', 'ms_hash'].some((k) => store.has(k)), '★ 본 로그인이 쓰는 저장 키(ms_*)는 건드리지 않는다(mst_* 만 사용 — 두 흐름이 섞이지 않는다)');
reset(); await T.startTest({ selectAccount: true }); ok(new URL(loc.assigned[0]).searchParams.get('prompt') === 'select_account', '계정 선택 강제 옵션(다른 계정으로 시험할 때)');
console.log('── 콜백 처리: 서버 호출까지만, 로그인은 하지 않는다');
const callback = async (reply) => { reset(); await T.startTest(); const S = { s: store.get('mst_state'), n: store.get('mst_nonce'), v: store.get('mst_verifier') }; loc.assigned.length = 0; loc.search = '?code=CODE9&state=' + S.s; fetchReply = async () => ({ ok: true, json: async () => ({ id_token: mkTok({ tid: 'TENANT', preferred_username: 'hong@jhsol.kr', aud: 'CLIENT', amr: ['pwd'], iat: NOW, exp: NOW + 3600, nonce: S.n }) }) }); callableReply = reply; const out = await T.finishTest(); return { S, out }; };
{ const { S, out } = await callback(async () => ({ data: { token: 'CUSTOM-TOKEN-SECRET' } }));
  ok(T.hasTestCallback() === false, '처리 뒤에는 콜백이 아님(주소 정리됨)');
  ok(log.fetch[0].url === 'https://login.microsoftonline.com/548fcb48-1ab8-4c47-8242-bc098ea80416/oauth2/v2.0/token' && log.fetch[0].opts.body.get('code') === 'CODE9' && log.fetch[0].opts.body.get('code_verifier') === S.v && log.fetch[0].opts.body.get('redirect_uri') === BASE + '/portal-test/app/', '토큰 교환: 같은 verifier·같은 리디렉션 주소');
  ok(log.callable.length === 1 && log.callable[0][0] === 'msLogin' && log.callable[0][1].nonce === S.n && typeof log.callable[0][1].idToken === 'string', '서버 함수 msLogin 에 id_token·nonce 전달');
  eq(out.result.level, 'ok', '★ 서버가 토큰을 주면 성공으로 해석');
  ok(globalThis.__signedIn === 0, '★★ 성공해도 Firebase 로그인(signInWithCustomToken)을 호출하지 않는다 — 현재 세션 불변');
  const shown = JSON.stringify(out); ok(!shown.includes('CUSTOM-TOKEN-SECRET'), '★ 커밋 토큰 글자가 결과에 없다'); ok(!shown.includes(mkTok({}).slice(0, 20)) && !/eyJ[A-Za-z0-9_-]{20,}/.test(shown), '★ id_token(JWT) 글자가 결과에 없다');
  ok(out.claims && out.claims.tid === 'TENANT' && out.claims.preferred_username === 'hong@jhsol.kr', '화면에 보일 클레임은 있다'); ok(['mst_verifier', 'mst_state', 'mst_nonce'].every((k) => !store.has(k)), '임시 저장값 정리'); }
{ const { out } = await callback(async () => { throw Object.assign(new Error('no-account'), { code: 'functions/not-found' }); }); eq([out.result.level, globalThis.__signedIn], ['warn', 0], '★ no-account → 경고, 로그인 호출 없음'); ok(out.claims && out.claims.tid === 'TENANT', '서버가 거부해도 클레임은 보여 준다(검증 단계 통과 증거)'); }
{ const { out } = await callback(async () => { throw Object.assign(new Error('internal'), { code: 'functions/internal' }); }); eq([out.result.level, globalThis.__signedIn], ['bad', 0], 'internal → 실패, 로그인 호출 없음'); }
console.log('── 콜백 실패 경로');
{ reset(); await T.startTest(); loc.search = '?code=C&state=mstest.WRONG'; const out = await T.finishTest(); ok(out.error === 'state-mismatch' && log.fetch.length === 0 && log.callable.length === 0 && globalThis.__signedIn === 0, '★ state 불일치면 토큰 교환도 서버 호출도 안 한다'); }
{ reset(); loc.search = '?code=C&state=mstest.X'; const out = await T.finishTest(); ok(out.error === 'state-mismatch' && log.fetch.length === 0, '저장값이 없으면(세션 유실) 거부'); }
{ reset(); loc.search = '?error=access_denied&error_description=x'; const out = await T.finishTest(); ok(out.error === 'ms-access_denied' && loc.search === '', 'Microsoft 가 오류를 돌려주면 그 코드를 보여 주고 주소를 정리'); }
{ reset(); await T.startTest(); loc.search = '?code=C&state=' + store.get('mst_state'); fetchReply = async () => ({ ok: false, json: async () => ({ error: 'invalid_grant', error_description: 'AADSTS70008 expired' }) }); const out = await T.finishTest(); ok(out.error === 'token-exchange-failed' && out.detail.includes('invalid_grant') && log.callable.length === 0 && globalThis.__signedIn === 0, '교환 실패 → 오류와 Microsoft 의 오류 코드를 보여 주고 서버 호출 안 함'); }
{ reset(); await T.startTest(); loc.search = '?code=C&state=' + store.get('mst_state'); fetchReply = async () => ({ ok: true, json: async () => ({}) }); const out = await T.finishTest(); ok(out.error === 'token-exchange-failed' && log.callable.length === 0, 'id_token 이 없으면 교환 실패'); }
console.log('── 진입 파일(app/index.html): 시험용 콜백일 때만 시험 페이지로 보낸다');
{ const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  const m = html.match(/<script>\(function\(\)\{[^<]*mstest[^<]*\}\)\(\);<\/script>/); ok(!!m, '★ index.html 의 head 에 시험 페이지 이동 스크립트가 있다');
  const idx = (re) => html.search(re); ok(m && html.indexOf(m[0]) < idx(/<script[^>]*src="core\/boot\.js/) && html.indexOf(m[0]) < idx(/<\/head>/), '★ 이동 스크립트는 앱 부팅(core/boot.js)보다 앞, head 안에 있다(앱이 시작되기 전에 이동)');
  const code = m ? m[0].replace(/^<script>/, '').replace(/<\/script>$/, '') : '';
  const gate = (search) => { const moved = []; const L = { search, replace: (u) => moved.push(u) }; try { new Function('location', code)(L); } catch (e) { return { threw: true }; } return { moved }; };
  eq(gate('?code=C1&state=mstest.ABC').moved, ['ms-login-test.html?code=C1&state=mstest.ABC'], '★ state 가 mstest. 로 시작하는 콜백은 같은 폴더의 시험 페이지로 쿼리를 그대로 가지고 이동');
  eq(gate('?error=access_denied&state=mstest.ABC').moved, ['ms-login-test.html?error=access_denied&state=mstest.ABC'], '오류 콜백(error=)도 시험 페이지로(실패 사유를 보여 주려고)');
  eq(gate('?state=mstest.ABC&code=C1').moved, ['ms-login-test.html?state=mstest.ABC&code=C1'], '쿼리 순서가 달라도(state 가 앞) 이동');
  for (const q of ['', '?code=C1&state=ms.ABC', '?code=C1&state=abc', '?code=C1', '?state=mstest.ABC', '?foo=mstest.&code=1', '?x=1&notstate=mstest.A&code=1', '?code=C&state=xmstest.A', '?r=123', '#/edoc/new']) eq(gate(q).moved, [], '★ 일반 사용은 이동하지 않는다: ' + JSON.stringify(q));
  ok(!gate('?code=C1&state=mstest.ABC').threw && !gate('').threw, '스크립트가 던지지 않는다'); }
console.log('── 콜백 감지·안전');
reset(); ok(!T.hasTestCallback(), '일반 주소는 콜백이 아님'); loc.search = '?code=a&state=mstest.b'; ok(T.hasTestCallback(), '★ state 가 mstest. 로 시작하는 콜백만 감지'); loc.search = '?code=a&state=ms.b'; ok(!T.hasTestCallback(), '본 로그인의 콜백(state 가 mstest. 가 아님)은 시험 페이지가 가로채지 않는다'); loc.search = '?code=a'; ok(!T.hasTestCallback(), 'state 없는 code 는 무시');
ok(pass + fail >= 76, '★ 시험이 끝까지 실행됨(중간에 예외로 중단돼도 FAIL 0 으로 보이지 않게)');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
