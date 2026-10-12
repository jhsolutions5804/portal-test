/* 주민번호 서버 암호화 보관(테섭 2026-10-08, 설계서 §50)과의 연결. 전체 번호는 서버 함수(identityAct)만 알고, 문서에는 마스킹 값(juminMasked)만 남는다.
 * 저장·열람은 저장소 루트의 공용 클라이언트(identity-client.js, window.JH_IDENTITY)를 쓴다 — 열람 때는 사유를 고르고 기록(3년)이 남는다. */
export async function loadIdentity() {
  if (globalThis.JH_IDENTITY) return globalThis.JH_IDENTITY;
  try { await import('../../../identity-client.js'); } catch (e) { /* 아래에서 null 처리 */ }
  return globalThis.JH_IDENTITY || null;
}
/** 번호 저장(13자리 숫자, 빈 문자열이면 삭제). 실패하면 오류를 던진다 */
export async function saveJumin(workerId, digits) { const id = await loadIdentity(); if (!id) throw new Error('주민번호 저장 기능을 불러오지 못했습니다.'); return id.save('hr', workerId, digits); }
/** 번호 열람(사유 선택 창이 뜸) → { found, jumin } 또는 취소·실패 시 null */
export async function revealJumin(workerId) { const id = await loadIdentity(); if (!id) { alert('주민번호 열람 기능을 불러오지 못했습니다. 새로고침해 주세요.'); return null; } return id.reveal('hr', workerId); }
/** 마스킹 값 표시용(* → ●) */
export const maskedView = (m) => String(m || '').replace(/\*/g, '●');
