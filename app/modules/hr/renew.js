/* 계약 만료·정식 전환 — 직원별로 근로계약서(기간제)와 연봉계약서 중 가장 늦은 만료일을 보고, 만료 2개월 전부터 단계(2개월 전 → 1.5개월 전 → 1개월 전 → 만료 지남)로 알린다.
 * 후속 계약이 이미 있으면(더 늦은 만료일) 알림에서 빠진다. 만료일이 없는 계약서(기간 정함 없음)는 만료일 계산에서 제외한다.
 * "다음 계약" 단추는 계약서 화면 주소(#/hr/<annualc|laborc>/<직원>/new?start=시작일)로 이어진다 — 시작일은 만료일 다음 날. 새로 저장하는 것은 없다(계산만).
 * 순수 함수 — 시험: tests/hr-renew.test.mjs. 설계: app-docs/hr-additions-design.md §5 */
import { HOME_EXEMPT, addDaysStr } from './home.js?v=20261031f';

export const RENEW_M1 = 30; // 1개월 전
export const RENEW_M15 = 45; // 1.5개월 전
export const RENEW_M2 = 60; // 2개월 전
export const RENEW_STAGES = {
  m2: { label: '2개월 전', mark: '', tone: 'muted', rank: 0 },
  m15: { label: '1.5개월 전', mark: '🟡', tone: 'accent', rank: 1 },
  m1: { label: '1개월 전', mark: '🟠', tone: 'warn', rank: 2 },
  expired: { label: '만료 지남', mark: '🔴', tone: 'warn', rank: 3 }
};
export const RENEW_KIND_LABEL = { annual: '연봉계약서', labor: '근로계약서(기간제)' };
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const utc = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
/** b - a 일수(둘 다 YYYY-MM-DD) */
export const daysBetween = (a, b) => (isDate(a) && isDate(b) ? Math.round((utc(b) - utc(a)) / 86400000) : NaN);
/** 남은 일수 → 단계. 60일 넘게 남았으면 null(알리지 않음), 정확히 30·45·60일 남은 날은 그 단계에 포함 */
export function renewStage(days) { if (!Number.isFinite(days)) return null; return days < 0 ? 'expired' : days <= RENEW_M1 ? 'm1' : days <= RENEW_M15 ? 'm15' : days <= RENEW_M2 ? 'm2' : null; }
export const renewDayText = (days) => (days === 0 ? 'D-day' : days > 0 ? 'D-' + days : 'D+' + -days);

/** 한 직원의 가장 늦은 만료 계약 — 같은 날이면 연봉계약서 우선. 만료일이 없는 계약서는 건너뛴다 */
export function latestContract(annualDocs, laborDocs) {
  const c = []; (annualDocs || []).forEach((d) => { if (d && isDate(d.endDate)) c.push({ kind: 'annual', endDate: d.endDate, startDate: d.startDate || '' }); });
  (laborDocs || []).forEach((d) => { if (d && isDate(d.endDate)) c.push({ kind: 'labor', endDate: d.endDate, startDate: d.startDate || '' }); });
  c.sort((a, b) => (a.endDate === b.endDate ? (a.kind === 'annual' ? -1 : 1) : a.endDate < b.endDate ? 1 : -1)); return c[0] || null;
}
/** 다음 계약 단추: 단기 근로계약이 끝나면 연봉계약서(정식 전환)를 먼저, 근로계약서 갱신은 보조. 시작일 = 만료일 다음 날 */
export function nextOptions(kind, workerId, endDate) {
  const start = addDaysStr(endDate, 1); const href = (k) => '#/hr/' + (k === 'annual' ? 'annualc' : 'laborc') + '/' + encodeURIComponent(workerId) + '/new?start=' + start;
  return kind === 'labor' ? [{ kind: 'annual', label: '연봉계약서로 정식 전환', href: href('annual'), start }, { kind: 'labor', label: '근로계약서로 갱신', href: href('labor'), start }] : [{ kind: 'annual', label: '연봉계약서 갱신', href: href('annual'), start }];
}
/** 인사 홈 목록 — workers: 직원, annual/labor: { 직원id: [계약서 문서…] }, today: YYYY-MM-DD. 퇴사자와 열외(대표·테스트 계정)는 제외, 급한 순(남은 일수 적은 순) */
export function renewItems(inp) {
  const x = inp || {}; const today = x.today; const A = x.annual || {}, L = x.labor || {}; const out = [];
  if (!isDate(today)) return out;
  (x.workers || []).forEach((w) => {
    if (!w || !w.id || w.status === 'resigned' || HOME_EXEMPT.includes(String(w.name || '').trim())) return;
    const lc = latestContract(A[w.id], L[w.id]); if (!lc) return;
    const days = daysBetween(today, lc.endDate); const stage = renewStage(days); if (!stage) return;
    const sg = RENEW_STAGES[stage]; out.push({ workerId: w.id, id: w.id, name: w.name || '', dept: w.dept || '', rank: w.rank || '', empNo: w.empNo || '', kind: lc.kind, kindLabel: RENEW_KIND_LABEL[lc.kind], endDate: lc.endDate, aLatest: lc.endDate, days, dayText: renewDayText(days), stage, tone: sg.tone, badge: (sg.mark ? sg.mark + ' ' : '') + sg.label, options: nextOptions(lc.kind, w.id, lc.endDate) });
  });
  return out.sort((a, b) => a.days - b.days || String(a.name).localeCompare(String(b.name)));
}
