/* PJT 근태·공수 — 순수 규칙(화면·네트워크 없이 시험 가능). 구포털 Ph2·Ph4·경량PJT의 출역·공수 입력 규칙을 합쳤다.
 * 저장 형식은 그대로다: 출역 = { checks: [근로자 id…] }, 공수 = { md: { 근로자 id: 숫자 } } (날짜별 문서). 영업기획의 공수 연동·팀별 노무비가 이 md 맵을 읽는다.
 * 합친 규칙: 공수는 0~3, 소수 첫째 자리, 0이면 지움 / 출역 체크 때 공수를 자동으로 넣을지는 프로젝트 설정(defaultManday) — 실데이터에서 Ph4는 출역 체크 없이 공수만 쓴 날이 있고 Ph2 공수는 대부분 2라서 Ph2·Ph4는 지금처럼 자동 입력 없음,
 * 경량PJT는 지금처럼 1 / 공수 문서는 항상 읽어 온 전체 맵에서 한 사람만 고쳐 쓴다(경량PJT 구포털은 명부에 없는 사람의 공수를 지우는 결함이 있었다). */
export const MD_MAX = 3;
const num = (v) => { const n = parseFloat(String(v == null ? '' : v)); return Number.isNaN(n) ? 0 : n; };
/** 입력값을 공수로: 숫자가 아니거나 0 미만은 0, 3 초과는 3, 소수 첫째 자리 반올림 */
export function clampManday(raw) { let v = num(raw); if (v < 0) v = 0; if (v > MD_MAX) v = MD_MAX; return Math.round(v * 10) / 10; }
const clone = (o) => Object.assign({}, o || {});
/** 한 사람의 공수를 정한 새 맵(0이면 그 사람 항목을 지움). 다른 사람의 항목은 그대로 둔다 */
export function setManday(md, wid, raw) { const m = clone(md); const v = clampManday(raw); if (v === 0) delete m[wid]; else m[wid] = v; return m; }
export const adjustManday = (md, wid, delta) => setManday(md, wid, ((md && md[wid]) || 0) + num(delta));
/** 여러 사람(ids)에게 같은 공수를 일괄 적용(0이면 지움). 그 밖의 사람은 그대로 */
export function setAllManday(md, ids, raw) { let m = clone(md); (ids || []).forEach((id) => { m = setManday(m, id, raw); }); return m; }
/** 출역 체크 한 명 토글. 체크를 켜는 순간 공수 칸이 비어 있고 defaultManday 가 있으면 그 값을 넣는다(끌 때 공수는 건드리지 않음). 반환 { checks, md } */
export function toggleCheck(checks, md, wid, defaultManday) {
  const c = (checks || []).slice(); const m = clone(md); const i = c.indexOf(wid);
  if (i < 0) { c.push(wid); if (defaultManday != null && m[wid] == null) m[wid] = clampManday(defaultManday); } else c.splice(i, 1);
  return { checks: c, md: m };
}
/** 전체 출역 체크/해제: targets(조작할 수 있는 사람) 모두 체크돼 있으면 모두 해제, 아니면 모두 체크(빈 공수 칸은 defaultManday). 대상이 아닌 사람의 체크는 그대로 */
export function toggleAll(checks, md, targets, defaultManday) {
  const ids = targets || []; if (!ids.length) return { checks: (checks || []).slice(), md: clone(md) };
  const all = ids.every((id) => (checks || []).indexOf(id) !== -1); let c = (checks || []).slice(); const m = clone(md);
  if (all) c = c.filter((id) => ids.indexOf(id) === -1);
  else ids.forEach((id) => { if (c.indexOf(id) === -1) c.push(id); if (defaultManday != null && m[id] == null) m[id] = clampManday(defaultManday); });
  return { checks: c, md: m };
}
/** 그날 조작·표시 대상 인원: 퇴사일이 그날 이전(당일 포함)인 사람은 뺀다(구포털 규칙 — 퇴사일 당일부터 제외). resigned = { 근로자 id: { resigned, resignedDate } } */
export function activeWorkersForDate(roster, resigned, dateKey) {
  return (roster || []).filter((w) => { const info = (resigned || {})[w.id] || (resigned || {})[w.masterId]; return !(info && info.resigned && info.resignedDate && info.resignedDate <= dateKey); });
}
/** 팀장(게스트) 권한: 관리자·일반 참여자는 모두, 팀장 계정은 본인과 자기 팀원(마스터 leaderId 가 본인)만 조작한다. me = { guest, teamLeaderIds }, teamMasterIds = 본인+팀원 마스터 id 집합 */
export function canWorkOn(me, worker, teamMasterIds) {
  if (!me || !me.guest) return true; if (!me.teamLeaderIds || !me.teamLeaderIds.length) return false;
  return !!teamMasterIds && teamMasterIds.has(worker.masterId || worker.id);
}
export const mdSum = (md) => Object.keys(md || {}).reduce((s, k) => s + num(md[k]), 0);
/** 그날 요약: 출역 인원(그날 대상자 중 체크된 수)·공수 합계·공수가 있는 인원 */
export function dayTotals(checks, md, activeIds) {
  const act = new Set(activeIds || []); return { attended: (checks || []).filter((id) => act.has(id)).length, manday: Math.round(mdSum(md) * 10) / 10, withManday: Object.keys(md || {}).filter((k) => num(md[k]) > 0).length };
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
  const rows = activeWorkersForDate(roster, resigned, first).map((w) => { const values = keys.map((k) => num(((mdByDay || {})[k] || {})[w.id])); return { id: w.id, name: w.name || '', values, total: Math.round(values.reduce((a, b) => a + b, 0) * 10) / 10 }; });
  const dayTotals2 = keys.map((k, i) => Math.round(rows.reduce((a, r) => a + r.values[i], 0) * 10) / 10);
  return { days, keys, rows, dayTotals: dayTotals2, grand: Math.round(rows.reduce((a, r) => a + r.total, 0) * 10) / 10 };
}
