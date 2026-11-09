/* 근로자 상세 「경력관리」 카드의 순수 규칙(화면·네트워크 없이 시험 가능) — 대기열 1-3-27-2, 시험: tests/hr-career-tab.test.mjs.
 * 서버(careerAct)가 돌려주는 모양: { worker, hasProfile, education, certs, career(원본), careerOverride(수정본 또는 null), careerEdits, awards, training, masterId } */
import { careerMonths, fmtMonths } from '../../shared/career-months.js?v=20261109s';
export { careerMonths, fmtMonths };   // 옛 가져오기 경로 호환(실제 계산은 shared/career-months.js)
export const AWARD_KINDS = [['award', '포상'], ['commend', '표창'], ['safety', '안전 무사고'], ['memo', '메모']];
export const awardLabel = (k) => { const x = AWARD_KINDS.find((a) => a[0] === k); return x ? x[1] : '메모'; };
export const emptyRow = () => ({ company: '', from: '', to: '', position: '', duty: '' });
/** 지금 보여 줄 입사 전 경력: 수정본이 있으면 수정본, 없으면 원본 */
export const careerRows = (c) => (c && Array.isArray(c.careerOverride) ? c.careerOverride : ((c && c.career) || []));
export const isEdited = (c) => !!(c && Array.isArray(c.careerOverride));
/** 수정 화면 초안(복사본, 빈 경력이면 한 줄) */
export const toDraft = (c) => { const r = careerRows(c).map((x) => Object.assign(emptyRow(), x)); return r.length ? r : [emptyRow()]; };
const ym = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s || '');
const idx = (s) => (+s.slice(0, 4)) * 12 + (+s.slice(5, 7) - 1);
/** 기간 표시: 2012-03 ~ 2016-02 · 2016-03 ~ 재직 · 입사만 없으면 ~ 퇴사 */
export function periodLabel(from, to) { const f = ym(from) ? from : (from || ''); const t = ym(to) ? to : (to || ''); if (!f && !t) return '—'; return (f || '?') + ' ~ ' + (t || (f ? '재직' : '?')); }
/** 연명부 연결 후보: 이름이 같은 인원(재직 먼저, 생년월일 순). masters = [{id,name,birth,resigned}] */
export function linkCandidates(worker, masters) {
  const nm = String((worker && worker.name) || '').trim(); if (!nm) return [];
  return (masters || []).filter((m) => String(m.name || '').trim() === nm).sort((a, b) => (!!a.resigned - !!b.resigned) || String(a.birth || '').localeCompare(String(b.birth || '')));
}
/** 서버 오류 → 화면 안내 문구. 함수가 아직 배포되지 않았을 때(unimplemented, 또는 메시지 없는 not-found)는 배포 안내, 서버가 직접 낸 not-found(명부에 없는 직원 등)는 그 문구를 그대로 */
export function careerErrorText(e) {
  const code = String((e && e.code) || ''); const msg = String((e && e.message) || '').trim();
  const generic = !msg || /^(not[-_ ]?found|unimplemented|internal)$/i.test(msg);
  if (/unimplemented$/.test(code) || (/not-found$/.test(code) && generic)) return '서버 함수(careerAct)가 아직 배포되지 않았습니다. 서버 재배포 뒤에 쓸 수 있습니다.';
  if (/permission-denied$/.test(code)) return '관리자만 쓸 수 있습니다.';
  return msg || '처리하지 못했습니다.';
}
