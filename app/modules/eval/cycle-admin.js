/* 평가 회차 관리 — 순수 규칙(화면·네트워크 없이 시험 가능). 보안 규칙(eval_cycles)·서버 함수(evalAct)와 같은 약속.
 *  상태: draft(준비) → open(진행) → closed(마감) → published(공개). 마감·공개된 회차는 다시 열 수 없다(재개방 후 재집계 → 평균 변화로 개인 점수 역산 방지). */
import { isEvalTarget, teamTypeOf, teamLeaderOf } from './evaluation.js?v=20261031a';
export const STATES = ['draft', 'open', 'closed', 'published'];
export const STATE_TEXT = { draft: '준비', open: '진행', closed: '마감', published: '공개' };
const rank = (s) => STATES.indexOf(s);
/** 다음에 할 수 있는 단계(한 칸 앞으로만) — 없으면 null */
export const nextState = (s) => { const i = rank(s); return i >= 0 && i < STATES.length - 1 ? STATES[i + 1] : null; };
/** 이 상태에서 이 상태로 바꿀 수 있는가(보안 규칙과 같은 기준: 앞으로만, 마감·공개는 되돌리지 못함) */
export function canMove(from, to) { const a = rank(from === undefined || from === null ? 'draft' : from), b = rank(to); if (a < 0 || b < 0) return false; if (b < a) return false; if ((from === 'closed' || from === 'published') && (to === 'draft' || to === 'open')) return false; return b !== a; }
export const MOVE_TEXT = { open: '평가 시작(진행)', closed: '평가 마감', published: '결과 공개' };
export const MOVE_WARN = { open: '직원에게 내 평가가 열립니다. 과제가 배정된 직원만 작성할 수 있습니다.', closed: '마감하면 직원은 더 이상 작성·수정할 수 없고, 마감한 회차는 다시 열 수 없습니다.', published: '결과를 공개하면 본인 결과를 볼 수 있게 됩니다(올해는 참고자료).' };

/** 과제 생성에 넘길 구성원: 평가 대상(해당 연도·직원) 중 동료평가를 하는 PJT팀만(대표님 확정 — 일단 PJT팀). uid 는 포털 계정과 연결된 근로자만 있다.
 *  isLead = 직원 관리에서 팀장으로 지정된 사람(없으면 팀 최상급자 — teamLeaderOf 와 같은 기준) */
export function buildMembers(year, workers, users) {
  const eligible = (workers || []).filter((w) => isEvalTarget(w, year) && teamTypeOf(w.dept) === 'pjt'); const byDept = {};
  eligible.forEach((w) => { const d = String(w.dept || '').trim(); (byDept[d] = byDept[d] || []).push(w); });
  const lead = {}; Object.keys(byDept).forEach((d) => { lead[d] = teamLeaderOf(d, byDept[d], users).workerId; });
  const uidOf = (w) => { const u = (users || []).find((x) => x && x.uid && ((w.portalUid && w.portalUid === x.uid) || (w.empNo && x.empNo && String(w.empNo) === String(x.empNo)))); return u ? u.uid : ''; };
  const members = eligible.map((w) => ({ uid: uidOf(w), workerId: w.id, team: String(w.dept || '').trim(), name: w.name || '', isLead: lead[String(w.dept || '').trim()] === w.id }));
  return { members, noAccount: members.filter((m) => !m.uid), total: members.length };
}
/** 과제 생성 전 점검 문구(없으면 빈 목록): 대상자 없음·팀원이 1명뿐인 팀(동료평가 불가)·팀장 없음 */
export function taskWarnings(plan) {
  const out = []; const byTeam = {}; (plan.members || []).forEach((m) => { (byTeam[m.team] = byTeam[m.team] || []).push(m); });
  if (!plan.total) out.push('평가 대상자가 없습니다(PJT팀 직원의 입사일·소속을 확인해 주세요).');
  Object.entries(byTeam).forEach(([t, ms]) => { if (ms.length < 3) out.push(t + ': 팀원이 ' + ms.length + '명이라 동료평가가 2명 미만이 되어 평균을 반영할 수 없습니다(익명 보호를 위해 평가자 2명 이상 필요).'); if (!ms.some((m) => m.isLead)) out.push(t + ': 팀장이 없습니다. 직원 관리에서 지정해 주세요.'); });
  if (plan.noAccount && plan.noAccount.length) out.push('포털 계정과 연결되지 않아 평가를 쓸 수 없는 직원 ' + plan.noAccount.length + '명: ' + plan.noAccount.map((m) => m.name || m.workerId).join(', ') + ' — 직원 관리에서 계정 연결을 확인해 주세요(사장단이 대신 입력할 수도 있습니다).');
  return out;
}
