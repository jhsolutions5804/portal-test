/* 일정 모듈의 순수 규칙 — 화면(DOM)·네트워크 없이 시험한다.
 * 공통 일정 형식: { id, source, title, start, end, startTime, endTime, tag, tagLabel, project, place, isTodo, done, link, editable, ref } */
import { pad, ymd, dateKey, isYmd, isHHMM, addDays, TAG_LABEL, tagLabelOf, makeEvent, fromLegacyDoc } from '../../shared/calendar-event.js?v=20261008k';
export { pad, ymd, dateKey, isYmd, isHHMM, addDays, TAG_LABEL, tagLabelOf, makeEvent, fromLegacyDoc };
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
export const dayOfWeek = (key) => new Date(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)).getDay();
export const monthKey = (y, m) => y + '-' + pad(m);
export function shiftMonth(y, m, delta) { const d = new Date(y, m - 1 + delta, 1); return { y: d.getFullYear(), m: d.getMonth() + 1 }; }
export function parseMonth(s, now) {      // 'YYYY-MM' → {y,m}, 형식이 틀리면 이번 달
  const n = now || new Date(); const m = /^(\d{4})-(\d{2})$/.exec(s || '');
  if (m && +m[2] >= 1 && +m[2] <= 12) return { y: +m[1], m: +m[2] };
  return { y: n.getFullYear(), m: n.getMonth() + 1 };
}
/** 달력 칸: 일요일 시작, 앞뒤 달 날짜로 채운 주 단위 배열. minWeeks 를 주면 모자란 만큼 다음 주를 더 붙인다(홈 위젯은 6주 고정 — 달을 넘겨도 높이가 안 바뀜) */
export function monthGrid(y, m, minWeeks) {
  const first = new Date(y, m - 1, 1); const last = new Date(y, m, 0);
  const start = new Date(y, m - 1, 1 - first.getDay()); const weeks = [];
  for (let c = new Date(start); ; c.setDate(c.getDate() + 7)) {
    const w = []; for (let i = 0; i < 7; i++) { const d = new Date(c.getFullYear(), c.getMonth(), c.getDate() + i); w.push({ key: dateKey(d), day: d.getDate(), inMonth: d.getMonth() === m - 1, dow: d.getDay() }); }
    weeks.push(w); if (new Date(c.getFullYear(), c.getMonth(), c.getDate() + 7) > last && weeks.length >= (minWeeks || 0)) break;
  }
  return weeks;
}
/** 보이는 달력 전체의 날짜 범위(앞뒤 달 칸 포함) */
export function gridRange(y, m, minWeeks) { const g = monthGrid(y, m, minWeeks); return { from: g[0][0].key, to: g[g.length - 1][6].key }; }

export const OWN_TAGS = ['meeting', 'edu', 'event', 'admin', 'safety', 'off', 'etc'];   // 일정 모듈에서 직접 등록할 수 있는 분류(회사 일정)


/* ── 날짜별 배치 ── */
/** 자정을 넘기는 일정(예: 19:00 → 다음날 05:00)은 시작일에만 표시한다. 진짜 여러 날 일정(출장 등)은 기간 전체에 표시 */
export function isOvernight(e) { return !!e.startTime && !!e.endTime && e.end === addDays(e.start, 1) && e.endTime <= e.startTime; }
/** opts.isHoliday(key) — 공휴일 판정. workdays 일정(연차·휴무)은 여러 날일 때 주말·공휴일 칸을 건너뛴다: 전자결재가 연차 일수를 주말을 뺀 날수로 세기 때문에
 *  금~월 연차(2일)가 금·토·일·월 4칸으로 보이면 안 된다. 하루짜리는 어느 날이든 그대로 표시한다. */
