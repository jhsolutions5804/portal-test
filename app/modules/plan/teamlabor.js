/* 영업기획 팀별 노무비 — 순수 규칙(화면·네트워크 없이 시험 가능). 구포털 기획(gihoek)의 팀별 노무비 집계를 그대로 옮겼다.
 * 팀 = 팀장(근로자 마스터에서 leaderId 가 없는 사람) + 팀원. 팀 공수 = 팀장+팀원 공수 합계, 노무비 = 팀 공수 × 팀 단가(원/공수, 팀장별).
 * 공수는 종료되지 않은 모든 PJT 프로젝트(pjt_registry/<id>)의 일자별 공수 문서(md 맵: 근로자 id → 공수)를 읽고, 각 프로젝트의 근로자 명부에 있는 사람만 더한다. 같은 사람은 이름|생년월일로 묶는다. */
const pad = (n) => String(n).padStart(2, '0');
/** 월 이동(구포털 tlShift): m 은 0~11 */
export function shiftMonth(ym, dir) { let y = ym.y, m = ym.m + dir; if (m > 11) { m = 0; y++; } if (m < 0) { m = 11; y--; } return { y, m }; }
/** 월 문서 범위(문서 번호가 날짜라서 범위 조회): 1일부터 31일까지 */
export const monthRange = (ym) => ({ lo: ym.y + '-' + pad(ym.m + 1) + '-01', hi: ym.y + '-' + pad(ym.m + 1) + '-31' });
export const monthLabel = (ym) => ym.y + '년 ' + (ym.m + 1) + '월';
/** 명부 한 줄: 근로자 마스터가 있으면 마스터의 이름·생년월일, 없으면 명부의 값(둘 다 없으면 이름 없음) */
export const rosterEntry = (id, w, master, label, regId) => ({ id, name: (master && master.name) || (w && w.name) || '(이름없음)', birth: (master && master.birth) || (w && w.birth) || '', label, regId });
/** 일자별 공수 문서들을 근로자(이름|생년월일)별로 합산. o = { roster: [rosterEntry…], rows: { <프로젝트 id>: [[날짜, md 맵], …] }, regs: [{ id, name }] } */
export function aggregateMandays(o) {
  const pmap = {}; const add = (w, a, pn) => { const k = (w.name || '').trim() + '|' + (w.birth || 'MISSING'); const P = pmap[k] || (pmap[k] = { name: w.name, birth: w.birth, total: 0, byPjt: {} }); P.total += a; P.byPjt[pn] = (P.byPjt[pn] || 0) + a; };
  (o.regs || []).forEach((rg) => { const by = {}; (o.roster || []).filter((w) => w.regId === rg.id).forEach((w) => { by[w.id] = w; }); ((o.rows || {})[rg.id] || []).forEach(([dk, md]) => Object.keys(md).forEach((id) => { const a = parseFloat(md[id]) || 0; if (a && by[id]) add(by[id], a, rg.name); })); });
  return pmap;
}
export const teamRateOf = (leader, rate) => (rate && rate[leader.id] != null ? rate[leader.id] : (Number(leader.teamRate) || 0));
/** 팀별 집계(구포털 drawTeamLabor): 팀(팀장+팀원) 공수·단가·노무비, 프로젝트별 공수, 팀에 속하지 않은 인원 */
export function buildTeams(masters, rate, pmap) {
  const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'ko'); const keys = Object.keys(pmap);
  const totalOf = (m) => { const k = keys.find((k) => pmap[k].name === m.name && pmap[k].birth === m.birth); return k ? pmap[k] : null; };
  const leaders = (masters || []).filter((m) => !m.leaderId).sort(byName); const used = new Set(); let grandMd = 0, grandAmt = 0;
  const teams = leaders.map((l) => {
    const members = (masters || []).filter((m) => m.leaderId === l.id).sort(byName);
    const people = [l, ...members].map((m) => { const p = totalOf(m); if (p) used.add(keys.find((k) => pmap[k] === p)); return { m, md: p ? p.total : 0, byPjt: p ? p.byPjt : {} }; });
    const md = people.reduce((s, x) => s + x.md, 0), r = teamRateOf(l, rate), amt = Math.round(md * r); const byPjt = {}; people.forEach((x) => Object.keys(x.byPjt).forEach((pn) => { byPjt[pn] = (byPjt[pn] || 0) + x.byPjt[pn]; }));
    grandMd += md; grandAmt += amt; return { l, members, people, md, r, amt, byPjt };
  }).sort((a, b) => b.amt - a.amt || b.md - a.md);
  const unassigned = keys.filter((k) => !used.has(k)).map((k) => pmap[k]); const unMd = unassigned.reduce((s, p) => s + p.total, 0);
  return { teams, unassigned, unMd, grandMd, grandAmt };
}
/** 팀 단가 입력(구포털 tlEditRate): 숫자만 남기고, 비어 있으면 0 */
export const parseTeamRate = (inp) => parseInt(String(inp == null ? '' : inp).replace(/[^0-9]/g, '')) || 0;
export const ratePatch = (v) => ({ teamRate: v });   // master_worker_private/<팀장>(관리자 전용)과 team_rates/<팀장>(관리자+그 팀 팀장, updatedAt 은 저장할 때 서버 시각) 두 곳에 같은 값을 저장
export function rateSaveMessage(okPriv, okRate, errMsg) {
  if (okPriv && okRate) return '팀 단가를 저장했습니다.';
  if (okPriv) return '⚠️ 팀 단가는 저장됐지만 팀장 조회용 문서에는 저장되지 않았습니다 (' + errMsg + '). 다시 저장해 주세요.';
  return '저장 실패: ' + errMsg;
}
