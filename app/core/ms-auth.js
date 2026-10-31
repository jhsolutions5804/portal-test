// Microsoft 로그인(리디렉션 + PKCE) → 서버 함수 msLogin → Firebase 로그인. 빌드 표기(?v=)는 다른 core 파일과 맞춘다.
import { auth, functions, httpsCallable, signInWithCustomToken } from './firebase.js?v=20261031d';
import { MS_TENANT_ID, MS_CLIENT_ID } from './config.js?v=20261031d';
import { randomString, pkceChallenge, buildAuthorizeUrl, parseCallback } from './ms-pkce.js?v=20261031d';

const K = { verifier: 'ms_verifier', state: 'ms_state', nonce: 'ms_nonce', hash: 'ms_hash' };
// 리디렉션 주소는 Entra 앱에 등록한 값과 글자 그대로 같아야 한다(쿼리·해시 제외, 끝의 / 또는 index.html 포함 여부까지)
const redirectUri = () => location.origin + location.pathname;
const fail = (code) => Object.assign(new Error(code), { msCode: code });

export async function startMicrosoftLogin(opts) {
  const verifier = randomString(48), state = randomString(16), nonce = randomString(16);
  sessionStorage.setItem(K.verifier, verifier); sessionStorage.setItem(K.state, state);
  sessionStorage.setItem(K.nonce, nonce); sessionStorage.setItem(K.hash, location.hash || '');   // 돌아와서 보던 화면(해시)으로 복귀
  location.assign(buildAuthorizeUrl({
    tenantId: MS_TENANT_ID, clientId: MS_CLIENT_ID, redirectUri: redirectUri(), state, nonce,
    challenge: await pkceChallenge(verifier), prompt: opts && opts.selectAccount ? 'select_account' : undefined
  }));
}

export function hasMicrosoftCallback() { const c = parseCallback(location.search); return !!((c.code && c.state) || c.error); }

/** boot.js 에서 watchMe 보다 먼저 호출. 성공하면 Firebase 로그인까지 끝나 있고, 실패하면 오류를 던진다 */
export async function finishMicrosoftLogin() {
  const c = parseCallback(location.search);
  const saved = {}; Object.keys(K).forEach((k) => { saved[k] = sessionStorage.getItem(K[k]); sessionStorage.removeItem(K[k]); });
  history.replaceState(null, '', location.pathname + (saved.hash || ''));   // 주소에서 code·state 제거 — 라우터가 쿼리를 유지하므로 꼭 필요
  if (c.error) throw fail('ms-' + c.error);
  if (!saved.verifier || !saved.state || c.state !== saved.state) throw fail('state-mismatch');
  const r = await fetch('https://login.microsoftonline.com/' + MS_TENANT_ID + '/oauth2/v2.0/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: MS_CLIENT_ID, grant_type: 'authorization_code', code: c.code, redirect_uri: redirectUri(), code_verifier: saved.verifier, scope: 'openid profile email' })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id_token) throw fail('token-exchange-failed');
  const res = await httpsCallable(functions, 'msLogin')({ idToken: j.id_token, nonce: saved.nonce });   // 서버가 서명·테넌트·nonce·도메인 검증
  await signInWithCustomToken(auth, res.data.token);
}

export function msErrorMessage(e) {
  const m = String((e && (e.msCode || e.message)) || '');
  if (/no-account|not-registered/.test(m)) return '등록되지 않은 계정입니다. 관리자에게 문의해 주세요.';
  if (/not-approved/.test(m)) return '승인되지 않은 계정입니다.';
  if (/disabled/.test(m)) return '사용이 중지된 계정입니다.';
  if (/guest-not-allowed/.test(m)) return '게스트 계정은 "Guest 계정 로그인" 탭에서 로그인해 주세요.';
  if (/wrong-tenant|wrong-domain/.test(m)) return '회사 Microsoft 계정(@jhsol.kr)으로 로그인해 주세요.';
  if (/ms-access_denied/.test(m)) return 'Microsoft 로그인이 취소되었거나 이 앱에 할당되지 않은 계정입니다.';
  if (/state-mismatch|stale-token|nonce-mismatch|invalid-token|token-exchange-failed/.test(m)) return '로그인 확인에 실패했습니다. 다시 시도해 주세요.';
  if (/failed-precondition|server-not-configured/.test(m)) return '로그인 서버 설정에 문제가 있습니다. 관리자에게 알려 주세요.';
  if (/unavailable|deadline-exceeded|network|failed to fetch/i.test(m)) return '네트워크가 불안정하거나 서버가 응답하지 않습니다. 연결을 확인하고 다시 시도해 주세요.';
  if (/invalid-argument|bad-request|missing-saved/.test(m)) return '로그인 정보를 확인하지 못했습니다. 처음부터 다시 시도해 주세요.';
  // 위 어디에도 없으면 서버 쪽 오류(internal 등) — 문의할 때 전달할 짧은 코드를 함께 보여 준다
  const code = String((e && (e.code || e.msCode)) || '').replace(/^functions\//, '').replace(/[^a-z0-9\-]/gi, '').slice(0, 30);
  return '서버가 로그인 처리를 하지 못했습니다. 잠시 후 다시 시도해도 같으면 관리자에게 알려 주세요.' + (/[a-z]{3}/i.test(code) ? ' (오류 코드: ' + code + ')' : '');
}
