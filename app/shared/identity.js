/* 주민(외국인)등록번호 열람·저장 — 서버 함수 identityAct 호출(설계서 §50). 번호는 저장·기록하지 않고 호출한 쪽이 화면에만 잠깐 보여 준다.
 * 열람마다 서버가 열람 기록(누가·누구의 번호·사유·시각·접속지)을 남긴다. */
import { functions, httpsCallable } from '../core/firebase.js?v=20261011a';
export const REASONS = ['4대보험 신고', '원천징수', '신분 확인', '기타'];
const call = async (data) => (await httpsCallable(functions, 'identityAct')(data)).data;
/** 서버가 준 한글 안내는 그대로, 그 밖(함수 미배포·네트워크)은 일반 안내 */
export const identityErrorText = (e) => { const m = String((e && e.message) || ''); return /[가-힣]/.test(m) ? m : '서버 함수(identityAct)를 호출하지 못했습니다. 함수가 아직 배포되지 않았거나 네트워크 문제일 수 있습니다.'; };
/** 본인 번호 열람(인사 명부 연동 근로자) → { found, jumin, masked } */
export async function revealOwn(workerId) { return call({ action: 'reveal', kind: 'hr', workerId, reason: '본인 확인' }); }
/** 마스킹 값('900101-1******')을 화면용으로 */
export const maskView = (m) => String(m || '').replace(/\*/g, '●');
/** 관리자: 월 1회 열람 기록 점검을 마쳤다고 표시(누가·언제·메모가 남는다) */
export async function markChecked(month, note) { return call({ action: 'markChecked', month, note: String(note || '') }); }
