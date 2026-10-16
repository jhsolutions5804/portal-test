/* 공사일보 저장 뒤 전자결재 업무일지 연동 결과 안내 — 순수 함수(화면·네트워크 없이 시험).
 * 이전에는 연동이 실패해도 console.warn 만 남아 사용자가 "업무일지가 안 만들어진다"는 것만 알고 이유는 몰랐다(C3).
 * 일보 저장은 연동 결과와 무관하게 유지된다 — 여기서는 결과를 문구로만 바꾼다. */
export const EMPTY_WORK_NOTE = '금일 업무가 비어 있어 전자결재 업무일지는 만들지 않았습니다.';

/** 서버 syncDaily 응답(또는 httpsCallable 의 {data}) → 안내 문구. 알려 줄 것이 없으면 '' */
export function dailyNote(res) {
  const r = res && typeof res === 'object' ? (res.data && typeof res.data === 'object' ? res.data : res) : null; if (!r) return '';
  if (r.skipped === 'locked') return '이미 승인된 전자결재 업무일지는 그대로 두었습니다.';
  if (r.skipped === 'other-author') return '다른 사람이 만든 업무일지라 수정하지 않았습니다.';
  if (r.noApprover) return '전자결재 업무일지를 임시저장으로 만들었습니다 — 결재자가 정해지지 않아 상신하지 못했습니다. 전자결재에서 결재선을 정해 상신해 주세요.';
  if (r.updated) return '결재 중인 전자결재 업무일지의 내용을 갱신했습니다.';
  if (r.created) return '전자결재 업무일지도 상신했습니다.';
  if (r.status === 'pending') return '전자결재 업무일지를 다시 상신했습니다.';
  return '';
}

/** 연동 실패(서버 거부·네트워크·함수 없음) → 안내 문구. 서버가 한글로 준 이유는 그대로 보여 준다 */
export function failNote(e) {
  const m = e && e.message ? String(e.message) : '';
  return '공사일보는 저장했지만 전자결재 업무일지는 만들지 못했습니다' + (/[가-힣]/.test(m) ? ' — ' + m.slice(0, 120) : ' (서버 함수에 닿지 못했습니다)') + '.';
}

/** work = 금일 업무 내용, run = 서버 연동 호출. 금일 업무가 비면 서버가 거부하므로 부르지 않고 이유를 안내한다. 예외는 던지지 않고 문구로 돌려준다 */
export async function syncWithNote(work, run) {
  if (!String(work == null ? '' : work).trim()) return EMPTY_WORK_NOTE;
  try { return dailyNote(await run()); } catch (e) { console.warn('[공사일보→업무일지 연동 실패]', (e && e.message) || e); return failNote(e); }
}
