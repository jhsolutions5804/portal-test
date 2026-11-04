/* 경력관리용 순수 규칙(화면·네트워크 없이 시험 가능) — 대기열 1-3-27-1.
 * ① 프로젝트 명단의 역할(role): 고정 목록 없이 자유 입력(40자), 이미 쓴 값을 입력칸 제안으로만 쓴다. 바뀔 때마다 roleLog 에 {role, at} 를 남겨 기간별로 나눈다.
 * ② 사람별 프로젝트 이력 집계(careerProjects): 저장하지 않고 명단·공수 기록에서 계산한다(원본이 바뀌면 이력도 바뀐다 — 이중 저장으로 어긋나는 것을 막는다).
 *    projects: [{ key, name, ended, test, roster: { 근로자id: { role, roleLog, active, endedDate, createdDate } }, rows: [[날짜(YYYY-MM-DD), { 근로자id: 공수 }], …] }] — 월간 공수 보기(aggregateMonth)와 같은 모양에 test·roleLog 등을 더한 것. */
export const ROLE_MAX = 40;
const LOG_MAX = 30;
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const r1 = (n) => Math.round(n * 10) / 10;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** 역할 입력값 정리: 앞뒤 공백 제거·연속 공백 한 칸·40자까지(자유 입력, 목록 없음) */
export const cleanRole = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, ROLE_MAX);
/** 입력칸 제안: 명단들에서 이미 쓴 역할을 많이 쓴 순(같으면 가나다)으로. rosters = 명단 배열 또는 { id: 항목 } 객체의 목록 */
export function roleSuggestions(rosters, limit) {
  const cnt = {};
  (rosters || []).forEach((r) => { const list = Array.isArray(r) ? r : Object.keys(r || {}).map((k) => r[k]); list.forEach((w) => { const x = cleanRole(w && w.role); if (x) cnt[x] = (cnt[x] || 0) + 1; }); });
  return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || a.localeCompare(b, 'ko')).slice(0, limit || 20);
}
/** 역할 변경 계획 → { role, roleLog } 또는 null(바뀐 것 없음). 비우면 role '' 로 두고 그 시점도 기록한다(그 뒤 공수는 「미지정」). today = YYYY-MM-DD */
export function rolePatch(w, value, today) {
  const role = cleanRole(value); const cur = cleanRole(w && w.role);
  if (role === cur) return null;
  const log = ((w && w.roleLog) || []).filter((e) => e && DATE.test(e.at || '')).map((e) => ({ role: cleanRole(e.role), at: e.at }));
  // 처음 역할을 적는 경우, 그 전에 이미 역할이 있었는데 기록이 없던 옛 데이터라면 현재 역할을 시작점으로 먼저 남긴다
  if (!log.length && cur) log.push({ role: cur, at: (w && w.createdDate && DATE.test(w.createdDate)) ? w.createdDate : '1900-01-01' });
  log.push({ role, at: DATE.test(today || '') ? today : '1900-01-01' });
  return { role, roleLog: log.slice(-LOG_MAX) };
}
/** 날짜 d 에 적용되는 역할: roleLog 에서 at <= d 인 가장 늦은 기록. d 가 첫 기록보다 이르면 첫 기록의 역할(그 전 역할은 모르므로) */
export function roleOn(w, d) {
  const log = ((w && w.roleLog) || []).filter((e) => e && DATE.test(e.at || '')).slice().sort((a, b) => a.at.localeCompare(b.at));
  if (!log.length) return cleanRole(w && w.role);
  let r = log[0].role; log.forEach((e) => { if (e.at <= d) r = e.role; });
  return cleanRole(r);
}
/** 한 사람의 프로젝트 이력: [{ pjtKey, name, ended, active, role(마지막 역할), from, to, days(출역일), manDays, segments:[{ role, from, to, days, manDays }] }] 시작이 늦은 순.
 *  기간 = 공수 기록이 있는 첫날 ~ (진행 중 투입이면 today, 종료된 투입·프로젝트면 마지막 공수일), 공수 기록이 없으면 명단의 createdDate~endedDate.
 *  시험 프로젝트(test:true)는 opts.includeTest 가 아니면 뺀다. 공수 0 인 날은 출역일에 넣지 않는다. */
export function careerProjects(workerId, projects, opts) {
  const o = opts || {}; const today = DATE.test(o.today || '') ? o.today : ''; const out = [];
  (projects || []).forEach((p) => {
    if (!p || (p.test && !o.includeTest)) return;
    const w = (p.roster || {})[workerId];
    const days = [];
    (p.rows || []).forEach(([date, md]) => { const a = num((md || {})[workerId]); if (a > 0 && DATE.test(date || '')) days.push({ date, a }); });
    if (!w && !days.length) return;
    days.sort((x, y) => x.date.localeCompare(y.date));
    const first = days.length ? days[0].date : ''; const last = days.length ? days[days.length - 1].date : '';
    const live = !!w && w.active !== false && !p.ended;
    const from = first || (w && DATE.test(w.createdDate || '') ? w.createdDate : '');
    const to = live ? (today || last || from) : (last || (w && DATE.test(w.endedDate || '') ? w.endedDate : '') || from);
    const segs = []; days.forEach((d) => { const role = roleOn(w, d.date); let s = segs[segs.length - 1]; if (!s || s.role !== role) { s = { role, from: d.date, to: d.date, days: 0, manDays: 0 }; segs.push(s); } s.to = d.date; s.days += 1; s.manDays += d.a; });
    segs.forEach((s) => { s.manDays = r1(s.manDays); });
    out.push({ pjtKey: p.key, name: p.name, ended: !!p.ended, active: live, role: cleanRole(w && w.role) || (segs.length ? segs[segs.length - 1].role : ''), from, to, days: days.length, manDays: r1(days.reduce((s, d) => s + d.a, 0)), segments: segs });
  });
  return out.sort((a, b) => String(b.from || '').localeCompare(String(a.from || '')) || String(a.name).localeCompare(String(b.name), 'ko'));
}
/** 이력 요약: { count, manDays, from(가장 이른 시작), to(가장 늦은 끝) } */
export function careerSummary(list) {
  const L = list || []; const froms = L.map((x) => x.from).filter(Boolean).sort(); const tos = L.map((x) => x.to).filter(Boolean).sort();
  return { count: L.length, manDays: r1(L.reduce((s, x) => s + (x.manDays || 0), 0)), from: froms[0] || '', to: tos[tos.length - 1] || '' };
}
