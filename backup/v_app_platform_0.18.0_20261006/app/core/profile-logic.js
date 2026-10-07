/* 내 정보의 순수 규칙(화면·네트워크 없음) */
export const MIN_PW = 8;
/** 새 비밀번호 검사. 문제가 있으면 안내 문구, 없으면 '' */
export function validateNewPassword(cur, nw, nw2) {
  if (!cur) return '현재 비밀번호를 입력해 주세요.';
  if (!nw) return '새 비밀번호를 입력해 주세요.';
  if (nw.length < MIN_PW) return '새 비밀번호는 ' + MIN_PW + '자 이상이어야 합니다.';
  if (nw === cur) return '새 비밀번호가 현재 비밀번호와 같습니다.';
  if (nw !== nw2) return '새 비밀번호 확인이 일치하지 않습니다.';
  return '';
}
export function passwordErrorMessage(code) {
  const m = { 'auth/wrong-password': '현재 비밀번호가 올바르지 않습니다.', 'auth/invalid-credential': '현재 비밀번호가 올바르지 않습니다.', 'auth/weak-password': '새 비밀번호가 너무 약합니다.', 'auth/too-many-requests': '시도 횟수가 많습니다. 잠시 후 다시 시도해 주세요.', 'auth/network-request-failed': '네트워크 연결을 확인해 주세요.', 'auth/requires-recent-login': '보안을 위해 다시 로그인한 뒤 시도해 주세요.' };
  return m[code] || '비밀번호를 바꾸지 못했습니다.';
}
export function fmtPhone(v) {
  let d = String(v || '').replace(/\D/g, '').slice(0, 11); if (d.length === 8) d = '010' + d;
  if (d.length <= 3) return d; if (d.length <= 6) return d.slice(0, 3) + '-' + d.slice(3);
  if (d.length <= 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6); return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
}
export const isPhone = (v) => /^0\d{1,2}-\d{3,4}-\d{4}$/.test(String(v || '')) ;
/** 주민번호: 13자리면 앞 6자리-성별 1자리●●●●●●, 아니면 안내 */
export function maskJumin(j) { const x = String(j || '').replace(/\D/g, ''); return x.length === 13 ? x.slice(0, 6) + '-' + x[6] + '●●●●●●' : (x ? '형식 확인 필요' : '—'); }
export function fmtJumin(j) { const x = String(j || '').replace(/\D/g, ''); return x.length === 13 ? x.slice(0, 6) + '-' + x.slice(6) : (x || '—'); }
/** 계좌번호: 앞뒤 일부만 보이고 가운데는 ●(숫자·하이픈 구조 유지) */
export function maskAccount(a) { const s = String(a || '').trim(); if (!s) return '—'; const d = s.replace(/\D/g, ''); if (d.length < 6) return '●'.repeat(s.length); let seen = 0; return s.replace(/\d/g, (c) => { seen++; return seen <= 3 || seen > d.length - 3 ? c : '●'; }); }
