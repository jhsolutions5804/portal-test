/* PJT 일정 — 순수 규칙(화면·네트워크 없이 시험 가능). 모든 프로젝트 같은 형식·같은 규칙.
 * 일정 문서(동결): { reg(등록자), text, place, att(참석자), tag, tagLabel, sdate, edate, isTodo, stime, etime, done?, savedAt }.
 * 저장 위치는 프로젝트마다 다르지만(어댑터 P.schedules) 문서 모양은 같다. Ph2 의 user_schedules 는 포털 홈 통합 캘린더가 함께 읽는다. */
export const CATS = [['edu', '교육'], ['meeting', '회의'], ['in', '반입'], ['fcu', '설치'], ['off', '휴무'], ['safety', '안전'], ['quality', '품질'], ['admin', '기타']];
export const TAG_LABEL = { edu: '교육', meeting: '회의', in: '반입', fcu: '설치', off: '휴무', safety: '안전', quality: '품질', admin: '기타', inspect: '검수', leave: '연차' };   // inspect·leave 는 옛 데이터 표시용
export const TAG_COLOR = { in: '#1D5BA6', inspect: '#2e7d32', edu: '#5e35b1', meeting: '#5D3A00', fcu: '#0A3D7A', safety: '#8D6E00', off: '#c0392b', leave: '#e67e22', quality: '#00695C', admin: '#7A8AA0' };
const pad = (n) => String(n).padStart(2, '0');
export const isKey = (k) => /^\d{4}-\d{2}-\d{2}$/.test(String(k || ''));
const ms = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fmt = (t) => { const d = new Date(t); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
export const addDays = (k, n) => fmt(ms(k) + n * 86400000);
export const dowOf = (k) => new Date(ms(k)).getUTCDay();
/** 내용에서 분류 추정(구포털 규칙 그대로): 회의 > 교육 > 반입 > 설치 > 휴무 > 안전 > 품질 > 기타 */
export function detectCat(text) {
  const t = String(text || '');
  if (/회의/.test(t)) return 'meeting'; if (/교육|훈련/.test(t)) return 'edu'; if (/반입|입고/.test(t)) return 'in'; if (/설치|시공|FCU|EHU/.test(t)) return 'fcu'; if (/휴무|휴일|휴가/.test(t)) return 'off';
  if (/안전|점검|대피|소방|TBM/.test(t)) return 'safety'; if (/품질|QC|공정회의|KISCO/.test(t)) return 'quality'; return 'admin';
}
/** 하루에 해당하는 일정(여러 날에 걸친 것 포함). 시작일 다음 날 새벽에 끝나는 야간 일정(19:00~05:00)은 시작일에만 보인다(원본 종료일·시간은 그대로 보존).
 *  표시 시간: 하루짜리는 시작 시간, 여러 날이면 첫날 시작 시간·마지막 날 종료 시간·중간 날 "00~24". 할 일(isTodo)은 하루 종일 = "00~24" */
export function itemsForKey(items, key) {
  const out = [];
  (items || []).forEach((u) => {
    const sd = u.sdate || key; const rawEd = u.edate || sd; let ed = rawEd;
    if (!u.isTodo && rawEd !== sd && u.stime && u.etime) { const diff = Math.round((ms(rawEd) - ms(sd)) / 86400000); if (diff === 1 && u.etime <= u.stime) ed = sd; }
    if (key < sd || key > ed) return;
    const multi = sd !== ed; let time = null, pos = 'single';
    if (u.isTodo) { time = '00~24'; } else if (!multi) time = u.stime || null; else if (key === sd) { time = u.stime || null; pos = 'start'; } else if (key === ed) { time = u.etime || null; pos = 'end'; } else { time = '00~24'; pos = 'mid'; }
    out.push(Object.assign({}, u, { time, _pos: pos, _sd: sd, _ed: rawEd }));
  });
  const rank = (x) => (x.time === '00~24' ? 0 : x.time ? 1 : 2);   // 하루 종일(00~24 — 할 일·여러 날 중간 날) → 시간 있는 것 → 시간 미정
  return out.sort((a, b) => rank(a) - rank(b) || (a.isTodo ? 1 : 0) - (b.isTodo ? 1 : 0) || String(a.time || '').localeCompare(String(b.time || '')) || String(a.text || '').localeCompare(String(b.text || ''), 'ko'));
}
/** "7/2 13:00 ~ 15:00" 형태의 일시 문구 */
export function rangeText(u) {
  const f = (s) => { if (!s) return ''; const [, m, d] = s.split('-'); return (+m) + '/' + (+d); }; const sd = u.sdate || '', ed = u.edate || sd; const noT = (t) => !t || t === '미정';
  if (u.isTodo) return f(sd) + (ed !== sd ? ' ~ ' + f(ed) : '') + ' (할 일 · 00~24)';
  if (sd === ed) { if (noT(u.stime)) return f(sd) + ' (시간 미정)'; return f(sd) + ' ' + u.stime + (!noT(u.etime) ? ' ~ ' + u.etime : ''); }
  return f(sd) + (noT(u.stime) ? '' : ' ' + u.stime) + ' ~ ' + f(ed) + (noT(u.etime) ? '' : ' ' + u.etime);
}
/** 그날의 점(달력 칸에 찍는 분류 색): 분류가 겹치면 하나만, 휴무는 점 대신 칸 색으로 */
export function dotsFor(items, key) { return [...new Set(itemsForKey(items, key).map((x) => x.tag || 'admin'))].filter((t) => t !== 'off'); }
/** 달력: y, m(0~11) → 6주 × 7일 날짜 키(그 달이 아닌 칸은 null) — 일요일 시작 */
export function monthGrid(y, m) { const first = new Date(Date.UTC(y, m, 1)).getUTCDay(); const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); const cells = []; for (let i = 0; i < first; i++) cells.push(null); for (let d = 1; d <= days; d++) cells.push(y + '-' + pad(m + 1) + '-' + pad(d)); while (cells.length % 7) cells.push(null); const weeks = []; for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7)); return weeks; }
/** 2주 달력: 고른 날이 속한 주(일요일 시작 — 달력과 같은 요일 순서)와 다음 주, 14일 */
export function twoWeeks(dateKey) { const sun = addDays(dateKey, -dowOf(dateKey)); return Array.from({ length: 14 }, (_, i) => addDays(sun, i)); }
/** 월요일 시작 주의 날짜들(n일치) */
export function weekDays(dateKey, n) { const dow = dowOf(dateKey); const monday = addDays(dateKey, -((dow + 6) % 7)); return Array.from({ length: n || 7 }, (_, i) => addDays(monday, i)); }
const TIME = /^([01]\d|2[0-4]):[0-5]\d$/;
/** 폼 값 → 저장할 일정 문서. form = { text, tag, sdate, edate, isTodo, sh, sm, eh, em, place, att, reg } — 실패하면 { error } */
export function buildDoc(form, defaults) {
  const f = form || {}; const text = String(f.text || '').trim();   // 내용은 비워도 된다(구포털 "공란 가능" — 목록에는 "(내용 없음)")
  let sdate = f.sdate && isKey(f.sdate) ? f.sdate : (defaults && defaults.today) || ''; if (!sdate) return { error: '날짜를 입력하세요.' }; let edate = f.edate && isKey(f.edate) ? f.edate : sdate; if (edate < sdate) edate = sdate;
  const tag = CATS.some((c) => c[0] === f.tag) ? f.tag : detectCat(text); const isTodo = !!f.isTodo; const t = (h, m) => pad(Math.max(0, Math.min(24, parseInt(h, 10) || 0))) + ':' + pad(Math.max(0, Math.min(59, parseInt(m, 10) || 0)));
  const stime = isTodo ? '00:00' : t(f.sh, f.sm), etime = isTodo ? '24:00' : t(f.eh, f.em);   // 할 일은 하루 종일(00:00~24:00)로 저장 — 구포털은 할 일의 시간을 쓰지 않으므로 호환된다
  if (!TIME.test(stime) || !TIME.test(etime)) return { error: '시간 형식이 올바르지 않습니다.' };
  return { data: { reg: String(f.reg || '').trim(), text, place: String(f.place || '').trim(), att: String(f.att || '').trim(), tag, tagLabel: TAG_LABEL[tag], sdate, edate, isTodo, stime, etime } };
}
/** 일정 문서 → 폼 값(수정용) */
export function formOf(u, today) { const p = (s) => { const [h, m] = String(s || '0:0').split(':'); return { h: pad(parseInt(h, 10) || 0), m: pad(Math.floor((parseInt(m, 10) || 0) / 10) * 10) }; }; const s = p(u && u.stime), e = p(u && u.etime); return { id: (u && u.id) || null, text: (u && u.text) || '', tag: (u && u.tag && CATS.some((c) => c[0] === u.tag) ? u.tag : 'admin'), sdate: (u && u.sdate) || today, edate: (u && (u.edate || u.sdate)) || today, isTodo: !!(u && u.isTodo), sh: s.h, sm: s.m, eh: e.h, em: e.m, place: (u && u.place) || '', att: (u && u.att) || '', reg: (u && u.reg) || '' }; }
