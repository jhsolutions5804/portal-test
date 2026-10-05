/* 일정 공통 형식 — 일정 모듈과 일정을 내놓는 모듈(어댑터 포함)이 함께 쓴다. 모듈끼리 직접 참조하지 않도록 공용(shared)에 둔다.
 * 공통 일정 형식: { id, source, title, start, end, startTime, endTime, tag, tagLabel, project, place, memo, isTodo, done, link, editable, ref, extra, tone } */
export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);          // m 은 1~12
export const dateKey = (d) => ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
export const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && dateKey(new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))) === s;
export const isHHMM = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
export function addDays(key, n) { const d = new Date(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10) + n); return dateKey(d); }

export const TAG_LABEL = { in: '반입', inspect: '검수', edu: '교육', off: '휴무', leave: '연차', meeting: '회의', fcu: '설치', safety: '안전', admin: '행정', event: '행사', etc: '기타', expiry: '만료', quality: '품질', hr: '인사' };
export const tagLabelOf = (tag, given) => (given && String(given).trim()) || TAG_LABEL[tag] || '일정';

const str = (v, max) => (v == null ? '' : String(v)).slice(0, max || 300);
const hm = (v) => (isHHMM(v) ? v : '');
export function makeEvent(o) {
  const start = isYmd(o.start) ? o.start : ''; const end = isYmd(o.end) && o.end >= start ? o.end : start;
  return {
    id: str(o.id, 160), source: str(o.source, 24), title: str(o.title, 200).trim() || '(제목 없음)', start, end,
    startTime: hm(o.startTime), endTime: hm(o.endTime), tag: str(o.tag, 24) || 'etc', tagLabel: tagLabelOf(o.tag, o.tagLabel),
    project: str(o.project, 80), place: str(o.place, 120), memo: str(o.memo, 600), isTodo: o.isTodo === true, done: o.done === true,
    link: typeof o.link === 'string' && /^#\/[a-z0-9_]+(\/[A-Za-z0-9_%.\-]+)*$/.test(o.link) ? o.link : '', editable: o.editable === true, ref: o.ref || null, extra: str(o.extra, 120), tone: str(o.tone, 12), workdays: o.workdays === true
  };
}
/** 옛 일정 문서(text·sdate·edate·stime·etime·tag·tagLabel·place·att·isTodo·done) → 공통 형식 */
export function fromLegacyDoc(id, d, source, project, extra) {
  const x = d || {};
  return makeEvent(Object.assign({ id: source + ':' + id, source, title: x.text, start: x.sdate, end: x.edate || x.sdate, startTime: x.stime, endTime: x.etime, tag: x.tag, tagLabel: x.tagLabel, project, place: x.place, memo: x.memo, isTodo: x.isTodo === true, done: x.done === true, extra: x.att }, extra || {}));
}