export function occursOn(e, key, opts) {
  if (!e.start) return false; if (isOvernight(e)) return key === e.start;
  if (key < e.start || key > e.end) return false;
  if (e.workdays && e.end !== e.start) { const dw = dayOfWeek(key); if (dw === 0 || dw === 6) return false; if (opts && opts.isHoliday && opts.isHoliday(key)) return false; }
  return true;
}
const SRC_ORDER = { leave: 1, hr: 2, expiry: 3, company: 4, pjt: 5 };
export function sortDay(list) {
  return list.slice().sort((a, b) => {
    const at = a.startTime || '', bt = b.startTime || ''; if (!!at !== !!bt) return at ? 1 : -1;    // 종일(시간 없음)이 먼저
    if (at !== bt) return at.localeCompare(bt);
    return (SRC_ORDER[a.source] || 9) - (SRC_ORDER[b.source] || 9) || a.title.localeCompare(b.title);
  });
}
/** 날짜 → 일정 목록 (보이는 달력 범위 안만) */
export function groupByDay(events, range, opts) {
  const by = {};
  events.forEach((e) => {
    if (!e.start) return; const from = e.start < range.from ? range.from : e.start; const to = isOvernight(e) ? e.start : (e.end > range.to ? range.to : e.end);
    for (let k = from; k <= to; k = addDays(k, 1)) { if (k >= range.from && k <= range.to && occursOn(e, k, opts)) (by[k] = by[k] || []).push(e); if (k > to) break; }
  });
  Object.keys(by).forEach((k) => { by[k] = sortDay(by[k]); });
  return by;
}

/* ── 제공자 결과 합치기(하나가 실패해도 나머지는 보인다) ── */
export const isDenied = (err) => !!err && (err.code === 'permission-denied' || /permission|insufficient/i.test(String(err.message || '')));
export function mergeResults(results) {
  const events = []; const failed = []; const hidden = [];
  results.forEach((r) => {
    if (r.error) { if (isDenied(r.error)) hidden.push(r.id); else failed.push(r.id); return; }
    (r.events || []).forEach((e) => events.push(e));
  });
  const seen = new Set(); const uniq = events.filter((e) => { const k = e.source + '|' + e.id; if (seen.has(k)) return false; seen.add(k); return true; });
  return { events: uniq, failed, hidden };
}
/** 제공자 켜기/끄기: off = 꺼 둔 제공자 id 배열 */
export const visibleEvents = (events, off) => (off && off.length ? events.filter((e) => off.indexOf(e.source) === -1) : events);

