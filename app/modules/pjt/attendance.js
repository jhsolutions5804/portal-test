/* PJT 근태·공수 — 순수 규칙(화면·네트워크 없이 시험 가능). 구포털 Ph2·Ph4·경량PJT의 출역·공수 입력 규칙을 합쳤다.
 * 저장 형식은 그대로다: 출역 = { checks: [근로자 id…] }, 공수 = { md: { 근로자 id: 숫자 } } (날짜별 문서). 영업기획의 공수 연동·팀별 노무비가 이 md 맵을 읽는다.
 * 합친 규칙: 공수는 0 이상, **상한 없음**(대표님 2026-10-20 "일 공수에 상한을 두지마" — 조출 1 + 다른 현장 오후 연장 1 이면 하루 2, 한 현장에서 조출·주간·연장·야간을 뛰면 2.5, 3 을 넘는 날도 있다. 예전의 "0~3, 초과는 3으로 자름" 은 조용히 데이터를 틀리게 했다), 소수 첫째 자리, 0이면 지움 / **공수를 입력하면(0보다 크면) 출역도 자동으로 체크된다 — 출역과 공수는 항상 함께 간다(대표님 2026-10-13)**: 출역을 해제하면 그 사람의 공수도 비운다 / 출역 체크 때 공수를 자동으로 넣을지는 프로젝트 설정(defaultManday) — 실데이터에서 Ph4는 출역 체크 없이 공수만 쓴 날이 있고 Ph2 공수는 대부분 2라서 Ph2·Ph4는 지금처럼 자동 입력 없음,
 * 경량PJT는 지금처럼 1 / **퇴사 처리한 사람의 공수도 나온다**: 퇴사일 전날까지의 공수는 모든 화면·집계표에 남고(퇴사일 당일부터만 입력 대상에서 빠짐), 명부에 없는 사람의 공수도 사라지지 않고 "(명부에 없음)" 행으로 보인다 / 공수 문서는 항상 읽어 온 전체 맵에서 한 사람만 고쳐 쓴다(경량PJT 구포털은 명부에 없는 사람의 공수를 지우는 결함이 있었다). */
const num = (v) => { const n = parseFloat(String(v == null ? '' : v)); return Number.isNaN(n) ? 0 : n; };
/** 입력값을 공수로: 숫자가 아니거나 0 미만은 0, 소수 첫째 자리 반올림. **위로는 상한이 없다**(이름의 clamp 는 0 아래로만 막는다는 뜻 — 하루 공수는 3 을 넘을 수 있다) */
export function clampManday(raw) { let v = num(raw); if (v < 0) v = 0; return Math.round(v * 10) / 10; }
const clone = (o) => Object.assign({}, o || {});
/** 한 사람의 공수를 정한 새 맵(0이면 그 사람 항목을 지움). 다른 사람의 항목은 그대로 둔다 */
export function setManday(md, wid, raw) { const m = clone(md); const v = clampManday(raw); if (v === 0) delete m[wid]; else m[wid] = v; return m; }
export const adjustManday = (md, wid, delta) => setManday(md, wid, ((md && md[wid]) || 0) + num(delta));
/** 여러 사람(ids)에게 같은 공수를 일괄 적용(0이면 지움). 그 밖의 사람은 그대로 */
export function setAllManday(md, ids, raw) { let m = clone(md); (ids || []).forEach((id) => { m = setManday(m, id, raw); }); return m; }
/** 한 사람의 공수를 정하고 출역도 맞춘다(대표님 규칙): 0보다 크면 출역 체크를 켜고, 0이면 공수만 지운다(출역은 그대로). 반환 { checks, md } */
export function applyManday(checks, md, wid, raw) {
  const m = setManday(md, wid, raw); const c = (checks || []).slice(); if (m[wid] > 0 && c.indexOf(wid) === -1) c.push(wid); return { checks: c, md: m };
}
export const applyAdjust = (checks, md, wid, delta) => applyManday(checks, md, wid, ((md && md[wid]) || 0) + num(delta));
/** 여러 사람에게 같은 공수를 일괄 적용하고 출역도 맞춘다(0이면 공수만 지움) */
export function applyAllManday(checks, md, ids, raw) { let r = { checks: (checks || []).slice(), md: clone(md) }; (ids || []).forEach((id) => { r = applyManday(r.checks, r.md, id, raw); }); return r; }
/** 출역 체크 한 명 토글. 켜는 순간 공수 칸이 비어 있고 defaultManday 가 있으면 그 값을 넣는다. 끄면 그 사람의 공수도 비운다(출역과 공수는 함께) — 공수가 있는 사람을 끌 때는 화면에서 먼저 확인한다(hasManday). 반환 { checks, md } */
export function toggleCheck(checks, md, wid, defaultManday) {
  const c = (checks || []).slice(); const m = clone(md); const i = c.indexOf(wid);
  if (i < 0) { c.push(wid); if (defaultManday != null && m[wid] == null) m[wid] = clampManday(defaultManday); } else { c.splice(i, 1); delete m[wid]; }
  return { checks: c, md: m };
}
export const hasManday = (md, wid) => ((md || {})[wid] || 0) > 0;
/** 전체 출역 체크/해제: targets(조작할 수 있는 사람) 모두 체크돼 있으면 모두 해제(그 사람들의 공수도 비움), 아니면 모두 체크(빈 공수 칸은 defaultManday). 대상이 아닌 사람은 그대로 */
export function toggleAll(checks, md, targets, defaultManday) {
  const ids = targets || []; if (!ids.length) return { checks: (checks || []).slice(), md: clone(md) };
  const all = ids.every((id) => (checks || []).indexOf(id) !== -1); let c = (checks || []).slice(); const m = clone(md);
  if (all) { c = c.filter((id) => ids.indexOf(id) === -1); ids.forEach((id) => { delete m[id]; }); }
  else ids.forEach((id) => { if (c.indexOf(id) === -1) c.push(id); if (defaultManday != null && m[id] == null) m[id] = clampManday(defaultManday); });
  return { checks: c, md: m };
}
/** 그날 조작·표시 대상 인원: 퇴사일이 그날 이전(당일 포함)인 사람은 뺀다(구포털 규칙 — 퇴사일 당일부터 제외, 퇴사일 전날까지는 나온다). resigned = { 근로자 id: { resigned, resignedDate } }.
 *  단, 그날 이미 공수·출역이 기록된 사람은 퇴사 후여도 보인다 — 기록된 공수는 어디서도 사라지지 않는다(rec = { checks, md }, 선택) */
