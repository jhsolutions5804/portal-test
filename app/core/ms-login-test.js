// Microsoft 로그인 시험 페이지의 로직(대기열 00-0). 본 로그인 화면을 바꾸기 전에 "Microsoft 로그인 → 서버 함수 msLogin 호출"까지만 해 본다.
// 약속: ① Firebase 로그인(signInWithCustomToken)은 어떤 경우에도 호출하지 않는다(지금 세션·기존 로그인 그대로) ② id_token·커스텀 토큰 글자는 화면 결과에 담지 않는다(길이·클레임 일부만)
// ③ state 가 "mstest." 로 시작하는 콜백만 처리한다 — Entra 에 등록된 리디렉션 주소(.../app/)로 돌아오면 app/index.html 이 이 페이지로 보낸다.
import { functions, httpsCallable } from './firebase.js?v=20261031f';
import { randomString, pkceChallenge, buildAuthorizeUrl, parseCallback } from './ms-pkce.js?v=20261031f';

// 회사 Entra 앱 "portal-login"(단일 테넌트 SPA) — 비밀이 아닌 공개 값. 본 로그인 패치(config.js)와 같은 값.
const TENANT_ID = '548fcb48-1ab8-4c47-8242-bc098ea80416';
const CLIENT_ID = '3669b1e5-34e9-4630-a357-ac512a878a90';
const PREFIX = 'mstest.';
const K = { verifier: 'mst_verifier', state: 'mst_state', nonce: 'mst_nonce' };   // 본 로그인의 ms_* 키와 섞이지 않게 따로 둔다
const redirectUri = () => location.origin + location.pathname.replace(/[^/]*$/, '');   // 시험 페이지가 있는 폴더(.../app/) — Entra 에 등록된 주소
const fail = (code, detail) => ({ error: code, detail: detail || '' });

export async function startTest(opts) {
  const verifier = randomString(48), state = PREFIX + randomString(16), nonce = randomString(16);
  sessionStorage.setItem(K.verifier, verifier); sessionStorage.setItem(K.state, state); sessionStorage.setItem(K.nonce, nonce);
  location.assign(buildAuthorizeUrl({ tenantId: TENANT_ID, clientId: CLIENT_ID, redirectUri: redirectUri(), state, nonce, challenge: await pkceChallenge(verifier), prompt: opts && opts.selectAccount ? 'select_account' : undefined }));
}

export function hasTestCallback() { const c = parseCallback(location.search); return !!(c.state && String(c.state).startsWith(PREFIX) && (c.code || c.error)); }

/** 토큰 본문에서 화면에 보일 클레임만 뽑는다(서명은 검증하지 않는다 — 표시용, 검증은 서버가 한다). 이상한 토큰은 { error: true } */
export function claimsOf(idToken) {
  try {
    if (typeof idToken !== 'string') return { error: true };
    const parts = idToken.split('.'); if (parts.length !== 3) return { error: true };
    const p = JSON.parse(decodeURIComponent(escape(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))));
    if (!p || typeof p !== 'object') return { error: true };
    const amr = Array.isArray(p.amr) ? p.amr.map(String) : [];
    const iat = typeof p.iat === 'number' ? p.iat : 0;
    return { tid: p.tid, preferred_username: p.preferred_username || p.upn, aud: p.aud, iss: p.iss, amr, mfa: amr.includes('mfa'), iat, exp: typeof p.exp === 'number' ? p.exp : 0, ageSec: iat ? Math.floor(Date.now() / 1000) - iat : null };
  } catch (e) { return { error: true }; }
}

