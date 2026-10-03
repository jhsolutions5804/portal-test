import { functions, httpsCallable } from '../../core/firebase.js?v=20261004f';

/* 서버 함수 edocAct 호출 — 상신·승인·반려·회수·게시·삭제는 모두 서버가 검증해 처리한다 */
const call = httpsCallable(functions, 'edocAct');
const FALLBACK = {
  unauthenticated: '로그인이 필요합니다. 다시 로그인해 주세요.',
  'permission-denied': '이 처리를 할 권한이 없습니다.',
  'failed-precondition': '문서 상태가 바뀌어 처리할 수 없습니다. 새로고침 후 다시 확인해 주세요.',
  'not-found': '문서를 찾을 수 없습니다.',
  'invalid-argument': '입력 내용을 확인해 주세요.',
  unavailable: '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  internal: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
};
export function errorMessage(e) {
  const code = String((e && e.code) || '').replace('functions/', '');
  const msg = String((e && e.message) || '');
  // 서버가 보낸 한국어 안내문이 있으면 그대로, 영문 코드뿐이면 대체 문구
  if (/[가-힣]/.test(msg)) return msg;
  return FALLBACK[code] || FALLBACK.internal;
}
export async function act(payload) {
  try { const r = await call(payload); return r.data; }
  catch (e) { const err = new Error(errorMessage(e)); err.code = e && e.code; throw err; }
}