export function activeWorkersForDate(roster, resigned, dateKey, rec) {
  const rc = rec || {}; const has = (id) => (rc.checks || []).indexOf(id) !== -1 || num((rc.md || {})[id]) > 0;
  return (roster || []).filter((w) => { const info = (resigned || {})[w.id] || (resigned || {})[w.masterId]; return !(info && info.resigned && info.resignedDate && info.resignedDate <= dateKey) || has(w.id); });
}
/** 팀장(게스트) 권한: 관리자·일반 참여자는 모두, 팀장 계정은 본인과 자기 팀원(마스터 leaderId 가 본인)만 조작한다. me = { guest, teamLeaderIds }, teamMasterIds = 본인+팀원 마스터 id 집합 */
export function canWorkOn(me, worker, teamMasterIds) {
  if (!me || !me.guest) return true; if (!me.teamLeaderIds || !me.teamLeaderIds.length) return false;
  return !!teamMasterIds && teamMasterIds.has(worker.masterId || worker.id);
}
export const mdSum = (md) => Object.keys(md || {}).reduce((s, k) => s + num(md[k]), 0);
/** 그날 요약: 출역 인원(체크됐거나 공수가 있는 사람 — 옛 기록의 "공수만 있는 날"도 출역으로 센다)·공수 합계·공수가 있는 인원. activeIds 가 있으면 그 대상자만 센다 */
export function dayTotals(checks, md, activeIds) {
  const act = activeIds ? new Set(activeIds) : null; const ids = new Set((checks || []).concat(Object.keys(md || {}).filter((k) => num(md[k]) > 0)));
  return { attended: [...ids].filter((id) => !act || act.has(id)).length, manday: Math.round(mdSum(md) * 10) / 10, withManday: Object.keys(md || {}).filter((k) => num(md[k]) > 0).length };
}
/** 인원별 누적 공수(여러 날짜 문서의 md 맵을 합침) — mdMaps: [md 맵…] */
export function cumulativeByWorker(mdMaps) { const t = {}; (mdMaps || []).forEach((md) => Object.keys(md || {}).forEach((k) => { t[k] = Math.round(((t[k] || 0) + num(md[k])) * 10) / 10; })); return t; }
/** 최근 n일(오늘부터 거꾸로) 날짜별 공수 합계. mdByDay = { 'YYYY-MM-DD': md 맵 } */
export function recentTotals(mdByDay, todayKey, n) {
  const out = []; const [y, m, d] = String(todayKey).split('-').map(Number); const base = new Date(Date.UTC(y, m - 1, d));
  for (let i = 0; i < (n == null ? 7 : n); i++) { const dt = new Date(base.getTime() - i * 86400000); const key = dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0'); out.push({ date: key, sum: Math.round(mdSum((mdByDay || {})[key]) * 10) / 10 }); }
  return out;
}
/** 월 공수 집계표: 그 달 1일에 재직 중이던 인원(월 중 퇴사자 포함)을 행으로, 날짜별 공수와 합계. y 연도, m 0~11 */
export function monthSheet(roster, resigned, mdByDay, y, m) {
  const days = new Date(y, m + 1, 0).getDate(); const pad = (n) => String(n).padStart(2, '0'); const first = y + '-' + pad(m + 1) + '-01'; const keys = Array.from({ length: days }, (_, i) => y + '-' + pad(m + 1) + '-' + pad(i + 1));
  const known = new Set((roster || []).map((w) => w.id)); const row = (id, name, orphan) => { const values = keys.map((k) => num(((mdByDay || {})[k] || {})[id])); return { id, name, orphan: !!orphan, values, total: Math.round(values.reduce((a, b) => a + b, 0) * 10) / 10 }; };
  const rows = activeWorkersForDate(roster, resigned, first).map((w) => row(w.id, w.name || '', false));
  // 이 달에 공수가 있는데 위에 없는 사람(퇴사 처리한 사람은 이 달 안에 퇴사했어도 위에 있고, 여기는 명부에서 빠진 사람)도 행으로 — 기록된 공수는 사라지지 않는다
  const seen = new Set(rows.map((r) => r.id)); const extra = []; keys.forEach((k) => Object.keys((mdByDay || {})[k] || {}).forEach((id) => { if (!seen.has(id) && num(mdByDay[k][id]) > 0 && extra.indexOf(id) === -1) extra.push(id); }));
  extra.forEach((id) => { const w = (roster || []).find((x) => x.id === id); rows.push(row(id, w ? (w.name || id) : '(명부에 없음) ' + id, !known.has(id))); });
  const dayTotals2 = keys.map((k, i) => Math.round(rows.reduce((a, r) => a + r.values[i], 0) * 10) / 10);
  return { days, keys, rows, dayTotals: dayTotals2, grand: Math.round(rows.reduce((a, r) => a + r.total, 0) * 10) / 10 };
}
/** 구포털 Ph2 의 "오늘": 한국 시간 새벽 6시 전이면 전날(야간조가 밤 12시를 넘겨 일해도 그 근무일로 기록). now = 밀리초(생략하면 지금) */
export function appToday(now) {
  const kst = new Date((now == null ? Date.now() : now) + 9 * 3600000); if (kst.getUTCHours() < 6) kst.setUTCDate(kst.getUTCDate() - 1);
  return kst.getUTCFullYear() + '-' + String(kst.getUTCMonth() + 1).padStart(2, '0') + '-' + String(kst.getUTCDate()).padStart(2, '0');
}
export function shiftDate(dateKey, delta) { const [y, m, d] = String(dateKey).split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, d + delta)); return dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0'); }
/** 월별 누적 공수(프로젝트 전체 기간): 행 = 사람, 열 = 공수가 기록된 달(오래된 달부터), 오른쪽 합계와 아래 월 합계. 공수가 있는 사람만 행으로 — 명부 순서 뒤에, 명부에 없는 사람은 "(명부에 없음)"으로 맨 아래.
 *  mdByDay = { 'YYYY-MM-DD': md 맵 } (그 프로젝트의 모든 공수 문서) */
