/* 직원 관리(관리자)의 순수 규칙 — 화면·네트워크 없이 시험한다 */
import { byEmpNo, RANK_ORDER } from '../../shared/org.js?v=20261007e';
import { isPhone } from '../../core/profile-logic.js?v=20261007e';

/** 포털 모듈 권한(옛 포털의 MODULES 와 같은 키). 관리자는 권한과 무관하게 모두 열린다 */
export const PERM_KEYS = [['plan', '기획'], ['hr', '인사'], ['edoc', '전자결재'], ['pjt', 'PJT']];
export const hasPerm = (u, k) => !!(u && u.perms && u.perms[k] === true);
/** 사번 숫자 순서(사번 없는 사람은 뒤) */
export const sortStaff = (users) => (users || []).slice().sort(byEmpNo);
export const ranksFor = (current) => { const c = String(current || '').trim(); return c && RANK_ORDER.indexOf(c) === -1 ? RANK_ORDER.concat([c]) : RANK_ORDER.slice(); };
const norm = (v) => String(v == null ? '' : v).trim();
/** 직원 상세 입력 검사 → 안내 문구('' = 통과). 사번은 다른 계정과 겹치면 안 된다(대소문자 무시) */
export function validateStaffForm(f, users, uid) {
  if (!norm(f.name)) return '이름을 입력해 주세요.';
  const e = norm(f.empNo).toLowerCase();
  if (e && (users || []).some((u) => u.uid !== uid && norm(u.empNo).toLowerCase() === e)) return '같은 사번을 쓰는 계정이 이미 있습니다.';
  if (norm(f.phone) && !isPhone(norm(f.phone))) return '전화번호 형식을 확인해 주세요. (예: 010-1234-5678)';
  return '';
}
/** 저장할 계정 필드(공백 정리) */
export const staffUpdate = (f) => ({ name: norm(f.name), empNo: norm(f.empNo), rank: norm(f.rank), dept: norm(f.dept), phone: norm(f.phone) });
/** 인사 명부(workers) 중 이 계정에 연결된 것 */
export const linkedWorkerOf = (workers, uid) => (workers || []).find((w) => w.portalUid === uid) || null;
/** 아직 계정에 연결되지 않은 명부 항목 중 사번이 같은 것, 없으면 이름이 같은 것이 딱 하나일 때 그것 */
export function findWorkerMatch(workers, user) {
  const free = (workers || []).filter((w) => !w.portalUid); const e = norm(user && user.empNo).toLowerCase();
  if (e) { const hit = free.filter((w) => norm(w.empNo).toLowerCase() === e); if (hit.length === 1) return hit[0]; if (hit.length > 1) return null; }
  const n = norm(user && user.name); if (!n) return null; const byName = free.filter((w) => norm(w.name) === n); return byName.length === 1 ? byName[0] : null;
}
/** 명부 항목에도 같이 맞춰 줄 필드(인사 화면이 쓰는 것과 같은 이름) */
export const workerSync = (upd) => ({ name: upd.name, empNo: upd.empNo, rank: upd.rank, dept: upd.dept, phone: upd.phone });
