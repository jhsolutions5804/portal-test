/* 포털 관리의 순수 규칙 — 화면·네트워크 없이 시험한다 */
import { participantsOf, normalizeParticipants } from '../../shared/pjt-access.js?v=20261007c';
import { isGuestUser, byRank, NO_DEPT } from '../../shared/org.js?v=20261007c';

export const FIXED_PJT = [{ id: 'p4ph2', name: 'P4 Ph2 (FAB)' }, { id: 'p4ph4', name: 'P4 Ph4 (SUP)' }];
/** 고정 PJT(FAB·SUP) + 경량 PJT(등록 순) → 화면 목록. 종료된 것은 뒤로 */
export function buildProjects(settings, registry) {
  const byId = {}; (settings || []).forEach((d) => { byId[d.id] = d; });
  const fixed = FIXED_PJT.map((f) => { const d = byId[f.id] || {}; return { kind: 'fixed', id: f.id, key: f.id, name: d.name || f.name, status: d.status === 'ended' ? 'ended' : 'active', participants: participantsOf(d), exists: !!byId[f.id] }; });
  const light = (registry || []).map((d) => ({ kind: 'light', id: d.id, key: 'reg_' + d.id, name: d.name || 'PJT', status: d.status === 'ended' ? 'ended' : 'active', participants: participantsOf(d), exists: true }));
  const all = fixed.concat(light); return all.filter((p) => p.status !== 'ended').concat(all.filter((p) => p.status === 'ended'));
}
export const toggleTeam = (p, team) => { const t = participantsOf({ participants: p }); const i = t.teams.indexOf(team); if (i === -1) t.teams.push(team); else t.teams.splice(i, 1); return t; };
export const addMember = (p, uid) => { const t = participantsOf({ participants: p }); if (uid && t.members.indexOf(uid) === -1) t.members.push(uid); return t; };
export const removeMember = (p, uid) => { const t = participantsOf({ participants: p }); t.members = t.members.filter((x) => x !== uid); return t; };
/** 선택 가능한 개인: 승인 직원(GUEST 제외), 부서 → 직급 → 사번 순 */
export function selectableUsers(users) {
  return (users || []).filter((u) => (!u.status || u.status === 'approved') && !isGuestUser(u)).slice().sort((a, b) => String(a.dept || '~').localeCompare(String(b.dept || '~'), 'ko') || byRank(a, b));
}
export const userLabel = (u) => (u.name || '-') + ' (' + [u.rank, u.dept || NO_DEPT].filter(Boolean).join(' · ') + ')';
export function summaryText(p, usersByUid) {
  const t = participantsOf({ participants: p }); if (!t.teams.length && !t.members.length) return '지정 없음 — PJT 권한이 있는 사람 모두';
  const names = t.members.map((id) => (usersByUid && usersByUid[id] ? usersByUid[id].name : '(알 수 없는 계정)'));
  return [t.teams.length ? '부서 ' + t.teams.join('·') : '', names.length ? '개인 ' + names.slice(0, 3).join('·') + (names.length > 3 ? ' 외 ' + (names.length - 3) + '명' : '') : ''].filter(Boolean).join(' / ');
}
export const sameParticipants = (a, b) => JSON.stringify(normalizeParticipants(a)) === JSON.stringify(normalizeParticipants(b));