export function monthlyMatrix(roster, mdByDay) {
  const months = [...new Set(Object.keys(mdByDay || {}).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && mdSum(mdByDay[k]) > 0).map((k) => k.slice(0, 7)))].sort(); const idx = {}; months.forEach((m, i) => { idx[m] = i; });
  const sums = {}; Object.keys(mdByDay || {}).forEach((k) => { const mi = idx[k.slice(0, 7)]; if (mi == null) return; Object.keys(mdByDay[k] || {}).forEach((id) => { const v = num(mdByDay[k][id]); if (!v) return; (sums[id] = sums[id] || months.map(() => 0))[mi] += v; }); });
  const r1 = (n) => Math.round(n * 10) / 10; const known = new Set((roster || []).map((w) => w.id)); const mk = (id, name, orphan) => { const values = (sums[id] || []).map(r1); return { id, name, orphan, values, total: r1(values.reduce((a, b) => a + b, 0)) }; };
  const rows = (roster || []).filter((w) => sums[w.id]).map((w) => mk(w.id, w.name || w.id, false)).concat(Object.keys(sums).filter((id) => !known.has(id)).sort().map((id) => mk(id, '(명부에 없음) ' + id, true)));
  const monthTotals = months.map((m, i) => r1(rows.reduce((a, r) => a + r.values[i], 0)));
  return { months, rows, monthTotals, grand: r1(rows.reduce((a, r) => a + r.total, 0)) };
}