/** 서버 응답(또는 오류)을 "어느 단계까지 통과했는지"로 풀어 쓴다. level: ok | warn | bad */
export function interpretResult(r) {
  if (r && typeof r === 'object' && r.token) return { level: 'ok', text: '검증·계정 조회·토큰 발급(IAM)까지 모두 통과했습니다. 서버가 이 계정의 로그인 토큰을 만들었습니다 — 시험이라 로그인하지 않았고 지금 세션은 그대로입니다.' };
  const msg = String((r && r.message) || '').trim(); const code = String((r && r.code) || '').replace(/^functions\//, '');
  const VERIFIED = '서명·테넌트·도메인·nonce 검증은 통과했습니다. ';
  if (msg === 'no-account') return { level: 'warn', text: VERIFIED + '다만 이 이메일의 포털(테섭) 계정이 없습니다(관리자가 먼저 등록한 직원만 로그인). 토큰 발급(IAM)은 아직 확인되지 않았습니다 — 테섭에 있는 계정(jh.kim@jhsol.kr)으로 시험하면 확인됩니다.' };
  if (msg === 'not-registered') return { level: 'warn', text: VERIFIED + '로그인 계정은 있으나 포털 문서(portal_users)가 없습니다. IAM 은 아직 확인되지 않았습니다.' };
  if (msg === 'not-approved') return { level: 'warn', text: VERIFIED + '포털 계정이 승인 상태가 아닙니다. IAM 은 아직 확인되지 않았습니다.' };
  if (msg === 'disabled') return { level: 'warn', text: VERIFIED + '이 계정은 사용이 중지되어 있습니다. IAM 은 아직 확인되지 않았습니다.' };
  if (msg === 'guest-not-allowed') return { level: 'warn', text: VERIFIED + '게스트 계정은 Microsoft 로그인을 쓰지 않습니다(기존 아이디·비밀번호). IAM 은 아직 확인되지 않았습니다.' };
  if (msg === 'wrong-tenant' || msg === 'wrong-domain') return { level: 'bad', text: '회사 Microsoft 계정(@jhsol.kr)이 아닙니다. 서버가 거부했습니다.' };
  if (msg === 'invalid-token' || msg === 'nonce-mismatch' || msg === 'stale-token') return { level: 'bad', text: '서버가 id_token 을 인정하지 않았습니다(' + msg + '). 다시 시험해 보고, 계속되면 서명 키 조회(서버의 Microsoft 접속)를 확인해야 합니다.' };
  if (msg === 'server-not-configured') return { level: 'bad', text: '서버에 테넌트·앱 ID 설정이 없습니다.' };
  if (code === 'internal' || msg === 'internal') return { level: 'bad', text: '서버 내부 오류입니다. 토큰 발급 권한(IAM) 문제일 가능성이 높습니다 — 함수 실행 계정에 "Service Account Token Creator"(signBlob) 권한이 있는지, 함수 로그(Cloud Logging)를 확인해야 합니다.' };
  return { level: 'bad', text: '예상하지 못한 응답입니다: ' + (msg || code || '(내용 없음)') };
}

/** 콜백 처리: Microsoft 가 돌려준 code → id_token → 서버 msLogin 호출까지. 로그인은 하지 않는다. 결과 객체에 토큰 글자는 담지 않는다 */
export async function finishTest() {
  const c = parseCallback(location.search);
  const saved = {}; Object.keys(K).forEach((k) => { saved[k] = sessionStorage.getItem(K[k]); sessionStorage.removeItem(K[k]); });
  history.replaceState(null, '', location.pathname);   // 주소에서 code·state 제거
  if (c.error) return fail('ms-' + c.error);
  if (!saved.verifier || !saved.state || c.state !== saved.state) return fail('state-mismatch');
  const r = await fetch('https://login.microsoftonline.com/' + TENANT_ID + '/oauth2/v2.0/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, grant_type: 'authorization_code', code: c.code, redirect_uri: redirectUri(), code_verifier: saved.verifier, scope: 'openid profile email' })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id_token) return fail('token-exchange-failed', [j.error, j.error_description && String(j.error_description).split('\n')[0]].filter(Boolean).join(' — '));
  const claims = claimsOf(j.id_token);
  let result;
  try { const res = await httpsCallable(functions, 'msLogin')({ idToken: j.id_token, nonce: saved.nonce }); result = interpretResult({ token: res && res.data && res.data.token ? 'issued' : '' }); }
  catch (e) { result = interpretResult({ code: e && e.code, message: e && e.message }); }
  return { claims, result };   // 토큰 글자는 담지 않는다(성공해도 "발급됨"만 알린다)
}

// ── 화면(시험 대상 밖): 결과를 한 장에 그린다
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const row = (k, v) => '<tr><th>' + esc(k) + '</th><td>' + v + '</td></tr>';
export function renderOutcome(root, out) {
  const box = (level, title, body) => '<div class="box ' + level + '"><strong>' + esc(title) + '</strong><p>' + body + '</p></div>';
  let h = '';
  if (out.error) {
    h += box('bad', '시험 실패 — ' + out.error, esc(out.error === 'ms-access_denied' ? 'Microsoft 가 로그인을 거부했거나 취소되었습니다. 이 앱에 할당되지 않은 계정일 수 있습니다.' : out.error === 'state-mismatch' ? '시험을 시작한 같은 브라우저 창에서 돌아오지 않았습니다. 처음부터 다시 시험해 주세요.' : out.detail || '다시 시험해 주세요.'));
  } else {
    const c = out.claims || {};
    h += box(out.result.level, out.result.level === 'ok' ? '✅ 통과' : out.result.level === 'warn' ? '⚠️ 일부 통과' : '❌ 실패', esc(out.result.text));
    if (!c.error) h += '<table>' + row('로그인한 계정', esc(c.preferred_username)) + row('테넌트(tid)', esc(c.tid)) + row('앱(aud)', esc(c.aud)) + row('인증 방법(amr)', c.amr && c.amr.length ? esc(c.amr.join(', ')) : '<em>토큰에 amr 가 없습니다(v2 토큰에는 안 올 수 있음)</em>') + row('MFA', c.mfa ? '예' : '확인 안 됨') + row('발급 뒤 경과', c.ageSec == null ? '-' : esc(c.ageSec) + '초') + '</table>';
  }
  root.innerHTML = h + '<p class="note">이 페이지는 로그인하지 않습니다. 토큰 값은 화면에 표시하지 않습니다.</p><div class="bar"><button id="t-again">다시 시험</button><button id="t-other">다른 계정으로 시험</button></div>';
  root.querySelector('#t-again').onclick = () => startTest();
  root.querySelector('#t-other').onclick = () => startTest({ selectAccount: true });
}
export async function mountTestPage(root) {
  if (hasTestCallback()) { root.innerHTML = '<p>확인 중…</p>'; renderOutcome(root, await finishTest()); return; }
  root.innerHTML = '<p>회사 Microsoft 계정으로 로그인하면, 서버(msLogin)가 그 계정을 확인하고 토큰을 만드는 데까지 시험합니다. <strong>실제 로그인은 하지 않으며</strong> 지금 로그인 상태는 바뀌지 않습니다.</p><div class="bar"><button id="t-go">Microsoft 로그인 시험 시작</button></div>';
  root.querySelector('#t-go').onclick = () => startTest();
}
