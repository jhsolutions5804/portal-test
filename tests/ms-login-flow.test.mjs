// node tests/ms-login-flow.test.mjs  (인자 없으면 저장소의 app/core 를 시험한다 — 자동 검사가 이 방식으로 부른다)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import crypto from 'node:crypto'; import assert from 'node:assert'; import { pathToFileURL } from 'node:url';
const core = process.argv[2] || new URL('../app/core/', import.meta.url).pathname;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'msflow-'));
const rw = (s) => s.replace(/from '\.\/firebase\.js\?v=[^']+'/, "from './stub-firebase.mjs'").replace(/from '\.\/config\.js\?v=[^']+'/, "from './stub-config.mjs'").replace(/from '\.\/ms-pkce\.js\?v=[^']+'/, "from './ms-pkce.mjs'");
fs.writeFileSync(path.join(tmp, 'ms-auth.mjs'), rw(fs.readFileSync(path.join(core, 'ms-auth.js'), 'utf8')));
fs.copyFileSync(path.join(core, 'ms-pkce.js'), path.join(tmp, 'ms-pkce.mjs'));
fs.writeFileSync(path.join(tmp, 'stub-firebase.mjs'), "export const auth={name:'AUTH'}; export const functions={name:'FN'}; export const httpsCallable=(f,n)=>(d)=>globalThis.__callable(n,d); export const signInWithCustomToken=(a,t)=>globalThis.__signIn(a,t);");
fs.writeFileSync(path.join(tmp, 'stub-config.mjs'), "export const MS_TENANT_ID='TENANT'; export const MS_CLIENT_ID='CLIENT';");
// 가짜 브라우저
const BASE = 'https://x.github.io'; const loc = { origin: BASE, pathname: '/portal-test/app/', search: '', hash: '#/edoc/new', assigned: [], assign(u) { this.assigned.push(u); } };
globalThis.location = loc;
globalThis.history = { replaceState(_s, _t, url) { const u = new URL(url, BASE); loc.pathname = u.pathname; loc.search = u.search; loc.hash = u.hash; } };
const store = new Map(); globalThis.sessionStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const log = { fetch: [], callable: [], signIn: [] }; let fetchReply, callableReply;
globalThis.fetch = async (url, opts) => { log.fetch.push({ url, opts }); return fetchReply(); };
globalThis.__callable = async (n, d) => { log.callable.push([n, d]); return callableReply(); };
globalThis.__signIn = async (a, t) => { log.signIn.push([a.name, t]); };
const ms = await import(pathToFileURL(path.join(tmp, 'ms-auth.mjs')).href);
const reset = () => { log.fetch.length = log.callable.length = log.signIn.length = 0; loc.assigned.length = 0; loc.search = ''; loc.hash = '#/edoc/new'; store.clear(); };
const b64u = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const rejects = async (p, code) => { try { await p; assert.fail('통과하면 안 됨 ' + code); } catch (e) { assert.strictEqual(e.msCode, code, '코드 ' + e.msCode); n++; return e; } };

// 1) 시작: 인증 주소·저장값·PKCE 일관성
reset(); await ms.startMicrosoftLogin();
const au = new URL(loc.assigned[0]); const q = au.searchParams;
ok(au.origin + au.pathname === 'https://login.microsoftonline.com/TENANT/oauth2/v2.0/authorize', '회사 테넌트 주소');
ok(q.get('client_id') === 'CLIENT' && q.get('response_type') === 'code' && q.get('scope') === 'openid profile email' && q.get('code_challenge_method') === 'S256', '인증 파라미터');
ok(q.get('redirect_uri') === BASE + '/portal-test/app/', '리디렉션 주소 = origin+pathname(해시·쿼리 제외)');
const verifier = store.get('ms_verifier'), state = store.get('ms_state'), nonce = store.get('ms_nonce');
ok(q.get('state') === state && q.get('nonce') === nonce && verifier.length >= 43, 'state·nonce 일치, verifier 길이 43 이상');
ok(q.get('code_challenge') === b64u(crypto.createHash('sha256').update(verifier).digest()), '챌린지 = SHA256(verifier)');
ok(store.get('ms_hash') === '#/edoc/new' && !q.has('prompt'), '보던 화면 저장, 기본은 계정 선택 강제 안 함');
reset(); await ms.startMicrosoftLogin({ selectAccount: true }); ok(new URL(loc.assigned[0]).searchParams.get('prompt') === 'select_account', '계정 선택 강제 옵션');

