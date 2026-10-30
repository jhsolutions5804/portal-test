/* 내 팀 공수표 — 순수 규칙(화면·네트워크 없이 시험 가능). 팀장은 관리자가 지정한 자기 팀(portal_users.teamLeaderIds), 관리자는 재직 팀장 전체의 팀을 본다.
 * 사람은 마스터 id 로 묶어(월간 공수 집계 aggregateMonth 의 persons) 팀·프로젝트별 공수와 노무비(= 공수 × 팀 단가)를 낸다. 모든 프로젝트(종료 포함)의 공수를 합친다. */
import { monthGrid } from './schedule.js?v=20261031a';
const r1 = (n) => Math.round(n * 10) / 10;
export const won = (n) => (Math.round(n) || 0).toLocaleString('ko-KR');
/** 단가 입력 → 정수(숫자만) */
export const parseRate = (v) => parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10) || 0;
const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko');
/** 보여 줄 팀 목록. masters = { id: { name, birth, leaderId, resigned } }.
 *  관리자: 팀장(leaderId 없고 퇴사 아님) 전부, 팀장: teamIds 의 마스터(없으면 missing 에 id) → { teams:[{ leader:{id,…}, members:[{id,…}] }], missing:[id] } */
export function teamsOf(masters, opts) {
  const M = masters || {}; const all = Object.keys(M).map((id) => Object.assign({ id }, M[id])); const membersOf = (lid) => all.filter((m) => m.leaderId === lid).sort(byName);
  if (opts && opts.admin) return { teams: all.filter((m) => !m.leaderId && !m.resigned).sort(byName).map((l) => ({ leader: l, members: membersOf(l.id) })), missing: [] };
  const teams = [], missing = []; ((opts && opts.teamIds) || []).forEach((id) => { if (M[id]) teams.push({ leader: Object.assign({ id }, M[id]), members: membersOf(id) }); else missing.push(id); });
  return { teams, missing };
}
/** 팀별 정리. agg = aggregateMonth 결과, rates = { 팀장id: { rate: 숫자|null, err: 조회 실패 } } → [{ t, people[{m,isLeader,total,byPjt,byDate}], md, byPjt, amount(단가 없으면 null) }] */
export function teamView(teams, agg, rates) {
  const P = {}; ((agg && agg.persons) || []).forEach((p) => { if (p.masterId) P[p.masterId] = p; });
  return (teams || []).map((t) => {
    const people = [t.leader].concat(t.members).map((m, i) => { const x = P[m.id] || { total: 0, byPjt: {}, byDate: {} }; return { m, isLeader: i === 0, total: x.total, byPjt: x.byPjt, byDate: x.byDate }; });
    const md = r1(people.reduce((s, x) => s + x.total, 0)); const byPjt = {}; people.forEach((x) => Object.keys(x.byPjt).forEach((pn) => { byPjt[pn] = r1((byPjt[pn] || 0) + x.byPjt[pn]); }));
    const rc = (rates || {})[t.leader.id] || { rate: null, err: false }; return { t: Object.assign({}, t, { rate: rc.rate, rateErr: !!rc.err }), people, md, byPjt, amount: rc.rate == null ? null : Math.round(md * rc.rate) };
  });
}
/** 전체 요약(팀이 둘 이상일 때 맨 위에): 팀 수·전체 공수·노무비 합계(단가 있는 팀만) */
export function summaryOf(view) { const priced = (view || []).filter((v) => v.amount != null); return { teams: (view || []).length, md: r1((view || []).reduce((a, v) => a + v.md, 0)), amount: priced.reduce((a, v) => a + v.amount, 0), priced: priced.length }; }
/** 달력 칸용 프로젝트 약칭 */
export const abbr = (pn) => (pn === 'P4 Ph2 (FAB)' ? 'FAB' : pn === 'P4 Ph4 (SUP)' ? 'SUP' : String(pn).length > 6 ? String(pn).slice(0, 6) + '…' : String(pn));
/** 개인 공수표 달력: 주 × 7칸 [{ k(날짜)|null, total, lines:[{ pjt, abbr, amount }] }] */
export function calendarOf(y, m, byDate) {
  return monthGrid(y, m).map((week) => week.map((k) => { if (!k) return { k: null, total: 0, lines: [] }; const dd = (byDate || {})[k] || {}; const lines = Object.keys(dd).map((pjt) => ({ pjt, abbr: abbr(pjt), amount: r1(dd[pjt]) })); return { k, total: r1(lines.reduce((a, l) => a + l.amount, 0)), lines }; }));
}
