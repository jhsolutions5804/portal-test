/* 채용 지원서 개인정보 파기 관리(대기열 1-3-16 ⑥) — 공고마다 "채용 확정일 + 보관기간(기본 90일, 14~180일)"을 두고 지원서마다 파기 예정일을 계산한다.
 * 근거(웹 확인, 노무사 확인 대기): 채용절차법 제11조·시행령 제4조(반환 청구기간은 채용 확정일부터 14~180일 중 회사가 정해 구직자에게 안내), 개인정보보호법 제21조(보유기간이 끝나면 지체 없이 파기).
 * 합격자(status pass)는 파기 대상에서 뺀다(입사 서류로 따로 보관). 파기는 이름·연락처·이력 전부를 지우고 최소 기록(접수일·공고·파기일·파기한 사람)만 남긴다. 순수 함수 — 시험: tests/hr-recruit-purge.test.mjs */
import { appStatusOf } from './logic.js?v=20261031c';
import { addDaysStr } from './home.js?v=20261031c';
import { daysBetween } from './renew.js?v=20261031c';

export const RET_DEFAULT = 90; // 보관기간 기본값(일)
export const RET_MIN = 14; // 법이 정한 하한
export const RET_MAX = 180; // 법이 정한 상한
export const PURGE_SOON = 14; // 파기 예정이 이 일수 이내면 "곧"
export const PURGE_STATES = {
  due: { label: '파기 기한 지남', mark: '🔴', tone: 'warn', rank: 5 },
  soon: { label: '파기 예정 임박', mark: '🟠', tone: 'warn', rank: 4 },
  nodate: { label: '채용 확정일 미입력', mark: '❔', tone: 'accent', rank: 3 },
  nolink: { label: '공고 연결 없음', mark: '❔', tone: 'accent', rank: 2 },
  ok: { label: '파기 예정', mark: '', tone: 'muted', rank: 1 },
  kept: { label: '합격자 — 파기 제외', mark: '✅', tone: 'ok', rank: 0 },
  done: { label: '파기 완료', mark: '', tone: 'muted', rank: 0 }
};
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
/** 보관기간(일) — 값이 없거나 14~180 정수가 아니면 기본 90일 */
export function retentionOf(posting) { const n = Number(posting && posting.retentionDays); return Number.isInteger(n) && n >= RET_MIN && n <= RET_MAX ? n : RET_DEFAULT; }

/** 지원서 한 건의 파기 상태. 파기 예정일 = 채용 확정일 + 보관기간, 예정일 다음 날부터 "기한 지남"(예정일 당일까지는 반환 청구가 가능) */
export function purgeInfo(app, posting, today) {
  if (app && app.status === 'destroyed') return { state: 'done', dueDate: '', days: null, retention: 0 };
  if (appStatusOf(app) === 'pass') return { state: 'kept', dueDate: '', days: null, retention: 0 };
  if (!posting) return { state: 'nolink', dueDate: '', days: null, retention: 0 };
  if (!isDate(posting.decidedDate)) return { state: 'nodate', dueDate: '', days: null, retention: retentionOf(posting) };
  const retention = retentionOf(posting); const dueDate = addDaysStr(posting.decidedDate, retention); const days = daysBetween(today, dueDate);
  if (!Number.isFinite(days)) return { state: 'nodate', dueDate, days: null, retention };
  return { state: days < 0 ? 'due' : days <= PURGE_SOON ? 'soon' : 'ok', dueDate, days, retention };
}
export const purgeDayText = (info) => (!info || info.days === null || info.days === undefined ? '' : info.days === 0 ? 'D-day' : info.days > 0 ? 'D-' + info.days : 'D+' + -info.days);

/** 전체 현황 — rows(지원서별), byPosting(공고별 건수·설정), counts(상태별 합), 파기 완료 건수 */
export function purgeReport(applicants, postings, today) {
  const P = {}; (postings || []).forEach((p) => { if (p && p.id) P[p.id] = p; });
  const counts = { due: 0, soon: 0, nodate: 0, nolink: 0, ok: 0, kept: 0, done: 0 }; const rows = []; const by = {};
  (applicants || []).forEach((a) => {
    if (!a) return; const p = P[a.jobKey] || null; const info = purgeInfo(a, p, today); counts[info.state]++; rows.push({ applicant: a, info });
    const k = p ? p.id : '(없음)'; by[k] = by[k] || { postingId: k, posting: p, total: 0, due: 0, soon: 0, nodate: 0, kept: 0, done: 0 }; by[k].total++; if (info.state in by[k]) by[k][info.state]++;
  });
  const byPosting = (postings || []).filter((p) => p && p.id).map((p) => by[p.id] || { postingId: p.id, posting: p, total: 0, due: 0, soon: 0, nodate: 0, kept: 0, done: 0 });
  if (by['(없음)']) byPosting.push(by['(없음)']);
  return { today, rows, byPosting, counts, pending: counts.due + counts.soon + counts.nodate + counts.nolink };
}
/** 파기 뒤에 남기는 최소 기록 — 이름·연락처·주소·생년월일·이력·병역·메모는 모두 사라진다(전체 교체로 저장). 공고 이름·접수 시각은 개인정보가 아니라 남긴다 */
export function destroyDoc(app, by, now) {
  const a = app || {}; return { status: 'destroyed', jobKey: a.jobKey || '', jobTitle: a.jobTitle || '', createdAt: a.createdAt || null, prevStatus: appStatusOf(a), destroyedAt: now, destroyedBy: String(by || '').trim().toLowerCase(), reason: 'retention' };
}
/** 공고 설정 검사 — 채용 확정일(비우면 지움)·보관기간(14~180 정수, 비우면 기본값) */
export function settingsPatch(decidedDate, retentionDays) {
  const d = String(decidedDate == null ? '' : decidedDate).trim(); const r = String(retentionDays == null ? '' : retentionDays).trim(); const errors = [];
  if (d && !isDate(d)) errors.push('채용 확정일 형식이 올바르지 않습니다.');
  let days = RET_DEFAULT; if (r) { const n = Number(r); if (!Number.isInteger(n) || n < RET_MIN || n > RET_MAX) errors.push('보관기간은 ' + RET_MIN + '~' + RET_MAX + '일의 정수로 입력해 주세요(법이 정한 범위).'); else days = n; }
  return errors.length ? { ok: false, errors } : { ok: true, errors: [], data: { decidedDate: d, retentionDays: days } };
}
