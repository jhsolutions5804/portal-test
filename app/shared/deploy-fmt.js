/* 투입 확인(대기열 1-3-27-6) 공용 표시 — 인사 모듈(관리자 현황)과 직원 본인 화면(deploy 모듈)이 같은 상태 이름·색·시각 형식을 쓰도록 shared 에 둔다. 순수 함수. */
export const DEPLOY_STATUS = {
  pending: { label: '확인 대기', tone: 'amber' },
  agreed: { label: '동의', tone: 'ok' },
  declined: { label: '동의 안 함', tone: 'gray' },
  withdrawn: { label: '철회', tone: 'gray' }
};
export const deployStatus = (s) => DEPLOY_STATUS[s] || DEPLOY_STATUS.pending;
/** ISO 시각 → 한국 시각 「2026-11-05 10:30」, 읽을 수 없으면 빈 문자열 */
export function deployWhen(iso) {
  const t = Date.parse(iso); if (!isFinite(t)) return '';
  const k = new Date(t + 9 * 3600 * 1000); const p = (n) => String(n).padStart(2, '0');
  return k.getUTCFullYear() + '-' + p(k.getUTCMonth() + 1) + '-' + p(k.getUTCDate()) + ' ' + p(k.getUTCHours()) + ':' + p(k.getUTCMinutes());
}
