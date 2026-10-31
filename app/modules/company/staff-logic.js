/* 직원 관리(관리자)의 순수 규칙 — 화면·네트워크 없이 시험한다 */
import { byEmpNo, RANK_ORDER } from '../../shared/org.js?v=20261031h';
import { isPhone } from '../../core/profile-logic.js?v=20261031h';

/** 포털 모듈 권한(옛 포털의 MODULES 와 같은 키). 관리자는 권한과 무관하게 모두 열린다 */
export const PERM_KEYS = [['plan', '영업기획'], ['hr', '인사총무'], ['finance', '재무회계'], ['edoc', '전자결재'], ['pjt', 'PJT'], ['hrEval', '인사평가']];   // 인사평가 = 다른 사람의 평가를 열람·운영(입력·확정은 사장단)
export const isTeamLead = (u) => !!(u && u.teamLead === true);
/** 팀장 지정: 같은 팀(부서)에는 한 명만. 새로 지정하면 같은 팀의 기존 팀장은 자동으로 해제된다. 돌려주는 값 = 바꿀 { uid: true|false } */
export function teamLeadChanges(users, uid, on) {
  const u = (users || []).find((x) => x && x.uid === uid); if (!u) return {};
  const out = { [uid]: !!on }; if (!on) return out; const d = String(u.dept || '').trim(); if (!d) return out;
  (users || []).forEach((x) => { if (x && x.uid !== uid && x.teamLead === true && String(x.dept || '').trim() === d) out[x.uid] = false; });
  return out;
}
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

/** 새 계정 입력 검사(서버 규칙과 같음 — 서버가 다시 검사한다). 안내 문구('' = 통과) */
export const ID_RE = /^[a-z0-9][a-z0-9._-]{1,29}$/;
/** 본인 이메일 로그인(계약직·GUEST) 이메일 검사(서버와 같음). 회사 이메일(@jhsol.kr)은 아이디 방식이라 거부, 이미 쓰는 이메일 거부. 안내 문구('' = 통과) */
export const EXT_EMAIL_RE = /^[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9-]+(\.[a-z0-9-]+)+$/;
export function validateExtEmail(raw, users, uid) {
  const e = norm(raw).toLowerCase(); if (!e || e.length > 100 || !EXT_EMAIL_RE.test(e)) return '이메일 주소 형식을 확인해 주세요.';
  if (e.endsWith('@jhsol.kr')) return '회사 이메일(@jhsol.kr)은 아이디 방식으로 만듭니다. 본인 이메일 로그인에는 다른 이메일 주소를 입력해 주세요.';
  if ((users || []).some((u) => u && u.uid !== uid && norm(u.email).toLowerCase() === e)) return '이미 사용 중인 이메일입니다.';
  return '';
}
export function validateNewAccount(f, users) {
  if (norm(f.email)) { const bad = validateExtEmail(f.email, users, ''); return bad || validateStaffForm(f, users, ''); }   // 본인 이메일 로그인(아이디 없이)
  const id = norm(f.id).toLowerCase(); if (!ID_RE.test(id)) return '아이디는 영문 소문자·숫자·점·밑줄·하이픈으로 2~30자여야 합니다.';
  if ((users || []).some((u) => norm(u.email).toLowerCase() === id + '@jhsol.kr')) return '이미 있는 아이디입니다.';
  return validateStaffForm(f, users, '');
}
/** GUEST 로그인 아이디 재설정 입력 검사(서버 규칙과 같음). users = 포털 계정 목록, uid = 대상 계정. 안내 문구('' = 통과) */
export function validateLoginId(rawId, users, uid) {
  const id = norm(rawId).toLowerCase(); if (!ID_RE.test(id)) return '아이디는 영문 소문자·숫자·점·밑줄·하이픈으로 2~30자여야 합니다.';
  if ((users || []).some((u) => u && u.uid !== uid && norm(u.email).toLowerCase() === id + '@jhsol.kr')) return '이미 있는 아이디입니다.';
  return '';
}
export const newAccountPayload = (f) => Object.assign({ action: 'createAccount', perms: f.perms || {} }, norm(f.email) ? { email: norm(f.email).toLowerCase() } : { id: norm(f.id).toLowerCase() }, staffUpdate(f));
/** 서버 함수 호출 실패를 사람이 읽는 문구로. 서버가 보낸 한글 메시지는 그대로, 아니면(함수 미배포·네트워크 등) 일반 안내 */
export function callMessage(e) {
  const m = String((e && e.message) || ''); if (/[가-힣]/.test(m)) return m;
  return '서버 함수(adminAct)를 호출하지 못했습니다. 함수가 아직 배포되지 않았거나 네트워크 문제일 수 있습니다.';
}
export const resetMailMessage = (e) => ((e && e.code) === 'auth/user-not-found' ? '이 메일 주소의 로그인 계정이 없습니다.' : (e && e.code) === 'auth/too-many-requests' ? '요청이 많아 잠시 후 다시 시도해 주세요.' : '재설정 메일을 보내지 못했습니다.');
