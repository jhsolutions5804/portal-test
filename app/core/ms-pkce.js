// PKCE·인증 주소 도우미(순수 함수) — 브라우저와 Node 18+ 에서 같이 쓴다
export function b64u(bytes) {
  const a = new Uint8Array(bytes); let s = '';
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function randomString(nBytes = 32) { return b64u(crypto.getRandomValues(new Uint8Array(nBytes))); }
export async function pkceChallenge(verifier) { return b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))); }
export function buildAuthorizeUrl({ tenantId, clientId, redirectUri, state, nonce, challenge, prompt }) {
  const p = new URLSearchParams({
    client_id: clientId, response_type: 'code', redirect_uri: redirectUri, response_mode: 'query',
    scope: 'openid profile email', state, nonce, code_challenge: challenge, code_challenge_method: 'S256'
  });
  if (prompt) p.set('prompt', prompt);   // 'select_account' 이면 계정 선택 창을 강제
  return 'https://login.microsoftonline.com/' + tenantId + '/oauth2/v2.0/authorize?' + p.toString();
}
export function parseCallback(search) {
  const p = new URLSearchParams(search || '');
  return { code: p.get('code'), state: p.get('state'), error: p.get('error') };
}
