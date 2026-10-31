/* 영업기획·재무회계 일정(plan_schedules·finance_schedules) — 순수 규칙(화면·네트워크 없이 시험 가능). 설계: portal-functions/app-docs/calendar-extension-design.md (2026-10-20 대표님 결정, 2026-10-31 구현)
 * 일정 문서 모양은 옛 일정과 같다: text·sdate·edate·stime·etime·tag·tagLabel·place·memo·isTodo·done + source('manual'|'settlement_auto')·srcId·recurId·createdBy·createdByName·savedAt.
 * 금액·계좌는 일정에 넣지 않는다(제목이 Outlook 공유 사서함으로도 나간다). 자동 일정(settlement_auto)은 서버가 정산서에서 만들므로 화면에서 고치거나 지울 수 없다. */
import { addDays, isYmd, isHHMM, makeEvent, fromLegacyDoc, pad } from './calendar-event.js?v=20261031i';

export const SCHEDULE_CONFIG = {
  plan: { key: 'plan', title: '영업기획 일정', col: 'plan_schedules', source: 'plan', label: '영업기획 일정', order: 55, link: '#/plan/schedule', defaultTag: 'meeting',
    tags: [['est', '견적'], ['billing', '청구'], ['payment', '지급'], ['meeting', '미팅'], ['etc', '기타']], mailbox: '영업기획 일정(Outlook 공유 사서함)' },
  finance: { key: 'finance', title: '재무회계 일정', col: 'finance_schedules', source: 'finsch', label: '재무회계 일정', order: 65, link: '#/finance/schedule', defaultTag: 'payday',
    tags: [['payday', '결제일'], ['tax', '세무'], ['payroll', '급여'], ['etc', '기타']], mailbox: '재무회계 일정(Outlook 공유 사서함)' },
};
export const RECUR_KINDS = [['none', '반복 없음'], ['monthly', '매월 같은 날'], ['yearly', '매년 같은 날']];
export const RECUR_MAX = { monthly: 12, yearly: 3 };   // 서버 없이 클라이언트가 미리 펼쳐 저장하는 개수(설계: 향후 12개월). 끝나기 전에 다시 만들면 된다
export const AUTO_SOURCE = 'settlement_auto';