// 2) 콜백 성공
reset(); await ms.startMicrosoftLogin(); const S = { v: store.get('ms_verifier'), s: store.get('ms_state'), n: store.get('ms_nonce') };
loc.search = '?code=CODE123&state=' + S.s; loc.hash = '';
ok(ms.hasMicrosoftCallback() === true, '콜백 감지');
fetchReply = async () => ({ ok: true, json: async () => ({ id_token: 'IDTOK' }) }); callableReply = async () => ({ data: { token: 'CUSTOM' } });
await ms.finishMicrosoftLogin();
const body = log.fetch[0].opts.body;
ok(log.fetch[0].url === 'https://login.microsoftonline.com/TENANT/oauth2/v2.0/token' && log.fetch[0].opts.method === 'POST', '토큰 주소·POST');
ok(body.get('grant_type') === 'authorization_code' && body.get('code') === 'CODE123' && body.get('client_id') === 'CLIENT' && body.get('code_verifier') === S.v && body.get('redirect_uri') === BASE + '/portal-test/app/', '토큰 교환 파라미터(저장한 verifier 사용)');
ok(JSON.stringify(log.callable) === JSON.stringify([['msLogin', { idToken: 'IDTOK', nonce: S.n }]]), '서버 함수에 id_token·nonce 전달');
ok(JSON.stringify(log.signIn) === JSON.stringify([['AUTH', 'CUSTOM']]), 'signInWithCustomToken 호출');
ok(loc.search === '' && loc.hash === '#/edoc/new' && loc.pathname === '/portal-test/app/', '주소에서 code·state 제거, 보던 화면 복귀');
ok(['ms_verifier', 'ms_state', 'ms_nonce', 'ms_hash'].every((k) => !store.has(k)), '임시 저장값 정리');
ok(ms.hasMicrosoftCallback() === false, '처리 뒤 콜백 아님');

// 3) 실패 경로 — 어느 경우에도 Firebase 로그인 호출 없음
const noSign = () => ok(log.signIn.length === 0, 'Firebase 로그인 호출 없음');
reset(); await ms.startMicrosoftLogin(); loc.search = '?code=C&state=WRONG'; await rejects(ms.finishMicrosoftLogin(), 'state-mismatch'); ok(log.fetch.length === 0 && log.callable.length === 0, 'state 불일치면 토큰 교환도 안 함'); noSign();
reset(); loc.search = '?code=C&state=S'; await rejects(ms.finishMicrosoftLogin(), 'state-mismatch'); ok(log.fetch.length === 0, '저장값 없음(세션 유실)'); noSign();
reset(); loc.search = '?error=access_denied&error_description=x'; await rejects(ms.finishMicrosoftLogin(), 'ms-access_denied'); ok(loc.search === '', '오류 콜백도 주소 정리'); noSign();
reset(); await ms.startMicrosoftLogin(); loc.search = '?code=C&state=' + store.get('ms_state'); fetchReply = async () => ({ ok: false, json: async () => ({ error: 'invalid_grant' }) }); await rejects(ms.finishMicrosoftLogin(), 'token-exchange-failed'); ok(log.callable.length === 0, '교환 실패면 서버 함수 호출 안 함'); noSign();
reset(); await ms.startMicrosoftLogin(); loc.search = '?code=C&state=' + store.get('ms_state'); fetchReply = async () => ({ ok: true, json: async () => ({}) }); await rejects(ms.finishMicrosoftLogin(), 'token-exchange-failed'); noSign();
reset(); await ms.startMicrosoftLogin(); loc.search = '?code=C&state=' + store.get('ms_state'); fetchReply = async () => ({ ok: true, json: async () => ({ id_token: 'X' }) }); callableReply = async () => { throw Object.assign(new Error('no-account'), { code: 'functions/not-found' }); };
const e6 = await (async () => { try { await ms.finishMicrosoftLogin(); } catch (e) { return e; } })(); ok(e6 && e6.message === 'no-account' && ms.msErrorMessage(e6).includes('등록되지 않은 계정'), '서버 거부 메시지 → 안내문'); noSign();
// 4) 일반 주소는 콜백이 아님
reset(); loc.search = ''; ok(!ms.hasMicrosoftCallback(), '일반 주소'); loc.search = '?code=abc'; ok(!ms.hasMicrosoftCallback(), 'state 없는 code 는 무시'); loc.search = '?r=123'; ok(!ms.hasMicrosoftCallback(), '재시도 쿼리(?r=)는 무시');
// 5) 오류 문구 대응표
const M = ms.msErrorMessage;
const table = [['no-account', '등록되지 않은'], ['not-registered', '등록되지 않은'], ['not-approved', '승인되지 않은'], ['disabled', '중지'], ['guest-not-allowed', '게스트'], ['wrong-tenant', '@jhsol.kr'], ['wrong-domain', '@jhsol.kr'], ['ms-access_denied', '취소'], ['state-mismatch', '다시 시도'], ['stale-token', '다시 시도'], ['nonce-mismatch', '다시 시도'], ['invalid-token', '다시 시도'], ['token-exchange-failed', '다시 시도'], ['뭔가-이상한-코드', '실패'], [undefined, '실패']];
table.forEach(([c, w]) => ok(M(c === undefined ? undefined : { message: c }).includes(w), '오류 문구 ' + c));
console.log('ms-auth 흐름 시험 ' + n + '건 통과');
