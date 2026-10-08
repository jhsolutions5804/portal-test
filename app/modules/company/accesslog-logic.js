/* 주민번호 열람 기록 화면의 순수 규칙 — 월 범위(한국 시각)·요약·하루 과다 열람 표시·필터. 화면·네트워크 없이 시험한다 */
export const ACTION_LABEL = { reveal: '조회', create: '번호 등록', update: '번호 변경', delete: '번호 삭제', 'migrate-plan': '이전 계획', 'migrate-apply': '이전 실행', 'migrate-apply-clean': '이전+정리', 'migrate-contracts-plan': '계약서 정리 계획', 'migrate-contracts-apply': '계약서 정리', 'monthly-check': '월 점검' };
export const ROLE_LABEL = { admin: '관리자', staff: '실무자', self: '본인' };
export const KIND_LABEL = { roster: '연명부', hr: '인사', contracts: '계약서' };
export const RESULT_LABEL = { ok: '완료', none: '번호 없음', error: '오류', partial: '일부 실패' };
export const DAILY_ALERT = 10;   // 한 사람이 하루에 이 건수 이상 조회하면 "주의"로 표시
export const tsMs = (t) => (!t ? 0 : typeof t.toMillis === 'function' ? t.toMillis() : (t.seconds != null ? t.seconds * 1000 : (Date.parse(t) || 0)));
const kst = (ms) => new Date(ms + 9 * 3600 * 1000).toISOString();
export const kstYm = (ms) => kst(ms).slice(0, 7);
export const kstDay = (ms) => kst(ms).slice(0, 10);
export const kstText = (ms) => { const s = kst(ms); return s.slice(5, 10) + ' ' + s.slice(11, 16); };
/** 'YYYY-MM' → [시작, 끝) 밀리초(한국 시각 기준 그 달 1일 0시 ~ 다음 달 1일 0시) */
export function monthRange(ym) { const m = /^(\d{4})-(\d{2})$/.exec(String(ym || '')); if (!m) return null; const y = +m[1], mo = +m[2]; if (mo < 1 || mo > 12) return null; const off = 9 * 3600 * 1000; return [Date.UTC(y, mo - 1, 1) - off, Date.UTC(y, mo, 1) - off]; }
export function addMonth(ym, d) { const r = /^(\d{4})-(\d{2})$/.exec(String(ym || '')); if (!r) return ym; const t = new Date(Date.UTC(+r[1], +r[2] - 1 + d, 1)); return t.toISOString().slice(0, 7); }
/** Firestore 문서 → 화면용 한 줄 */
export const toEntry = (id, x) => ({ id, ms: tsMs(x.at), actorUid: x.actorUid || '', actorName: x.actorName || '', role: x.role || '', action: x.action || '', kind: x.kind || '', workerId: x.workerId || '', targetName: x.targetName || '', reason: x.reason || '', note: x.note || '', ip: x.ip || '', result: x.result || '' });
export function filterEntries(list, f) { return (list || []).filter((e) => (!f || !f.actor || e.actorUid === f.actor) && (!f || !f.action || (f.action === 'reveal' ? e.action === 'reveal' : e.action !== 'reveal')) && (!f || !f.q || (e.targetName || '').indexOf(f.q) !== -1)); }
/** 요약: 전체·조회 건수, 열람자별 건수(많은 순), 하루 과다 조회 표시 */
export function summarize(list) {
  const by = {}; const perDay = {}; let reveals = 0;
  (list || []).forEach((e) => {
    const k = e.actorUid || e.actorName || '?'; by[k] = by[k] || { uid: e.actorUid, name: e.actorName || '(이름 없음)', n: 0, reveals: 0 }; by[k].n++;
    if (e.action === 'reveal') { by[k].reveals++; reveals++; const dk = k + '|' + kstDay(e.ms); perDay[dk] = perDay[dk] || { uid: e.actorUid, name: e.actorName || '(이름 없음)', day: kstDay(e.ms), n: 0 }; perDay[dk].n++; }
  });
  const actors = Object.values(by).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  const flagged = Object.values(perDay).filter((x) => x.n >= DAILY_ALERT).sort((a, b) => b.n - a.n || b.day.localeCompare(a.day));
  return { total: (list || []).length, reveals, actors, flagged };
}