const ymKey = (y, m) => y + '-' + pad(m);
const lastDayOf = (y, m) => new Date(y, m, 0).getDate();   // m 은 1~12
export const isAuto = (d) => !!d && d.source === AUTO_SOURCE;
export const canEditDoc = (d) => !!d && !isAuto(d);
/** 'YYYY-MM' → { from, to } (그 달 1일~말일) */
export function monthRange(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym || '')); if (!m || +m[2] < 1 || +m[2] > 12) return null;
  const y = +m[1], mo = +m[2]; return { from: y + '-' + pad(mo) + '-01', to: y + '-' + pad(mo) + '-' + pad(lastDayOf(y, mo)) };
}
export const shiftMonth = (ym, n) => { const r = monthRange(ym); if (!r) return ym; const d = new Date(+r.from.slice(0, 4), +r.from.slice(5, 7) - 1 + n, 1); return ymKey(d.getFullYear(), d.getMonth() + 1); };
/** 반복 규칙의 날짜 목록 — 시작일부터. monthly: 매월 시작일의 '일'(그 달에 없으면 말일), yearly: 매년 같은 월·일(2/29 는 평년에 2/28) */
export function recurrenceDates(kind, start, count) {
  if (!isYmd(start)) return [];
  const y0 = +start.slice(0, 4), m0 = +start.slice(5, 7), d0 = +start.slice(8, 10);
  const n = Math.max(1, Math.min(count || RECUR_MAX[kind] || 1, 60)); const out = [];
  if (kind === 'monthly') for (let i = 0; i < n; i++) { const t = (m0 - 1) + i; const y = y0 + Math.floor(t / 12), m = (t % 12) + 1; out.push(y + '-' + pad(m) + '-' + pad(Math.min(d0, lastDayOf(y, m)))); }
  else if (kind === 'yearly') for (let i = 0; i < n; i++) { const y = y0 + i; out.push(y + '-' + pad(m0) + '-' + pad(Math.min(d0, lastDayOf(y, m0)))); }
  else out.push(start);
  return out;
}
/** 입력 양식 → 저장할 문서(검증). 오류면 { error }. form: { text, sdate, edate, stime, etime, tag, place, memo, isTodo } */
export function buildScheduleDoc(form, cfg, me) {
  const f = form || {}; const text = String(f.text == null ? '' : f.text).trim();
  if (!text) return { error: '제목을 입력해 주세요.' };
  if (text.length > 100) return { error: '제목은 100자까지 쓸 수 있습니다.' };
  if (!isYmd(f.sdate)) return { error: '날짜를 정확히 입력해 주세요.' };
  const edate = f.edate ? f.edate : f.sdate; if (!isYmd(edate)) return { error: '종료일을 정확히 입력해 주세요.' };
  if (edate < f.sdate) return { error: '종료일이 시작일보다 앞입니다.' };
  const todo = f.isTodo === true || f.isTodo === 'true';
  let stime = todo ? '' : String(f.stime || '').trim(), etime = todo ? '' : String(f.etime || '').trim();
  if (stime && !isHHMM(stime)) return { error: '시작 시간 형식이 맞지 않습니다(예: 09:30).' };
  if (etime && !isHHMM(etime)) return { error: '종료 시간 형식이 맞지 않습니다(예: 18:00).' };
  if (etime && !stime) return { error: '종료 시간만 입력할 수 없습니다. 시작 시간도 입력해 주세요.' };
  if (stime && etime && edate === f.sdate && etime <= stime) return { error: '종료 시간이 시작 시간보다 늦어야 합니다.' };
  const tagRow = cfg.tags.find((t) => t[0] === f.tag) || cfg.tags.find((t) => t[0] === cfg.defaultTag) || cfg.tags[0];
  const memo = String(f.memo == null ? '' : f.memo).trim(); if (memo.length > 600) return { error: '메모는 600자까지 쓸 수 있습니다.' };
  const place = String(f.place == null ? '' : f.place).trim(); if (place.length > 120) return { error: '장소는 120자까지 쓸 수 있습니다.' };
  return { doc: { text, sdate: f.sdate, edate, stime, etime, tag: tagRow[0], tagLabel: tagRow[1], place, memo, isTodo: todo, done: false, source: 'manual', createdBy: (me && me.uid) || '', createdByName: (me && (me.name || me.email)) || '' } };
}
/** 반복 입력 → 문서 여러 개(같은 recurId, 문서 id 는 <recurId>_<번호>). 여러 날짜 일정은 기간 길이를 유지해 각 날짜로 옮긴다 */
export function buildSeries(form, cfg, me, kind, recurId) {
  const base = buildScheduleDoc(form, cfg, me); if (base.error) return base;
  if (!kind || kind === 'none') return { docs: [{ id: '', doc: base.doc }] };
  if (!RECUR_MAX[kind]) return { error: '알 수 없는 반복 방식입니다.' };
  const span = daysBetween(base.doc.sdate, base.doc.edate); const dates = recurrenceDates(kind, base.doc.sdate);
  return { docs: dates.map((d, i) => ({ id: recurId + '_' + String(i + 1).padStart(2, '0'), doc: Object.assign({}, base.doc, { sdate: d, edate: addDays(d, span), recurId, recurKind: kind, recurNo: i + 1, recurTotal: dates.length }) })) };
}
export function daysBetween(a, b) { if (!isYmd(a) || !isYmd(b)) return 0; return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000); }
/** 반복 묶음에서 날짜 이후(포함) 또는 전체에 해당하는 문서 id 목록 */
export function seriesTargets(rows, recurId, scope, fromDate) { return (rows || []).filter((r) => r.d && r.d.recurId === recurId && (scope === 'all' || (r.d.sdate >= fromDate))).map((r) => r.id); }
/** 그 달에 걸친 일정만(여러 날 일정이 앞 달에서 시작했을 수 있다), 날짜·시간 순 */
export function monthItems(rows, ym) {
  const r = monthRange(ym); if (!r) return [];
  return (rows || []).filter((x) => x.d && x.d.sdate && (x.d.edate || x.d.sdate) >= r.from && x.d.sdate <= r.to)
    .sort((a, b) => (a.d.sdate < b.d.sdate ? -1 : a.d.sdate > b.d.sdate ? 1 : String(a.d.stime || '99').localeCompare(String(b.d.stime || '99')) || String(a.d.text).localeCompare(String(b.d.text))));
}
/** 날짜별 묶음 — 여러 날 일정은 시작일에 한 번만(기간은 행에 표시). [{ date, items }] */
export function groupByDate(items) { const m = new Map(); (items || []).forEach((x) => { const k = x.d.sdate; if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return [...m.keys()].sort().map((k) => ({ date: k, items: m.get(k) })); }
/** 위쪽 요약: 오늘 일정, 앞으로 7일 안 마감(미완료 할 일), 지난 미완료 할 일 */
export function summarize(rows, today) {
  const wk = addDays(today, 7); let todayN = 0, soon = 0, over = 0;
  (rows || []).forEach((x) => { const d = x.d || {}; if (!d.sdate) return; const e = d.edate || d.sdate; if (d.sdate <= today && e >= today) todayN++; if (d.isTodo && !d.done) { if (e < today) over++; else if (e <= wk) soon++; } });
  return { today: todayN, soon, over };
}
/** 홈 캘린더에 내놓을 공통 일정 형식 — 영업기획·재무회계 권한자에게만(제공자 perm) */
export function toCalendarEvent(id, d, cfg) {
  return fromLegacyDoc(id, d, cfg.source, '', { link: cfg.link, extra: isAuto(d) ? '정산서 자동' : '', tagLabel: d.tagLabel || undefined });
}
export { makeEvent };