/* ── 만료 일정 ── */
export const SOON_DAYS = 30;     // 연명부와 같은 기준: 30일 이내면 임박
export function daysUntil(expiry, today) { return Math.round((new Date(expiry + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000); }
export function expiryState(expiry, today) { const d = daysUntil(expiry, today); return { d, state: d < 0 ? 'expired' : d <= SOON_DAYS ? 'soon' : 'ok' }; }
export function expiryNote(expiry, today) { const s = expiryState(expiry, today); return s.state === 'expired' ? '만료됨 (D+' + Math.abs(s.d) + ')' : s.d === 0 ? '오늘 만료' : 'D-' + s.d; }

/* ── 직접 등록하는 일정(회사 일정) ── */
export function validateDraft(d) {
  const e = {}; const x = d || {};
  if (!String(x.title || '').trim()) e.title = '제목을 입력해 주세요.'; else if (String(x.title).trim().length > 100) e.title = '제목은 100자 이내로 적어 주세요.';
  if (!isYmd(x.start)) e.start = '시작일을 선택해 주세요.';
  if (x.end && !isYmd(x.end)) e.end = '종료일 형식이 맞지 않습니다.'; else if (x.end && isYmd(x.start) && x.end < x.start) e.end = '종료일은 시작일보다 빠를 수 없습니다.';
  if (!!x.startTime !== !!x.endTime && !x.isTodo) e.time = '시작 시각과 종료 시각을 함께 입력하거나 둘 다 비워 주세요.';
  if (x.startTime && !isHHMM(x.startTime)) e.time = '시각 형식이 맞지 않습니다.'; if (x.endTime && !isHHMM(x.endTime)) e.time = '시각 형식이 맞지 않습니다.';
  const sameDay = !x.end || x.end === x.start;
  if (!e.time && x.startTime && x.endTime && sameDay && x.endTime <= x.startTime) e.time = '같은 날 안에서는 종료 시각이 시작 시각보다 늦어야 합니다. (밤을 넘기면 종료일을 다음 날로)';
  if (OWN_TAGS.indexOf(x.tag) === -1) e.tag = '분류를 선택해 주세요.';
  if (String(x.place || '').length > 120) e.place = '장소는 120자 이내로 적어 주세요.'; if (String(x.memo || '').length > 600) e.memo = '메모는 600자 이내로 적어 주세요.';
  return e;
}
/** 직접 등록하는 일정 → company_schedules 문서(옛 일정과 같은 필드 이름) */
export function toCompanyDoc(d, me) {
  const todo = d.isTodo === true;
  return { text: String(d.title).trim(), tag: d.tag, tagLabel: TAG_LABEL[d.tag] || '일정', sdate: d.start, edate: d.end || d.start, stime: todo || !d.startTime ? null : d.startTime, etime: todo || !d.endTime ? null : d.endTime,
    isTodo: todo, done: false, place: String(d.place || '').trim(), memo: String(d.memo || '').trim(), att: me.name || '', reg: me.email || me.name || '', source: 'calendar' };
}
export const canWrite = (me) => !!me && !me.isGuest;                      // GUEST 는 일정 등록·수정·삭제·완료 불가
export const canEditOwn = (e, me) => canWrite(me) && e.editable === true;
export function fmtRange(e) {
  const t = e.startTime ? e.startTime + (e.endTime ? '~' + e.endTime : '') : '종일';
  const same = e.start === e.end; return same ? t : (e.start.slice(5).replace('-', '/') + '~' + e.end.slice(5).replace('-', '/') + (e.startTime ? ' ' + t : ''));
}

/* ── 보기 방식(Outlook 처럼): 안건(다가오는 일정 목록) · 월 — 하루·3일은 대표님 결정(2026-10-06)으로 두지 않는다 ── */
export const VIEWS = [['agenda', '안건'], ['month', '월']];
export const isView = (v) => VIEWS.some((x) => x[0] === v);
/** 기본 보기: 폰은 안건, PC는 월. 사용자가 고른 것이 있으면 그것(이 기기에 저장) */
export const defaultView = (phone, saved) => (isView(saved) ? saved : (phone ? 'agenda' : 'month'));
export const AGENDA_DAYS = 14;      // 안건은 오늘부터 14일치, "더 보기"로 14일씩 늘림
/** 안건의 날짜 범위(월은 gridRange 를 쓴다). extra = "더 보기"로 늘린 일수 */
export function viewRange(view, anchor, extra) { return { from: anchor, to: addDays(anchor, AGENDA_DAYS - 1 + (extra || 0)) }; }
export function shiftAnchor(view, anchor, dir) { return addDays(anchor, dir * 7); }   // 안건은 7일 단위로 이동
export function dayLabel(key, today) {
  const d = new Date(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)); const t = key === today ? '오늘 • ' : key === addDays(today, 1) ? '내일 • ' : '';
  return t + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + WEEKDAYS[d.getDay()] + '요일';
}
/** 안건에 보일 날짜: 일정이 있는 날 + (범위 안이면) 오늘 */
export function listDates(view, byDay, range, today) {
  const out = []; Object.keys(byDay).forEach((k) => { if (k >= range.from && k <= range.to && byDay[k].length) out.push(k); });
  if (today >= range.from && today <= range.to && out.indexOf(today) === -1) out.push(today); return out.sort();
}
export function rangeTitle(view, range) { const f = (k) => (+k.slice(5, 7)) + '/' + (+k.slice(8, 10)); return f(range.from) + ' ~ ' + f(range.to); }
